// Minimal mock NeoDB instance for the e2e suite. Zero dependencies.
//
// Serves just enough of NeoDB's own API (/api/...) and its
// Mastodon-compatible surface (/api/v1/...) for the app's server-side
// proxy routes and SSR pages. State that tests mutate (shelf marks,
// posted replies) is held in memory; restart the server for a clean slate
// (Playwright starts a fresh one per run).
import http from "node:http";
import {
  initialShelfMarks,
  items,
  me,
  MOCK_PORT,
  myBridgedFediverseAccount,
  myMastodonAccount,
  notifications,
  otherAccount,
  otherCommentStatus,
  ownCommentStatus,
  timelineStatuses,
  TINY_PNG,
} from "./fixtures.mjs";

const accountsById = new Map(
  [myMastodonAccount, otherAccount, myBridgedFediverseAccount].map((account) => [
    account.id,
    account,
  ]),
);

const itemList = Object.values(items);
const itemsByUuid = new Map(itemList.map((item) => [item.uuid, item]));

// Mutable state.
const shelfMarks = new Map(Object.entries(initialShelfMarks));
const statuses = new Map(
  [ownCommentStatus, otherCommentStatus].map((status) => [status.id, status]),
);
const repliesByPostId = new Map();
let nextReplyId = 800000000000000001n;

// Item posts (the item detail community section), keyed by uuid.
const itemPosts = new Map([
  [items.book.uuid, { comment: [otherCommentStatus, ownCommentStatus], review: [] }],
]);

function json(res, payload, status = 200) {
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(JSON.stringify(payload));
}

// NeoDB's own (non-Mastodon-compatible) endpoints — /api/me/shelf,
// /api/me/review, /api/item/{uuid}/posts/ — emit id-bearing fields as bare
// (unquoted) JSON numbers even when they exceed Number.MAX_SAFE_INTEGER.
// Reproduce that faithfully, for the given field names, so the suite locks
// in the app's safe parsing.
function jsonWithRawIds(res, payload, fieldNames, status = 200) {
  const pattern = new RegExp(`"(${fieldNames.join("|")})":"(-?\\d+)"`, "g");
  const text = JSON.stringify(payload).replace(pattern, '"$1":$2');
  res.writeHead(status, { "Content-Type": "application/json" });
  res.end(text);
}

function notFound(res) {
  json(res, { detail: "Not found." }, 404);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
  });
}

