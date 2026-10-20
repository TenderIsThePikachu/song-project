import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { exportSongProjectAsMp3 } from '../../audio/engine';
import SiteHeader from '../../components/layout/SiteHeader';
import TrackWaveform from '../../components/community/TrackWaveform';
import {
  BASE_SHARED_TRACK_LIBRARY,
  buildSharedTrackCard,
  getGenreLabel,
  getMusicShareTrackImage,
  type MusicShareTrackCard,
} from '../../dummy/musicShareLibrary';
import { useAuthStore } from '../../store/authStore';
import { useComposerLibraryStore } from '../../store/composerLibraryStore';
import { useMusicShareStore } from '../../store/musicShareStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useShortsStore } from '../../store/shortsStore';
import { useSongStore } from '../../store/songStore';
import { getProjectFromSharedTrack } from '../../utils/songSketchDna';
import { uploadMusicShareCoverOnServer } from '../../utils/libraryApi';
import './MusicShareDetail.css';

const EDIT_CATEGORY_OPTIONS: Array<{ value: MusicShareTrackCard['category']; label: string }> = [
  { value: 'classic', label: '클래식' },
  { value: 'pop', label: '팝' },
  { value: 'ballad', label: '발라드' },
  { value: 'jazz', label: '재즈' },
  { value: 'citypop', label: '시티팝' },
  { value: 'ost', label: 'OST' },
  { value: 'anime', label: '애니메이션' },
  { value: 'game', label: '게임' },
  { value: 'rock', label: '록' },
];

