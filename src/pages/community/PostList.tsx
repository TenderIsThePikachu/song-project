import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommunitySpaceNav from '../../components/community/CommunitySpaceNav';
import PostCard from '../../components/community/PostCard';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useCommunityStore } from '../../store/communityStore';
import type { Post } from '../../types/community';
import './PostList.css';

type CategoryKey = 'all' | '질문' | '팁&정보' | '장비' | '작곡' | '피드백';
type SortKey = 'popular' | 'latest' | 'comments';

const CATEGORY_ITEMS: Array<{ key: CategoryKey; label: string }> = [
  { key: 'all', label: '전체' }, { key: '질문', label: '질문' },
  { key: '팁&정보', label: '팁&정보' }, { key: '장비', label: '장비' },
  { key: '작곡', label: '작곡' }, { key: '피드백', label: '피드백' },
];
const SORT_OPTIONS: Array<{ key: SortKey; label: string }> = [
  { key: 'popular', label: '인기순' }, { key: 'latest', label: '최신순' },
  { key: 'comments', label: '댓글순' },
];
const FEATURED_IMAGES = [
  '/landing-assets/shared-fallback-film.jpg',
  '/landing-assets/emotional-bridge.jpg',
  '/landing-assets/shared-fallback-groove.jpg',
];
const GUIDE_ITEMS = [
  '서로를 존중하는 따뜻한 표현을 사용해요.',
  '무단 홍보 및 상업적 게시물은 제한될 수 있어요.',
  '음원 저작권을 존중해요.',
  '건설적인 피드백으로 더 좋은 음악 문화를 만들어요.',
];
const PAGE_SIZE = 8;

function sortPosts(posts: Post[], sortKey: SortKey) {
  const cloned = [...posts];
  if (sortKey === 'latest') return cloned.sort((a, b) => b.createdAt - a.createdAt);
  if (sortKey === 'comments') return cloned.sort((a, b) =>
    (b.commentCount ?? 0) - (a.commentCount ?? 0) || (b.likeCount ?? 0) - (a.likeCount ?? 0));
  return cloned.sort((a, b) =>
    (b.viewCount ?? 0) - (a.viewCount ?? 0) || (b.likeCount ?? 0) - (a.likeCount ?? 0));
}

function matchesSearch(post: Post, term: string) {
  if (!term) return true;
  return [post.title, post.content, post.authorName, post.category, ...(post.tags ?? [])]
    .filter((value): value is string => Boolean(value))
    .some((value) => value.toLowerCase().includes(term));
}

