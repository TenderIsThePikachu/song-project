import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CommunitySpaceNav from '../../components/community/CommunitySpaceNav';
import TrackWaveform from '../../components/community/TrackWaveform';
import SiteHeader from '../../components/layout/SiteHeader';
import {
  BASE_SHARED_TRACK_LIBRARY,
  MUSIC_SHARE_CATEGORIES,
  MUSIC_SHARE_TAGS,
  buildSharedTrackCard,
  getMusicShareTrackImage,
  type MusicShareCategory,
  type MusicShareTrackCard,
} from '../../dummy/musicShareLibrary';
import { useAuthStore } from '../../store/authStore';
import { useComposerLibraryStore } from '../../store/composerLibraryStore';
import { useMusicShareStore } from '../../store/musicShareStore';
import { useNotificationStore } from '../../store/notificationStore';
import './MusicShare.css';

const PAGE_SIZE = 16;

type SortMode = 'latest' | 'likes' | 'views' | 'downloads';

const SORT_OPTIONS: Array<{ key: SortMode; label: string }> = [
  { key: 'latest', label: '최신순' },
  { key: 'likes', label: '좋아요순' },
  { key: 'views', label: '조회순' },
  { key: 'downloads', label: '다운로드순' },
];

function matchesSearch(track: MusicShareTrackCard, keyword: string) {
  if (!keyword) {
    return true;
  }

  return [
    track.title,
    track.progression,
    track.reference,
    track.category,
    track.creatorName,
    ...(Array.isArray(track.tags) ? track.tags : []),
  ].some((value) => String(value ?? '').toLowerCase().includes(keyword));
}

