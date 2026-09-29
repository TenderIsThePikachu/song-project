import { 
  collection, getDocs, addDoc, updateDoc, deleteDoc, doc, setDoc, getDoc, query, orderBy, increment, arrayUnion, arrayRemove, limit,  
} from 'firebase/firestore';
import { db } from '../firebase'; // ★ 주의: 실제 firebase.ts 파일 경로에 맞게 수정해주세요!
import type { Comment, Post } from '../types/community';

// ============================================================================
// 1. 타입 정의 (기존 UI와의 완벽한 호환을 위해 그대로 유지합니다)
// ============================================================================
export type CommunitySnapshot = {
  posts: Post[];
  comments: Comment[];
  likedPostIdsByUser: Record<string, string[]>;
  bookmarkedPostIdsByUser: Record<string, string[]>;
  reportedPostIdsByUser: Record<string, string[]>;
};

export type CreateCommunityPostPayload = {
  title: string;
  content: string;
  category: string;
  tags: string[];
  authorName: string;
  authorEmail: string;
};

export type UpdateCommunityPostPayload = {
  postId: string;
  title: string;
  content: string;
  category: string;
  tags: string[];
  userEmail: string;
};

export type AddCommunityCommentPayload = {
  postId: string;
  authorName: string;
  authorEmail: string;
  content: string;
};

export type ReplyCommunityCommentPayload = AddCommunityCommentPayload & {
  commentId: string;
};

export type UpdateCommunityCommentPayload = {
  commentId: string;
  userEmail: string;
  content: string;
};

export type DeleteCommunityCommentPayload = {
  commentId: string;
  userEmail: string;
};

export type ModerateCommunityPostPayload = {
  postId: string;
  userEmail: string;
  action: 'delete-post' | 'block-user';
};


// ============================================================================
// 🔥 2. 화면 데이터 동기화 (Bootstrap)
// ============================================================================

// [도우미 함수] 유저들의 좋아요/북마크/신고 기록을 가져옵니다.
async function fetchUserMetas() {
  const metaSnap = await getDocs(collection(db, 'community_user_meta'));
  const likedPostIdsByUser: Record<string, string[]> = {};
  const bookmarkedPostIdsByUser: Record<string, string[]> = {};
  const reportedPostIdsByUser: Record<string, string[]> = {};

  metaSnap.forEach(docSnap => {
    const email = docSnap.id; // 문서 ID를 이메일로 사용
    const data = docSnap.data();
    if (data.likedPostIds) likedPostIdsByUser[email] = data.likedPostIds;
    if (data.bookmarkedPostIds) bookmarkedPostIdsByUser[email] = data.bookmarkedPostIds;
    if (data.reportedPostIds) reportedPostIdsByUser[email] = data.reportedPostIds;
  });

  return { likedPostIdsByUser, bookmarkedPostIdsByUser, reportedPostIdsByUser };
}

export async function fetchCommunityBootstrap(): Promise<CommunitySnapshot> {
  const postsQuery = query(collection(db, 'community_posts'), orderBy('createdAt', 'desc'), limit(20)); // limit(20) 추가
  const postsSnap = await getDocs(postsQuery);
    
  const commentsQuery = query(collection(db, 'community_comments'), orderBy('createdAt', 'asc'), limit(20)); // limit(50) 추가
  const commentsSnap = await getDocs(commentsQuery);

  const posts = postsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Post));
  const comments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() } as Comment));
  const metas = await fetchUserMetas();

  return {
    posts,
    comments,
    likedPostIdsByUser: metas.likedPostIdsByUser,
    bookmarkedPostIdsByUser: metas.bookmarkedPostIdsByUser,
    reportedPostIdsByUser: metas.reportedPostIdsByUser
  };
}


// ============================================================================
// 🔥 3. 게시글 관련 API
// ============================================================================

export async function createCommunityPostOnServer(payload: CreateCommunityPostPayload) {
  const docRef = await addDoc(collection(db, 'community_posts'), {
    ...payload,
    viewCount: 0,
    likeCount: 0,
    createdAt: Date.now(),
  });
  return { postId: docRef.id, snapshot: await fetchCommunityBootstrap() };
}

export async function updateCommunityPostOnServer(payload: UpdateCommunityPostPayload) {
  const postRef = doc(db, 'community_posts', payload.postId);
  await updateDoc(postRef, {
    title: payload.title,
    content: payload.content,
    category: payload.category,
    tags: payload.tags,
    updatedAt: Date.now()
  });
  return { snapshot: await fetchCommunityBootstrap() };
}

export async function deleteCommunityPostOnServer(payload: { postId: string; userEmail: string }) {
  await deleteDoc(doc(db, 'community_posts', payload.postId));
  return { snapshot: await fetchCommunityBootstrap() };
}

