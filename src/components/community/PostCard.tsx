import type { Post } from '../../types/community';

type PostCardProps = { post: Post; rank: number; onClick: () => void };

const ROW_IMAGES = [
  '/landing-assets/emotional-bridge.jpg', '/landing-assets/shared-fallback-pink-sketch.jpg',
  '/landing-assets/shared-fallback-dream.jpg', '/landing-assets/shared-fallback-film.jpg',
  '/landing-assets/shared-fallback-groove.jpg', '/landing-assets/shared-fallback-jazz.jpg',
];

function formatRelativeTime(timestamp: number) {
  const diff = Date.now() - timestamp;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;
  if (diff < hour) return `${Math.max(1, Math.floor(diff / 60000))}분 전`;
  if (diff < day) return `${Math.max(1, Math.floor(diff / hour))}시간 전`;
  if (diff < day * 7) return `${Math.max(1, Math.floor(diff / day))}일 전`;
  return new Date(timestamp).toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' });
}

function StatIcon({ type }: { type: 'heart' | 'comment' | 'view' }) {
  if (type === 'heart') return <svg viewBox="0 0 20 20"><path d="M10 16.4 3.5 10.5A4 4 0 0 1 9.2 4.9l.8.8.8-.8a4 4 0 0 1 5.7 5.6Z" /></svg>;
  if (type === 'comment') return <svg viewBox="0 0 20 20"><path d="M4 4.5h12v8H9l-4 3v-3H4Z" /></svg>;
  return <svg viewBox="0 0 20 20"><path d="M2.5 10s2.5-4.5 7.5-4.5 7.5 4.5 7.5 4.5-2.5 4.5-7.5 4.5S2.5 10 2.5 10Z" /><circle cx="10" cy="10" r="2.2" /></svg>;
}

export default function PostCard({ post, rank, onClick }: PostCardProps) {
  const isMusicPost = post.category?.includes('음악 공유');

  return (
    <button type="button" className="community-post-row" onClick={onClick}>
      <span className="community-post-thumbnail" style={{ backgroundImage: `url(${ROW_IMAGES[(rank - 1) % ROW_IMAGES.length]})` }} />
      <span className="community-post-main">
        <span className="community-post-main-head">
          <span className="community-post-tag">{post.category ?? '자유'}</span>
          <span className="community-post-title">{post.title}</span>
        </span>
        <span className="community-post-excerpt">{post.content}</span>
        {isMusicPost ? (
          <span className="community-post-audio" aria-hidden="true">
            <b>▶</b>
            <span>{Array.from({ length: 36 }, (_, index) => <i key={index} />)}</span>
            <small>{rank === 1 ? '3:24' : '2:48'}</small>
          </span>
        ) : null}
      </span>
      <span className="community-post-author">
        <span className="community-post-author-head">
          <i
            aria-hidden="true"
            style={{ backgroundImage: `url(${ROW_IMAGES[rank % ROW_IMAGES.length]})` }}
          />
          <b>{post.authorName}<small> · {formatRelativeTime(post.createdAt)}</small></b>
        </span>
        <span className="community-post-tags">{post.tags?.slice(0, 3).map((tag) => <i key={tag}>#{tag}</i>)}</span>
      </span>
      <span className="community-post-stats">
        <span><StatIcon type="heart" />{(post.likeCount ?? 0).toLocaleString('ko-KR')}</span>
        <span><StatIcon type="comment" />{(post.commentCount ?? 0).toLocaleString('ko-KR')}</span>
        <span><StatIcon type="view" />{(post.viewCount ?? 0).toLocaleString('ko-KR')}</span>
      </span>
      <span className="community-post-more">⋮</span>
    </button>
  );
}
