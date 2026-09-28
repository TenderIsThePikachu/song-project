import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { getSqlDriver, loadSqlState, saveSqlState } from './sqliteState.mjs';
import { loadCommunityMysqlState, saveCommunityMysqlState } from './mysqlTables.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const COMMUNITY_LEGACY_DATA_PATH = join(__dirname, 'community-data.json');
const MANAGER_EMAIL_PATTERNS = [
  /^admin@/i,
  /^mod@/i,
  /^manager@/i,
  /moderator/i,
  /manager/i,
  /^admin$/i,
];
const COMMUNITY_DEMO_SEED_ENABLED = process.env.COMMUNITY_DEMO_SEED === 'true';
const LEGACY_COMMUNITY_SEED_POST_IDS = new Set(
  Array.from({ length: 8 }, (_, index) => `community-post-${index + 1}`)
);

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createHttpError(statusCode, message) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeText(value, fallback = '') {
  const trimmed = String(value || '').trim();
  return trimmed || fallback;
}

function toggleId(items, targetId) {
  return items.includes(targetId)
    ? items.filter((item) => item !== targetId)
    : [targetId, ...items];
}

function isManagerEmail(email) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    return false;
  }

  return MANAGER_EMAIL_PATTERNS.some((pattern) => pattern.test(normalized));
}

