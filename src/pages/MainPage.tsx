import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { LATEST_TRACKS, TRENDING_TRACKS } from '../dummy/mockData';
import type { CommunityTrack } from '../types/community';
import './MainPage.css';

const TRACK_DISPLAY: Record<string, { title: string; mood: string }> = {
  'trend-1': { title: '야경 루프', mood: '오늘의 추천' },
  'trend-2': { title: '시티팝 리프', mood: '가볍게 듣기 좋은 진행' },
  'trend-3': { title: '감성 브리지', mood: '후렴 전에 쓰기 좋은 구조' },
  'trend-4': { title: '미드나잇 훅', mood: '밤 작업용 훅' },
  'trend-5': { title: '딥 하우스 라인', mood: '그루브 아이디어' },
  'trend-6': { title: '필름 OST 테마', mood: '서정적인 진행' },
  'trend-7': { title: '몽환 신스 팝', mood: '공간감 있는 사운드' },
  'trend-8': { title: '그루브 스케치', mood: '가볍게 시작하기' },
  'latest-1': { title: '펑크 스케치', mood: '새로 올라온 곡' },
  'latest-2': { title: '청량 밴드 루프', mood: '밴드 작곡용 루프' },
  'latest-3': { title: '발라드 베이스 아이디어', mood: '입문자용 진행' },
  'latest-4': { title: '모던 재즈 훅', mood: '리듬 변주형 진행' },
};

const TRACK_IMAGE_MAP: Record<string, string> = {
  'trend-1': '/landing-assets/night-loop.jpg',
  'trend-2': '/landing-assets/frost-tower-riff.jpg',
  'trend-3': '/landing-assets/emotional-bridge.jpg',
  'trend-4': '/landing-assets/midnight-hook.jpg',
  'trend-5': '/landing-assets/deep-house-line.jpg',
  'trend-6': '/landing-assets/shared-fallback-film.jpg',
  'trend-7': '/landing-assets/shared-fallback-dream.jpg',
  'trend-8': '/landing-assets/shared-fallback-groove.jpg',
  'latest-1': '/landing-assets/shared-fallback-pink-sketch.jpg',
  'latest-2': '/landing-assets/shared-fallback-band.jpg',
  'latest-3': '/landing-assets/shared-fallback-ballad.jpg',
  'latest-4': '/landing-assets/shared-fallback-jazz.jpg',
};

const GENRE_CHIPS = ['K-pop', 'Lo-fi', 'Ballad', 'City Pop', 'Jazz', 'OST', 'Rock', '...'];

const GENERATOR_TABS = [
  {
    key: 'compose',
    label: '작곡',
    route: '/composer',
    icon: '/landing-icons/compose-pencil.svg',
    prompt: '어떤 곡을 만들고 싶나요?',
    example: '예) 밤 산책 느낌의 시티팝 코드 진행에 짧은 후렴 멜로디 만들기',
    actionLabel: '✦ 바로 작곡하기',
  },
  {
    key: 'lyrics',
    label: '가사',
    route: '/composer?tab=lyrics',
    icon: '/landing-icons/lyrics-document.svg',
    prompt: '어떤 가사를 만들고 싶나요?',
    example: '예) 여름밤의 설렘을 담은 시티팝 후렴 가사 만들기',
    actionLabel: '✦ 가사 작성하기',
  },
  {
    key: 'shared',
    label: '공유곡',
    route: '/community/music',
    icon: '/landing-icons/shared-people.svg',
    prompt: '다른 사람의 공유곡을 들어볼까요?',
    example: '인기 공유곡을 듣고 새로운 작곡 아이디어를 찾아보세요',
    actionLabel: '✦ 공유곡 둘러보기',
  },
] as const;

type GeneratorTabKey = (typeof GENERATOR_TABS)[number]['key'];

const FEATURE_CARDS = [
  {
    label: 'COMPOSER',
    title: '빠른 작곡',
    body: '아이디어를 바로 음악으로',
    icon: '/landing-icons/quick-compose.svg',
    route: '/composer',
  },
  {
    label: 'SHARE',
    title: '함께 만드는 음악',
    body: '친구와 실시간 협업',
    icon: '/landing-icons/collab-music.svg',
    route: '/community/music',
  },
  {
    label: 'COLLAB',
    title: '다양한 스타일',
    body: '원하는 분위기로 자유롭게',
    icon: '/landing-icons/style-bars.svg',
    route: '/collab',
  },
] as const;