function formatDate(value: number) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function sanitizeFileName(value: string) {
  const normalized = value.trim().replace(/[\\/:*?"<>|]+/g, '').replace(/\s+/g, '-');
  return normalized || `track-${Date.now()}`;
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

function normalizeText(value?: string) {
  return value?.trim().toLocaleLowerCase('ko-KR') ?? '';
}

function getYouTubeEmbedUrl(value?: string) {
  const rawUrl = value?.trim();
  if (!rawUrl) return '';

  try {
    const url = new URL(rawUrl);
    const hostname = url.hostname.replace(/^www\./, '').toLowerCase();
    let videoId = '';

    if (hostname === 'youtu.be') {
      videoId = url.pathname.split('/').filter(Boolean)[0] ?? '';
    } else if (['youtube.com', 'm.youtube.com', 'music.youtube.com'].includes(hostname)) {
      if (url.pathname === '/watch') {
        videoId = url.searchParams.get('v') ?? '';
      } else {
        const pathParts = url.pathname.split('/').filter(Boolean);
        if (['embed', 'shorts', 'live'].includes(pathParts[0] ?? '')) {
          videoId = pathParts[1] ?? '';
        }
      }
    }

    if (!/^[a-zA-Z0-9_-]{6,15}$/.test(videoId)) return '';

    const embedUrl = new URL(`https://www.youtube.com/embed/${videoId}`);
    const start = url.searchParams.get('start') ?? url.searchParams.get('t');
    if (start && /^\d+$/.test(start)) embedUrl.searchParams.set('start', start);
    return embedUrl.toString();
  } catch {
    return '';
  }
}

function syncShortAudioToVideo(video: HTMLVideoElement, audio: HTMLAudioElement) {
  const targetTime = Number.isFinite(audio.duration) && audio.duration > 0
    ? video.currentTime % audio.duration
    : video.currentTime;

  if (Math.abs(audio.currentTime - targetTime) > 0.3) {
    audio.currentTime = targetTime;
  }
}

export default function MusicShareDetail() {
  const { trackId } = useParams<{ trackId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useComposerLibraryStore((state) => state.projects);
  const deleteTrack = useMusicShareStore((state) => state.deleteTrack);
  const updateTrack = useMusicShareStore((state) => state.updateTrack);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const likedTrackIdsByUser = useMusicShareStore((state) => state.likedTrackIdsByUser);
  const serverTracks = useMusicShareStore((state) => state.tracks);
  const trackMetricsById = useMusicShareStore((state) => state.trackMetricsById);
  const trackComments = useMusicShareStore((state) => state.comments);
  const toggleTrackLike = useMusicShareStore((state) => state.toggleTrackLike);
  const addTrackComment = useMusicShareStore((state) => state.addTrackComment);
  const recordTrackView = useMusicShareStore((state) => state.recordTrackView);
  const recordTrackDownload = useMusicShareStore((state) => state.recordTrackDownload);
  const recordTrackOpen = useMusicShareStore((state) => state.recordTrackOpen);
  const seedMusicShare = useMusicShareStore((state) => state.seedMusicShare);
  const shorts = useShortsStore((state) => state.shorts);
  const seedShorts = useShortsStore((state) => state.seedShorts);
  const loadProject = useSongStore((state) => state.loadProject);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [commentInput, setCommentInput] = useState('');
  const [feedbackBar, setFeedbackBar] = useState('1');
  const [isPreviewPreparing, setIsPreviewPreparing] = useState(false);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);
  const [isEditOpen, setIsEditOpen] = useState(false);
  const [isSavingEdit, setIsSavingEdit] = useState(false);
  const [editError, setEditError] = useState('');
  const [editTitle, setEditTitle] = useState('');
  const [editReference, setEditReference] = useState('');
  const [editProgression, setEditProgression] = useState('');
  const [editCategory, setEditCategory] = useState<MusicShareTrackCard['category']>('pop');
  const [editTags, setEditTags] = useState('');
  const [editYoutubeUrl, setEditYoutubeUrl] = useState('');
  const [editCoverFile, setEditCoverFile] = useState<File | null>(null);
  const [editCoverPreviewUrl, setEditCoverPreviewUrl] = useState('');
  const [editCoverRemoved, setEditCoverRemoved] = useState(false);
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null);
  const previewAudioRef = useRef<HTMLAudioElement | null>(null);
  const previewAudioUrlRef = useRef('');
  const linkedShortVideoRef = useRef<HTMLVideoElement | null>(null);
  const linkedShortAudioRef = useRef<HTMLAudioElement | null>(null);
  const toastTimeoutRef = useRef<number | null>(null);

  const showToast = (message: string, tone: 'success' | 'error' = 'success') => {
    if (toastTimeoutRef.current !== null) {
      window.clearTimeout(toastTimeoutRef.current);
    }

    setToast({ message, tone });
    toastTimeoutRef.current = window.setTimeout(() => {
      setToast(null);
      toastTimeoutRef.current = null;
    }, 3000);
  };

  // 여기서 seedLibrary와 seedMusicShare가 사용됩니다. (에러 방지)
  useEffect(() => {
    void seedLibrary().catch((error) => {
      console.error(error);
    });
    void seedMusicShare().catch((error) => {
      console.error(error);
    });
    void seedShorts().catch((error) => {
      console.error(error);
    });
  }, [seedLibrary, seedMusicShare, seedShorts]);

  const trackLibrary = useMemo(
    () => [
      ...BASE_SHARED_TRACK_LIBRARY,
      ...projects
        .filter((project) => project && typeof project === 'object')
        .map((project) => buildSharedTrackCard(project))
        .filter((track): track is MusicShareTrackCard => Boolean(track)),
      ...serverTracks,
    ],
    [projects, serverTracks]
  );

  const track = serverTracks.find((item) => item.id === trackId)
    ?? trackLibrary.find((item) => item.id === trackId)
    ?? null;
  const trackImageUrl = track ? getMusicShareTrackImage(track) : '';
  const youtubeEmbedUrl = track ? getYouTubeEmbedUrl(track.youtubeUrl) : '';
  const metrics = track ? trackMetricsById[track.id] ?? { likeCount: 0, viewCount: 0, downloadCount: 0 } : null;
  
  const comments = useMemo(
    () =>
      track
        ? trackComments
            .filter((comment) => comment.trackId === track.id)
            .sort((left, right) => right.createdAt - left.createdAt)
        : [],
    [track, trackComments]
  );
  
  const liked = !!user && !!track && (likedTrackIdsByUser[user.email] ?? []).includes(track.id);
  const trackProject = useMemo(() => {
    if (!track) return null;
    return projects.find((item) => item.id === track.projectId)?.project ?? track.project ?? null;
  }, [projects, track]);
  const linkedShort = useMemo(() => {
    if (!track) return null;

    const normalizedTrackTitle = normalizeText(track.title);
    const normalizedTrackCreatorEmail = normalizeText(track.creatorEmail);

    return [...shorts]
      .filter((short) => {
        if (!short.videoUrl) return false;
        if (short.visibility === 'private' && short.creatorEmail !== user?.email) return false;

        const hasMatchingId =
          short.musicShareTrackId === track.id ||
          short.musicProjectId === track.id ||
          Boolean(track.projectId && short.musicProjectId === track.projectId);
        const hasMatchingIdentity =
          Boolean(normalizedTrackTitle) &&
          normalizeText(short.musicProjectTitle) === normalizedTrackTitle &&
          (!normalizedTrackCreatorEmail || normalizeText(short.creatorEmail) === normalizedTrackCreatorEmail);

        return hasMatchingId || hasMatchingIdentity;
      })
      .sort((left, right) => right.createdAt - left.createdAt)[0] ?? null;
  }, [shorts, track, user?.email]);

  useEffect(() => {
    return () => {
      previewAudioRef.current?.pause();
      previewAudioRef.current = null;
      if (previewAudioUrlRef.current) URL.revokeObjectURL(previewAudioUrlRef.current);
      previewAudioUrlRef.current = '';
      if (toastTimeoutRef.current !== null) window.clearTimeout(toastTimeoutRef.current);
    };
  }, [trackId]);
  // 🌟 무한 루프 방지용 코드 (순서가 중요합니다! 반드시 track이 정의된 아래에 있어야 합니다)
  const currentTrackId = track?.id;
  const currentUserEmail = user?.email;

  useEffect(() => {
    if (!currentTrackId) {
      return;
    }

    void recordTrackView(currentTrackId, currentUserEmail);
    if (currentUserEmail) {
      void recordTrackOpen(currentTrackId, currentUserEmail);
    }
  }, [recordTrackOpen, recordTrackView, currentTrackId, currentUserEmail]);

  if (!track || !metrics) {
    return (
      <div className="music-share-detail-page">
        <SiteHeader activeSection="community" />
        <main className="music-share-detail-shell">
          <section className="music-share-detail-empty">
            <strong>선택한 공유곡을 찾을 수 없습니다.</strong>
            <button type="button" onClick={() => navigate('/community/music')}>
              음악 공유로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  const handleRequireLogin = () => {
    navigate('/login');
  };

  const handleToggleLike = async () => {
    if (!user) {
      handleRequireLogin();
      return;
    }

    await toggleTrackLike(track.id, user.email);
    pushNotification({
      kind: 'music',
      title: liked ? '공유곡 좋아요 취소' : '공유곡 좋아요',
      body: `"${track.title}" 곡을 ${liked ? '좋아요에서 뺐습니다.' : '좋아요했습니다.'}`,
      route: `/community/music/${track.id}`,
      actorName: user.name,
    });
  };

  const handleDownload = async () => {
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
  };

  const handleOpenComposer = () => {
    loadProject(getProjectFromSharedTrack(track, trackProject ?? undefined));
    navigate('/composer?source=shared-track');
  };

  const handleTogglePreview = async () => {
    if (previewAudioRef.current) {
      if (previewAudioRef.current.paused) {
        await previewAudioRef.current.play();
        setIsPreviewPlaying(true);
      } else {
        previewAudioRef.current.pause();
        setIsPreviewPlaying(false);
      }
      return;
    }

    setIsPreviewPreparing(true);
    try {
      const storedAudioUrl = track.audioUrl?.trim();
      const audioUrl = storedAudioUrl || URL.createObjectURL(
        await exportSongProjectAsMp3(
          getProjectFromSharedTrack(track, trackProject ?? undefined)
        )
      );
      const audio = new Audio(audioUrl);
      audio.onended = () => setIsPreviewPlaying(false);
      previewAudioUrlRef.current = storedAudioUrl ? '' : audioUrl;
      previewAudioRef.current = audio;
      await audio.play();
      setIsPreviewPlaying(true);
    } catch (error) {
      console.error('Track preview failed:', error);
      showToast('미리듣기를 준비하지 못했습니다. 잠시 후 다시 시도해 주세요.', 'error');
    } finally {
      setIsPreviewPreparing(false);
    }
  };

  const handleOpenYouTube = () => {
    if (track.youtubeUrl && /^https?:\/\//i.test(track.youtubeUrl)) {
      window.open(track.youtubeUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    const query = encodeURIComponent(`${track.title} ${track.creatorName}`);
    window.open(`https://www.youtube.com/results?search_query=${query}`, '_blank', 'noopener,noreferrer');
  };

  const handleShareTrack = async () => {
    const url = window.location.href;
    if (navigator.share) {
      try {
        await navigator.share({ title: track.title, text: `${track.creatorName}의 공유곡`, url });
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === 'AbortError') return;
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      showToast('공유 링크를 복사했습니다.');
    } catch (error) {
      console.error('Share link copy failed:', error);
      showToast('공유 링크를 복사하지 못했습니다.', 'error');
    }
  };

const isOwner = Boolean(
  user &&
  track &&
  (track.creatorEmail
    ? normalizeText(user.email) === normalizeText(track.creatorEmail)
    : user.name === track.creatorName)
);

const handleOpenEdit = () => {
  if (!isOwner) return;
  setEditTitle(track.title);
  setEditReference(track.reference);
  setEditProgression(track.progression);
  setEditCategory(track.category);
  setEditTags(track.tags.join(', '));
  setEditYoutubeUrl(track.youtubeUrl ?? '');
  setEditCoverFile(null);
  setEditCoverPreviewUrl(track.imageUrl || getMusicShareTrackImage(track));
  setEditCoverRemoved(false);
  setEditError('');
  setIsEditOpen(true);
};

const handleSelectEditCover = (event: React.ChangeEvent<HTMLInputElement>) => {
  const file = event.target.files?.[0] ?? null;
  event.target.value = '';
  if (!file) return;

  if (!file.type.startsWith('image/')) {
    setEditError('이미지 파일만 선택할 수 있습니다.');
    return;
  }

  if (file.size > 8 * 1024 * 1024) {
    setEditError('커버 이미지는 8MB 이하로 선택해 주세요.');
    return;
  }

  if (editCoverPreviewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(editCoverPreviewUrl);
  }
  setEditCoverFile(file);
  setEditCoverPreviewUrl(URL.createObjectURL(file));
  setEditCoverRemoved(false);
  setEditError('');
};

const handleRemoveEditCover = () => {
  if (editCoverPreviewUrl.startsWith('blob:')) {
    URL.revokeObjectURL(editCoverPreviewUrl);
  }
  setEditCoverFile(null);
  setEditCoverPreviewUrl('');
  setEditCoverRemoved(true);
};

const handleSaveEdit = async (event: React.FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  if (!user || !isOwner || isSavingEdit) return;

  const title = editTitle.trim();
  if (!title) {
    setEditError('곡 제목을 입력해 주세요.');
    return;
  }

  const youtubeUrl = editYoutubeUrl.trim();
  if (youtubeUrl) {
    try {
      const parsedUrl = new URL(youtubeUrl);
      const hostname = parsedUrl.hostname.replace(/^www\./, '').toLowerCase();
      if (!['youtube.com', 'm.youtube.com', 'music.youtube.com', 'youtu.be'].includes(hostname)) {
        throw new Error('invalid host');
      }
    } catch {
      setEditError('올바른 유튜브 링크를 입력해 주세요.');
      return;
    }
  }

  setIsSavingEdit(true);
  setEditError('');
  try {
    const uploadedCover = editCoverFile
      ? await uploadMusicShareCoverOnServer({ file: editCoverFile, creatorEmail: user.email })
      : null;

    await updateTrack({
      trackId: track.id,
      creatorEmail: user.email,
      title,
      reference: editReference.trim(),
      progression: editProgression.trim(),
      category: editCategory,
      tags: editTags.split(',').map((tag) => tag.trim()).filter(Boolean),
      youtubeUrl,
      imageUrl: uploadedCover?.imageUrl ?? (editCoverRemoved ? '' : track.imageUrl),
    });
    if (editCoverPreviewUrl.startsWith('blob:')) {
      URL.revokeObjectURL(editCoverPreviewUrl);
    }
    setIsEditOpen(false);
  } catch (error) {
    setEditError(error instanceof Error ? error.message : '공유곡을 수정하지 못했습니다.');
  } finally {
    setIsSavingEdit(false);
  }
};

const handleDeleteTrack = async () => {
  // 🌟 [에러 2 해결] user나 track 데이터가 없으면 아예 함수 실행을 막습니다.
  if (!user || !track) {
    return;
  }

  // 사용자에게 삭제 확인받기
  if (!window.confirm('정말로 이 공유곡을 삭제하시겠습니까? \n삭제된 곡은 복구할 수 없습니다.')) {
    return;
  }

  try {
    // 삭제 실행
    await deleteTrack(track.id);
    
    // 알림 띄우기
    pushNotification({
      kind: 'music',
      title: '삭제 완료',
      body: `"${track.title}" 곡이 목록에서 삭제되었습니다.`,
      route: '/community/music',
      // 위에서 if (!user) return; 으로 걸러냈기 때문에 여기서 에러가 나지 않습니다!
      actorName: user.name, 
    });
    
    // 삭제 후 목록으로 이동
    navigate('/community/music', { replace: true });
    
  } catch (error) {
    console.error('글 삭제 중 오류 발생:', error);
    showToast('삭제에 실패했습니다. 다시 시도해 주세요.', 'error');
  }
};

  const handleCommentSubmit = async () => {
    if (!user) {
      handleRequireLogin();
      return;
    }

    const content = commentInput.trim();
    if (!content) {
      return;
    }

    const normalizedBar = Math.max(1, Number.parseInt(feedbackBar, 10) || 1);
    await addTrackComment({
      trackId: track.id,
      authorName: user.name,
      authorEmail: user.email,
      content: `[${normalizedBar}마디] ${content}`,
    });
    setCommentInput('');
  };

  
  return (
    <div className="music-share-detail-page">
      <SiteHeader activeSection="community" />

      <main className="music-share-detail-shell">
        <section className="music-share-detail-hero">
          <div className="music-share-detail-copy">
            <span className="music-share-detail-kicker">{track.category ? track.category.toUpperCase() : 'ETC'}</span>
            <h1>{track.title}</h1>
            <p>{track.reference}</p>
            <div className="music-share-detail-meta">
              <span>{track.creatorName}</span>
              <span>{formatDate(track.createdAt)}</span>
              <span>{track.progression}</span>
            </div>
            <TrackWaveform
              className="music-share-detail-waveform"
              project={track.project}
              seed={track.id}
              bars={112}
            />
          </div>
          <div className="music-share-detail-hero-cover">
            <img src={trackImageUrl} alt={`${track.title} 커버`} />
          </div>
        </section>

        <section className="music-share-detail-layout">
          <article className="music-share-detail-panel">
            <div className="music-share-detail-panel-head">
              <strong>곡 정보</strong>
              <span>진행과 레퍼런스를 기준으로 바로 열어볼 수 있습니다.</span>
            </div>

            <div className="music-share-detail-tags">
              {track.tags?.map((tag) => (
                <span key={tag}>#{tag}</span>
              ))}
            </div>

            <section className="music-share-detail-player-card" aria-label={`${track.title} 미리듣기`}>
              <div className="music-share-detail-player-head">
                <div>
                  <span>공유곡</span>
                  <strong>{track.title}</strong>
                </div>
                <button
                  type="button"
                  className={`music-share-detail-play-button${isPreviewPlaying ? ' is-playing' : ''}`}
                  onClick={() => void handleTogglePreview()}
                  disabled={isPreviewPreparing}
                  aria-label={isPreviewPlaying ? '미리듣기 일시정지' : '미리듣기 재생'}
                >
                  <i aria-hidden="true" />
                </button>
              </div>

              <p className="music-share-detail-player-meta">
                {getGenreLabel(track.category)} · {track.progression}
              </p>

              {linkedShort?.videoUrl ? (
                <div className="music-share-detail-player-preview has-short-video">
                  <video
                    ref={linkedShortVideoRef}
                    src={linkedShort.videoUrl}
                    controls
                    playsInline
                    preload="metadata"
                    aria-label={`${linkedShort.title} 숏폼 영상`}
                    muted={Boolean(linkedShort.audioUrl)}
                    onPlay={(event) => {
                      const audio = linkedShortAudioRef.current;
                      if (!audio) return;
                      syncShortAudioToVideo(event.currentTarget, audio);
                      void audio.play().catch(() => undefined);
                    }}
                    onPause={() => linkedShortAudioRef.current?.pause()}
                    onSeeked={(event) => {
                      const audio = linkedShortAudioRef.current;
                      if (audio) syncShortAudioToVideo(event.currentTarget, audio);
                    }}
                    onTimeUpdate={(event) => {
                      const audio = linkedShortAudioRef.current;
                      if (audio) syncShortAudioToVideo(event.currentTarget, audio);
                    }}
                  />
                  {linkedShort.audioUrl ? (
                    <audio
                      ref={linkedShortAudioRef}
                      src={linkedShort.audioUrl}
                      preload="metadata"
                      aria-hidden="true"
                    />
                  ) : null}
                </div>
              ) : youtubeEmbedUrl ? (
                <div className="music-share-detail-player-preview has-youtube-video">
                  <iframe
                    src={youtubeEmbedUrl}
                    title={`${track.title} 유튜브 영상`}
                    loading="lazy"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                    referrerPolicy="strict-origin-when-cross-origin"
                    allowFullScreen
                  />
                </div>
              ) : (
                <button
                  type="button"
                  className="music-share-detail-player-preview"
                  onClick={() => void handleTogglePreview()}
                  disabled={isPreviewPreparing}
                  aria-label={isPreviewPlaying ? '미리듣기 일시정지' : '미리듣기 재생'}
                >
                  <span className={`music-share-detail-preview-play${isPreviewPlaying ? ' is-playing' : ''}`}>
                    <i aria-hidden="true" />
                  </span>
                  {isPreviewPreparing ? <b>미리듣기 준비 중</b> : null}
                </button>
              )}

              <button type="button" className="music-share-detail-service-link" onClick={handleOpenYouTube}>
                <span className="music-share-detail-youtube-icon" aria-hidden="true"><i /></span>
                <strong>유튜브</strong>
                <em aria-hidden="true">›</em>
              </button>

              <div className="music-share-detail-player-actions">
                <button type="button" onClick={() => void handleShareTrack()}>공유</button>
                {isOwner ? <button type="button" onClick={handleOpenEdit}>수정</button> : null}
              </div>
            </section>

            <div className="music-share-detail-actions">
              <button
                type="button"
                className={`music-share-detail-button${liked ? ' is-active' : ''}`}
                onClick={handleToggleLike}
              >
                {liked ? '좋아요 취소' : '좋아요'}
              </button>
              <button
                type="button"
                className="music-share-detail-button"
                onClick={handleDownload}
              >
                다운로드
              </button>
              <button
                type="button"
                className="music-share-detail-button is-primary"
                onClick={handleOpenComposer}
              >
                작곡 화면에서 열기
              </button>
            </div>
          </article>

          <article className="music-share-detail-panel">
            <div className="music-share-detail-panel-head">
              <strong>댓글</strong>
              <span>{comments.length}개의 반응이 이어지고 있습니다.</span>
            </div>

            <div className="music-share-detail-comment-form">
              <label className="music-share-detail-bar-field">
                <span>피드백 마디</span>
                <input
                  type="number"
                  min="1"
                  max="999"
                  value={feedbackBar}
                  onChange={(event) => setFeedbackBar(event.target.value)}
                />
              </label>
              <textarea
                value={commentInput}
                onChange={(event) => setCommentInput(event.target.value)}
                placeholder="선택한 마디에 대한 피드백을 남겨보세요"
              />
              <button type="button" onClick={handleCommentSubmit}>
                댓글 등록
              </button>
              {isOwner && (
                <button
                  type="button"
                  className="music-share-detail-button"
                  onClick={handleDeleteTrack}
                  style={{ color: '#ff4d4f', borderColor: '#ff4d4f' }} // 빨간색으로 위험(삭제) 버튼임을 강조
                >
                  삭제하기
                </button>
                )}
            </div>

            <div className="music-share-detail-comment-list">
              {comments.length ? (
                comments.map((comment) => (
                  <article key={comment.id} className="music-share-detail-comment-card">
                    <div className="music-share-detail-comment-meta">
                      <strong>{comment.authorName}</strong>
                      <span>{formatDate(comment.createdAt)}</span>
                    </div>
                    <p>{comment.content}</p>
                  </article>
                ))
              ) : (
                <div className="music-share-detail-comment-empty">
                  아직 댓글이 없습니다.
                </div>
              )}
            </div>
          </article>
        </section>
      </main>

      {isEditOpen ? (
        <div className="music-share-edit-overlay" role="presentation" onMouseDown={() => !isSavingEdit && setIsEditOpen(false)}>
          <form
            className="music-share-edit-dialog"
            aria-label="공유곡 수정"
            onSubmit={handleSaveEdit}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <header>
              <div><span>MY SHARED MUSIC</span><strong>공유곡 수정</strong></div>
              <button type="button" aria-label="수정 창 닫기" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>×</button>
            </header>

            <label><span>곡 제목</span><input value={editTitle} onChange={(event) => setEditTitle(event.target.value)} maxLength={80} /></label>
            <div className="music-share-edit-row">
              <label><span>장르</span><select value={editCategory} onChange={(event) => setEditCategory(event.target.value as MusicShareTrackCard['category'])}>{EDIT_CATEGORY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select></label>
              <label><span>코드 진행</span><input value={editProgression} onChange={(event) => setEditProgression(event.target.value)} maxLength={120} /></label>
            </div>
            <label><span>곡 설명</span><textarea value={editReference} onChange={(event) => setEditReference(event.target.value)} maxLength={300} /></label>
            <label><span>태그</span><input value={editTags} onChange={(event) => setEditTags(event.target.value)} placeholder="발라드, 감성, 피아노" /></label>
            <label><span>유튜브 링크</span><input type="url" value={editYoutubeUrl} onChange={(event) => setEditYoutubeUrl(event.target.value)} placeholder="https://www.youtube.com/watch?v=..." /></label>

            <div className="music-share-edit-cover-field">
              <span>커버 이미지</span>
              <div className="music-share-edit-cover-content">
                <div className={`music-share-edit-cover-preview${editCoverPreviewUrl ? '' : ' is-empty'}`}>
                  {editCoverPreviewUrl ? <img src={editCoverPreviewUrl} alt="변경할 커버 미리보기" /> : <span>기본 이미지 사용</span>}
                </div>
                <div className="music-share-edit-cover-actions">
                  <label className="music-share-edit-cover-picker">
                    <span>{editCoverFile ? '다른 이미지 선택' : '이미지 선택'}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" onChange={handleSelectEditCover} disabled={isSavingEdit} />
                  </label>
                  {(track.imageUrl || editCoverFile) && !editCoverRemoved ? (
                    <button type="button" onClick={handleRemoveEditCover} disabled={isSavingEdit}>이미지 삭제</button>
                  ) : null}
                  <small>JPG, PNG, WebP · 최대 8MB</small>
                </div>
              </div>
            </div>

            {editError ? <p className="music-share-edit-error">{editError}</p> : null}
            <footer>
              <button type="button" onClick={() => setIsEditOpen(false)} disabled={isSavingEdit}>취소</button>
              <button type="submit" className="is-primary" disabled={isSavingEdit}>{isSavingEdit ? '저장 중...' : '저장'}</button>
            </footer>
          </form>
        </div>
      ) : null}

      {toast ? (
        <div
          className={`music-share-detail-toast is-${toast.tone}`}
          role={toast.tone === 'error' ? 'alert' : 'status'}
          aria-live={toast.tone === 'error' ? 'assertive' : 'polite'}
        >
          <span aria-hidden="true">{toast.tone === 'error' ? '!' : '✓'}</span>
          <p><strong>{toast.tone === 'error' ? '처리하지 못했습니다' : '완료되었습니다'}</strong>{toast.message}</p>
          <button type="button" aria-label="알림 닫기" onClick={() => setToast(null)}>×</button>
        </div>
      ) : null}
    </div>
  );
}