function createSeedState() {
  if (!COMMUNITY_DEMO_SEED_ENABLED) {
    return {
      posts: [],
      comments: [],
      likedPostIdsByUser: {},
      bookmarkedPostIdsByUser: {},
      reportedPostIdsByUser: {},
      blockedAuthorEmails: [],
    };
  }

  const now = Date.now();
  const hour = 60 * 60 * 1000;

  const posts = [
    {
      id: 'community-post-1',
      title: '코드 진행 질문 있습니다',
      content:
        'C - G - Am - F 진행에서 벌스 멜로디를 만들고 있는데요. 후렴으로 넘어가기 직전에 연결이 자꾸 어색합니다.\n\n라인을 어디에 끊어야 더 자연스럽게 들리는지 조언 부탁드립니다.',
      authorId: 'musicjane@songmaker.app',
      authorName: 'musicjane',
      createdAt: now - 30 * hour,
      likeCount: 23,
      category: '질문',
      commentCount: 4,
      viewCount: 1842,
      isHot: true,
      tags: ['코드진행', '멜로디', '후렴'],
    },
    {
      id: 'community-post-2',
      title: '작곡 팁 공유 - 베이스와 프리코러스 연결',
      content:
        '베이스에서 프리코러스로 들어갈 때 베이스를 먼저 정리하면 훨씬 자연스럽게 이어집니다.\n\n루트 이동과 보이싱만 정리해도 후렴 진입이 훨씬 편해져요.',
      authorId: 'groovepark@songmaker.app',
      authorName: 'groovepark',
      createdAt: now - 24 * hour,
      likeCount: 17,
      category: '정보',
      commentCount: 3,
      viewCount: 1326,
      isHot: true,
      tags: ['작곡팁', '프리코러스', '보이싱'],
    },
    {
      id: 'community-post-3',
      title: '입문용 MIDI 키보드 추천 부탁드려요',
      content:
        '처음 DAW를 만지고 있는데요. 49건반 정도에서 추천할 만한 MIDI 키보드가 있을까요?\n\n예산은 20만원대까지 보고 있습니다.',
      authorId: 'loopmaker@songmaker.app',
      authorName: 'loopmaker',
      createdAt: now - 20 * hour,
      likeCount: 11,
      category: '장비',
      commentCount: 6,
      viewCount: 968,
      isHot: false,
      tags: ['MIDI', '키보드', '입문장비'],
    },
    {
      id: 'community-post-4',
      title: '피아노 연습용 코드 진행 추천해주세요',
      content:
        '머니 코드 말고도 반복 연습하기 좋은 코드 진행이 있으면 추천 부탁드립니다.\n\n손에 잘 붙는 진행 위주로 찾고 있어요.',
      authorId: 'pianoflow@songmaker.app',
      authorName: 'pianoflow',
      createdAt: now - 18 * hour,
      likeCount: 8,
      category: '질문',
      commentCount: 2,
      viewCount: 820,
      isHot: false,
      tags: ['피아노', '연습', '코드'],
    },
    {
      id: 'community-post-5',
      title: '곡에 여백 줄 때 제일 신경 쓰는 포인트 정리',
      content:
        '악기를 많이 쌓는 것보다 필요한 구간에서 비워두는 게 훨씬 효과적일 때가 많습니다.\n\n드럼과 베이스만 남겨도 후렴 대비가 살아나요.',
      authorId: 'mixbear@songmaker.app',
      authorName: 'mixbear',
      createdAt: now - 14 * hour,
      likeCount: 14,
      category: '정보',
      commentCount: 1,
      viewCount: 874,
      isHot: false,
      tags: ['편곡', '다이내믹', '믹스'],
    },
    {
      id: 'community-post-6',
      title: '작업 피드백 받고 싶어요 - 3절 완성했습니다',
      content:
        '후렴 멜로디와 스트링 라인 위주로 피드백 받고 싶습니다.\n\n전체적으로 너무 비슷하게 들리는지 확인 부탁드려요.',
      authorId: 'songcraft@songmaker.app',
      authorName: 'songcraft',
      createdAt: now - 10 * hour,
      likeCount: 9,
      category: '피드백',
      commentCount: 5,
      viewCount: 641,
      isHot: false,
      tags: ['피드백', '멜로디', '스트링'],
    },
    {
      id: 'community-post-7',
      title: '기타 코드 전환 - F 코드가 너무 어려워요',
      content:
        '기타로 코드를 잡을 때 F 계열 바레 코드가 계속 뭉개집니다.\n\n손가락 힘이랑 자세 팁 있으면 알려주세요.',
      authorId: 'stringday@songmaker.app',
      authorName: 'stringday',
      createdAt: now - 8 * hour,
      likeCount: 7,
      category: '질문',
      commentCount: 4,
      viewCount: 732,
      isHot: false,
      tags: ['기타', '바레코드', '연습'],
    },
    {
      id: 'community-post-8',
      title: '보컬 녹음 전에 체크하는 프리셋 리스트',
      content:
        '보컬 녹음 전에 컴프레서와 EQ를 미리 아주 세게 걸기보다 모니터용으로만 살짝 다루는 편이 좋습니다.\n\n간단한 프리셋 공유합니다.',
      authorId: 'vocalnote@songmaker.app',
      authorName: 'vocalnote',
      createdAt: now - 5 * hour,
      likeCount: 12,
      category: '정보',
      commentCount: 2,
      viewCount: 921,
      isHot: false,
      tags: ['보컬', '프리셋', '녹음'],
    },
  ];

  const comments = [
    {
      id: 'community-comment-1',
      postId: 'community-post-1',
      content: '후렴 진입 직전에 멜로디 톤을 조금 길게 잡으면 훨씬 자연스럽게 연결됩니다.',
      authorName: 'frequencymaster',
      authorEmail: 'frequencymaster@songmaker.app',
      createdAt: now - 22 * hour,
      likeCount: 2,
      parentId: null,
    },
    {
      id: 'community-comment-2',
      postId: 'community-post-1',
      content: '베이스를 먼저 단순하게 두고 탑라인을 얹어보면 끼임이 많이 줄어요.',
      authorName: 'composerk',
      authorEmail: 'composerk@songmaker.app',
      createdAt: now - 18 * hour,
      likeCount: 1,
      parentId: null,
    },
    {
      id: 'community-comment-3',
      postId: 'community-post-3',
      content: '49건반이면 입문용으로 충분하고, 패드보다 건반감을 먼저 보는 걸 추천해요.',
      authorName: 'gearlist',
      authorEmail: 'gearlist@songmaker.app',
      createdAt: now - 12 * hour,
      likeCount: 0,
      parentId: null,
    },
    {
      id: 'community-comment-4',
      postId: 'community-post-6',
      content: '스트링과 베이스에서 조금 더 비워두면 후렴이 더 살아날 것 같아요.',
      authorName: 'soundcheck',
      authorEmail: 'soundcheck@songmaker.app',
      createdAt: now - 4 * hour,
      likeCount: 0,
      parentId: null,
    },
  ];

  return {
    posts,
    comments,
    likedPostIdsByUser: {},
    bookmarkedPostIdsByUser: {},
    reportedPostIdsByUser: {},
    blockedAuthorEmails: [],
  };
}

