import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { DUMMY_POSTS } from '../../dummy/mockData';
import { useAuthStore } from '../../store/authStore';
import { useCommunityStore } from '../../store/communityStore';
import { useNotificationStore } from '../../store/notificationStore';
import type { Comment, Post } from '../../types/community';
import './PostDetail.css';

type CommentNode = {
  comment: Comment;
  children: CommentNode[];
};

function EyeIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M2.5 12s3.3-6 9.5-6 9.5 6 9.5 6-3.3 6-9.5 6-9.5-6-9.5-6Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="12" r="2.7" fill="none" stroke="currentColor" strokeWidth="1.8" />
    </svg>
  );
}

function CommentIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M5 5.7h14v9.8H9.2L5 19.2V5.7Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function HeartIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M12 19.3S4.8 15.2 4.8 9.5c0-2.2 1.7-3.9 3.8-3.9 1.3 0 2.5.7 3.2 1.8.7-1.1 1.9-1.8 3.2-1.8 2.1 0 3.8 1.7 3.8 3.9 0 5.7-6.8 9.8-6.8 9.8Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function BookmarkIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M6 3.5h12v17l-6-4-6 4v-17Z" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round" />
    </svg>
  );
}

function ShareIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 16V3m0 0L7.5 7.5M12 3l4.5 4.5M5 12v8h14v-8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ReportIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3 2.8 20h18.4L12 3Zm0 6v5m0 3h.01" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AuthorIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="9" cy="8" r="3" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path d="M3.8 18c.5-3.2 2.2-4.8 5.2-4.8s4.7 1.6 5.2 4.8M16 8.5c2.2.2 3.5 1.5 3.9 3.9M16.3 14.2c2.1.5 3.4 1.8 3.9 3.8" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}

const DETAIL_POPULAR_IMAGES = [
  '/landing-assets/shared-fallback-film.jpg',
  '/landing-assets/shared-fallback-groove.jpg',
  '/landing-assets/shared-fallback-dream.jpg',
];

const categoryToneMap: Record<string, string> = {
  질문: 'indigo',
  정보: 'mint',
  장비: 'amber',
  작곡: 'violet',
  피드백: 'rose',
};

export const categoryGuideMap: Record<string, string> = {
  질문: '질문 글에는 현재 막히는 지점과 시도한 방법을 같이 적어주면 더 빠르게 도움을 받을 수 있습니다.',
  정보: '직접 경험한 팁이나 정리한 내용을 남기면 다른 사용자에게도 큰 도움이 됩니다.',
  장비: '예산과 작업 환경을 함께 적어주면 더 현실적인 추천을 받을 수 있습니다.',
  작곡: '코드 진행, 멜로디, 참고 곡을 같이 적어주면 더 구체적인 피드백이 가능합니다.',
  피드백: '어떤 부분이 궁금한지 먼저 적어주면 필요한 코멘트가 더 정확해집니다.',
};

function isCommunityManagerEmail(email?: string | null) {
  const normalized = String(email || '').trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return (
    normalized.startsWith('admin@') ||
    normalized.startsWith('mod@') ||
    normalized.startsWith('manager@') ||
    normalized.includes('moderator') ||
    normalized.includes('manager')
  );
}

function buildCommentTree(comments: Comment[]) {
  const nodeMap = new Map<string, CommentNode>();
  const roots: CommentNode[] = [];

  comments.forEach((comment) => {
    nodeMap.set(comment.id, {
      comment,
      children: [],
    });
  });

  comments.forEach((comment) => {
    const node = nodeMap.get(comment.id);

    if (!node) {
      return;
    }

    if (comment.parentId && nodeMap.has(comment.parentId)) {
      nodeMap.get(comment.parentId)?.children.push(node);
      return;
    }

    roots.push(node);
  });

  return roots;
}

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const minute = 1000 * 60;
  const hour = minute * 60;
  const day = hour * 24;

  if (diff < hour) {
    return `${Math.max(1, Math.floor(diff / minute))}분 전`;
  }

  if (diff < day) {
    return `${Math.max(1, Math.floor(diff / hour))}시간 전`;
  }

  if (diff < day * 7) {
    return `${Math.max(1, Math.floor(diff / day))}일 전`;
  }

  return new Date(timestamp).toLocaleDateString('ko-KR');
}

function formatPostDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: 'numeric',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatCount(value: number | undefined) {
  return (value ?? 0).toLocaleString('ko-KR');
}

function getAvatarSeed(name: string) {
  return name.slice(0, 1).toUpperCase();
}

function getSummary(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length <= 170 ? normalized : `${normalized.slice(0, 170)}...`;
}

function getParagraphs(content: string) {
  return content
    .split('\n\n')
    .map((paragraph) => paragraph.trim())
    .filter(Boolean);
}

function isChordProgressionBlock(paragraph: string) {
  const lines = paragraph.split('\n').map((line) => line.trim()).filter(Boolean);
  return lines.length > 1 && lines.filter((line) => /[A-G](?:#|b)?(?:m|maj|dim|aug)?/.test(line)).length >= 2;
}

export default function PostDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const isPreviewMode = searchParams.get('preview') === '1';
  const user = useAuthStore((state) => state.user);
  const posts = useCommunityStore((state) => state.posts);
  const commentsStore = useCommunityStore((state) => state.comments);
  const bootstrapStatus = useCommunityStore((state) => state.bootstrapStatus);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const likedPostIdsByUser = useCommunityStore((state) => state.likedPostIdsByUser);
  const bookmarkedPostIdsByUser = useCommunityStore((state) => state.bookmarkedPostIdsByUser);
  const reportedPostIdsByUser = useCommunityStore((state) => state.reportedPostIdsByUser);
  const recordView = useCommunityStore((state) => state.recordView);
  const toggleLike = useCommunityStore((state) => state.toggleLike);
  const toggleBookmark = useCommunityStore((state) => state.toggleBookmark);
  const reportPost = useCommunityStore((state) => state.reportPost);
  const deletePost = useCommunityStore((state) => state.deletePost);
  const moderatePost = useCommunityStore((state) => state.moderatePost);
  const addComment = useCommunityStore((state) => state.addComment);
  const replyComment = useCommunityStore((state) => state.replyComment);
  const updateComment = useCommunityStore((state) => state.updateComment);
  const deleteComment = useCommunityStore((state) => state.deleteComment);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [commentInput, setCommentInput] = useState('');
  const [replyTargetId, setReplyTargetId] = useState<string | null>(null);
  const [replyInput, setReplyInput] = useState('');
  const [editingCommentId, setEditingCommentId] = useState<string | null>(null);
  const [editingCommentInput, setEditingCommentInput] = useState('');
  const [commentToastMessage, setCommentToastMessage] = useState('');
  const [isCommentPopupOpen, setIsCommentPopupOpen] = useState(false);
  const [isCommentSubmitting, setIsCommentSubmitting] = useState(false);
  const [replySubmittingId, setReplySubmittingId] = useState<string | null>(null);

  const post: Post | null =
    posts.find((item) => item.id === id) ?? (isPreviewMode ? DUMMY_POSTS[0] : null);
  const comments: Comment[] = useMemo(
    () => commentsStore.filter((item) => item.postId === id),
    [commentsStore, id]
  );
  const commentTree = useMemo(() => buildCommentTree(comments), [comments]);

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity]);

  useEffect(() => {
    if (!id || isPreviewMode || bootstrapStatus !== 'ready') {
      return;
    }

    void recordView(id).catch((error) => {
      console.error(error);
    });
  }, [bootstrapStatus, id, isPreviewMode, recordView]);

  useEffect(() => {
    if (!commentToastMessage) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setCommentToastMessage('');
    }, 1800);

    return () => window.clearTimeout(timeout);
  }, [commentToastMessage]);

  if (!post && (bootstrapStatus === 'idle' || bootstrapStatus === 'loading')) {
    return (
      <div className="community-detail-page">
        <SiteHeader activeSection="community" />

        <main className="community-detail-shell">
          <section className="community-detail-empty-card">
            <span className="community-detail-empty-kicker">LOADING</span>
            <strong>게시글을 불러오는 중입니다.</strong>
            <p>서버에서 최신 커뮤니티 내용을 가져오고 있습니다.</p>
          </section>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="community-detail-page">
        <SiteHeader activeSection="community" />

        <main className="community-detail-shell">
          <section className="community-detail-empty-card">
            <span className="community-detail-empty-kicker">NOT FOUND</span>
            <strong>존재하지 않는 게시글입니다.</strong>
            <p>삭제되었거나 잘못된 주소일 수 있습니다. 게시판으로 돌아가 다시 확인해보세요.</p>
            <div className="community-detail-empty-actions">
              <button type="button" onClick={() => navigate('/community')}>
                게시판으로 돌아가기
              </button>
            </div>
          </section>
        </main>
      </div>
    );
  }

  const liked = !!user && (likedPostIdsByUser[user.email] ?? []).includes(post.id);
  const bookmarked = !!user && (bookmarkedPostIdsByUser[user.email] ?? []).includes(post.id);
  const reported = !!user && (reportedPostIdsByUser[user.email] ?? []).includes(post.id);
  const isMine =
    !!user &&
    (post.authorId === user.email ||
      ('authorEmail' in post && post.authorEmail === user.email));
  const isManager = !!user && isCommunityManagerEmail(user.email);
  const tone = categoryToneMap[post.category ?? '질문'] ?? 'slate';
  const paragraphs = getParagraphs(post.content);
  const summary = getSummary(post.content);
  const communityPosts = posts.length ? posts : DUMMY_POSTS;
  const popularPosts = [...communityPosts]
    .filter((item) => item.id !== post.id)
    .sort((left, right) => (right.viewCount ?? 0) - (left.viewCount ?? 0))
    .slice(0, 3);
  const popularTags = Array.from(
    communityPosts.reduce((counts, item) => {
      item.tags?.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1));
      return counts;
    }, new Map<string, number>())
  )
    .sort((left, right) => right[1] - left[1])
    .slice(0, 8)
    .map(([tag]) => tag);
  const authorPostCount = communityPosts.filter(
    (item) => item.authorId === post.authorId || item.authorName === post.authorName
  ).length;
  const authorStats = isPreviewMode
    ? { posts: 12, followers: 248, following: 17 }
    : { posts: authorPostCount, followers: 0, following: 0 };

  const handleCommentSubmit = async () => {
    const nextValue = commentInput.trim();
    if (!nextValue || isCommentSubmitting) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    setIsCommentSubmitting(true);
    await addComment({
      postId: post.id,
      authorName: user.name,
      authorEmail: user.email,
      content: nextValue,
    }).catch((error) => {
      setIsCommentSubmitting(false);
      throw error;
    });
    pushNotification({
      kind: 'community',
      title: '커뮤니티 댓글 등록',
      body: `"${post.title}" 글에 댓글을 남겼습니다.`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
    setCommentInput('');
    setIsCommentPopupOpen(false);
    setIsCommentSubmitting(false);
    setCommentToastMessage('댓글 달았습니다.');
  };

  const handleOpenCommentPopup = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setCommentToastMessage('');
    setIsCommentPopupOpen(true);
  };

  const handleReplySubmit = async (comment: Comment) => {
    const nextValue = replyInput.trim();
    if (!nextValue || replySubmittingId === comment.id) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    setReplySubmittingId(comment.id);
    await replyComment({
      commentId: comment.id,
      postId: post.id,
      authorName: user.name,
      authorEmail: user.email,
      content: nextValue,
    }).catch((error) => {
      setReplySubmittingId(null);
      throw error;
    });
    pushNotification({
      kind: 'community',
      title: '답글 등록',
      body: `${comment.authorName}님의 댓글에 답글을 남겼습니다.`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
    setReplyTargetId(null);
    setReplyInput('');
    setReplySubmittingId(null);
    setCommentToastMessage('답글을 달았습니다.');
  };

  const handleCommentUpdate = async (comment: Comment) => {
    const nextValue = editingCommentInput.trim();
    if (!nextValue || !user) {
      return;
    }

    await updateComment({
      commentId: comment.id,
      userEmail: user.email,
      content: nextValue,
    });
    setEditingCommentId(null);
    setEditingCommentInput('');
  };

  const handleCommentDelete = async (comment: Comment) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const confirmed = window.confirm('이 댓글을 삭제할까요? 답글이 있으면 함께 삭제됩니다.');
    if (!confirmed) {
      return;
    }

    await deleteComment(comment.id, user.email);
    if (replyTargetId === comment.id) {
      setReplyTargetId(null);
      setReplyInput('');
    }
    if (editingCommentId === comment.id) {
      setEditingCommentId(null);
      setEditingCommentInput('');
    }
  };

  const handleToggleLike = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    await toggleLike(post.id, user.email);
    pushNotification({
      kind: 'community',
      title: liked ? '좋아요 취소' : '커뮤니티 좋아요',
      body: `"${post.title}" 글을 ${liked ? '좋아요 목록에서 뺐습니다.' : '좋아요했습니다.'}`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
  };

  const handleToggleBookmark = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const nextBookmarked = await toggleBookmark(post.id, user.email);
    pushNotification({
      kind: 'community',
      title: nextBookmarked ? '북마크 추가' : '북마크 해제',
      body: `"${post.title}" 글을 ${nextBookmarked ? '저장했습니다.' : '저장 목록에서 뺐습니다.'}`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
  };

  const handleReport = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    await reportPost(post.id, user.email);
    pushNotification({
      kind: 'community',
      title: '게시글 신고 접수',
      body: `"${post.title}" 글 신고가 접수되었습니다.`,
      route: `/community/${post.id}`,
      actorName: user.name,
    });
  };

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title: post.title,
          text: summary,
          url: window.location.href,
        });
        return;
      }

      await navigator.clipboard.writeText(window.location.href);
      setCommentToastMessage('게시글 링크를 복사했습니다.');
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        return;
      }

      console.error(error);
    }
  };

  const handleFollowAuthor = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setCommentToastMessage('팔로우 기능은 프로필 연동 후 사용할 수 있습니다.');
  };

  const handleDelete = async () => {
    if (!user || !isMine) {
      return;
    }

    const confirmed = window.confirm('이 게시글을 삭제할까요?');
    if (!confirmed) {
      return;
    }

    await deletePost(post.id, user.email);
    navigate('/community');
  };

  const handleModerate = async (action: 'delete-post' | 'block-user') => {
    if (!user || !isManager) {
      return;
    }

    const message =
      action === 'delete-post'
        ? '관리자 권한으로 이 게시글을 삭제할까요?'
        : '이 작성자를 차단하면 작성자의 게시글과 댓글이 커뮤니티에서 숨겨집니다. 계속할까요?';

    if (!window.confirm(message)) {
      return;
    }

    await moderatePost(post.id, user.email, action);
    navigate('/community');
  };

  const renderCommentNode = (node: CommentNode, depth = 0) => {
    const comment = node.comment;
    const canManageComment = !!user && (comment.authorEmail === user.email || isManager);
    const isEditing = editingCommentId === comment.id;
    const isReplying = replyTargetId === comment.id;

    return (
      <div key={comment.id} className="community-detail-comment-thread">
        <article
          className={`community-detail-comment-item${depth > 0 ? ' is-reply' : ''}`}
          style={{ marginLeft: depth ? `${Math.min(depth, 3) * 22}px` : undefined }}
        >
          <span className="community-detail-comment-avatar" aria-hidden="true">
            {getAvatarSeed(comment.authorName)}
          </span>
          <div className="community-detail-comment-copy">
            <div className="community-detail-comment-head">
              <strong>{comment.authorName}</strong>
              <span>{formatRelativeTime(comment.createdAt)}</span>
            </div>

            {isEditing ? (
              <div className="community-detail-comment-editor">
                <textarea
                  value={editingCommentInput}
                  onChange={(event) => setEditingCommentInput(event.target.value)}
                  placeholder="수정할 댓글을 입력하세요"
                />
                <div className="community-detail-comment-editor-actions">
                  <button type="button" onClick={() => handleCommentUpdate(comment)}>
                    저장
                  </button>
                  <button
                    type="button"
                    className="community-detail-secondary-button"
                    onClick={() => {
                      setEditingCommentId(null);
                      setEditingCommentInput('');
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : (
              <p>{comment.content}</p>
            )}

            <div className="community-detail-comment-actions">
              <span>좋아요 {formatCount(comment.likeCount)}</span>
              <button
                type="button"
                className="community-detail-comment-action-button"
                onClick={() => {
                  if (!user) {
                    navigate('/login');
                    return;
                  }

                  setEditingCommentId(null);
                  setEditingCommentInput('');
                  setReplyTargetId((current) => (current === comment.id ? null : comment.id));
                  setReplyInput('');
                }}
              >
                답글
              </button>
              {canManageComment ? (
                <>
                  <button
                    type="button"
                    className="community-detail-comment-action-button"
                    onClick={() => {
                      setReplyTargetId(null);
                      setReplyInput('');
                      setEditingCommentId(comment.id);
                      setEditingCommentInput(comment.content);
                    }}
                  >
                    수정
                  </button>
                  <button
                    type="button"
                    className="community-detail-comment-action-button is-danger"
                    onClick={() => handleCommentDelete(comment)}
                  >
                    삭제
                  </button>
                </>
              ) : null}
            </div>

            {isReplying ? (
              <div className="community-detail-comment-editor community-detail-comment-editor--reply">
                <textarea
                  value={replyInput}
                  onChange={(event) => setReplyInput(event.target.value)}
                  placeholder={`${comment.authorName}님에게 답글 남기기`}
                />
                <div className="community-detail-comment-editor-actions">
                  <button
                    type="button"
                    disabled={replySubmittingId === comment.id}
                    onClick={() => handleReplySubmit(comment)}
                  >
                    답글 등록
                  </button>
                  <button
                    type="button"
                    className="community-detail-secondary-button"
                    onClick={() => {
                      setReplyTargetId(null);
                      setReplyInput('');
                    }}
                  >
                    취소
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </article>

        {node.children.length ? (
          <div className="community-detail-comment-replies">
            {node.children.map((child) => renderCommentNode(child, depth + 1))}
          </div>
        ) : null}
      </div>
    );
  };

  return (
    <div className="community-detail-page">
      <SiteHeader activeSection="community" />

      <main className="community-detail-shell">
        <div className="community-detail-layout">
          <div className="community-detail-main-column">
            <article className="community-detail-article-card">
              <button
                type="button"
                className="community-detail-back-button"
                onClick={() => navigate('/community')}
              >
                <span aria-hidden="true">←</span> 게시판으로 돌아가기
              </button>

              <div className="community-detail-badges">
                <span className={`community-detail-category community-detail-category--${tone}`}>
                  {post.category ?? '질문'}
                </span>
                {post.isHot ? <span className="community-detail-hot">HOT</span> : null}
              </div>

              <h1 className="community-detail-title">{post.title}</h1>

              <div className="community-detail-byline-row">
                <div className="community-detail-meta">
                  <span className="community-detail-meta-avatar" aria-hidden="true">
                    {getAvatarSeed(post.authorName)}
                  </span>
                  <span className="community-detail-meta-author">{post.authorName}</span>
                  <span>{formatPostDate(post.createdAt)}</span>
                </div>
                <div className="community-detail-inline-stats" aria-label="게시글 통계">
                  <span><EyeIcon /> {formatCount(post.viewCount)}</span>
                  <span><CommentIcon /> {formatCount(comments.length)}</span>
                  <span><HeartIcon /> {formatCount(post.likeCount)}</span>
                </div>
              </div>

              <div className="community-detail-content">
                {paragraphs.map((paragraph, paragraphIndex) =>
                  isChordProgressionBlock(paragraph) ? (
                    <div className="community-detail-chord-block" key={`${paragraphIndex}-${paragraph}`}>
                      {paragraph.split('\n').map((line, lineIndex) => (
                        <span key={`${lineIndex}-${line}`}>{line}</span>
                      ))}
                    </div>
                  ) : (
                    <p key={`${paragraphIndex}-${paragraph}`}>{paragraph}</p>
                  )
                )}
              </div>

              {post.tags?.length ? (
                <div className="community-detail-tags">
                  {post.tags.map((tag) => (
                    <span key={tag} className="community-detail-tag">
                      #{tag}
                    </span>
                  ))}
                </div>
              ) : null}

              <footer className="community-detail-article-actions">
                <div className="community-detail-action-group">
                  <button
                    type="button"
                    className={`community-detail-action-button community-detail-post-like-button${liked ? ' is-active' : ''}`}
                    onClick={handleToggleLike}
                    aria-pressed={liked}
                  >
                    <HeartIcon />
                    <span>좋아요</span>
                    <strong>{formatCount(post.likeCount)}</strong>
                  </button>
                  <button
                    type="button"
                    className={`community-detail-action-button${bookmarked ? ' is-active' : ''}`}
                    onClick={handleToggleBookmark}
                  >
                    <BookmarkIcon /> {bookmarked ? '북마크 해제' : '북마크'}
                  </button>
                </div>
                <div className="community-detail-action-group community-detail-action-group--right">
                  {isMine ? (
                    <>
                      <button type="button" className="community-detail-text-action" onClick={() => navigate(`/community/write?edit=${post.id}`)}>
                        수정
                      </button>
                      <button type="button" className="community-detail-text-action is-danger" onClick={handleDelete}>
                        삭제
                      </button>
                    </>
                  ) : null}
                  {isManager ? (
                    <>
                      <button type="button" className="community-detail-text-action is-danger" onClick={() => handleModerate('delete-post')}>
                        관리자 삭제
                      </button>
                      <button type="button" className="community-detail-text-action is-danger" onClick={() => handleModerate('block-user')}>
                        작성자 차단
                      </button>
                    </>
                  ) : null}
                  <button
                    type="button"
                    className="community-detail-text-action"
                    onClick={handleReport}
                    disabled={reported}
                  >
                    <ReportIcon /> {reported ? '신고 완료' : '신고하기'}
                  </button>
                  <button type="button" className="community-detail-icon-button" aria-label="게시글 공유" onClick={handleShare}>
                    <ShareIcon />
                  </button>
                </div>
              </footer>
            </article>

            <section className="community-detail-comments-card">
              <h2 className="community-detail-comments-title"><CommentIcon /> 댓글 {comments.length}</h2>

              <div className="community-detail-comment-entry">
                <span className="community-detail-comment-avatar" aria-hidden="true">
                  {user ? getAvatarSeed(user.name) : 'G'}
                </span>
                <button
                  type="button"
                  className="community-detail-comment-open-button"
                  onClick={handleOpenCommentPopup}
                >
                  댓글을 작성해보세요.
                </button>
                <button type="button" className="community-detail-comment-submit-button" onClick={handleOpenCommentPopup}>
                  등록
                </button>
              </div>

              <div className="community-detail-comment-list">
                {commentTree.length ? (
                  commentTree.map((node) => renderCommentNode(node))
                ) : (
                  <div className="community-detail-comment-empty">
                    <CommentIcon />
                    <strong>아직 댓글이 없습니다.</strong>
                    <span>첫 댓글을 남겨보세요!</span>
                  </div>
                )}
              </div>
            </section>
          </div>

          <aside className="community-detail-side-column">
            <section className="community-detail-side-card">
              <h2 className="community-detail-side-title community-detail-author-title"><AuthorIcon /> 작성자 정보</h2>
              <div className="community-detail-author-profile">
                <span className="community-detail-author-avatar" aria-hidden="true">
                  {getAvatarSeed(post.authorName)}
                </span>
                <div className="community-detail-author-copy">
                  <strong>{post.authorName}</strong>
                  <span>{isPreviewMode ? '음악을 좋아하는 학생이에요!' : '작곡밥 커뮤니티 멤버'}</span>
                </div>
                <button type="button" className="community-detail-follow-button" onClick={handleFollowAuthor}>
                  <span aria-hidden="true">＋</span> 팔로우
                </button>
              </div>
              <div className="community-detail-author-stats">
                <span><strong>{authorStats.posts}</strong><small>작성글</small></span>
                <span><strong>{authorStats.followers}</strong><small>팔로워</small></span>
                <span><strong>{authorStats.following}</strong><small>팔로잉</small></span>
              </div>
            </section>

            <section className="community-detail-side-card">
              <div className="community-detail-side-heading-row">
                <h2 className="community-detail-side-title">인기 글</h2>
                <button type="button" onClick={() => navigate('/community')}>더보기 <span aria-hidden="true">›</span></button>
              </div>
              <div className="community-detail-popular-list">
                {popularPosts.map((item, index) => (
                  <button type="button" className="community-detail-popular-post" key={item.id} onClick={() => navigate(`/community/${item.id}`)}>
                    <img src={DETAIL_POPULAR_IMAGES[index % DETAIL_POPULAR_IMAGES.length]} alt="" />
                    <span className="community-detail-popular-copy">
                      <strong>{item.title}</strong>
                      <small>{item.authorName} · {formatRelativeTime(item.createdAt)}</small>
                      <span className="community-detail-popular-stats">
                        <span><EyeIcon /> {formatCount(item.viewCount)}</span>
                        <span><CommentIcon /> {formatCount(item.commentCount)}</span>
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="community-detail-side-card">
              <div className="community-detail-side-heading-row">
                <h2 className="community-detail-side-title">인기 태그</h2>
                <button type="button" onClick={() => navigate('/community')}>더보기 <span aria-hidden="true">›</span></button>
              </div>
              <div className="community-detail-popular-tags">
                {popularTags.map((tag) => (
                  <button type="button" key={tag} onClick={() => navigate(`/community?tag=${encodeURIComponent(tag)}`)}>
                    #{tag}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </div>
      </main>
      {isCommentPopupOpen ? (
        <div
          className="community-detail-comment-modal-backdrop"
          role="presentation"
          onMouseDown={() => setIsCommentPopupOpen(false)}
        >
          <section
            className="community-detail-comment-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="community-comment-modal-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="community-detail-comment-modal-head">
              <strong id="community-comment-modal-title">댓글 작성</strong>
              <button
                type="button"
                aria-label="댓글 작성 닫기"
                onClick={() => setIsCommentPopupOpen(false)}
              >
                ×
              </button>
            </div>
            <textarea
              autoFocus
              value={commentInput}
              onChange={(event) => setCommentInput(event.target.value)}
              placeholder="댓글을 입력해보세요"
            />
            <div className="community-detail-comment-modal-actions">
              <button
                type="button"
                className="community-detail-secondary-button"
                disabled={isCommentSubmitting}
                onClick={() => setIsCommentPopupOpen(false)}
              >
                취소
              </button>
              <button
                type="button"
                className="community-detail-primary-button"
                disabled={isCommentSubmitting || !commentInput.trim()}
                onClick={handleCommentSubmit}
              >
                댓글 달기
              </button>
            </div>
          </section>
        </div>
      ) : null}
      {commentToastMessage ? (
        <div className="community-detail-toast" role="status" aria-live="polite">
          {commentToastMessage}
        </div>
      ) : null}
    </div>
  );
}