const COLLAB_SHOWCASE = [
  {
    title: 'Midnight Session',
    role: '보컬 · 기타 모집',
    image: '/seed-images/music/citypop.svg',
  },
  {
    title: '봄밤 데모',
    role: '피아노 · 믹스 파트너',
    image: '/seed-images/music/canon.svg',
  },
  {
    title: 'Neon Drive',
    role: '베이스 · 드럼',
    image: '/seed-images/music/game-theme.svg',
  },
  {
    title: '별처럼 남아',
    role: '작사 · 편곡',
    image: '/seed-images/music/film-ost.svg',
  },
  {
    title: '우리의 동네',
    role: '프로듀서 모집',
    image: '/seed-images/music/stand-by-me.svg',
  },
  {
    title: 'Down Town Loop',
    role: '신스 · 기타',
    image: '/seed-images/music/pop.svg',
  },
] as const;

const HOT_CHART_DETAILS: Record<
  string,
  {
    artist: string;
    plan: 'Basic' | 'Premium';
    duration: string;
    tags: [string, string];
    downloads: number;
  }
> = {
  'trend-1': {
    artist: 'MangMARU',
    plan: 'Basic',
    duration: '03:05',
    tags: ['차분한 힙합/알앤비', '일렉기타 빠름'],
    downloads: 1842,
  },
  'trend-2': {
    artist: '브금냥',
    plan: 'Basic',
    duration: '01:35',
    tags: ['따뜻한 팝', '신디사이저 빠름'],
    downloads: 1730,
  },
  'trend-3': {
    artist: 'Moopi',
    plan: 'Premium',
    duration: '02:57',
    tags: ['따뜻한 팝', '신디사이저 보통 빠름'],
    downloads: 1654,
  },
  'trend-4': {
    artist: 'slowslow',
    plan: 'Basic',
    duration: '01:16',
    tags: ['몽환적인 팝', '신디사이저 느림'],
    downloads: 1512,
  },
  'trend-5': {
    artist: '휘르리',
    plan: 'Basic',
    duration: '01:46',
    tags: ['몽환적인 팝', '신디사이저 느림'],
    downloads: 1468,
  },
  'trend-6': {
    artist: 'noonroom',
    plan: 'Premium',
    duration: '02:24',
    tags: ['시네마틱 OST', '피아노 보통'],
    downloads: 1395,
  },
  'trend-7': {
    artist: 'cyanlake',
    plan: 'Basic',
    duration: '02:12',
    tags: ['공간감 있는 앰비언트', '패드 느림'],
    downloads: 1328,
  },
  'trend-8': {
    artist: 'groovezip',
    plan: 'Basic',
    duration: '01:58',
    tags: ['경쾌한 그루브', '베이스 빠름'],
    downloads: 1284,
  },
  'latest-1': {
    artist: 'loopkey',
    plan: 'Basic',
    duration: '02:03',
    tags: ['펑키한 팝', '기타 보통'],
    downloads: 1197,
  },
  'latest-2': {
    artist: 'bandnote',
    plan: 'Premium',
    duration: '02:41',
    tags: ['청량한 밴드', '드럼 빠름'],
    downloads: 1139,
  },
  'latest-3': {
    artist: 'pianobox',
    plan: 'Basic',
    duration: '02:18',
    tags: ['아련한 발라드', '베이스 느림'],
    downloads: 1086,
  },
  'latest-4': {
    artist: 'jazzyroom',
    plan: 'Premium',
    duration: '02:36',
    tags: ['모던 재즈', '피아노 보통'],
    downloads: 1032,
  },
};

type HotChartView = 'weekly' | 'genre' | 'monthly';

const HOT_CHART_TABS: Array<{ key: HotChartView; label: string }> = [
  { key: 'weekly', label: '6월 3주차' },
  { key: 'genre', label: '장르별' },
  { key: 'monthly', label: '월간 BGM' },
];

