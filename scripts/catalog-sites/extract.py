"""Extract NeoDB's supported-site URL rules as JSON.

Reads a copy of upstream's ``neodb/catalog/sites/`` package and reports the
sites in *registration order* — the order matters, because NeoDB resolves a URL
with ``next(filter(...))`` over the registry: the first site whose pattern
matches wins.

Each site reports the patterns that decide whether a URL belongs to it:

* ``patterns`` — ``URL_PATTERNS``, checked by ``validate_url``
* ``fallback_patterns`` — the pattern-shaped part of the sites that override
  ``validate_url_fallback`` (``URL_PATTERN_FALLBACK``, ``SLUG_PATTERNS``),
  consulted only when no site matched on the primary patterns

Written as a script rather than folded into the TypeScript generator because
Python's own ``ast`` handles the source exactly — string concatenation across
lines, module constants, ``"|".join(...)`` — where a text scraper would have to
reimplement it and would trip over brackets inside the patterns themselves.
"""

from __future__ import annotations

import ast
import json
import pathlib
import sys

UNKNOWN = object()

FALLBACK_PATTERN_NAMES = (
    "URL_PATTERN_FALLBACK",
    "URL_PATTERNS_FALLBACK",
    "SLUG_PATTERNS",
)


def evaluate(node: ast.AST, resolve) -> object:
    """Evaluate the expressions the site classes actually use for patterns."""
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return node.value

    if isinstance(node, ast.Name):
        return resolve(node.id)

    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        left = evaluate(node.left, resolve)
        right = evaluate(node.right, resolve)

        if isinstance(left, str) and isinstance(right, str):
            return left + right

        if isinstance(left, list) and isinstance(right, list):
            return left + right

        return UNKNOWN

    if isinstance(node, (ast.Tuple, ast.List, ast.Set)):
        items = [evaluate(element, resolve) for element in node.elts]

        return items if all(isinstance(item, str) for item in items) else UNKNOWN

    if (
        isinstance(node, ast.Call)
        and isinstance(node.func, ast.Attribute)
        and node.func.attr == "join"
    ):
        separator = evaluate(node.func.value, resolve)
        sequence = evaluate(node.args[0], resolve) if node.args else UNKNOWN

        if isinstance(separator, str) and isinstance(sequence, list):
            return separator.join(sequence)

        return UNKNOWN

    try:
        value = ast.literal_eval(node)
    except Exception:
        return UNKNOWN

    return value if isinstance(value, (str, list, tuple)) else UNKNOWN


def module_env(tree: ast.Module):
    """Resolve module-level names lazily, so declaration order never matters."""
    assignments: dict[str, ast.AST] = {}

    for node in tree.body:
        if isinstance(node, ast.Assign):
            for target in node.targets:
                if isinstance(target, ast.Name):
                    assignments[target.id] = node.value
        elif isinstance(node, ast.AnnAssign) and isinstance(node.target, ast.Name):
            if node.value is not None:
                assignments[node.target.id] = node.value

    resolving: set[str] = set()

    def resolve(name: str):
        if name in resolving or name not in assignments:
            return UNKNOWN

        resolving.add(name)

        try:
            return evaluate(assignments[name], resolve)
        finally:
            resolving.discard(name)

    return resolve


def class_fields(node: ast.ClassDef, module_resolve) -> dict[str, object]:
    """Field values plus the class-level names they refer to.

    Constants live either at module level (``_HOST``) or in the class body
    (``_GOOGLE_HOST``), and a class body's own names shadow the module's.
    """
    raw: dict[str, ast.AST] = {}

    for statement in node.body:
        if isinstance(statement, ast.Assign):
            targets = [
                target.id
                for target in statement.targets
                if isinstance(target, ast.Name)
            ]
            value = statement.value
        elif isinstance(statement, ast.AnnAssign) and isinstance(
            statement.target, ast.Name
        ):
            targets = [statement.target.id]
            value = statement.value
        else:
            continue

        if value is not None:
            for target in targets:
                raw[target] = value

    resolving: set[str] = set()

    def resolve(name: str):
        if name in resolving:
            return UNKNOWN

        if name in raw:
            resolving.add(name)

            try:
                return evaluate(raw[name], resolve)
            finally:
                resolving.discard(name)

        return module_resolve(name)

    fields: dict[str, object] = {}

    for name, value in raw.items():
        # ID_TYPE / SITE_NAME are enum members (`IdType.IMDB`) — the member
        # name is all a client can use, since the labels are upstream i18n.
        fields[name] = (
            value.attr if isinstance(value, ast.Attribute) else evaluate(value, resolve)
        )

    return fields


def string_list(value: object) -> list[str]:
    if isinstance(value, str):
        return [value]

    if isinstance(value, list):
        return [item for item in value if isinstance(item, str)]

    return []


def inherited_fields(node: ast.ClassDef, classes: dict[str, ast.ClassDef], module_resolve):
    """A class's fields, falling back to the bases declared in this module.

    Several sites split a base class (which names the site) from per-category
    subclasses (which name the id type), so a field may only exist upstream of
    the class that gets registered.
    """
    fields = class_fields(node, module_resolve)

    for base in node.bases:
        if isinstance(base, ast.Name) and base.id in classes:
            for key, value in inherited_fields(
                classes[base.id], classes, module_resolve
            ).items():
                fields.setdefault(key, value)

    return fields


def collect(sites_dir: pathlib.Path) -> list[dict[str, object]]:
    init_tree = ast.parse((sites_dir / "__init__.py").read_text("utf-8"))
    imports: list[tuple[str, list[str]]] = []

    for node in init_tree.body:
        if isinstance(node, ast.ImportFrom) and node.level == 1 and node.module:
            imports.append((node.module, [alias.name for alias in node.names]))

    sites: list[dict[str, object]] = []

    for module, imported in imports:
        path = sites_dir / f"{module}.py"

        if not path.exists():
            print(f"skipping {module}: no module", file=sys.stderr)
            continue

        tree = ast.parse(path.read_text("utf-8"))
        resolve = module_env(tree)
        classes = {
            node.name: node for node in tree.body if isinstance(node, ast.ClassDef)
        }

        for node in tree.body:
            if not isinstance(node, ast.ClassDef) or node.name not in imported:
                continue

            fields = inherited_fields(node, classes, resolve)
            fallback: list[str] = []

            for name in FALLBACK_PATTERN_NAMES:
                fallback.extend(string_list(fields.get(name)))

            sites.append(
                {
                    "className": node.name,
                    "idType": fields.get("ID_TYPE") or node.name,
                    "module": module,
                    "patterns": string_list(fields.get("URL_PATTERNS")),
                    "siteName": fields.get("SITE_NAME") or node.name,
                    "fallbackPatterns": fallback,
                }
            )

    return sites


def main() -> None:
    if len(sys.argv) != 2:
        print("usage: extract.py <path-to-neodb/catalog/sites>", file=sys.stderr)
        sys.exit(2)

    sites = collect(pathlib.Path(sys.argv[1]))
    print(json.dumps({"sites": sites}, ensure_ascii=False, indent=1))


if __name__ == "__main__":
    main()