export async function recordCommunityViewOnServer(payload: { postId: string }) {
  const postRef = doc(db, 'community_posts', payload.postId);
  await updateDoc(postRef, { viewCount: increment(1) });
  return { snapshot: await fetchCommunityBootstrap() };
}

// ============================================================================
// 기존의 toggleCommunityLikeOnServer 함수를 아래 코드로 교체하세요.
// ============================================================================
export async function toggleCommunityLikeOnServer(payload: { postId: string; userEmail: string }) {
  const userMetaRef = doc(db, 'community_user_meta', payload.userEmail);
  const userMetaSnap = await getDoc(userMetaRef);
  let isLiked = false;
  
  if (userMetaSnap.exists()) {
    isLiked = userMetaSnap.data().likedPostIds?.includes(payload.postId);
  }

  let nextLiked = false;
  if (isLiked) {
    await setDoc(userMetaRef, { likedPostIds: arrayRemove(payload.postId) }, { merge: true });
    await updateDoc(doc(db, 'community_posts', payload.postId), { likeCount: increment(-1) });
    nextLiked = false; // 좋아요 취소됨
  } else {
    await setDoc(userMetaRef, { likedPostIds: arrayUnion(payload.postId) }, { merge: true });
    await updateDoc(doc(db, 'community_posts', payload.postId), { likeCount: increment(1) });
    nextLiked = true; // 좋아요 됨
  }
  
  // 🔥 스토어가 요구하는 대로 'liked' 값도 같이 보내줍니다.
  return { liked: nextLiked, snapshot: await fetchCommunityBootstrap() };
}

// ============================================================================
// 기존의 toggleCommunityBookmarkOnServer 함수를 아래 코드로 교체하세요.
// ============================================================================
export async function toggleCommunityBookmarkOnServer(payload: { postId: string; userEmail: string }) {
  const userMetaRef = doc(db, 'community_user_meta', payload.userEmail);
  const userMetaSnap = await getDoc(userMetaRef);
  let isBookmarked = false;
  
  if (userMetaSnap.exists()) {
    isBookmarked = userMetaSnap.data().bookmarkedPostIds?.includes(payload.postId);
  }

  let nextBookmarked = false;
  if (isBookmarked) {
    await setDoc(userMetaRef, { bookmarkedPostIds: arrayRemove(payload.postId) }, { merge: true });
    nextBookmarked = false; // 북마크 취소됨
  } else {
    await setDoc(userMetaRef, { bookmarkedPostIds: arrayUnion(payload.postId) }, { merge: true });
    nextBookmarked = true; // 북마크 됨
  }
  
  // 🔥 스토어가 요구하는 에러의 원인! 'bookmarked' 값을 같이 보내줍니다.
  return { bookmarked: nextBookmarked, snapshot: await fetchCommunityBootstrap() };
}

export async function reportCommunityPostOnServer(payload: { postId: string; userEmail: string }) {
  const userMetaRef = doc(db, 'community_user_meta', payload.userEmail);
  // 신고 목록에 추가합니다.
  await setDoc(userMetaRef, { reportedPostIds: arrayUnion(payload.postId) }, { merge: true });
  return { snapshot: await fetchCommunityBootstrap() };
}

export async function moderateCommunityPostOnServer(payload: ModerateCommunityPostPayload) {
  if (payload.action === 'delete-post') {
    await deleteDoc(doc(db, 'community_posts', payload.postId));
  }
  return { snapshot: await fetchCommunityBootstrap() };
}


// ============================================================================
// 🔥 4. 댓글 관련 API
// ============================================================================

export async function addCommunityCommentOnServer(payload: AddCommunityCommentPayload) {
  const docRef = await addDoc(collection(db, 'community_comments'), {
    ...payload,
    likeCount: 0,
    createdAt: Date.now(),
  });
  return { commentId: docRef.id, snapshot: await fetchCommunityBootstrap() };
}

export async function replyCommunityCommentOnServer(payload: ReplyCommunityCommentPayload) {
  const docRef = await addDoc(collection(db, 'community_comments'), {
    postId: payload.postId,
    parentId: payload.commentId, // 부모 댓글 ID를 추가로 저장
    authorName: payload.authorName,
    authorEmail: payload.authorEmail,
    content: payload.content,
    likeCount: 0,
    createdAt: Date.now(),
  });
  return { commentId: docRef.id, snapshot: await fetchCommunityBootstrap() };
}

export async function updateCommunityCommentOnServer(payload: UpdateCommunityCommentPayload) {
  const commentRef = doc(db, 'community_comments', payload.commentId);
  await updateDoc(commentRef, {
    content: payload.content,
    updatedAt: Date.now()
  });
  return { snapshot: await fetchCommunityBootstrap() };
}

export async function deleteCommunityCommentOnServer(payload: DeleteCommunityCommentPayload) {
  await deleteDoc(doc(db, 'community_comments', payload.commentId));
  return { snapshot: await fetchCommunityBootstrap() };
}