function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}만`;
  }

  if (value >= 1000) {
    return `${(value / 1000).toFixed(1).replace(/\.0$/, '')}K`;
  }

  return value.toLocaleString('ko-KR');
}

const MUSIC_SHARE_DURATIONS: Record<string, string> = {
  'share-base-1': '2:34',
  'share-base-2': '3:06',
  'share-base-3': '2:42',
  'share-base-4': '3:28',
  'share-base-5': '2:51',
  'share-base-6': '2:08',
  'share-base-7': '3:12',
  'share-base-8': '1:45',
  'share-base-9': '2:19',
};

const MUSIC_SHARE_BASE_METRICS: Record<
  string,
  { likeCount: number; commentCount: number; viewCount: number; downloadCount: number }
> = {
  'share-base-1': { likeCount: 32, commentCount: 5, viewCount: 1200, downloadCount: 48 },
  'share-base-2': { likeCount: 62, commentCount: 11, viewCount: 2800, downloadCount: 91 },
  'share-base-3': { likeCount: 41, commentCount: 6, viewCount: 1800, downloadCount: 61 },
  'share-base-4': { likeCount: 37, commentCount: 7, viewCount: 1300, downloadCount: 45 },
  'share-base-5': { likeCount: 44, commentCount: 6, viewCount: 1700, downloadCount: 57 },
  'share-base-6': { likeCount: 28, commentCount: 4, viewCount: 1500, downloadCount: 52 },
  'share-base-7': { likeCount: 56, commentCount: 8, viewCount: 2100, downloadCount: 73 },
  'share-base-8': { likeCount: 20, commentCount: 3, viewCount: 856, downloadCount: 24 },
  'share-base-9': { likeCount: 49, commentCount: 5, viewCount: 1900, downloadCount: 68 },
};

function getTrackDuration(trackId: string) {
  if (MUSIC_SHARE_DURATIONS[trackId]) {
    return MUSIC_SHARE_DURATIONS[trackId];
  }

  const hash = Array.from(trackId).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  const seconds = 105 + (hash % 106);
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;
}

type MusicShareMetricIconName = 'heart' | 'comment' | 'play' | 'download';

function MusicShareMetricIcon({ name }: { name: MusicShareMetricIconName }) {
  if (name === 'heart') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M20.8 5.9a5.4 5.4 0 0 0-7.6 0L12 7.1l-1.2-1.2a5.4 5.4 0 0 0-7.6 7.6L12 22l8.8-8.5a5.4 5.4 0 0 0 0-7.6Z" />
      </svg>
    );
  }

  if (name === 'comment') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="M21 11.5a8.5 8.5 0 0 1-9 8.5 9.3 9.3 0 0 1-3.8-.8L3 21l1.7-4.5A8.5 8.5 0 1 1 21 11.5Z" />
      </svg>
    );
  }

  if (name === 'play') {
    return (
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <path d="m8 5 11 7-11 7V5Z" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M12 3v12m0 0 4-4m-4 4-4-4M5 19v2h14v-2" />
    </svg>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

function sanitizeFileName(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-');
  return normalized || `track-${Date.now()}`;
}

export default function MusicShare() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useComposerLibraryStore((state) => state.projects);
  const favoriteTrackIdsByUser = useComposerLibraryStore((state) => state.favoriteTrackIdsByUser);
  const toggleFavoriteTrack = useComposerLibraryStore((state) => state.toggleFavoriteTrack);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const likedTrackIdsByUser = useMusicShareStore((state) => state.likedTrackIdsByUser);
  const serverTracks = useMusicShareStore((state) => state.tracks);
  const trackMetricsById = useMusicShareStore((state) => state.trackMetricsById);
  const trackComments = useMusicShareStore((state) => state.comments);
  const toggleTrackLike = useMusicShareStore((state) => state.toggleTrackLike);
  const addTrackComment = useMusicShareStore((state) => state.addTrackComment);
  const recordTrackDownload = useMusicShareStore((state) => state.recordTrackDownload);
  const seedMusicShare = useMusicShareStore((state) => state.seedMusicShare);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [selectedCategory, setSelectedCategory] = useState<MusicShareCategory>('all');
  const [selectedTag, setSelectedTag] = useState('전체');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [sortMode, setSortMode] = useState<SortMode>('latest');
  const [currentPage, setCurrentPage] = useState(1);
  const [commentTrackId, setCommentTrackId] = useState<string | null>(null);
  const [commentInput, setCommentInput] = useState('');

  useEffect(() => {
    void seedLibrary().catch((error) => {
      console.error(error);
    });
    void seedMusicShare().catch((error) => {
      console.error(error);
    });
  }, [seedLibrary, seedMusicShare]);

  const sharedProjectTracks = useMemo(
    () =>
      projects
        .filter((project) => project && typeof project === 'object')
        .map((project) => buildSharedTrackCard(project))
        .filter((track): track is MusicShareTrackCard => Boolean(track)),
    [projects]
  );

  const trackLibrary = useMemo(
    () => [...BASE_SHARED_TRACK_LIBRARY, ...sharedProjectTracks, ...serverTracks],
    [serverTracks, sharedProjectTracks]
  );

  const likedTrackIds = user ? likedTrackIdsByUser[user.email] ?? [] : [];
  const savedTrackIds = user ? favoriteTrackIdsByUser[user.email] ?? [] : [];
  const normalizedKeyword = searchKeyword.trim().toLowerCase();

  const filteredTracks = useMemo(() => {
    const visibleTracks = trackLibrary.filter((track) => {
      const matchesCategory = selectedCategory === 'all' || track.category === selectedCategory;
      const matchesTag =
        selectedTag === '전체' ||
        (Array.isArray(track.tags) && track.tags.includes(selectedTag));

      return matchesCategory && matchesTag && matchesSearch(track, normalizedKeyword);
    });

    return visibleTracks.sort((left, right) => {
      const leftMetrics = trackMetricsById[left.id] ?? {
        likeCount: 0,
        viewCount: 0,
        downloadCount: 0,
      };
      const rightMetrics = trackMetricsById[right.id] ?? {
        likeCount: 0,
        viewCount: 0,
        downloadCount: 0,
      };

      if (sortMode === 'likes') {
        return rightMetrics.likeCount - leftMetrics.likeCount;
      }

      if (sortMode === 'views') {
        return rightMetrics.viewCount - leftMetrics.viewCount;
      }

      if (sortMode === 'downloads') {
        return rightMetrics.downloadCount - leftMetrics.downloadCount;
      }

      return right.createdAt - left.createdAt;
    });
  }, [
    normalizedKeyword,
    selectedCategory,
    selectedTag,
    sortMode,
    trackLibrary,
    trackMetricsById,
  ]);

  const categoryCounts = useMemo(
    () =>
      MUSIC_SHARE_CATEGORIES.reduce<Record<MusicShareCategory, number>>(
        (counts, item) => {
          counts[item.key] =
            item.key === 'all'
              ? trackLibrary.length
              : trackLibrary.filter((track) => track.category === item.key).length;
          return counts;
        },
        {
          all: 0,
          classic: 0,
          pop: 0,
          ballad: 0,
          jazz: 0,
          citypop: 0,
          ost: 0,
          anime: 0,
          game: 0,
          rock: 0,
        }
      ),
    [trackLibrary]
  );

  const selectedTrack = trackLibrary.find((track) => track.id === commentTrackId) ?? null;
  const selectedTrackComments = trackComments
    .filter((comment) => comment.trackId === commentTrackId)
    .sort((left, right) => right.createdAt - left.createdAt);

  const totalPages = Math.max(1, Math.ceil(filteredTracks.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visibleTracks = filteredTracks.slice(startIndex, startIndex + PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  const handleCategoryChange = (nextCategory: MusicShareCategory) => {
    setSelectedCategory(nextCategory);
    setCurrentPage(1);
  };

  const handleTagChange = (tag: string) => {
    setSelectedTag(tag);
    setCurrentPage(1);
  };

  const handleOpenTrack = (track: MusicShareTrackCard) => {
    navigate(`/community/music/${track.id}`);
  };

  const handleToggleTrackLike = async (track: MusicShareTrackCard) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const alreadyLiked = likedTrackIds.includes(track.id);
    await toggleTrackLike(track.id, user.email);
    pushNotification({
      kind: 'music',
      title: alreadyLiked ? '공유곡 좋아요 취소' : '공유곡 좋아요',
      body: `"${track.title}" 곡에 ${alreadyLiked ? '좋아요를 취소했어요.' : '좋아요를 눌렀어요.'}`,
      route: '/community/music',
      actorName: user.name,
    });
  };

  const handleToggleSavedTrack = async (trackId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    await toggleFavoriteTrack(trackId, user.email);
  };

  const handleDownloadTrack = async (track: MusicShareTrackCard) => {
    await recordTrackDownload(track.id, user?.email);

    if (track.projectId) {
      const project = projects.find((item) => item.id === track.projectId);
      if (project) {
        downloadBlob(
          new Blob([JSON.stringify(project.project, null, 2)], { type: 'application/json' }),
          `${sanitizeFileName(track.title)}.json`
        );
      }
    } else {
      downloadBlob(
        new Blob(
          [
            `Title: ${track.title}\n`,
            `Progression: ${track.progression}\n`,
            `Reference: ${track.reference}\n`,
            `Creator: ${track.creatorName}\n`,
          ],
          { type: 'text/plain;charset=utf-8' }
        ),
        `${sanitizeFileName(track.title)}.txt`
      );
    }

    if (user) {
      pushNotification({
        kind: 'music',
        title: '공유곡 다운로드',
        body: `"${track.title}" 곡을 다운로드했어요.`,
        route: '/community/music',
        actorName: user.name,
      });
    }
  };

  const handleCommentSubmit = async () => {
    if (!selectedTrack || !user) {
      navigate('/login');
      return;
    }

    const content = commentInput.trim();
    if (!content) {
      return;
    }

    await addTrackComment({
      trackId: selectedTrack.id,
      authorName: user.name,
      authorEmail: user.email,
      content,
    });
    pushNotification({
      kind: 'music',
      title: '공유곡 댓글 등록',
      body: `"${selectedTrack.title}" 곡에 댓글을 남겼어요.`,
      route: '/community/music',
      actorName: user.name,
    });
    setCommentInput('');
  };

  return (
    <div className="music-share-page">
      <SiteHeader activeSection="community" />
      <div className="music-share-background-copy" aria-hidden="true">
        <span className="is-share">Share<br />your sound</span>
        <span className="is-together">Music brings<br />us together ♪</span>
        <span className="is-ideas">Good<br />Ideas<br />Better<br />Music</span>
        <span className="is-lives">Music<br />Lives<br />Here</span>
      </div>

      <main className="music-share-shell">
        <CommunitySpaceNav active="music" />
        <aside className="music-share-sidebar">
          <div className="music-share-sidebar-head">
            <span className="music-share-sidebar-kicker">MUSIC SHARE</span>
            <strong>장르 탐색</strong>
          </div>

          <div className="music-share-sidebar-list">
            {MUSIC_SHARE_CATEGORIES.map((item) => (
              <button
                key={item.key}
                type="button"
                className={`music-share-sidebar-button${
                  selectedCategory === item.key ? ' is-active' : ''
                }`}
                onClick={() => handleCategoryChange(item.key)}
              >
                <span>{item.label}</span>
                <strong>{categoryCounts[item.key]}</strong>
              </button>
            ))}
          </div>

          <button
            type="button"
            className="music-share-sidebar-link"
            onClick={() => navigate('/community')}
          >
            게시판으로 이동
          </button>
        </aside>

        <section className="music-share-content">
          <div className="music-share-content-head">
            <div>
              <span className="music-share-content-kicker">COMMUNITY MUSIC</span>
              <h1 className="music-share-title">커뮤니티 음악 공유</h1>
              <p className="music-share-description">
                다른 유저의 아이디어와 데모를 듣고 새로운 영감을 받아보세요.
              </p>
            </div>
            <span className="music-share-count">총 {filteredTracks.length}곡</span>
          </div>

          <div className="music-share-toolbar">
            <div className="music-share-toolbar-top">
              <label className="music-share-search" aria-label="음악 검색">
                <input
                  type="search"
                  value={searchKeyword}
                  onChange={(event) => {
                    setSearchKeyword(event.target.value);
                    setCurrentPage(1);
                  }}
                  placeholder="제목, 진행, 태그, 작성자 검색"
                />
              </label>

              <select
                className="music-share-sort-select"
                value={sortMode}
                onChange={(event) => {
                  setSortMode(event.target.value as SortMode);
                  setCurrentPage(1);
                }}
              >
                {SORT_OPTIONS.map((option) => (
                  <option key={option.key} value={option.key}>
                    {option.label}
                  </option>
                ))}
              </select>

              <button
                type="button"
                className="music-share-create-button"
                onClick={() => navigate('/composer')}
              >
                <span aria-hidden="true">＋ ♪</span>
                공유곡 만들기
              </button>
            </div>

            <div className="music-share-tag-row" role="tablist" aria-label="음악 필터">
              {MUSIC_SHARE_TAGS.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`music-share-tag-button${selectedTag === tag ? ' is-active' : ''}`}
                  onClick={() => handleTagChange(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>

          <div className="music-share-grid">
            {visibleTracks.map((track) => {
              const metricChanges = trackMetricsById[track.id] ?? {
                likeCount: 0,
                viewCount: 0,
                downloadCount: 0,
              };
              const baseMetrics = MUSIC_SHARE_BASE_METRICS[track.id];
              const metrics = {
                likeCount: (baseMetrics?.likeCount ?? 0) + metricChanges.likeCount,
                viewCount: (baseMetrics?.viewCount ?? 0) + metricChanges.viewCount,
                downloadCount: (baseMetrics?.downloadCount ?? 0) + metricChanges.downloadCount,
              };
              const commentCount =
                (baseMetrics?.commentCount ?? 0) +
                trackComments.filter((comment) => comment.trackId === track.id).length;
              const isSaved = savedTrackIds.includes(track.id);
              const isLiked = likedTrackIds.includes(track.id);
              const coverImageUrl = getMusicShareTrackImage(track);
              const duration = getTrackDuration(track.id);

              return (
                <article
                  key={track.id}
                  className="music-share-card"
                >
                  <button
                    type="button"
                    className="music-share-card-main"
                    onClick={() => handleOpenTrack(track)}
                    aria-label={`${track.title} 열기`}
                  >
                    <div
                      className="music-share-card-art"
                      style={{
                        backgroundImage: `url(${coverImageUrl})`,
                      }}
                      aria-hidden="true"
                    >
                      <span className="music-share-card-duration">{duration}</span>
                    </div>
                    <div className="music-share-card-header">
                      <div className="music-share-card-meta">
                        {track.isSharedProject ? (
                          <span className="music-share-card-chip">공유 프로젝트</span>
                        ) : null}
                        <span className="music-share-card-author">{track.creatorName}</span>
                      </div>
                    </div>

                    <div className="music-share-card-footer">
                      <strong className="music-share-card-title">{track.title}</strong>
                      <span className="music-share-card-caption">{track.progression}</span>
                      <span className="music-share-card-tags">
                        {track.tags.slice(0, 3).map((tag) => (
                          <span key={`${track.id}-${tag}`}>#{tag}</span>
                        ))}
                      </span>
                      <span className="music-share-card-wave-row">
                        <span className="music-share-card-play-dot">
                          <MusicShareMetricIcon name="play" />
                        </span>
                        <TrackWaveform
                          className="music-share-card-waveform"
                          project={track.project}
                          seed={track.id}
                          bars={54}
                        />
                        <span className="music-share-card-time">0:00 / {duration}</span>
                      </span>
                    </div>
                  </button>

                  <button
                    type="button"
                    className={`music-share-card-favorite-button${isSaved ? ' is-active' : ''}`}
                    aria-label="저장한 곡으로 추가"
                    onClick={(event) => {
                      event.stopPropagation();
                      handleToggleSavedTrack(track.id);
                    }}
                  >
                    {isSaved ? '♥' : '♡'}
                  </button>

                  <div className="music-share-card-stats">
                    <button
                      type="button"
                      className={`music-share-card-stat-button${isLiked ? ' is-active' : ''}`}
                      onClick={() => handleToggleTrackLike(track)}
                      aria-label={`${track.title} 좋아요`}
                    >
                      <span className="music-share-card-stat-icon"><MusicShareMetricIcon name="heart" /></span>
                      <span>{formatCount(metrics.likeCount)}</span>
                    </button>
                    <button
                      type="button"
                      className="music-share-card-stat-button"
                      onClick={() => setCommentTrackId(track.id)}
                      aria-label={`${track.title} 댓글`}
                    >
                      <span className="music-share-card-stat-icon"><MusicShareMetricIcon name="comment" /></span>
                      <span>{formatCount(commentCount)}</span>
                    </button>
                    <button
                      type="button"
                      className="music-share-card-stat-button"
                      onClick={() => handleOpenTrack(track)}
                      aria-label={`${track.title} 재생`}
                    >
                      <span className="music-share-card-stat-icon"><MusicShareMetricIcon name="play" /></span>
                      <span>{formatCount(metrics.viewCount)}</span>
                    </button>
                    <button
                      type="button"
                      className="music-share-card-stat-button"
                      onClick={() => handleDownloadTrack(track)}
                      aria-label={`${track.title} 다운로드`}
                    >
                      <span className="music-share-card-stat-icon"><MusicShareMetricIcon name="download" /></span>
                      <span>{formatCount(metrics.downloadCount)}</span>
                    </button>
                  </div>

                  <div className="music-share-card-stats music-share-card-stats--legacy">
                    <span>조회 {formatCount(metrics.viewCount)}</span>
                    <span>좋아요 {formatCount(metrics.likeCount)}</span>
                    <span>댓글 {formatCount(commentCount)}</span>
                    <span>다운 {formatCount(metrics.downloadCount)}</span>
                  </div>

                  <div className="music-share-card-actions">
                    <button
                      type="button"
                      className={`music-share-card-action${isLiked ? ' is-active' : ''}`}
                      onClick={() => handleToggleTrackLike(track)}
                    >
                      좋아요
                    </button>
                    <button
                      type="button"
                      className="music-share-card-action"
                      onClick={() => setCommentTrackId(track.id)}
                    >
                      댓글
                    </button>
                    <button
                      type="button"
                      className="music-share-card-action"
                      onClick={() => handleDownloadTrack(track)}
                    >
                      다운로드
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          <div className="music-share-pagination">
            {pageNumbers.map((pageNumber) => (
              <button
                key={pageNumber}
                type="button"
                className={`music-share-page-button${safePage === pageNumber ? ' is-active' : ''}`}
                onClick={() => setCurrentPage(pageNumber)}
              >
                {pageNumber}
              </button>
            ))}
          </div>
        </section>
      </main>

      {selectedTrack ? (
        <div className="music-share-comment-overlay" onClick={() => setCommentTrackId(null)}>
          <section
            className="music-share-comment-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="music-share-comment-head">
              <div>
                <strong>{selectedTrack.title}</strong>
                <span>{selectedTrack.reference}</span>
              </div>
              <button type="button" onClick={() => setCommentTrackId(null)}>
                닫기
              </button>
            </div>

            <div className="music-share-comment-list">
              {selectedTrackComments.length ? (
                selectedTrackComments.map((comment) => (
                  <article key={comment.id} className="music-share-comment-item">
                    <strong>{comment.authorName}</strong>
                    <span>{new Date(comment.createdAt).toLocaleDateString('ko-KR')}</span>
                    <p>{comment.content}</p>
                  </article>
                ))
              ) : (
                <div className="music-share-comment-empty">아직 댓글이 없습니다.</div>
              )}
            </div>

            <div className="music-share-comment-form">
              <textarea
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                placeholder="곡에 대한 의견을 남겨보세요."
              />
              <button type="button" onClick={handleCommentSubmit}>
                댓글 등록
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