function toMarkResponse(mark) {
  return {
    comment_text: mark.comment_text ?? "",
    created_time: mark.created_time ?? null,
    item: mark.item,
    post_id: mark.post_id ?? null,
    rating_grade: mark.rating_grade ?? 0,
    shelf_type: mark.shelf_type,
    tags: mark.tags ?? [],
    visibility: mark.visibility ?? 0,
  };
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${MOCK_PORT}`);
  const path = url.pathname.replace(/\/+$/, "") || "/";
  const method = req.method || "GET";

  // --- Static image bytes (covers, avatars) ---
  if (path.startsWith("/m/")) {
    res.writeHead(200, { "Content-Type": "image/png" });
    res.end(TINY_PNG);
    return;
  }

  // --- Trending ---
  const trending = path.match(/^\/api\/trending\/([a-z-]+)$/);
  if (trending && method === "GET") {
    if (trending[1] === "collection") {
      json(res, []);
      return;
    }
    const item = items[trending[1]];
    json(res, item ? [item] : []);
    return;
  }

  // --- Catalog search ---
  if (path === "/api/catalog/search" && method === "GET") {
    const query = url.searchParams.get("query") || "";
    const category = url.searchParams.get("category");
    const data = itemList.filter(
      (item) =>
        item.display_title.includes(query) &&
        (!category || category.split(",").includes(item.category)),
    );
    json(res, { count: data.length, data, pages: 1 });
    return;
  }

  // --- Item posts (community comments/reviews) ---
  const posts = path.match(/^\/api\/item\/([^/]+)\/posts$/);
  if (posts && method === "GET") {
    const type = url.searchParams.get("type") || "comment";
    const entries = itemPosts.get(posts[1])?.[type] || [];
    // Like real NeoDB: this endpoint emits post id and account id (both keyed
    // "id" at their respective nesting level) as bare numbers, unlike the
    // Mastodon-compatible /api/v1/* surface.
    jsonWithRawIds(res, { count: entries.length, data: entries, pages: 1 }, ["id"]);
    return;
  }

  // --- Item detail (any /api/{category...}/{uuid} shape) ---
  const itemDetail = path.match(/^\/api\/(?:book|movie|tv|album|game|podcast|performance)(?:\/(?:season|episode|production))?\/([^/]+)$/);
  if (itemDetail && method === "GET") {
    const item = itemsByUuid.get(itemDetail[1]);
    if (item) {
      json(res, item);
    } else {
      notFound(res);
    }
    return;
  }

  // --- Collections (none configured on the mock) ---
  if (path.startsWith("/api/collection/")) {
    notFound(res);
    return;
  }

  // --- Current user ---
  if (path === "/api/me" && method === "GET") {
    json(res, me);
    return;
  }
  if (path === "/api/v1/accounts/verify_credentials" && method === "GET") {
    json(res, myMastodonAccount);
    return;
  }
  const accountById = path.match(/^\/api\/v1\/accounts\/([^/]+)$/);
  if (accountById && method === "GET") {
    const account = accountsById.get(accountById[1]);
    if (account) {
      json(res, account);
    } else {
      notFound(res);
    }
    return;
  }

  // --- Own shelf mark for one item (the raw-post_id endpoint) ---
  const shelfItem = path.match(/^\/api\/me\/shelf\/item\/([^/]+)$/);
  if (shelfItem) {
    const uuid = shelfItem[1];
    if (method === "GET") {
      const mark = shelfMarks.get(uuid);
      if (!mark) {
        notFound(res);
      } else {
        jsonWithRawIds(res, toMarkResponse(mark), ["post_id"]);
      }
      return;
    }
    if (method === "POST") {
      const body = JSON.parse((await readBody(req)) || "{}");
      const existing = shelfMarks.get(uuid);
      shelfMarks.set(uuid, {
        comment_text: body.comment_text ?? existing?.comment_text ?? "",
        created_time:
          body.created_time ?? existing?.created_time ?? new Date().toISOString(),
        item: itemsByUuid.get(uuid) || existing?.item || null,
        post_id: existing?.post_id ?? null,
        rating_grade: body.rating_grade ?? existing?.rating_grade ?? 0,
        shelf_type: body.shelf_type ?? existing?.shelf_type ?? "wishlist",
        tags: body.tags ?? existing?.tags ?? [],
        visibility: body.visibility ?? existing?.visibility ?? 0,
      });
      json(res, { message: "OK" });
      return;
    }
    if (method === "DELETE") {
      shelfMarks.delete(uuid);
      json(res, { message: "OK" });
      return;
    }
  }

  // --- Shelf listing ---
  const shelfList = path.match(/^\/api\/me\/shelf\/(wishlist|progress|complete|dropped)$/);
  if (shelfList && method === "GET") {
    const category = url.searchParams.get("category");
    const data = [...shelfMarks.values()]
      .filter((mark) => mark.shelf_type === shelfList[1] && mark.item)
      .filter((mark) => !category || mark.item.category === category)
      .map((mark) => ({
        comment_text: mark.comment_text,
        created_time: mark.created_time,
        item: mark.item,
        rating_grade: mark.rating_grade,
        shelf_type: mark.shelf_type,
      }));
    json(res, { count: data.length, data, pages: 1 });
    return;
  }

  // --- Own review for one item (none in fixtures) ---
  if (path.match(/^\/api\/me\/review\/item\/[^/]+$/) && method === "GET") {
    notFound(res);
    return;
  }

  // --- User calendar (profile heatmap) ---
  if (path.match(/^\/api\/user\/[^/]+\/calendar$/) && method === "GET") {
    json(res, {});
    return;
  }

  // --- Mastodon statuses ---
  const statusContext = path.match(/^\/api\/v1\/statuses\/([^/]+)\/context$/);
  if (statusContext && method === "GET") {
    // Like real NeoDB: unknown status ids (e.g. an id corrupted by unsafe
    // JSON number parsing, or a synthetic local- fallback id) 404 here.
    if (!statuses.has(statusContext[1])) {
      notFound(res);
      return;
    }
    json(res, {
      ancestors: [],
      descendants: repliesByPostId.get(statusContext[1]) || [],
    });
    return;
  }

  const statusById = path.match(/^\/api\/v1\/statuses\/([^/]+)$/);
  if (statusById && method === "GET") {
    const status = statuses.get(statusById[1]);
    if (status) {
      json(res, status);
    } else {
      notFound(res);
    }
    return;
  }
  if (statusById && method === "DELETE") {
    statuses.delete(statusById[1]);
    json(res, {});
    return;
  }

  if (path === "/api/v1/statuses" && method === "POST") {
    const form = new URLSearchParams(await readBody(req));
    const inReplyToId = form.get("in_reply_to_id");
    if (inReplyToId && !statuses.has(inReplyToId)) {
      notFound(res);
      return;
    }
    const reply = {
      account: myMastodonAccount,
      content: `<p>${form.get("status") || ""}</p>`,
      created_at: new Date().toISOString(),
      emojis: [],
      ext_neodb: null,
      favourited: false,
      favourites_count: 0,
      id: String(nextReplyId++),
      in_reply_to_id: inReplyToId,
      media_attachments: [],
      mentions: [],
      replies_count: 0,
      spoiler_text: "",
      url: null,
      visibility: form.get("visibility") || "public",
    };
    statuses.set(reply.id, reply);
    if (inReplyToId) {
      const list = repliesByPostId.get(inReplyToId) || [];
      list.push(reply);
      repliesByPostId.set(inReplyToId, list);
    }
    json(res, reply);
    return;
  }

  // --- Timelines / notifications / trends ---
  if (path === "/api/v1/timelines/home" && method === "GET") {
    json(res, timelineStatuses);
    return;
  }
  if (path === "/api/v1/notifications" && method === "GET") {
    json(res, notifications);
    return;
  }
  if (path === "/api/v1/trends/statuses" && method === "GET") {
    json(res, []);
    return;
  }
  if (path.match(/^\/api\/v1\/accounts\/[^/]+\/statuses$/) && method === "GET") {
    json(res, []);
    return;
  }

  notFound(res);
});

server.listen(MOCK_PORT, "127.0.0.1", () => {
  console.log(`[mock-neodb] listening on http://127.0.0.1:${MOCK_PORT}`);
});