async function loadLegacyState() {
  return await loadSqlState('community', createSeedState, {
    legacyFilePath: COMMUNITY_LEGACY_DATA_PATH,
    normalize: (parsed) => ({
      posts: Array.isArray(parsed.posts) ? parsed.posts : [],
      comments: Array.isArray(parsed.comments) ? parsed.comments : [],
      likedPostIdsByUser:
        parsed && typeof parsed.likedPostIdsByUser === 'object' && parsed.likedPostIdsByUser
          ? parsed.likedPostIdsByUser
          : {},
      bookmarkedPostIdsByUser:
        parsed &&
        typeof parsed.bookmarkedPostIdsByUser === 'object' &&
        parsed.bookmarkedPostIdsByUser
          ? parsed.bookmarkedPostIdsByUser
          : {},
      reportedPostIdsByUser:
        parsed && typeof parsed.reportedPostIdsByUser === 'object' && parsed.reportedPostIdsByUser
          ? parsed.reportedPostIdsByUser
          : {},
      blockedAuthorEmails: Array.isArray(parsed.blockedAuthorEmails)
        ? parsed.blockedAuthorEmails.map((email) => normalizeEmail(email)).filter(Boolean)
        : [],
    }),
  });
}

async function loadState() {
  if (getSqlDriver() === 'mysql') {
    return await loadCommunityMysqlState(loadLegacyState);
  }

  return await loadLegacyState();
}

const loadedState = await loadState();
const removedLegacySeedData =
  !COMMUNITY_DEMO_SEED_ENABLED &&
  loadedState.posts.some((post) => LEGACY_COMMUNITY_SEED_POST_IDS.has(post.id));
let state = removedLegacySeedData
  ? {
      ...loadedState,
      posts: loadedState.posts.filter((post) => !LEGACY_COMMUNITY_SEED_POST_IDS.has(post.id)),
      comments: loadedState.comments.filter(
        (comment) => !LEGACY_COMMUNITY_SEED_POST_IDS.has(comment.postId)
      ),
      likedPostIdsByUser: Object.fromEntries(
        Object.entries(loadedState.likedPostIdsByUser).map(([email, ids]) => [
          email,
          ids.filter((id) => !LEGACY_COMMUNITY_SEED_POST_IDS.has(id)),
        ])
      ),
      bookmarkedPostIdsByUser: Object.fromEntries(
        Object.entries(loadedState.bookmarkedPostIdsByUser).map(([email, ids]) => [
          email,
          ids.filter((id) => !LEGACY_COMMUNITY_SEED_POST_IDS.has(id)),
        ])
      ),
      reportedPostIdsByUser: Object.fromEntries(
        Object.entries(loadedState.reportedPostIdsByUser).map(([email, ids]) => [
          email,
          ids.filter((id) => !LEGACY_COMMUNITY_SEED_POST_IDS.has(id)),
        ])
      ),
    }
  : loadedState;

function saveState() {
  if (getSqlDriver() === 'mysql') {
    saveCommunityMysqlState(state);
    return;
  }

  saveSqlState('community', state);
}

if (removedLegacySeedData) {
  saveState();
}

function getVisibleComments(comments, posts, blockedAuthorEmails) {
  const blocked = new Set(blockedAuthorEmails);
  const visiblePostIds = new Set(
    posts
      .filter((post) => !blocked.has(normalizeEmail(post.authorId)))
      .map((post) => post.id)
  );

  let filtered = comments.filter((comment) => {
    if (!visiblePostIds.has(comment.postId)) {
      return false;
    }

    return !blocked.has(normalizeEmail(comment.authorEmail));
  });

  let changed = true;

  while (changed) {
    changed = false;
    const visibleCommentIds = new Set(filtered.map((comment) => comment.id));
    const nextFiltered = filtered.filter(
      (comment) => !comment.parentId || visibleCommentIds.has(comment.parentId)
    );

    if (nextFiltered.length !== filtered.length) {
      filtered = nextFiltered;
      changed = true;
    }
  }

  return filtered;
}

