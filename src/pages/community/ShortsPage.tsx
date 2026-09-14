import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useShortsStore } from '../../store/shortsStore';
import {
  SHORT_TONE_BACKGROUNDS,
  type ShortItem,
  type ShortTone,
  type ShortVisibility,
} from '../../types/shorts';
import {
  readShortVideoFile,
} from '../../utils/shortsVideoStorage';
import { uploadShortAudioOnServer, uploadShortVideoOnServer } from '../../utils/shortsApi';
import './ShortsPage.css';

type ShortsFilter = 'all' | 'mine' | 'liked';

type ShortsFormState = {
  title: string;
  description: string;
  tags: string;
  durationLabel: string;
  tone: ShortTone;
  visibility: ShortVisibility;
  videoUrl: string;
  videoStorageKey: string;
  fileName: string;
  audioUrl: string;
  audioStorageKey: string;
  audioFileName: string;
};

const MAX_VIDEO_SIZE = 50 * 1024 * 1024;
const MAX_AUDIO_SIZE = 15 * 1024 * 1024;

function getShortUploadErrorMessage(error: unknown) {
  const code =
    typeof error === 'object' && error && 'code' in error
      ? String((error as { code?: unknown }).code ?? '')
      : '';

  if (code.includes('storage/unauthorized') || code.includes('permission-denied')) {
    return '업로드 권한이 없습니다. 다시 로그인한 뒤 시도해 주세요.';
  }

  if (code.includes('storage/quota-exceeded')) {
    return '저장 공간이 부족해 업로드하지 못했습니다.';
  }

  if (code.includes('storage/retry-limit-exceeded') || code.includes('network')) {
    return '네트워크 연결이 불안정합니다. 잠시 후 다시 시도해 주세요.';
  }

  return error instanceof Error
    ? `숏폼 등록에 실패했습니다: ${error.message}`
    : '숏폼 등록에 실패했습니다. 로그인 상태와 업로드 서버를 확인해 주세요.';
}

const FILTER_OPTIONS: Array<{ key: ShortsFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'mine', label: '내 업로드' },
  { key: 'liked', label: '좋아요한 숏폼' },
];

const TONE_OPTIONS: Array<{ key: ShortTone; label: string }> = [
  { key: 'lime', label: 'Lime' },
  { key: 'cyan', label: 'Cyan' },
  { key: 'violet', label: 'Violet' },
  { key: 'amber', label: 'Amber' },
];

const EMPTY_FORM: ShortsFormState = {
  title: '',
  description: '',
  tags: '',
  durationLabel: '0:15',
  tone: 'lime',
  visibility: 'public',
  videoUrl: '',
  videoStorageKey: '',
  fileName: '',
  audioUrl: '',
  audioStorageKey: '',
  audioFileName: '',
};

function formatCount(value: number) {
  if (value >= 10000) {
    return `${(value / 10000).toFixed(1)}만`;
  }

  return value.toLocaleString('ko-KR');
}

function formatRelativeDate(timestamp: number) {
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

  return `${Math.max(1, Math.floor(diff / day))}일 전`;
}

function parseTags(value: string) {
  return value
    .split(',')
    .map((tag) => tag.trim())
    .filter(Boolean)
    .slice(0, 5);
}

function getShortTags(short: ShortItem) {
  return Array.isArray(short.tags) ? short.tags : [];
}

function getShortLikedBy(short: ShortItem) {
  return Array.isArray(short.likedBy) ? short.likedBy : [];
}

function getShortTone(short: ShortItem): ShortTone {
  return short.tone && SHORT_TONE_BACKGROUNDS[short.tone] ? short.tone : 'lime';
}