const HOT_CHART_DESCRIPTIONS: Record<HotChartView, string> = {
  weekly: '다운로드와 반응이 빠르게 쌓이는 이번 주 공유곡을 모았습니다.',
  genre: '서로 다른 장르에서 가장 반응이 좋은 대표 공유곡을 골랐습니다.',
  monthly: '한 달 동안 꾸준히 사랑받은 BGM과 루프를 모았습니다.',
};

const MONTHLY_BGM_ORDER = [
  'latest-2',
  'trend-6',
  'latest-1',
  'trend-2',
  'trend-8',
  'trend-1',
  'trend-7',
  'latest-3',
  'trend-5',
  'latest-4',
];
const HOT_CHART_PREVIEW_COUNT = 5;
const HOT_CHART_EXPANDED_COUNT = 10;
const CHART_FAVORITES_STORAGE_KEY = 'song-project-chart-favorites';

function getTrackDisplay(track: CommunityTrack) {
  return TRACK_DISPLAY[track.id] ?? { title: track.title, mood: track.mood };
}

function getTrackCover(track: CommunityTrack) {
  return TRACK_IMAGE_MAP[track.id] ?? '/seed-images/music/pop.svg';
}

function getWaveformBars(seed: string, count = 44) {
  let value = seed.split('').reduce((sum, char) => sum + char.charCodeAt(0), 0);

  return Array.from({ length: count }, (_, index) => {
    value = (value * 1664525 + 1013904223 + index) % 4294967296;
    const normalized = value / 4294967296;
    const swell = Math.sin((index / count) * Math.PI);
    return Math.round(18 + normalized * 42 + swell * 24);
  });
}