function refreshPostMetrics(posts, comments, blockedAuthorEmails) {
  const visibleComments = getVisibleComments(comments, posts, blockedAuthorEmails);

  return posts.map((post) => {
    const commentCount = visibleComments.filter((comment) => comment.postId === post.id).length;
    const viewCount = Number(post.viewCount) || 0;
    const likeCount = Number(post.likeCount) || 0;

    return {
      ...post,
      commentCount,
      likeCount,
      viewCount,
      isHot: viewCount >= 150 || likeCount >= 20 || commentCount >= 10,
    };
  });
}

function commit(nextState) {
  state = {
    ...nextState,
    blockedAuthorEmails: Array.from(
      new Set((nextState.blockedAuthorEmails ?? []).map((email) => normalizeEmail(email)).filter(Boolean))
    ),
  };

  state.posts = refreshPostMetrics(state.posts, state.comments, state.blockedAuthorEmails);
  saveState();
}

function getVisiblePosts() {
  const blocked = new Set(state.blockedAuthorEmails);
  return state.posts.filter((post) => !blocked.has(normalizeEmail(post.authorId)));
}

function getVisibleCommentsForSnapshot() {
  return getVisibleComments(state.comments, state.posts, state.blockedAuthorEmails);
}

function findPostOrThrow(postId) {
  const post = state.posts.find((item) => item.id === postId);

  if (!post) {
    throw createHttpError(404, '게시글을 찾을 수 없습니다.');
  }

  return post;
}

function findCommentOrThrow(commentId) {
  const comment = state.comments.find((item) => item.id === commentId);

  if (!comment) {
    throw createHttpError(404, '댓글을 찾을 수 없습니다.');
  }

  return comment;
}

function ensureWritableUser(email) {
  const normalized = normalizeEmail(email);

  if (!normalized) {
    throw createHttpError(401, '로그인이 필요합니다.');
  }

  if (state.blockedAuthorEmails.includes(normalized)) {
    throw createHttpError(403, '차단된 계정은 커뮤니티 활동을 할 수 없습니다.');
  }

  return normalized;
}

function ensurePostOwnerOrManager(post, userEmail) {
  const normalized = ensureWritableUser(userEmail);

  if (normalizeEmail(post.authorId) !== normalized && !isManagerEmail(normalized)) {
    throw createHttpError(403, '이 게시글을 수정할 권한이 없습니다.');
  }

  return normalized;
}

function ensureCommentOwnerOrManager(comment, userEmail) {
  const normalized = ensureWritableUser(userEmail);

  if (normalizeEmail(comment.authorEmail) !== normalized && !isManagerEmail(normalized)) {
    throw createHttpError(403, '이 댓글을 수정할 권한이 없습니다.');
  }

  return normalized;
}

function ensureManager(userEmail) {
  const normalized = ensureWritableUser(userEmail);

  if (!isManagerEmail(normalized)) {
    throw createHttpError(403, '관리자만 사용할 수 있는 기능입니다.');
  }

  return normalized;
}

function collectDescendantCommentIds(commentId) {
  const result = new Set([commentId]);
  let changed = true;

  while (changed) {
    changed = false;

    state.comments.forEach((comment) => {
      if (comment.parentId && result.has(comment.parentId) && !result.has(comment.id)) {
        result.add(comment.id);
        changed = true;
      }
    });
  }

  return result;
}

export function getCommunitySnapshot() {
  return {
    posts: getVisiblePosts(),
    comments: getVisibleCommentsForSnapshot(),
    likedPostIdsByUser: state.likedPostIdsByUser,
    bookmarkedPostIdsByUser: state.bookmarkedPostIdsByUser,
    reportedPostIdsByUser: state.reportedPostIdsByUser,
  };
}

