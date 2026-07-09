import { visit } from "unist-util-visit";
import type { Element, Root, Text } from "hast";

export function remarkSpoiler() {
  return (tree: Root) => {
    visit(tree, "text", (node: Text, index, parent: Element | Root | null) => {
      if (!parent || index === undefined) {
        return;
      }

      const regex = />!([^!]+)!</g;
      const matches = [...node.value.matchAll(regex)];

      if (!matches.length) {
        return;
      }

      const nodes: Array<Text | Element> = [];
      let cursor = 0;

      for (const match of matches) {
        if (match.index > cursor) {
          nodes.push({
            type: "text",
            value: node.value.slice(cursor, match.index),
          });
        }

        nodes.push({
          type: "element",
          tagName: "spoiler",
          properties: {},
          children: [{ type: "text", value: match[1] }],
        });

        cursor = match.index + match[0].length;
      }

      if (cursor < node.value.length) {
        nodes.push({
          type: "text",
          value: node.value.slice(cursor),
        });
      }

      parent.children.splice(index, 1, ...nodes);
    });
  };
}