export default function PostList() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const posts = useCommunityStore((state) => state.posts);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const [selectedCategory, setSelectedCategory] = useState<CategoryKey>('all');
  const [sortKey, setSortKey] = useState<SortKey>('popular');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => { void seedCommunity().catch(console.error); }, [seedCommunity]);

  const displayPosts = posts;
  const featuredPosts = useMemo(() => sortPosts(posts, 'popular').slice(0, 3), [posts]);
  const popularTags = useMemo(() => {
    const counts = new Map<string, number>();
    displayPosts.forEach((post) => post.tags?.forEach((tag) => counts.set(tag, (counts.get(tag) ?? 0) + 1)));
    return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
  }, [displayPosts]);
  const matchingPosts = displayPosts.filter((post) => {
    const categoryMatches = selectedCategory === 'all' || post.category === selectedCategory;
    return categoryMatches && matchesSearch(post, searchKeyword.trim().toLowerCase());
  });
  const filteredPosts = sortKey === 'popular' ? matchingPosts : sortPosts(matchingPosts, sortKey);
  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visiblePosts = filteredPosts.slice(startIndex, startIndex + PAGE_SIZE);

  const resetFilters = () => {
    setSelectedCategory('all'); setSortKey('popular'); setSearchKeyword(''); setCurrentPage(1);
  };

  return (
    <div className="community-page community-board-page">
      <SiteHeader activeSection="community" />
      <main className="community-shell community-board-shell">
        <CommunitySpaceNav active="board" />
        <section className="community-board-hero">
          <div>
            <span className="community-board-kicker">ALL DISCUSSIONS</span>
            <h1>커뮤니티 게시판</h1>
            <p>함께 만들고, 듣고, 의견을 나눠보세요.</p>
          </div>
          <button
            type="button"
            className="community-board-write-button"
            onClick={() => navigate(user ? '/community/write' : '/login')}
          >
            <span aria-hidden="true">+</span>
            글쓰기
          </button>
        </section>

        <div className="community-board-layout">
          <section className="community-board-column">
            <div className="community-board-toolbar community-reference-toolbar">
              <label className="community-search" aria-label="게시물 검색">
                <span aria-hidden="true">⌕</span>
                <input type="search" value={searchKeyword} placeholder="제목, 내용, 태그, 작성자로 검색..."
                  onChange={(event) => { setSearchKeyword(event.target.value); setCurrentPage(1); }} />
              </label>
              <div className="community-filter-row" role="tablist" aria-label="게시판 필터">
                {CATEGORY_ITEMS.map((item) => (
                  <button key={item.key} type="button"
                    className={`community-filter-chip${selectedCategory === item.key ? ' is-active' : ''}`}
                    onClick={() => { setSelectedCategory(item.key); setCurrentPage(1); }}>
                    {item.label}
                  </button>
                ))}
                <button type="button" className="community-reset-button" onClick={resetFilters}>↻ 필터 초기화</button>
              </div>
            </div>

            <section className="community-featured-section">
              <div className="community-section-heading">
                <div><strong>🔥 지금 인기 있는 글</strong><span>지금 작곡밥에서 가장 뜨거운 이야기들을 확인해보세요.</span></div>
                <button type="button" onClick={() => setSortKey('popular')}>더보기 ›</button>
              </div>
              <div className="community-featured-grid">
                {featuredPosts.map((post, index) => (
                  <button key={post.id} type="button" className="community-featured-card"
                    onClick={() => navigate(`/community/${post.id}`)}>
                    <span className="community-featured-copy">
                      <span className="community-featured-category">{post.category ?? '자유'}</span>
                      <strong>{post.title}</strong>
                      <span className="community-featured-excerpt">{post.content}</span>
                      <span className="community-featured-meta">
                        <i style={{ backgroundImage: `url(${FEATURED_IMAGES[(index + 1) % FEATURED_IMAGES.length]})` }} />
                        <small>{post.authorName} · {index + 1}일 전</small>
                        <span>♡ {post.likeCount ?? 76}</span>
                        <span>▢ {post.commentCount ?? 18}</span>
                        <span>◉ {(post.viewCount ?? 760).toLocaleString('ko-KR')}</span>
                      </span>
                    </span>
                    <span className="community-featured-art" style={{ backgroundImage: `url(${FEATURED_IMAGES[index]})` }} />
                  </button>
                ))}
              </div>
            </section>

            <section className="community-board-panel community-reference-panel">
              <div className="community-board-summary">
                <strong>전체 게시글 <em>{filteredPosts.length}개</em></strong>
                <div className="community-sort-tabs">
                  {SORT_OPTIONS.map((option) => (
                    <button key={option.key} type="button"
                      className={`community-sort-button${sortKey === option.key ? ' is-active' : ''}`}
                      onClick={() => { setSortKey(option.key); setCurrentPage(1); }}>{option.label}</button>
                  ))}
                </div>
              </div>
              <div className="community-post-board">
                {visiblePosts.length ? visiblePosts.map((post, index) => (
                  <PostCard key={post.id} post={post} rank={startIndex + index + 1}
                    onClick={() => navigate(`/community/${post.id}`)} />
                )) : <div className="community-empty-state">조건에 맞는 게시물이 없습니다.</div>}
              </div>
              <div className="community-board-footer"><div className="community-pagination">
                {Array.from({ length: totalPages }, (_, index) => index + 1).map((page) => (
                  <button key={page} type="button" className={`community-page-button${safePage === page ? ' is-active' : ''}`}
                    onClick={() => setCurrentPage(page)}>{page}</button>
                ))}
              </div></div>
            </section>
          </section>

          <aside className="community-board-sidebar">
            <section className="community-sidebar-card">
              <div className="community-sidebar-title"><strong>▣ 이번 주 인기 태그</strong><span>더보기 ›</span></div>
              <div className="community-popular-tags">
                {(popularTags.length ? popularTags : [['시티팝', 12], ['피드백', 9], ['작곡질문', 8], ['미디', 7]]).map(([tag, count]) => (
                  <button key={tag} type="button" onClick={() => { setSearchKeyword(String(tag)); setCurrentPage(1); }}>
                    #{tag} <small>{count}</small>
                  </button>
                ))}
              </div>
            </section>
            <section className="community-sidebar-card community-guide-card">
              <div className="community-sidebar-title"><strong>▤ 커뮤니티 가이드</strong><span>더보기 ›</span></div>
              <ol>{GUIDE_ITEMS.map((item) => <li key={item}>{item}</li>)}</ol>
            </section>
            <button type="button" className="community-sidebar-promo" onClick={() => navigate('/community/music')}>
              <span>♫</span><span><strong>좋은 음악, 좋은 사람들</strong><small>작곡밥과 함께 더 멋진 음악을 만들어요.</small></span><b>›</b>
            </button>
          </aside>
        </div>
      </main>

      <div className="community-floating-actions">
        <button type="button" className="community-floating-music-button" onClick={() => navigate('/community/music')}>음악 공유</button>
        <button type="button" className="community-floating-write-button" onClick={() => navigate(user ? '/community/write' : '/login')}>+ 글쓰기</button>
      </div>
    </div>
  );
}