export function createCommunityPost(payload) {
  const authorEmail = ensureWritableUser(payload.authorEmail);
  const postId = createId('community-post');
  const timestamp = Date.now();

  commit({
    ...state,
    posts: [
      {
        id: postId,
        title: normalizeText(payload.title, '제목 없는 게시글'),
        content: normalizeText(payload.content),
        authorId: authorEmail,
        authorName: normalizeText(payload.authorName, 'guest'),
        createdAt: timestamp,
        likeCount: 0,
        category: normalizeText(payload.category, '질문'),
        commentCount: 0,
        viewCount: 0,
        isHot: false,
        tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean).slice(0, 6) : [],
      },
      ...state.posts,
    ],
  });

  return {
    postId,
    snapshot: getCommunitySnapshot(),
  };
}

export function updateCommunityPost(payload) {
  const postId = normalizeText(payload.postId);
  const post = findPostOrThrow(postId);
  ensurePostOwnerOrManager(post, payload.userEmail);

  commit({
    ...state,
    posts: state.posts.map((item) =>
      item.id === postId
        ? {
            ...item,
            title: normalizeText(payload.title, item.title),
            content: normalizeText(payload.content, item.content),
            category: normalizeText(payload.category, item.category || '질문'),
            tags: Array.isArray(payload.tags) ? payload.tags.filter(Boolean).slice(0, 6) : [],
          }
        : item
    ),
  });

  return {
    snapshot: getCommunitySnapshot(),
  };
}

export function deleteCommunityPost(payload) {
  const postId = normalizeText(payload.postId);
  const post = findPostOrThrow(postId);
  ensurePostOwnerOrManager(post, payload.userEmail);

  commit({
    ...state,
    posts: state.posts.filter((item) => item.id !== postId),
    comments: state.comments.filter((comment) => comment.postId !== postId),
    likedPostIdsByUser: Object.fromEntries(
      Object.entries(state.likedPostIdsByUser).map(([email, ids]) => [
        email,
        ids.filter((id) => id !== postId),
      ])
    ),
    bookmarkedPostIdsByUser: Object.fromEntries(
      Object.entries(state.bookmarkedPostIdsByUser).map(([email, ids]) => [
        email,
        ids.filter((id) => id !== postId),
      ])
    ),
    reportedPostIdsByUser: Object.fromEntries(
      Object.entries(state.reportedPostIdsByUser).map(([email, ids]) => [
        email,
        ids.filter((id) => id !== postId),
      ])
    ),
  });

  return {
    snapshot: getCommunitySnapshot(),
  };
}

export function moderateCommunityPost(payload) {
  const postId = normalizeText(payload.postId);
  const action = normalizeText(payload.action);
  ensureManager(payload.userEmail);

  const post = findPostOrThrow(postId);

  if (action === 'delete-post') {
    return deleteCommunityPost({
      postId,
      userEmail: payload.userEmail,
    });
  }

  if (action === 'block-user') {
    const authorEmail = normalizeEmail(post.authorId);

    commit({
      ...state,
      blockedAuthorEmails: [...state.blockedAuthorEmails, authorEmail],
    });

    return {
      blockedAuthorEmail: authorEmail,
      snapshot: getCommunitySnapshot(),
    };
  }

  throw createHttpError(400, '알 수 없는 관리자 작업입니다.');
}

export function recordCommunityView(payload) {
  const postId = normalizeText(payload.postId);
  const post = findPostOrThrow(postId);

  if (state.blockedAuthorEmails.includes(normalizeEmail(post.authorId))) {
    throw createHttpError(404, '게시글을 찾을 수 없습니다.');
  }

  commit({
    ...state,
    posts: state.posts.map((item) =>
      item.id === postId
        ? {
            ...item,
            viewCount: (Number(item.viewCount) || 0) + 1,
          }
        : item
    ),
  });

  return {
    snapshot: getCommunitySnapshot(),
  };
}

export function toggleCommunityLike(payload) {
  const postId = normalizeText(payload.postId);
  const userEmail = ensureWritableUser(payload.userEmail);
  const post = findPostOrThrow(postId);
  const currentIds = state.likedPostIdsByUser[userEmail] ?? [];
  const alreadyLiked = currentIds.includes(postId);

  if (state.blockedAuthorEmails.includes(normalizeEmail(post.authorId))) {
    throw createHttpError(404, '게시글을 찾을 수 없습니다.');
  }

  commit({
    ...state,
    posts: state.posts.map((item) =>
      item.id === postId
        ? {
            ...item,
            likeCount: Math.max(0, (Number(item.likeCount) || 0) + (alreadyLiked ? -1 : 1)),
          }
        : item
    ),
    likedPostIdsByUser: {
      ...state.likedPostIdsByUser,
      [userEmail]: toggleId(currentIds, postId),
    },
  });

  return {
    snapshot: getCommunitySnapshot(),
  };
}