function formatFileSize(bytes: number) {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(0)}MB`;
  }

  return `${Math.max(1, Math.round(bytes / 1024))}KB`;
}

function createFormState(short?: ShortItem, resolvedVideoUrl?: string): ShortsFormState {
  if (!short) {
    return EMPTY_FORM;
  }

  const hasExistingAudio = Boolean(short.audioStorageKey || short.audioUrl);

  return {
    title: short.title,
    description: short.description,
    tags: getShortTags(short).join(', '),
    durationLabel: short.durationLabel,
    tone: getShortTone(short),
    visibility: short.visibility,
    videoUrl: resolvedVideoUrl ?? short.videoUrl ?? '',
    videoStorageKey: short.videoStorageKey ?? '',
    fileName:
      short.videoFileName ??
      (short.videoStorageKey || short.videoUrl ? '현재 업로드된 영상' : ''),
    audioUrl: short.audioUrl ?? '',
    audioStorageKey: short.audioStorageKey ?? '',
    audioFileName:
      short.audioFileName ??
      (hasExistingAudio ? '현재 업로드된 MP3' : ''),
  };
}

export default function ShortsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const shorts = useShortsStore((state) => state.shorts);
  const comments = useShortsStore((state) => state.comments);
  const createShort = useShortsStore((state) => state.createShort);
  const updateShort = useShortsStore((state) => state.updateShort);
  const deleteShort = useShortsStore((state) => state.deleteShort);
  const toggleLike = useShortsStore((state) => state.toggleLike);
  const addComment = useShortsStore((state) => state.addComment);
  const recordView = useShortsStore((state) => state.recordView);
  const seedShorts = useShortsStore((state) => state.seedShorts);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [selectedFilter, setSelectedFilter] = useState<ShortsFilter>('all');
  const [activeIndex, setActiveIndex] = useState(0);
  const [movementDirection, setMovementDirection] = useState<'up' | 'down' | null>(null);
  const [activeCommentShortId, setActiveCommentShortId] = useState<string | null>(null);
  const [commentDraftByShortId, setCommentDraftByShortId] = useState<Record<string, string>>({});
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShortId, setEditingShortId] = useState<string | null>(null);
  const [formState, setFormState] = useState<ShortsFormState>(EMPTY_FORM);
  const [uploadedVideoFile, setUploadedVideoFile] = useState<File | null>(null);
  const [uploadedAudioFile, setUploadedAudioFile] = useState<File | null>(null);
  const [resolvedVideoUrlByShortId, setResolvedVideoUrlByShortId] = useState<Record<string, string>>(
    {}
  );
  const [formError, setFormError] = useState('');
  const [isSubmittingShort, setIsSubmittingShort] = useState(false);
  const [animatedLikeShortId, setAnimatedLikeShortId] = useState<string | null>(null);
  const feedRef = useRef<HTMLDivElement | null>(null);
  const reelRefs = useRef<Array<HTMLElement | null>>([]);
  const videoRefs = useRef<Array<HTMLVideoElement | null>>([]);
  const audioRefs = useRef<Array<HTMLAudioElement | null>>([]);
  const wheelLockedRef = useRef(false);
  const moveResetTimerRef = useRef<number | null>(null);
  const likeResetTimerRef = useRef<number | null>(null);
  const previewVideoUrlRef = useRef<string | null>(null);
  const previewAudioUrlRef = useRef<string | null>(null);
  const viewedShortIdsRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    void seedShorts().catch((error) => {
      console.error(error);
    });
  }, [seedShorts]);

  const filteredShorts = useMemo(() => {
    const orderedShorts = [...shorts].sort((left, right) => right.createdAt - left.createdAt);

    if (selectedFilter === 'mine') {
      if (!user) {
        return [];
      }

      return orderedShorts.filter((short) => short.creatorEmail === user.email);
    }

    if (selectedFilter === 'liked') {
      if (!user) {
        return [];
      }

      return orderedShorts.filter((short) => getShortLikedBy(short).includes(user.email));
    }

    return orderedShorts;
  }, [selectedFilter, shorts, user]);

  const filterCounts: Record<ShortsFilter, number> = useMemo(
    () => ({
      all: shorts.length,
      mine: user ? shorts.filter((short) => short.creatorEmail === user.email).length : 0,
      liked: user ? shorts.filter((short) => getShortLikedBy(short).includes(user.email)).length : 0,
    }),
    [shorts, user]
  );

  const commentsByShortId = useMemo(() => {
    return comments.reduce<Record<string, typeof comments>>((grouped, comment) => {
      if (!grouped[comment.shortId]) {
        grouped[comment.shortId] = [];
      }

      grouped[comment.shortId].push(comment);
      return grouped;
    }, {});
  }, [comments]);

  const safeActiveIndex = Math.min(activeIndex, Math.max(filteredShorts.length - 1, 0));
  const activeShort = filteredShorts[safeActiveIndex] ?? null;
  const activeShortComments = activeShort ? commentsByShortId[activeShort.id] ?? [] : [];
  const isDesktopCommentOpen = Boolean(activeShort && activeCommentShortId === activeShort.id);

  const resetPreviewVideo = useCallback(() => {
    if (previewVideoUrlRef.current) {
      URL.revokeObjectURL(previewVideoUrlRef.current);
      previewVideoUrlRef.current = null;
    }

    if (previewAudioUrlRef.current) {
      URL.revokeObjectURL(previewAudioUrlRef.current);
      previewAudioUrlRef.current = null;
    }

    setUploadedVideoFile(null);
    setUploadedAudioFile(null);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const objectUrls: string[] = [];

    const loadVideoUrls = async () => {
      const resolvedEntries = await Promise.all(
        shorts.map(async (short) => {
          if (short.videoUrl) {
            return [short.id, short.videoUrl] as const;
          }

          if (short.videoStorageKey) {
            try {
              const blob = await readShortVideoFile(short.videoStorageKey);

              if (blob) {
                const objectUrl = URL.createObjectURL(blob);
                objectUrls.push(objectUrl);
                return [short.id, objectUrl] as const;
              }
            } catch (error) {
              console.error(error);
            }
          }

          return null;
        })
      );

      if (cancelled) {
        objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
        return;
      }

      setResolvedVideoUrlByShortId(
        Object.fromEntries(
          resolvedEntries.filter(
            (entry): entry is readonly [string, string] => Boolean(entry?.[0] && entry[1])
          )
        )
      );
    };

    void loadVideoUrls();

    return () => {
      cancelled = true;
      objectUrls.forEach((objectUrl) => URL.revokeObjectURL(objectUrl));
    };
  }, [shorts]);

  const resetMovementAnimation = useCallback((direction: 'up' | 'down') => {
    setMovementDirection(direction);

    if (moveResetTimerRef.current) {
      window.clearTimeout(moveResetTimerRef.current);
    }

    moveResetTimerRef.current = window.setTimeout(() => {
      setMovementDirection(null);
    }, 460);
  }, []);

  const moveToShort = useCallback(
    (direction: 'up' | 'down') => {
      setActiveIndex((currentIndex) => {
        const lastIndex = Math.max(filteredShorts.length - 1, 0);
        const nextIndex =
          direction === 'down'
            ? Math.min(currentIndex + 1, lastIndex)
            : Math.max(currentIndex - 1, 0);

        if (nextIndex !== currentIndex) {
          setActiveCommentShortId(null);
          resetMovementAnimation(direction);
        }

        return nextIndex;
      });
    },
    [filteredShorts.length, resetMovementAnimation]
  );

  useEffect(() => {
    const feedNode = feedRef.current;
    const activeNode = reelRefs.current[safeActiveIndex];

    if (!feedNode || !activeNode) {
      return;
    }

    feedNode.scrollTo({
      top: activeNode.offsetTop,
      behavior: 'smooth',
    });
  }, [safeActiveIndex]);

  useEffect(() => {
    videoRefs.current.forEach((video, index) => {
      if (!video) {
        return;
      }

      if (index === safeActiveIndex) {
        void video.play().catch(() => undefined);
        return;
      }

      video.pause();
    });

    audioRefs.current.forEach((audio, index) => {
      if (!audio) {
        return;
      }

      if (index === safeActiveIndex && filteredShorts[index]?.audioUrl) {
        void audio.play().catch(() => undefined);
        return;
      }

      audio.pause();
      audio.currentTime = 0;
    });
  }, [filteredShorts, safeActiveIndex]);

  useEffect(() => {
    if (!activeShort || viewedShortIdsRef.current.has(activeShort.id)) {
      return;
    }

    viewedShortIdsRef.current.add(activeShort.id);
    void recordView(activeShort.id).catch((error) => {
      console.error(error);
    });
  }, [activeShort, recordView]);

  useEffect(() => {
    const feedNode = feedRef.current;

    if (!feedNode) {
      return;
    }

    const handleWheel = (event: WheelEvent) => {
      if (isModalOpen || !filteredShorts.length) {
        return;
      }

      if (Math.abs(event.deltaY) < 18) {
        return;
      }

      event.preventDefault();

      if (wheelLockedRef.current) {
        return;
      }

      wheelLockedRef.current = true;
      moveToShort(event.deltaY > 0 ? 'down' : 'up');

      window.setTimeout(() => {
        wheelLockedRef.current = false;
      }, 420);
    };

    feedNode.addEventListener('wheel', handleWheel, { passive: false });

    return () => {
      feedNode.removeEventListener('wheel', handleWheel);
    };
  }, [filteredShorts.length, isModalOpen, moveToShort]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isModalOpen || !filteredShorts.length) {
        return;
      }

      if (event.key === 'ArrowDown') {
        event.preventDefault();
        moveToShort('down');
      }

      if (event.key === 'ArrowUp') {
        event.preventDefault();
        moveToShort('up');
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [filteredShorts.length, isModalOpen, moveToShort]);

  useEffect(() => {
    return () => {
      if (moveResetTimerRef.current) {
        window.clearTimeout(moveResetTimerRef.current);
      }

      if (likeResetTimerRef.current) {
        window.clearTimeout(likeResetTimerRef.current);
      }

      resetPreviewVideo();
    };
  }, [resetPreviewVideo]);

  const openCreateModal = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    resetPreviewVideo();
    setEditingShortId(null);
    setFormState(EMPTY_FORM);
    setFormError('');
    setIsModalOpen(true);
  };

  const openEditModal = async (short: ShortItem) => {
    if (!user || short.creatorEmail !== user.email) {
      return;
    }

    resetPreviewVideo();

    let resolvedVideoUrl = resolvedVideoUrlByShortId[short.id] ?? short.videoUrl ?? '';

    if (!resolvedVideoUrl && short.videoStorageKey) {
      try {
        const blob = await readShortVideoFile(short.videoStorageKey);

        if (blob) {
          resolvedVideoUrl = URL.createObjectURL(blob);
          previewVideoUrlRef.current = resolvedVideoUrl;
        }
      } catch (error) {
        console.error(error);
      }
    }

    setEditingShortId(short.id);
    if (resolvedVideoUrl.startsWith('blob:')) {
      previewVideoUrlRef.current = resolvedVideoUrl;
    }
    setFormState(createFormState(short, resolvedVideoUrl));
    setFormError('');
    setIsModalOpen(true);
  };

  const closeModal = () => {
    resetPreviewVideo();
    setIsModalOpen(false);
    setEditingShortId(null);
    setFormError('');
    setFormState(EMPTY_FORM);
  };

  const handleFilterChange = (nextFilter: ShortsFilter) => {
    if ((nextFilter === 'mine' || nextFilter === 'liked') && !user) {
      navigate('/login');
      return;
    }

    setSelectedFilter(nextFilter);
    setActiveIndex(0);
    setActiveCommentShortId(null);
  };

  const handleVideoUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    if (file.size > MAX_VIDEO_SIZE) {
      setFormError(`${formatFileSize(MAX_VIDEO_SIZE)} 이하 영상만 업로드할 수 있어요.`);
      return;
    }

    try {
      resetPreviewVideo();
      const videoUrl = URL.createObjectURL(file);
      previewVideoUrlRef.current = videoUrl;
      setUploadedVideoFile(file);
      setFormState((current) => ({
        ...current,
        videoUrl,
        videoStorageKey: current.videoStorageKey || '',
        fileName: file.name,
      }));
      setFormError('');
    } catch (error) {
      console.error(error);
      setFormError('영상을 불러오지 못했습니다.');
    }
  };

  const handleAudioUpload = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';

    if (!file) {
      return;
    }

    const isMp3 = file.type === 'audio/mpeg' || file.name.toLowerCase().endsWith('.mp3');

    if (!isMp3) {
      setFormError('MP3 파일만 추가할 수 있어요.');
      return;
    }

    if (file.size > MAX_AUDIO_SIZE) {
      setFormError(`${formatFileSize(MAX_AUDIO_SIZE)} 이하 MP3만 업로드할 수 있어요.`);
      return;
    }

    try {
      if (previewAudioUrlRef.current) {
        URL.revokeObjectURL(previewAudioUrlRef.current);
      }

      const audioUrl = URL.createObjectURL(file);
      previewAudioUrlRef.current = audioUrl;
      setUploadedAudioFile(file);
      setFormState((current) => ({
        ...current,
        audioUrl,
        audioStorageKey: current.audioStorageKey || '',
        audioFileName: file.name,
      }));
      setFormError('');
    } catch (error) {
      console.error(error);
      setFormError('MP3를 불러오지 못했습니다.');
    }
  };

  const handleSubmitShort = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmittingShort) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    const title = formState.title.trim();
    const description = formState.description.trim();
    const tags = parseTags(formState.tags);
    const durationLabel = formState.durationLabel.trim() || '0:15';

    if (!title) {
      setFormError('제목을 입력해 주세요.');
      return;
    }

    if (!description) {
      setFormError('설명을 입력해 주세요.');
      return;
    }

    if (!formState.videoUrl && !editingShortId) {
      setFormError('업로드할 영상을 선택해 주세요.');
      return;
    }

    const editingShort = editingShortId
      ? shorts.find((short) => short.id === editingShortId) ?? null
      : null;

    let videoStorageKey = formState.videoStorageKey || editingShort?.videoStorageKey;
    let videoUrl = editingShort?.videoUrl;
    let videoFileName = editingShort?.videoFileName;
    let videoSizeBytes = editingShort?.videoSizeBytes;
    let audioStorageKey = formState.audioStorageKey || editingShort?.audioStorageKey;
    let audioUrl = editingShort?.audioUrl;
    let audioFileName = editingShort?.audioFileName;
    let audioSizeBytes = editingShort?.audioSizeBytes;

    setFormError('');
    setIsSubmittingShort(true);

    try {
      if (uploadedVideoFile) {
        const upload = await uploadShortVideoOnServer({
          creatorEmail: user.email,
          file: uploadedVideoFile,
        });
        videoStorageKey = upload.storageKey; 
        videoUrl = upload.url; 
        videoFileName = uploadedVideoFile.name; 
        videoSizeBytes = uploadedVideoFile.size;
      }

      if (uploadedAudioFile) {
        const upload = await uploadShortAudioOnServer({
          creatorEmail: user.email,
          file: uploadedAudioFile,
        });
        audioStorageKey = upload.storageKey;
        audioUrl = upload.url;
        audioFileName = uploadedAudioFile.name;
        audioSizeBytes = uploadedAudioFile.size;
      }

      if (!videoStorageKey && !videoUrl) {
        throw new Error('업로드할 영상을 선택해 주세요.');
      }

      if (editingShortId) {
        await updateShort({
          shortId: editingShortId,
          creatorEmail: user.email,
          title,
          description,
          tags,
          durationLabel,
          tone: formState.tone,
          visibility: formState.visibility,
          videoUrl,
          videoStorageKey,
          videoFileName,
          videoSizeBytes,
          audioUrl,
          audioStorageKey,
          audioFileName,
          audioSizeBytes,
        });

        pushNotification({
          kind: 'shorts',
          title: '숏폼 수정 완료',
          body: `"${title}" 숏폼 내용을 업데이트했어요.`,
          route: '/community/shorts',
          actorName: user.name,
        });
      } else {
        await createShort({
          title,
          description,
          creatorName: user.name,
          creatorEmail: user.email,
          tags,
          durationLabel,
          visibility: formState.visibility,
          tone: formState.tone,
          videoUrl,
          videoStorageKey,
          videoFileName,
          videoSizeBytes,
          audioUrl,
          audioStorageKey,
          audioFileName,
          audioSizeBytes,
        });

        pushNotification({
          kind: 'shorts',
          title: '숏폼 업로드 완료',
          body: `"${title}" 숏폼을 업로드했어요.`,
          route: '/profile',
          actorName: user.name,
        });
      }

      closeModal();
      setSelectedFilter('all');
      setActiveIndex(0);
    } catch (error) {
      console.error(error);
      setFormError(getShortUploadErrorMessage(error));
    } finally {
      setIsSubmittingShort(false);
    }
  };

  const handleToggleLike = async (short: ShortItem) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const alreadyLiked = getShortLikedBy(short).includes(user.email);
    try {
      await toggleLike(short.id, user.email);
    setAnimatedLikeShortId(short.id);

    if (likeResetTimerRef.current) {
      window.clearTimeout(likeResetTimerRef.current);
    }

    likeResetTimerRef.current = window.setTimeout(() => {
      setAnimatedLikeShortId(null);
    }, 320);

      pushNotification({
      kind: 'shorts',
      title: alreadyLiked ? '숏폼 좋아요 취소' : '숏폼 좋아요',
      body: `"${short.title}" 숏폼에 ${alreadyLiked ? '좋아요를 취소했어요.' : '좋아요를 남겼어요.'}`,
      route: '/community/shorts',
        actorName: user.name,
      });
    } catch (error) {
      console.error(error);
      const message =
        error instanceof Error ? error.message : '숏폼 좋아요를 처리하지 못했습니다.';

      if (message.includes('로그인') || message.includes('session') || message.includes('인증')) {
        alert('로그인 정보가 만료됐어요. 다시 로그인한 뒤 시도해주세요.');
        navigate('/login');
        return;
      }

      alert(message);
    }
  };

  const handleDeleteShort = async (short: ShortItem) => {
    if (!user || short.creatorEmail !== user.email) {
      return;
    }

    const shouldDelete = window.confirm(`"${short.title}" 숏폼을 삭제할까요?`);

    if (!shouldDelete) {
      return;
    }

    await deleteShort(short.id, user.email);
    setActiveCommentShortId((current) => (current === short.id ? null : current));
    setEditingShortId((current) => (current === short.id ? null : current));

    pushNotification({
      kind: 'shorts',
      title: '숏폼 삭제 완료',
      body: `"${short.title}" 숏폼을 삭제했어요.`,
      route: '/profile',
      actorName: user.name,
    });
  };

  const handleCommentSubmit = async (short: ShortItem) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const content = (commentDraftByShortId[short.id] ?? '').trim();

    if (!content) {
      return;
    }

    await addComment({
      shortId: short.id,
      authorName: user.name,
      authorEmail: user.email,
      content,
    });

    setCommentDraftByShortId((current) => ({
      ...current,
      [short.id]: '',
    }));

    pushNotification({
      kind: 'shorts',
      title: '숏폼 댓글 등록',
      body: `"${short.title}" 숏폼에 댓글을 남겼어요.`,
      route: '/community/shorts',
      actorName: user.name,
    });
  };

  const renderCommentPanel = (
    short: ShortItem,
    reelComments: typeof comments,
    variant: 'sidebar' | 'mobile'
  ) => (
    <section
      className={`shorts-comment-panel ${
        variant === 'sidebar' ? 'shorts-comment-sidebar' : 'shorts-comment-sheet'
      }`}
      aria-label="댓글 패널"
    >
      <div className="shorts-comment-head">
        <strong>댓글 {reelComments.length}</strong>
        <button
          type="button"
          className="shorts-comment-close"
          onClick={() => setActiveCommentShortId(null)}
        >
          닫기
        </button>
      </div>

      <div className="shorts-comment-list">
        {reelComments.length ? (
          reelComments.map((comment) => (
            <article key={comment.id} className="shorts-comment-card">
              <div className="shorts-comment-meta">
                <strong>{comment.authorName}</strong>
                <span>{formatRelativeDate(comment.createdAt)}</span>
              </div>
              <p>{comment.content}</p>
            </article>
          ))
        ) : (
          <div className="shorts-comment-empty">아직 첫 댓글이 없어요.</div>
        )}
      </div>

      <div className="shorts-comment-form">
        <textarea
          className="shorts-comment-textarea"
          value={commentDraftByShortId[short.id] ?? ''}
          onChange={(event) =>
            setCommentDraftByShortId((current) => ({
              ...current,
              [short.id]: event.target.value,
            }))
          }
          placeholder="댓글을 남겨보세요"
        />
        <button
          type="button"
          className="shorts-comment-submit"
          onClick={() => handleCommentSubmit(short)}
        >
          댓글 등록
        </button>
      </div>
    </section>
  );

  return (
    <div className="shorts-page">
      <SiteHeader activeSection="shorts" />

      <main className="shorts-shell">
        <section className="shorts-player-frame">
          <div className="shorts-player-toolbar">
            <div className="shorts-toolbar-left">
              <strong>숏폼</strong>
            </div>

            <div className="shorts-filter-row" role="tablist" aria-label="숏폼 필터">
              {FILTER_OPTIONS.map((filter) => (
                <button
                  key={filter.key}
                  type="button"
                  className={`shorts-filter-button${
                    selectedFilter === filter.key ? ' is-active' : ''
                  }`}
                  onClick={() => handleFilterChange(filter.key)}
                >
                  <span>{filter.label}</span>
                  <em>{formatCount(filterCounts[filter.key])}</em>
                </button>
              ))}
            </div>

            <div className="shorts-toolbar-actions">
              <button
                type="button"
                className="shorts-toolbar-button is-primary"
                onClick={openCreateModal}
              >
                숏폼 올리기
              </button>
            </div>
          </div>

          {filteredShorts.length ? (
            <div className={`shorts-stage${isDesktopCommentOpen ? ' has-comment-sidebar' : ''}`}>
              <div
                ref={feedRef}
                className={`shorts-feed${
                  movementDirection ? ` is-moving-${movementDirection}` : ''
                }`}
                aria-label="숏폼 피드"
              >
                {filteredShorts.map((short, index) => {
                  const isActive = index === safeActiveIndex;
                  const isOwnShort = user?.email === short.creatorEmail;
                  const isLiked = user ? getShortLikedBy(short).includes(user.email) : false;
                  const reelComments = commentsByShortId[short.id] ?? [];
                  const isCommentOpen = activeCommentShortId === short.id;
                  const resolvedVideoUrl =
                    resolvedVideoUrlByShortId[short.id] ?? short.videoUrl ?? '';
                  const resolvedAudioUrl = short.audioUrl ?? '';

                  return (
                    <article
                      key={short.id}
                      ref={(node) => {
                        reelRefs.current[index] = node;
                      }}
                      className={`shorts-reel${isActive ? ' is-active' : ''}`}
                    >
                      <div
                        className="shorts-reel-surface"
                        style={{ backgroundImage: SHORT_TONE_BACKGROUNDS[getShortTone(short)] }}
                      >
                        {resolvedVideoUrl ? (
                          <video
                            ref={(node) => {
                              videoRefs.current[index] = node;
                            }}
                            className="shorts-reel-video"
                            src={resolvedVideoUrl}
                            muted
                            loop
                            playsInline
                            preload={isActive ? 'metadata' : 'none'}
                          />
                        ) : (
                          <div className="shorts-reel-placeholder">{short.durationLabel}</div>
                        )}

                        {resolvedAudioUrl ? (
                          <audio
                            ref={(node) => {
                              audioRefs.current[index] = node;
                            }}
                            className="shorts-reel-audio"
                            src={resolvedAudioUrl}
                            controls
                            controlsList="nodownload"
                            loop
                            preload={isActive ? 'metadata' : 'none'}
                          />
                        ) : null}

                        <div className="shorts-reel-overlay" />

                        <div className="shorts-reel-top">
                          <span className="shorts-reel-chip">
                            {short.visibility === 'public' ? '공개' : '비공개'}
                          </span>
                          <span className="shorts-reel-chip">{short.durationLabel}</span>
                          {resolvedAudioUrl ? (
                            <span className="shorts-reel-chip shorts-reel-audio-chip">
                              MP3
                            </span>
                          ) : null}

                          {isOwnShort ? (
                            <div className="shorts-reel-editor-actions">
                              <button
                                type="button"
                                className="shorts-inline-action"
                                onClick={() => openEditModal(short)}
                              >
                                수정
                              </button>
                              <button
                                type="button"
                                className="shorts-inline-action is-danger"
                                onClick={() => handleDeleteShort(short)}
                              >
                                삭제
                              </button>
                            </div>
                          ) : null}
                        </div>

                        <div className="shorts-reel-bottom">
                          <div className="shorts-reel-copy">
                            <span className="shorts-reel-author">@{short.creatorName}</span>
                            <h1>{short.title}</h1>
                            <p>{short.description}</p>

                            <div className="shorts-reel-tags">
                              {getShortTags(short).map((tag) => (
                                <span key={`${short.id}-${tag}`} className="shorts-tag">
                                  #{tag}
                                </span>
                              ))}
                              <span className="shorts-tag is-muted">
                                {formatRelativeDate(short.createdAt)}
                              </span>
                            </div>
                          </div>

                          <div className="shorts-reel-actions">
                            <div
                              className="shorts-reel-stat"
                              aria-label={`조회수 ${formatCount(short.viewCount)}`}
                            >
                              <span className="shorts-reel-stat-icon" aria-hidden="true">
                                ◔
                              </span>
                              <strong>{formatCount(short.viewCount)}</strong>
                            </div>

                            <button
                              type="button"
                              className={`shorts-reel-stat-button${
                                animatedLikeShortId === short.id ? ' is-bumping' : ''
                              }`}
                              onClick={() => handleToggleLike(short)}
                              aria-pressed={isLiked}
                              aria-label={isLiked ? '좋아요 취소' : '좋아요'}
                            >
                              <span className="shorts-reel-stat-icon" aria-hidden="true">
                                {isLiked ? '♥' : '♡'}
                              </span>
                              <strong>{formatCount(short.likeCount)}</strong>
                            </button>

                            <button
                              type="button"
                              className="shorts-reel-stat-button"
                              onClick={() =>
                                setActiveCommentShortId((current) =>
                                  current === short.id ? null : short.id
                                )
                              }
                              aria-pressed={isCommentOpen}
                              aria-label="댓글 열기"
                            >
                              <span className="shorts-reel-stat-icon" aria-hidden="true">
                                ⌁
                              </span>
                              <strong>{formatCount(reelComments.length)}</strong>
                            </button>
                          </div>
                        </div>

                        {isCommentOpen ? (
                          <section className="shorts-comment-sheet" aria-label="댓글 패널">
                            <div className="shorts-comment-head">
                              <strong>댓글 {reelComments.length}</strong>
                              <button
                                type="button"
                                className="shorts-comment-close"
                                onClick={() => setActiveCommentShortId(null)}
                              >
                                닫기
                              </button>
                            </div>

                            <div className="shorts-comment-list">
                              {reelComments.length ? (
                                reelComments.map((comment) => (
                                  <article key={comment.id} className="shorts-comment-card">
                                    <div className="shorts-comment-meta">
                                      <strong>{comment.authorName}</strong>
                                      <span>{formatRelativeDate(comment.createdAt)}</span>
                                    </div>
                                    <p>{comment.content}</p>
                                  </article>
                                ))
                              ) : (
                                <div className="shorts-comment-empty">
                                  아직 첫 댓글이 없어요.
                                </div>
                              )}
                            </div>

                            <div className="shorts-comment-form">
                              <textarea
                                className="shorts-comment-textarea"
                                value={commentDraftByShortId[short.id] ?? ''}
                                onChange={(event) =>
                                  setCommentDraftByShortId((current) => ({
                                    ...current,
                                    [short.id]: event.target.value,
                                  }))
                                }
                                placeholder="댓글을 남겨보세요."
                              />
                              <button
                                type="button"
                                className="shorts-comment-submit"
                                onClick={() => handleCommentSubmit(short)}
                              >
                                댓글 등록
                              </button>
                            </div>
                          </section>
                        ) : null}
                      </div>
                    </article>
                  );
                })}
              </div>

              {isDesktopCommentOpen && activeShort
                ? renderCommentPanel(activeShort, activeShortComments, 'sidebar')
                : null}

              <div className="shorts-nav-rail">
                <button
                  type="button"
                  className="shorts-nav-button"
                  onClick={() => moveToShort('up')}
                  disabled={safeActiveIndex === 0}
                  aria-label="이전 숏폼"
                >
                  ↑
                </button>
                <button
                  type="button"
                  className="shorts-nav-button"
                  onClick={() => moveToShort('down')}
                  disabled={safeActiveIndex >= filteredShorts.length - 1}
                  aria-label="다음 숏폼"
                >
                  ↓
                </button>
              </div>
            </div>
          ) : (
            <div className="shorts-empty-state">
              <strong>
                {selectedFilter === 'all'
                  ? '보여줄 숏폼이 아직 없어요.'
                  : '선택한 조건에 맞는 숏폼이 없어요.'}
              </strong>
              <span>첫 영상을 올리거나 필터를 바꿔서 다시 살펴보세요.</span>
              <div className="shorts-empty-actions">
                <button
                  type="button"
                  className="shorts-helper-button"
                  onClick={openCreateModal}
                >
                  숏폼 올리기
                </button>
              </div>
            </div>
          )}
        </section>
      </main>

      {isModalOpen ? (
        <div className="shorts-modal-overlay" onClick={closeModal} aria-hidden="true">
          <section
            className="shorts-modal"
            onClick={(event) => event.stopPropagation()}
            aria-label={editingShortId ? '숏폼 수정' : '숏폼 업로드'}
          >
            <span className="shorts-modal-kicker">
              {editingShortId ? 'EDIT SHORT' : 'UPLOAD SHORT'}
            </span>

            <div className="shorts-modal-head">
              <div>
                <h2>{editingShortId ? '숏폼 수정하기' : '숏폼 올리기'}</h2>
              </div>
              <button
                type="button"
                className="shorts-modal-close"
                onClick={closeModal}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <form className="shorts-modal-form" onSubmit={handleSubmitShort}>
              <label className="shorts-field">
                <span>제목</span>
                <input
                  type="text"
                  value={formState.title}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  placeholder="숏폼 제목을 입력해 주세요."
                />
              </label>

              <label className="shorts-field">
                <span>설명</span>
                <textarea
                  value={formState.description}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      description: event.target.value,
                    }))
                  }
                  placeholder="짧은 설명이나 포인트를 적어 주세요."
                />
              </label>

              <label className="shorts-field">
                <span>태그</span>
                <input
                  type="text"
                  value={formState.tags}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      tags: event.target.value,
                    }))
                  }
                  placeholder="예: 코드진행, 베이스, 루프"
                />
              </label>

              <label className="shorts-field">
                <span>길이 표시</span>
                <input
                  type="text"
                  value={formState.durationLabel}
                  onChange={(event) =>
                    setFormState((current) => ({
                      ...current,
                      durationLabel: event.target.value,
                    }))
                  }
                  placeholder="0:15"
                />
              </label>

              <div className="shorts-field">
                <span>톤</span>
                <div className="shorts-tone-row">
                  {TONE_OPTIONS.map((tone) => (
                    <button
                      key={tone.key}
                      type="button"
                      className={`shorts-tone-button${
                        formState.tone === tone.key ? ' is-active' : ''
                      }`}
                      onClick={() =>
                        setFormState((current) => ({
                          ...current,
                          tone: tone.key,
                        }))
                      }
                    >
                      {tone.label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="shorts-upload-box">
                <div className="shorts-upload-copy">
                  <strong>영상 업로드</strong>
                  <span>
                    {formatFileSize(MAX_VIDEO_SIZE)} 이하 mp4, mov, webm 파일을 올릴 수 있어요.
                  </span>
                </div>
                <label className="shorts-upload-button">
                  영상 선택
                  <input
                    type="file"
                    accept="video/mp4,video/quicktime,video/webm"
                    onChange={handleVideoUpload}
                  />
                </label>
              </div>

              {formState.videoUrl ? (
                <div className="shorts-upload-preview">
                  <video
                    className="shorts-preview-video"
                    src={formState.videoUrl}
                    muted
                    loop
                    autoPlay
                    playsInline
                  />
                  <div className="shorts-preview-meta">
                    <strong>{formState.fileName || '업로드한 영상'}</strong>
                    <span>
                      미리보기로 확인한 뒤 바로 업로드할 수 있어요.
                      {uploadedVideoFile ? ` (${formatFileSize(uploadedVideoFile.size)})` : ''}
                    </span>
                  </div>
                </div>
              ) : null}

              <div className="shorts-upload-box shorts-upload-box--audio">
                <div className="shorts-upload-copy">
                  <strong>MP3 추가</strong>
                  <span>
                    선택 사항입니다. {formatFileSize(MAX_AUDIO_SIZE)} 이하 MP3를 배경음악으로 붙일 수 있어요.
                  </span>
                </div>
                <label className="shorts-upload-button">
                  MP3 선택
                  <input
                    type="file"
                    accept="audio/mpeg,.mp3"
                    onChange={handleAudioUpload}
                  />
                </label>
              </div>

              {formState.audioUrl ? (
                <div className="shorts-audio-preview">
                  <div className="shorts-audio-preview-icon" aria-hidden="true">♪</div>
                  <div className="shorts-preview-meta">
                    <strong>{formState.audioFileName || '업로드한 MP3'}</strong>
                    <span>
                      숏폼 재생 시 함께 사용할 오디오입니다.
                      {uploadedAudioFile ? ` (${formatFileSize(uploadedAudioFile.size)})` : ''}
                    </span>
                    <audio src={formState.audioUrl} controls />
                  </div>
                </div>
              ) : null}

              <button
                type="button"
                className="shorts-toggle-row"
                onClick={() =>
                  setFormState((current) => ({
                    ...current,
                    visibility: current.visibility === 'public' ? 'private' : 'public',
                  }))
                }
              >
                <div className="shorts-toggle-copy">
                  <strong>공개 여부</strong>
                  <span>끄면 나만 볼 수 있어요.</span>
                </div>
                <span
                  className={`shorts-toggle${
                    formState.visibility === 'public' ? ' is-active' : ''
                  }`}
                >
                  <span />
                </span>
              </button>

              {formError ? <p className="shorts-error-text">{formError}</p> : null}

              <div className="shorts-modal-actions">
                <button
                  type="button"
                  className="shorts-modal-button"
                  onClick={closeModal}
                >
                  취소
                </button>
                <button
                  type="submit"
                  className="shorts-modal-button is-primary"
                  disabled={isSubmittingShort}
                >
                  {isSubmittingShort
                    ? '업로드 중...'
                    : editingShortId
                      ? '수정 저장'
                      : '숏폼 등록'}
                </button>
              </div>
            </form>
          </section>
        </div>
      ) : null}
    </div>
  );
}
