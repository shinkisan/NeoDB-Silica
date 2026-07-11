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
export const REMOTE_SPOILER_ACCOUNT_ID = "800000000000000003";
export const REMOTE_SPOILER_POST_ID = "800000000000000004";
export const REMOTE_SPOILER_CONTENT = "揭晓结局，主角最后其实是卧底";
export const REMOTE_SPOILER_WARNING = "可能包含剧透";
export const REVIEW_POST_ID = "800000000000000005";
export const REVIEW_TITLE = "测试长评标题";
export const REVIEW_TEASER_TEXT = "a review of 测试电影";
export const REMOTE_ITEM_URL = "https://eggplant.place/movie/6SnxLxSAl1VwqLV0HlebTs";
export const REMOTE_ITEM_NAME = "远端电影条目";

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
  tag = null,
  createdAt = "2026-07-01T12:00:00.000Z",
  extra = {},
}) {
  return {
    account,
    content,
    created_at: createdAt,
    emojis: [],
    ext_neodb: { relatedWith, tag },
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

// Real Mastodon/ActivityPub instances treat spoiler_text (CW) and sensitive
// (media-blur flag) as independent - a remote post can carry CW text with
// sensitive:false when it has no media to blur. Regression fixture for the
// bug where the app only gated visible content on `sensitive`, so a CW
// button rendered but the text underneath showed anyway.
export const remoteSpoilerAccount = {
  acct: "reader@eggplant.place",
  avatar: `${MOCK_ORIGIN}/m/avatars/remote.png`,
  display_name: "外站读者",
  emojis: [],
  id: REMOTE_SPOILER_ACCOUNT_ID,
  url: "https://eggplant.place/users/reader/",
  username: "reader",
};

// The tag points at eggplant.place's own local item uuid - NeoDB federation
// only syncs activity data, not catalog uuids, so this uuid does not exist on
// our connected instance. Regression fixture for the bug where such links got
// rewritten into a broken internal /item/... route instead of staying an
// external link.
export const remoteSpoilerStatus = status({
  id: REMOTE_SPOILER_POST_ID,
  account: remoteSpoilerAccount,
  content: `<p>${REMOTE_SPOILER_CONTENT}</p>`,
  relatedWith: [],
  tag: {
    href: REMOTE_ITEM_URL,
    name: REMOTE_ITEM_NAME,
    type: "Movie",
    image: `${MOCK_ORIGIN}/m/covers/remote.png`,
  },
  createdAt: "2026-07-02T08:00:00.000Z",
  extra: {
    sensitive: false,
    spoiler_text: REMOTE_SPOILER_WARNING,
  },
});

// NeoDB sets spoiler_text unconditionally on review crossposts to a generic
// "a review of {title}" AP teaser (see journal/models/review.py
// display_summary) - it is not a real spoiler warning unless NeoDB itself
// appends "(may contain spoilers)". Regression fixture for the bug where
// review posts got wrongly gated behind a CW button because the app treated
// any spoiler_text as a real warning.
export const reviewStatus = status({
  id: REVIEW_POST_ID,
  account: otherAccount,
  content: "🌕🌕🌕🌕🌑\n#测试标签",
  relatedWith: [
    { content: "<p>这是一篇很长的测试长评正文。</p>", name: REVIEW_TITLE, type: "Review" },
    { type: "Rating", value: 8 },
  ],
  createdAt: "2026-07-03T08:00:00.000Z",
  extra: {
    sensitive: false,
    spoiler_text: REVIEW_TEASER_TEXT,
  },
});

export const timelineStatuses = [
  ownCommentStatus,
  otherCommentStatus,
  remoteSpoilerStatus,
  reviewStatus,
];

// 1x1 transparent PNG.
export const TINY_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==",
  "base64",
);