export function toggleCommunityBookmark(payload) {
  const postId = normalizeText(payload.postId);
  const userEmail = ensureWritableUser(payload.userEmail);
  const currentIds = state.bookmarkedPostIdsByUser[userEmail] ?? [];
  const nextIds = toggleId(currentIds, postId);

  findPostOrThrow(postId);

  commit({
    ...state,
    bookmarkedPostIdsByUser: {
      ...state.bookmarkedPostIdsByUser,
      [userEmail]: nextIds,
    },
  });

  return {
    bookmarked: nextIds.includes(postId),
    snapshot: getCommunitySnapshot(),
  };
}

export function reportCommunityPost(payload) {
  const postId = normalizeText(payload.postId);
  const userEmail = ensureWritableUser(payload.userEmail);
  const currentIds = state.reportedPostIdsByUser[userEmail] ?? [];

  findPostOrThrow(postId);

  if (currentIds.includes(postId)) {
    return {
      snapshot: getCommunitySnapshot(),
    };
  }

  commit({
    ...state,
    reportedPostIdsByUser: {
      ...state.reportedPostIdsByUser,
      [userEmail]: [postId, ...currentIds],
    },
  });

  return {
    snapshot: getCommunitySnapshot(),
  };
}

export function addCommunityComment(payload) {
  const postId = normalizeText(payload.postId);
  const authorEmail = ensureWritableUser(payload.authorEmail);

  findPostOrThrow(postId);

  const commentId = createId('community-comment');

  commit({
    ...state,
    comments: [
      {
        id: commentId,
        postId,
        content: normalizeText(payload.content),
        authorName: normalizeText(payload.authorName, 'guest'),
        authorEmail,
        createdAt: Date.now(),
        likeCount: 0,
        parentId: null,
      },
      ...state.comments,
    ],
  });

  return {
    commentId,
    snapshot: getCommunitySnapshot(),
  };
}

export function replyCommunityComment(payload) {
  const parentComment = findCommentOrThrow(payload.commentId);
  const authorEmail = ensureWritableUser(payload.authorEmail);
  const commentId = createId('community-comment');

  if (normalizeText(payload.postId) !== parentComment.postId) {
    throw createHttpError(400, '답글 대상 댓글의 게시글 정보가 올바르지 않습니다.');
  }

  commit({
    ...state,
    comments: [
      {
        id: commentId,
        postId: parentComment.postId,
        content: normalizeText(payload.content),
        authorName: normalizeText(payload.authorName, 'guest'),
        authorEmail,
        createdAt: Date.now(),
        likeCount: 0,
        parentId: parentComment.id,
      },
      ...state.comments,
    ],
  });

  return {
    commentId,
    snapshot: getCommunitySnapshot(),
  };
}

export function updateCommunityComment(payload) {
  const commentId = normalizeText(payload.commentId);
  const comment = findCommentOrThrow(commentId);
  ensureCommentOwnerOrManager(comment, payload.userEmail);

  commit({
    ...state,
    comments: state.comments.map((item) =>
      item.id === commentId
        ? {
            ...item,
            content: normalizeText(payload.content, item.content),
          }
        : item
    ),
  });

  return {
    snapshot: getCommunitySnapshot(),
  };
}

export function deleteCommunityComment(payload) {
  const commentId = normalizeText(payload.commentId);
  const comment = findCommentOrThrow(commentId);
  ensureCommentOwnerOrManager(comment, payload.userEmail);
  const removedIds = collectDescendantCommentIds(commentId);

  commit({
    ...state,
    comments: state.comments.filter((item) => !removedIds.has(item.id)),
  });

  return {
    snapshot: getCommunitySnapshot(),
  };
}
