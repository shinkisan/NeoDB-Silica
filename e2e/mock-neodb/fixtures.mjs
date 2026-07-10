// Fixture data for the mock NeoDB server. Everything the thin e2e suite
// needs lives here; state that tests mutate (shelf marks, replies) is
// initialized from these values in server.mjs.

export const MOCK_PORT = 3199;
export const MOCK_ORIGIN = `http://127.0.0.1:${MOCK_PORT}`;

// Deliberately NOT representable as a JS double (> Number.MAX_SAFE_INTEGER,
// odd). NeoDB's own (non-Mastodon-compatible) endpoints — /api/me/shelf,
// /api/me/review, /api/item/{uuid}/posts/ — emit ids as bare JSON numbers; if
// the app ever regresses to plain JSON.parse on those responses, these ids
// corrupt and every later lookup by them fails.
export const OWN_COMMENT_POST_ID = "597971872949586301";
export const OTHER_COMMENT_POST_ID = "700000000000000001";
export const OTHER_ACCOUNT_ID = "600000000000000002";

export const me = {
  avatar: `${MOCK_ORIGIN}/m/avatars/me.png`,
  display_name: "测试用户",
  external_accounts: [],
  roles: [],
  url: "/users/testuser/",
  username: "testuser",
};

export const myMastodonAccount = {
  acct: "testuser",
  avatar: me.avatar,
  display_name: me.display_name,
  emojis: [],
  followers_count: 1,
  following_count: 2,
  id: "10001",
  statuses_count: 3,
  url: `${MOCK_ORIGIN}/users/testuser/`,
  username: "testuser",
};

function item({ apiCategory, category, uuid, title, brief, extra = {} }) {
  return {
    api_url: `/api/${apiCategory || category}/${uuid}`,
    brief,
    category,
    cover_image_url: `${MOCK_ORIGIN}/m/covers/${uuid}.png`,
    description: brief,
    display_title: title,
    external_resources: [],
    rating: 8.4,
    rating_count: 123,
    rating_distribution: [2, 3, 10, 45, 40],
    tags: ["测试", "端到端"],
    title,
    type: null,
    url: `/${category}/${uuid}`,
    uuid,
    ...extra,
  };
}

export const items = {
  book: item({
    category: "book",
    uuid: "e2ebook00000000000000001",
    title: "测试之书",
    brief: "一本专供端到端测试使用的书。",
    extra: {
      author: ["测试作者"],
      credits: [{ name: "测试作者", role: "author" }],
      pub_year: "2026",
    },
  }),
  movie: item({
    category: "movie",
    uuid: "e2emovie0000000000000001",
    title: "测试电影",
    brief: "一部专供端到端测试使用的电影。",
    extra: {
      credits: [{ name: "测试导演", role: "director" }],
      director: ["测试导演"],
      year: 2026,
    },
  }),
  tv: item({
    category: "tv",
    uuid: "e2etv000000000000000001",
    title: "测试剧集",
    brief: "一部专供端到端测试使用的剧集。",
  }),
  music: item({
    apiCategory: "album",
    category: "music",
    uuid: "e2emusic0000000000000001",
    title: "测试专辑",
    brief: "一张专供端到端测试使用的专辑。",
  }),
  game: item({
    category: "game",
    uuid: "e2egame00000000000000001",
    title: "测试游戏",
    brief: "一部专供端到端测试使用的游戏。",
  }),
  podcast: item({
    category: "podcast",
    uuid: "e2epodcast00000000000001",
    title: "测试播客",
    brief: "一档专供端到端测试使用的播客。",
  }),
  performance: item({
    category: "performance",
    uuid: "e2eperf00000000000000001",
    title: "测试演出",
    brief: "一场专供端到端测试使用的演出。",
  }),
};

export const bookUuid = items.book.uuid;
export const movieUuid = items.movie.uuid;

function status({
  id,
  account,
  content,
  relatedWith,
  createdAt = "2026-07-01T12:00:00.000Z",
  extra = {},
}) {
  return {
    account,
    content,
    created_at: createdAt,
    emojis: [],
    ext_neodb: { relatedWith },
    favourited: false,
    favourites_count: 0,
    id,
    in_reply_to_id: null,
    media_attachments: [],
    mentions: [],
    reblogged: false,
    reblogs_count: 0,
    replies_count: 0,
    sensitive: false,
    spoiler_text: "",
    tags: [],
    url: `${MOCK_ORIGIN}/statuses/${id}`,
    visibility: "public",
    ...extra,
  };
}

export const otherAccount = {
  acct: "otheruser",
  avatar: `${MOCK_ORIGIN}/m/avatars/other.png`,
  display_name: "另一位用户",
  emojis: [],
  id: OTHER_ACCOUNT_ID,
  url: `${MOCK_ORIGIN}/users/otheruser/`,
  username: "otheruser",
};

export const ownCommentStatus = status({
  id: OWN_COMMENT_POST_ID,
  account: myMastodonAccount,
  content: "<p>看过 🌕🌕🌕🌕🌑</p><p>这是自己的测试短评</p>",
  relatedWith: [
    { content: "这是自己的测试短评", type: "Comment" },
    { type: "Rating", value: 8 },
    { status: "complete", type: "Status" },
  ],
});

export const otherCommentStatus = status({
  id: OTHER_COMMENT_POST_ID,
  account: otherAccount,
  content: "<p>看过 🌕🌕🌕🌑🌑</p><p>这是别人的测试短评</p>",
  relatedWith: [
    { content: "这是别人的测试短评", type: "Comment" },
    { type: "Rating", value: 6 },
    { status: "complete", type: "Status" },
  ],
  createdAt: "2026-06-30T09:00:00.000Z",
});

// Initial shelf marks, keyed by item uuid. post_id is kept as a string here
// and un-quoted at serialization time in server.mjs.
export const initialShelfMarks = {
  [bookUuid]: {
    comment_text: "这是自己的测试短评",
    created_time: "2026-07-01T12:00:00.000Z",
    item: items.book,
    post_id: OWN_COMMENT_POST_ID,
    rating_grade: 8,
    shelf_type: "complete",
    tags: [],
    visibility: 0,
  },
};

export const timelineStatuses = [ownCommentStatus, otherCommentStatus];

// 1x1 transparent PNG.
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
