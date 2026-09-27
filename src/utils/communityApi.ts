import type { Comment, Post } from '../types/community';
import { fetchServerJson } from './serverApi';

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

export function fetchCommunityBootstrap() {
  return fetchServerJson<CommunitySnapshot>('/api/community/bootstrap');
}

export function createCommunityPostOnServer(payload: CreateCommunityPostPayload) {
  return fetchServerJson<{ postId: string; snapshot: CommunitySnapshot }>('/api/community/posts', {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export function updateCommunityPostOnServer(payload: UpdateCommunityPostPayload) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/update`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function deleteCommunityPostOnServer(payload: { postId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/delete`,
    { method: 'POST', body: JSON.stringify({ userEmail: payload.userEmail }) }
  );
}

export function moderateCommunityPostOnServer(payload: ModerateCommunityPostPayload) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/moderate`,
    {
      method: 'POST',
      body: JSON.stringify({ userEmail: payload.userEmail, action: payload.action }),
    }
  );
}

export function recordCommunityViewOnServer(payload: { postId: string }) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/view`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function toggleCommunityLikeOnServer(payload: { postId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/like`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function toggleCommunityBookmarkOnServer(payload: {
  postId: string;
  userEmail: string;
}) {
  return fetchServerJson<{ bookmarked: boolean; snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/bookmark`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function reportCommunityPostOnServer(payload: { postId: string; userEmail: string }) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/report`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function addCommunityCommentOnServer(payload: AddCommunityCommentPayload) {
  return fetchServerJson<{ commentId: string; snapshot: CommunitySnapshot }>(
    `/api/community/posts/${payload.postId}/comments`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function replyCommunityCommentOnServer(payload: ReplyCommunityCommentPayload) {
  return fetchServerJson<{ commentId: string; snapshot: CommunitySnapshot }>(
    `/api/community/comments/${payload.commentId}/reply`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function updateCommunityCommentOnServer(payload: UpdateCommunityCommentPayload) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/comments/${payload.commentId}/update`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}

export function deleteCommunityCommentOnServer(payload: DeleteCommunityCommentPayload) {
  return fetchServerJson<{ snapshot: CommunitySnapshot }>(
    `/api/community/comments/${payload.commentId}/delete`,
    { method: 'POST', body: JSON.stringify(payload) }
  );
}