export default function MainPage() {
  const navigate = useNavigate();
  const [activeGeneratorTabKey, setActiveGeneratorTabKey] = useState<GeneratorTabKey>('compose');
  const [activeGenre, setActiveGenre] = useState('City Pop');
  const [activeCoverIndex, setActiveCoverIndex] = useState(0);
  const [hotChartView, setHotChartView] = useState<HotChartView>('weekly');
  const [isHotChartExpanded, setIsHotChartExpanded] = useState(false);
  const [collabSlideIndex, setCollabSlideIndex] = useState(0);
  const collabCarouselRef = useRef<HTMLDivElement | null>(null);
  const collabSlideIndexRef = useRef(0);
  const [favoriteTrackIds, setFavoriteTrackIds] = useState<Set<string>>(() => {
    try {
      const stored = JSON.parse(window.localStorage.getItem(CHART_FAVORITES_STORAGE_KEY) ?? '[]');
      return new Set(Array.isArray(stored) ? stored.filter((id): id is string => typeof id === 'string') : []);
    } catch {
      return new Set();
    }
  });
  const showcaseTracks = TRENDING_TRACKS.slice(0, 5);
  const activeGeneratorTab =
    GENERATOR_TABS.find((tab) => tab.key === activeGeneratorTabKey) ?? GENERATOR_TABS[0];
  const featuredTrack = showcaseTracks[activeCoverIndex];
  const featuredTrackDisplay = getTrackDisplay(featuredTrack);
  const chartCandidates = [...TRENDING_TRACKS, ...LATEST_TRACKS].filter(
    (track) => HOT_CHART_DETAILS[track.id]
  );
  const hotChartTrackPool = (() => {
    if (hotChartView === 'monthly') {
      return MONTHLY_BGM_ORDER.map((id) => chartCandidates.find((track) => track.id === id)).filter(
        (track): track is CommunityTrack => Boolean(track)
      );
    }

    const ranked = [...chartCandidates].sort(
      (left, right) => HOT_CHART_DETAILS[right.id].downloads - HOT_CHART_DETAILS[left.id].downloads
    );

    if (hotChartView === 'genre') {
      const selectedGenres = new Set<string>();
      const genreLeaders = ranked.filter((track) => {
        const genre = HOT_CHART_DETAILS[track.id].tags[0];
        if (selectedGenres.has(genre)) return false;
        selectedGenres.add(genre);
        return true;
      });
      return [...genreLeaders, ...ranked.filter((track) => !genreLeaders.includes(track))];
    }

    return ranked;
  })();
  const hotChartLimit = isHotChartExpanded ? HOT_CHART_EXPANDED_COUNT : HOT_CHART_PREVIEW_COUNT;
  const hotChartTracks = hotChartTrackPool.slice(0, hotChartLimit);
  const canExpandHotChart = hotChartTrackPool.length > HOT_CHART_PREVIEW_COUNT;
  const activeCollabDotIndex = collabSlideIndex % COLLAB_SHOWCASE.length;
  const collabCarouselItems = [
    ...COLLAB_SHOWCASE,
    ...COLLAB_SHOWCASE,
    ...COLLAB_SHOWCASE,
    ...COLLAB_SHOWCASE,
    ...COLLAB_SHOWCASE,
  ];

  useEffect(() => {
    let animationFrame = 0;
    let resetFrame = 0;

    const getSlideMetrics = () => {
      const scroller = collabCarouselRef.current;
      const card = scroller?.querySelector<HTMLElement>('.main-collab-card');
      if (!scroller || !card) return null;

      const styles = window.getComputedStyle(scroller);
      const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 18;
      const step = card.getBoundingClientRect().width + gap;
      const middleStart = step * COLLAB_SHOWCASE.length * 2;

      return { scroller, step, middleStart };
    };

    const easeInOut = (progress: number) =>
      progress < 0.5 ? 4 * progress * progress * progress : 1 - Math.pow(-2 * progress + 2, 3) / 2;

    const animateScrollTo = (targetLeft: number, duration = 1_250) => {
      const metrics = getSlideMetrics();
      if (!metrics) return;

      const { scroller } = metrics;
      const startLeft = scroller.scrollLeft;
      const distance = targetLeft - startLeft;
      const startedAt = performance.now();

      window.cancelAnimationFrame(animationFrame);

      const stepFrame = (now: number) => {
        const progress = Math.min((now - startedAt) / duration, 1);
        scroller.scrollLeft = startLeft + distance * easeInOut(progress);

        if (progress < 1) {
          animationFrame = window.requestAnimationFrame(stepFrame);
        }
      };

      animationFrame = window.requestAnimationFrame(stepFrame);
    };

    const resetToMiddle = () => {
      const metrics = getSlideMetrics();
      if (!metrics) return;

      metrics.scroller.scrollLeft = metrics.middleStart;
    };

    resetFrame = window.requestAnimationFrame(resetToMiddle);

    const timer = window.setInterval(() => {
      const metrics = getSlideMetrics();

      if (!metrics) {
        collabSlideIndexRef.current = (collabSlideIndexRef.current + 1) % COLLAB_SHOWCASE.length;
        setCollabSlideIndex(collabSlideIndexRef.current);
        return;
      }

      const nextIndex = (collabSlideIndexRef.current + 1) % COLLAB_SHOWCASE.length;
      const visualStep = collabSlideIndexRef.current + 1;
      const targetLeft = metrics.middleStart + visualStep * metrics.step;

      collabSlideIndexRef.current = nextIndex;
      setCollabSlideIndex(nextIndex);

      animateScrollTo(targetLeft);

      if (visualStep >= COLLAB_SHOWCASE.length) {
        window.setTimeout(() => {
          resetToMiddle();
        }, 1_320);
      }
    }, 3_000);

    const handleResize = () => resetToMiddle();
    window.addEventListener('resize', handleResize);

    return () => {
      window.clearInterval(timer);
      window.cancelAnimationFrame(animationFrame);
      window.cancelAnimationFrame(resetFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, []);
  const toggleChartFavorite = (trackId: string) => {
    setFavoriteTrackIds((current) => {
      const next = new Set(current);
      if (next.has(trackId)) next.delete(trackId);
      else next.add(trackId);
      window.localStorage.setItem(CHART_FAVORITES_STORAGE_KEY, JSON.stringify([...next]));
      return next;
    });
  };

  const moveCollabSlide = (direction: 1 | -1) => {
    const scroller = collabCarouselRef.current;
    const card = scroller?.querySelector<HTMLElement>('.main-collab-card');

    if (!scroller || !card) {
      const nextIndex =
        (collabSlideIndexRef.current + direction + COLLAB_SHOWCASE.length) % COLLAB_SHOWCASE.length;
      collabSlideIndexRef.current = nextIndex;
      setCollabSlideIndex(nextIndex);
      return;
    }

    const styles = window.getComputedStyle(scroller);
    const gap = Number.parseFloat(styles.columnGap || styles.gap || '0') || 18;
    const step = card.getBoundingClientRect().width + gap;
    const loopWidth = step * COLLAB_SHOWCASE.length;
    const middleStart = loopWidth * 2;
    const nextIndex =
      (collabSlideIndexRef.current + direction + COLLAB_SHOWCASE.length) % COLLAB_SHOWCASE.length;

    if (direction > 0 && scroller.scrollLeft >= middleStart + loopWidth - step / 2) {
      scroller.scrollLeft -= loopWidth;
    }

    if (direction < 0 && scroller.scrollLeft <= middleStart - loopWidth + step / 2) {
      scroller.scrollLeft += loopWidth;
    }

    collabSlideIndexRef.current = nextIndex;
    setCollabSlideIndex(nextIndex);

    scroller.scrollBy({
      left: step * direction,
      behavior: 'smooth',
    });
  };

  const downloadChartTrack = (track: CommunityTrack) => {
    const display = getTrackDisplay(track);
    const detail = HOT_CHART_DETAILS[track.id];
    const content = [
      `제목: ${display.title}`,
      `작가: ${detail.artist}`,
      `코드 진행: ${track.progression}`,
      `분위기: ${display.mood}`,
      `태그: ${detail.tags.join(', ')}`,
      `재생 시간: ${detail.duration}`,
      '',
      'Song Project 공유곡 정보',
    ].join('\n');
    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${display.title.replace(/[\\/:*?"<>|]+/g, '-')}.txt`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="main-page">
      <SiteHeader />

      <main className="main-shell">
        <section className="main-hero">
          <div className="main-hero-copy main-reference-copy">
            <span className="main-label">AI와 함께하는 나만의 음악 메이커</span>
            <h1>
              아이디어만 있으면
              <br />
              <span>곡 스케치</span>까지 바로.
            </h1>
            <p>
              멜로디를 찍고, 가사를 얹고, 공유곡을 참고하면서 나만의 곡을 빠르게 만들어보세요.
            </p>

            <div className="main-generator-card main-reference-generator">
              <div className="main-generator-tabs main-reference-tabs">
                {GENERATOR_TABS.map((tab) => (
                  <button
                    key={tab.label}
                    type="button"
                    className={tab.key === activeGeneratorTabKey ? 'is-active' : undefined}
                    aria-pressed={tab.key === activeGeneratorTabKey}
                    onClick={() => setActiveGeneratorTabKey(tab.key)}
                  >
                    <img src={tab.icon} alt="" aria-hidden="true" />
                    {tab.label}
                  </button>
                ))}
              </div>
              <button
                type="button"
                className="main-generator-prompt main-reference-prompt"
                onClick={() => navigate(activeGeneratorTab.route)}
              >
                <span className="main-prompt-label">{activeGeneratorTab.prompt}</span>
                <strong className="main-prompt-example">{activeGeneratorTab.example}</strong>
                <span className="main-prompt-tool" aria-hidden="true">▧</span>
                <span className="main-prompt-count" aria-hidden="true">0/500</span>
              </button>
              <div className="main-chip-row main-reference-chips">
                {GENRE_CHIPS.map((chip) => (
                  <button
                    key={chip}
                    type="button"
                    className={chip === activeGenre ? 'is-active' : undefined}
                    aria-pressed={chip === activeGenre}
                    onClick={() => setActiveGenre(chip)}
                  >
                    {chip}
                  </button>
                ))}
              </div>
              <div className="main-generator-actions main-reference-actions">
                <button
                  type="button"
                  className="main-button is-primary"
                  onClick={() => navigate(activeGeneratorTab.route)}
                >
                  {activeGeneratorTab.actionLabel}
                </button>
                <button type="button" className="main-button" onClick={() => navigate('/community/music')}>
                  레퍼런스 듣기
                </button>
              </div>
            </div>

            <section className="main-feature-grid main-reference-features" aria-label="작곡 서비스 특징">
              {FEATURE_CARDS.map((item) => (
                <button key={item.label} type="button" onClick={() => navigate(item.route)}>
                  <img src={item.icon} alt="" aria-hidden="true" />
                  <span>{item.label}</span>
                  <strong>{item.title}</strong>
                  <small>{item.body}</small>
                </button>
              ))}
            </section>
          </div>

          <div className="main-showcase main-reference-showcase">
            <div className="hero-music-player main-reference-player" aria-label="오늘의 추천곡 플레이어">
              <div
                className="hero-music-cover"
                style={{ backgroundImage: `url(${getTrackCover(featuredTrack)})` }}
              />

              <div className="hero-music-info">
                <div className="hero-music-meta">
                  <span>오늘의 추천곡</span>
                  <button type="button" aria-label="좋아요">
                    ♡
                  </button>
                  <button type="button" aria-label="더보기">
                    ···
                  </button>
                </div>
                <strong>{featuredTrackDisplay.title}</strong>
                <small>{featuredTrackDisplay.mood}</small>
                <em>{featuredTrack.progression}</em>
              </div>

              <div className="hero-music-wave" aria-hidden="true">
                {getWaveformBars(featuredTrack.id, 56).map((height, index) => (
                  <i key={index} style={{ height: `${height}%` }} />
                ))}
              </div>

              <div className="hero-music-time" aria-hidden="true">
                <span>0:42</span>
                <b />
                <span>2:31</span>
              </div>

              <div className="hero-music-controls">
                <button
                  type="button"
                  aria-label="이전 추천곡"
                  onClick={() =>
                    setActiveCoverIndex((current) =>
                      (current - 1 + showcaseTracks.length) % showcaseTracks.length
                    )
                  }
                >
                  ‹
                </button>
                <button type="button" aria-label="추천곡 재생" onClick={() => navigate('/community/music')}>
                  Ⅱ
                </button>
                <button
                  type="button"
                  aria-label="다음 추천곡"
                  onClick={() =>
                    setActiveCoverIndex((current) => (current + 1) % showcaseTracks.length)
                  }
                >
                  ›
                </button>
              </div>

              <div className="hero-music-queue" role="list" aria-label="추천곡 리스트">
                <div className="hero-music-queue-head">
                  <strong>추천곡 리스트</strong>
                  <button type="button" onClick={() => navigate('/community/music')}>
                    전체보기 ›
                  </button>
                </div>
                {showcaseTracks.slice(0, 5).map((track, index) => {
                  const displayTrack = getTrackDisplay(track);
                  const isActive = index === activeCoverIndex;

                  return (
                    <button
                      key={track.id}
                      type="button"
                      className={isActive ? 'is-active' : undefined}
                      onClick={() => setActiveCoverIndex(index)}
                    >
                      <i style={{ backgroundImage: `url(${getTrackCover(track)})` }} aria-hidden="true" />
                      <span>{String(index + 1).padStart(2, '0')}</span>
                      <strong>
                        {displayTrack.title}
                        <small>{track.progression}</small>
                      </strong>
                      <em>{index === 0 ? '2:31' : index === 1 ? '2:08' : index === 2 ? '1:54' : index === 3 ? '2:27' : '2:16'}</em>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </section>

        <section className="main-hot-chart" aria-labelledby="main-hot-chart-title">
          <div className="main-hot-chart-head">
            <span className="main-label">COMMUNITY CHART</span>
            <h2 id="main-hot-chart-title">
              <i aria-hidden="true">
                <b />
                <b />
                <b />
                <b />
              </i>
              공유곡 <em>HOT 10</em>
            </h2>
            <p>{HOT_CHART_DESCRIPTIONS[hotChartView]}</p>
            <div className="main-hot-chart-filters" aria-label="HOT 10 차트 보기">
              {HOT_CHART_TABS.map((tab) => (
                <button
                  key={tab.key}
                  type="button"
                  className={hotChartView === tab.key ? 'is-active' : undefined}
                  aria-pressed={hotChartView === tab.key}
                  onClick={() => {
                    setHotChartView(tab.key);
                    setIsHotChartExpanded(false);
                  }}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          <div className="main-hot-chart-list" key={hotChartView}>
            {hotChartTracks.map((track, index) => {
              const displayTrack = getTrackDisplay(track);
              const detail = HOT_CHART_DETAILS[track.id];
              const isEditorsPick = index === 0;
              const isFavorite = favoriteTrackIds.has(track.id);

              return (
                <article
                  key={track.id}
                  className={`main-hot-chart-row${isEditorsPick ? ' is-editor-pick' : ''}`}
                  role="button"
                  tabIndex={0}
                  onClick={() => navigate('/community/music')}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') navigate('/community/music');
                  }}
                >
                  <span className="main-hot-rank">
                    {isEditorsPick ? (
                      <>
                        <small>Editor&apos;s</small>
                        <strong>PICK</strong>
                      </>
                    ) : (
                      <strong>{index}</strong>
                    )}
                  </span>
                  <span
                    className="main-hot-cover"
                    style={{ backgroundImage: `url(${getTrackCover(track)})` }}
                  />
                  <span className="main-hot-title">
                    <strong>{displayTrack.title}</strong>
                    <small>{detail.artist}</small>
                  </span>
                  <span className={`main-hot-plan is-${detail.plan.toLowerCase()}`}>
                    {detail.plan}
                  </span>
                  <span className="main-hot-play" aria-hidden="true" />
                  <span className="main-hot-wave" aria-hidden="true">
                    {getWaveformBars(track.id, 96).map((height, barIndex) => (
                      <i key={barIndex} style={{ height: `${height}%` }} />
                    ))}
                  </span>
                  <span className="main-hot-duration">{detail.duration}</span>
                  <span className="main-hot-tags">
                    <strong>{detail.tags[0]}</strong>
                    <small>{detail.tags[1]}</small>
                  </span>
                  <span className="main-hot-actions">
                    <i className="is-signal" aria-hidden="true" />
                    <button
                      type="button"
                      className={`main-hot-action-button is-heart${isFavorite ? ' is-active' : ''}`}
                      aria-label={isFavorite ? `${displayTrack.title} 좋아요 취소` : `${displayTrack.title} 좋아요`}
                      aria-pressed={isFavorite}
                      onClick={(event) => {
                        event.stopPropagation();
                        toggleChartFavorite(track.id);
                      }}
                    >
                      {isFavorite ? '♥' : '♡'}
                    </button>
                    <button
                      type="button"
                      className="main-hot-action-button"
                      aria-label={`${displayTrack.title} 다운로드`}
                      onClick={(event) => {
                        event.stopPropagation();
                        downloadChartTrack(track);
                      }}
                    >
                      <i className="is-download" aria-hidden="true" />
                    </button>
                  </span>
                </article>
              );
            })}
          </div>
          {canExpandHotChart ? (
            <button
              type="button"
              className={`main-hot-chart-more${isHotChartExpanded ? ' is-expanded' : ''}`}
              aria-expanded={isHotChartExpanded}
              aria-label={isHotChartExpanded ? '공유곡 차트 5개만 보기' : '공유곡 차트 10개까지 보기'}
              onClick={() => setIsHotChartExpanded((current) => !current)}
            >
              <span aria-hidden="true" />
            </button>
          ) : null}
        </section>

        <section className="main-collab-showcase" aria-labelledby="main-collab-showcase-title">
          <div className="main-collab-showcase-head">
            <span className="main-collab-kicker">JAKGOKBAP COLLAB</span>
            <h2 id="main-collab-showcase-title">
              <span>협업</span>에서 모집 중인 파트
            </h2>
            <i aria-hidden="true" />
            <div className="main-collab-showcase-dots" aria-hidden="true">
              {COLLAB_SHOWCASE.map((item, index) => (
                <span key={item.title} className={index === activeCollabDotIndex ? 'is-active' : undefined} />
              ))}
            </div>
          </div>

          <div className="main-collab-carousel">
            <button
              type="button"
              className="main-collab-arrow is-left"
              aria-label="이전 협업 보기"
              onClick={() => moveCollabSlide(-1)}
            >
              <span />
            </button>
            <div
              ref={collabCarouselRef}
              className="main-collab-card-row"
            >
              {collabCarouselItems.map((item, index) => (
                <button
                  key={`${index}-${item.title}`}
                  type="button"
                  className="main-collab-card"
                  onClick={() => navigate('/collab')}
                >
                  <span className="main-collab-cover" style={{ backgroundImage: `url(${item.image})` }}>
                    <i aria-hidden="true" />
                  </span>
                  <strong>{item.title}</strong>
                  <small>{item.role}</small>
                </button>
              ))}
            </div>
            <button
              type="button"
              className="main-collab-arrow is-right"
              aria-label="다음 협업 보기"
              onClick={() => moveCollabSlide(1)}
            >
              <span />
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}
