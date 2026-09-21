import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommunitySpaceNav from '../../components/community/CommunitySpaceNav';
import PostCard from '../../components/community/PostCard';
import SiteHeader from '../../components/layout/SiteHeader';
import { DUMMY_POSTS } from '../../dummy/mockData';
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

const FALLBACK_POSTS: Post[] = [
  { ...DUMMY_POSTS[0], category: '음악 공유', title: '새로 만든 곡 들어봐주세요! (City Lights)', content: '요즘 시티팝 느낌으로 작업한 곡입니다. 분위기가 어떤지 의견 부탁드려요!', authorName: '하늘음표', tags: ['시티팝', '자작곡', '피드백환영'], createdAt: Date.now() - 5 * 60 * 60 * 1000, viewCount: 320, commentCount: 18, likeCount: 52 },
  { ...DUMMY_POSTS[7], title: '미디 키보드 61키 vs 88키, 뭐가 좋을까요?', authorName: '초보작곡가', tags: ['미디', '장비', '입문'], createdAt: Date.now() - 7 * 60 * 60 * 1000, viewCount: 860, commentCount: 37, likeCount: 24 },
  { ...DUMMY_POSTS[1], category: '음악 공유', title: '바다를 보며 만든 곡 (Waves)', content: '여름 여행에서 영감을 받아 만든 인스트루멘탈 곡이에요. 편하게 들어주세요!', authorName: '파도소리', tags: ['인스트루멘탈', '뉴에이지', '자작곡'], createdAt: Date.now() - 12 * 60 * 60 * 1000, viewCount: 1100, commentCount: 21, likeCount: 91 },
  { ...DUMMY_POSTS[11], title: '작곡할 때 영감을 얻는 5가지 방법', authorName: '노트한장', tags: ['작곡팁', '영감', '작업방식'], createdAt: Date.now() - 24 * 60 * 60 * 1000, viewCount: 950, commentCount: 14, likeCount: 68 },
  { ...DUMMY_POSTS[4], title: '코드 진행 피드백 부탁드립니다 (DEMO)', authorName: '감성온도', tags: ['코드진행', '피드백', '발라드'], createdAt: Date.now() - 26 * 60 * 60 * 1000, viewCount: 640, commentCount: 27, likeCount: 41 },
  ...DUMMY_POSTS.slice(5),
];

const FALLBACK_FEATURED: Post[] = [
  { ...DUMMY_POSTS[2], title: '초보 작곡가가 알아야 할 코드 진행의 기본', content: '작곡을 처음 시작하는 분들을 위해, 가장 자주 쓰이는 코드 진행 패턴을 정리했어요!', authorName: '뮤지션킴', likeCount: 142, commentCount: 32, viewCount: 1200 },
  { ...DUMMY_POSTS[1], title: '이 곡 피드백 부탁드립니다!', content: '처음으로 완성한 곡인데, 편곡이 어색한 것 같아요. 조언 부탁드려요!', authorName: '달빛사운드', likeCount: 89, commentCount: 25, viewCount: 980 },
  { ...DUMMY_POSTS[5], title: '가성비 좋은 오디오 인터페이스 추천해요!', content: '입문자도 쓰기 좋은 가성비 오디오 인터페이스 TOP 5를 정리했습니다.', authorName: '사운드노트', likeCount: 76, commentCount: 18, viewCount: 760 },
];

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

  // Keep the board presentation stable even when the backing store has only a
  // handful of seed records. This is also the visual order used by the design.
  const displayPosts = FALLBACK_POSTS;
  const featuredPosts = FALLBACK_FEATURED;
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
                <strong>전체 게시글 <em>{posts.length > 0 ? filteredPosts.length : 125}개</em></strong>
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
