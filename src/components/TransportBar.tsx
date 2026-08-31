import type { ChangeEvent } from 'react';
import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import * as Tone from 'tone';
import {
  exportSongAsMp3,
  exportSongAsWav,
  getPlaybackStartDelaySeconds,
  preparePlaybackEngine,
} from '../audio/engine.ts';
import type { SongProject } from '../store/songStore.ts';
import { useSongStore, buildSongProjectSnapshot } from '../store/songStore.ts';
import { useAuthStore } from '../store/authStore.ts';
import { useComposerLibraryStore } from '../store/composerLibraryStore.ts';
import { fetchAiMusic } from '../utils/ai';
import { analyzeSongSketchDna, getRecruitUrlFromSketch, type SongSketchDna } from '../utils/songSketchDna';
import { uploadMusicShareCoverOnServer } from '../utils/libraryApi.ts';
import './TransportBar.css';

const DEFAULT_AI_TEMPLATE = `분위기:
참고곡:
사용 악기:
리듬 무드:
멜로디/베이스 구분:
강조하고 싶은 요소:`;

const SAVE_BACKUP_STORAGE_KEY = 'song-maker-project-backups';
const BAR_LENGTH = 16;
const GO_TO_FIRST_BAR_EVENT = 'composer-go-to-first-bar';
const MIN_AI_GENERATION_MS = 2_800;

const GENRE_OPTIONS = [
  { value: 'ballad', label: '발라드' },
  { value: 'pop', label: '팝' },
  { value: 'jazz', label: '재즈' },
  { value: 'ost', label: 'OST' },
  { value: 'citypop', label: '시티팝' },
  { value: 'electronic', label: '일렉트로닉' },
] as const;

type ComposerDialog = 'save' | 'share' | null;
type SaveFormat = 'wav' | 'mp3' | 'flac';

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
  return normalized || `song-${Date.now()}`;
}

function persistRecord(key: string, record: unknown) {
  try {
    const previous = JSON.parse(window.localStorage.getItem(key) ?? '[]');
    const records = Array.isArray(previous) ? previous : [];
    window.localStorage.setItem(key, JSON.stringify([record, ...records].slice(0, 20)));
  } catch (error) {
    console.error(`Failed to persist ${key}:`, error);
  }
}

type TransportBarProps = {
  onPlayStarted?: () => void;
};

const UndoIcon = () => (
  <svg
    className="transport-button-icon-svg"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M8 6H4.5V2.5" />
    <path d="M4.5 6a7 7 0 1 1 1.3 7.6" />
  </svg>
);

const RedoIcon = () => (
  <svg
    className="transport-button-icon-svg"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M12 6h3.5V2.5" />
    <path d="M15.5 6a7 7 0 1 0-1.3 7.6" />
  </svg>
);

const ResetIcon = () => (
  <svg
    className="transport-button-icon-svg"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M10 3.5a6.5 6.5 0 1 1-4.6 1.9" />
    <path d="M5.4 1.8v3.8h3.8" />
  </svg>
);

const FirstBarIcon = () => (
  <svg
    className="transport-button-icon-svg"
    viewBox="0 0 20 20"
    aria-hidden="true"
    focusable="false"
  >
    <path d="M5 4v12" />
    <path d="M15 5 8 10l7 5V5Z" />
  </svg>
);

export const TransportBar = ({ onPlayStarted }: TransportBarProps = {}) => {
  const navigate = useNavigate();
  const location = useLocation();
  const bpm = useSongStore((state) => state.bpm);
  const setBpm = useSongStore((state) => state.setBpm);
  const steps = useSongStore((state) => state.steps);
  const isPlaying = useSongStore((state) => state.isPlaying);
  const setPlaying = useSongStore((state) => state.setPlaying);
  const currentStep = useSongStore((state) => state.currentStep);
  const setCurrentStep = useSongStore((state) => state.setCurrentStep);
  const volumes = useSongStore((state) => state.volumes);
  const loopRange = useSongStore((state) => state.loopRange);
  const setLoopRange = useSongStore((state) => state.setLoopRange);
  const toggleLoopCurrentBar = useSongStore((state) => state.toggleLoopCurrentBar);
  const undo = useSongStore((state) => state.undo);
  const redo = useSongStore((state) => state.redo);
  const clear = useSongStore((state) => state.clear);
  const canUndo = useSongStore((state) => state.canUndo);
  const canRedo = useSongStore((state) => state.canRedo);

  const user = useAuthStore((state) => state.user);
  const saveComposerProject = useComposerLibraryStore((state) => state.saveProject);
  const shareComposerProject = useComposerLibraryStore((state) => state.shareProject);

  const [isExporting, setIsExporting] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [aiCompletionToast, setAiCompletionToast] = useState<'compose' | null>(null);
  const [songDna, setSongDna] = useState<SongSketchDna | null>(null);
  const [isAiPanelOpen, setIsAiPanelOpen] = useState(false);
  const [activeDialog, setActiveDialog] = useState<ComposerDialog>(null);

  const [aiSummary, setAiSummary] = useState('');
  const [aiDetails, setAiDetails] = useState(DEFAULT_AI_TEMPLATE);

  useEffect(() => {
    if (!aiCompletionToast) return undefined;

    const timeout = window.setTimeout(() => {
      setAiCompletionToast(null);
    }, 2200);

    return () => window.clearTimeout(timeout);
  }, [aiCompletionToast]);

  const [saveTitle, setSaveTitle] = useState('');
  const [saveDescription, setSaveDescription] = useState('');
  const [saveGenre, setSaveGenre] = useState('ballad');
  const [saveFormat, setSaveFormat] = useState<SaveFormat>('wav');
  const [saveBackupEnabled, setSaveBackupEnabled] = useState(true);

  const [shareTitle, setShareTitle] = useState('');
  const [shareDescription, setShareDescription] = useState('');
  const [shareGenre, setShareGenre] = useState('pop');
  const [shareIsPublic, setShareIsPublic] = useState(true);
  const [shareMidiEnabled, setShareMidiEnabled] = useState(false);
  const [shareCoverFile, setShareCoverFile] = useState<File | null>(null);
  const [shareCoverPreviewUrl, setShareCoverPreviewUrl] = useState('');
  const [isUploadingShareCover, setIsUploadingShareCover] = useState(false);

  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const backingTrackAudioRef = useRef<HTMLAudioElement | null>(null);
  const backingTrackUrlRef = useRef('');
  const backingTrackTimerRef = useRef<number | null>(null);
  const previousPlaybackStepRef = useRef<number | null>(null);
  const previousBackingTrackSourceBpmRef = useRef(bpm);
  const [backingTrackName] = useState('');
  const [backingTrackVolume] = useState(0.7);
  const [backingTrackSourceBpm] = useState(bpm);

  const currentBar = Math.floor(currentStep / BAR_LENGTH) + 1;
  const totalBars = Math.max(1, Math.ceil(steps / BAR_LENGTH));

  const getBackingTrackStartTime = (step = loopRange?.start ?? 0) =>
    step * (60 / Math.max(1, backingTrackSourceBpm) / 4);

  const clearBackingTrackTimer = () => {
    if (backingTrackTimerRef.current !== null) {
      window.clearTimeout(backingTrackTimerRef.current);
      backingTrackTimerRef.current = null;
    }
  };

  const stopBackingTrack = (resetToStart = true) => {
    clearBackingTrackTimer();
    const audio = backingTrackAudioRef.current;
    if (!audio) return;
    audio.pause();
    if (resetToStart) {
      audio.currentTime = Math.min(getBackingTrackStartTime(), audio.duration || Infinity);
    }
  };

  const startBackingTrack = (step = loopRange?.start ?? 0) => {
    const audio = backingTrackAudioRef.current;
    if (!audio || !backingTrackName) return;

    clearBackingTrackTimer();
    const startTime = getBackingTrackStartTime(step);
    audio.currentTime = Math.min(startTime, audio.duration || Infinity);
    backingTrackTimerRef.current = window.setTimeout(() => {
      backingTrackTimerRef.current = null;
      void audio.play().catch((error) => {
        console.error('MP3 playback start failed:', error);
      });
    }, getPlaybackStartDelaySeconds() * 1000);
  };

  useEffect(() => {
    const audio = backingTrackAudioRef.current;
    return () => {
      clearBackingTrackTimer();
      audio?.pause();
      if (backingTrackUrlRef.current) URL.revokeObjectURL(backingTrackUrlRef.current);
    };
  }, []);

  useEffect(() => {
    if (backingTrackAudioRef.current) {
      backingTrackAudioRef.current.volume = backingTrackVolume;
    }
  }, [backingTrackVolume]);

  useEffect(() => {
    const audio = backingTrackAudioRef.current;
    if (!audio) return;
    const playbackRate = Math.min(4, Math.max(0.25, bpm / Math.max(1, backingTrackSourceBpm)));
    audio.defaultPlaybackRate = playbackRate;
    audio.playbackRate = playbackRate;
    audio.preservesPitch = true;
  }, [bpm, backingTrackSourceBpm]);

  useEffect(() => {
    const previousSourceBpm = previousBackingTrackSourceBpmRef.current;
    previousBackingTrackSourceBpmRef.current = backingTrackSourceBpm;
    const audio = backingTrackAudioRef.current;
    if (!audio || !backingTrackName || previousSourceBpm === backingTrackSourceBpm) return;
    const playbackStep = useSongStore.getState().currentStep;
    audio.currentTime = Math.min(
      playbackStep * (60 / Math.max(1, backingTrackSourceBpm) / 4),
      audio.duration || Infinity
    );
  }, [backingTrackName, backingTrackSourceBpm]);

  useEffect(() => {
    const handlePlaybackStep = (event: Event) => {
      if (!backingTrackName) return;
      const step = (event as CustomEvent<{ step: number }>).detail.step;
      const previousStep = previousPlaybackStepRef.current;
      const loopRestarted = loopRange
        ? previousStep === loopRange.end && step === loopRange.start
        : previousStep !== null && step < previousStep;

      if (loopRestarted) {
        const audio = backingTrackAudioRef.current;
        if (audio) {
          audio.currentTime = step * (60 / Math.max(1, backingTrackSourceBpm) / 4);
          if (audio.paused) void audio.play().catch(() => undefined);
        }
      }
      previousPlaybackStepRef.current = step;
    };

    window.addEventListener('composer-playhead-step', handlePlaybackStep);
    return () => window.removeEventListener('composer-playhead-step', handlePlaybackStep);
  }, [backingTrackName, backingTrackSourceBpm, loopRange]);

  const createProjectSnapshot = (): SongProject => {
    return buildSongProjectSnapshot(useSongStore.getState());
  };

  const openDialog = (dialog: Exclude<ComposerDialog, null>) => {
    setIsAiPanelOpen(false);
    setActiveDialog(dialog);
  };

  const closeDialog = () => {
    setActiveDialog(null);
  };

  const handleOpenDna = () => {
    const project = createProjectSnapshot();
    setSongDna(analyzeSongSketchDna(project, saveTitle.trim() || shareTitle.trim() || '현재 스케치'));
  };

  const handleSelectShareCover = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0] ?? null;
    event.target.value = '';

    if (shareCoverPreviewUrl) {
      URL.revokeObjectURL(shareCoverPreviewUrl);
    }

    if (!file) {
      setShareCoverFile(null);
      setShareCoverPreviewUrl('');
      return;
    }

    setShareCoverFile(file);
    setShareCoverPreviewUrl(URL.createObjectURL(file));
  };

  const clearShareCover = () => {
    if (shareCoverPreviewUrl) {
      URL.revokeObjectURL(shareCoverPreviewUrl);
    }

    setShareCoverFile(null);
    setShareCoverPreviewUrl('');
  };

  const handleTogglePlay = async () => {
    if (isPlaying) {
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      stopBackingTrack();
      previousPlaybackStepRef.current = null;
      setCurrentStep(loopRange?.start ?? 0);
      setPlaying(false);
      return;
    }

    try {
      await preparePlaybackEngine();
      Tone.Transport.bpm.value = bpm;
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      const startStep = loopRange?.start ?? 0;
      setCurrentStep(startStep);
      setPlaying(true);
      onPlayStarted?.();
      window.requestAnimationFrame(() => {
        Tone.Transport.start(`+${getPlaybackStartDelaySeconds()}`);
        startBackingTrack(startStep);
      });
    } catch (error) {
      console.error('Playback start failed:', error);
      Tone.Transport.stop();
      Tone.Transport.position = 0;
      stopBackingTrack();
      setCurrentStep(loopRange?.start ?? 0);
      setPlaying(false);
      alert('재생을 시작하지 못했습니다. 브라우저를 새로고침한 뒤 다시 시도해 주세요.');
    }
  };

  const handleGoToFirstBar = () => {
    Tone.Transport.stop();
    Tone.Transport.position = '0:0:0';
    stopBackingTrack(false);
    if (backingTrackAudioRef.current) backingTrackAudioRef.current.currentTime = 0;
    previousPlaybackStepRef.current = null;
    setLoopRange(null);
    setCurrentStep(0);
    setPlaying(false);
    window.requestAnimationFrame(() => {
      window.dispatchEvent(new Event(GO_TO_FIRST_BAR_EVENT));
    });
  };

  const handleLoadProjectClick = () => {
    fileInputRef.current?.click();
  };

  const handleResetProject = () => {
    const shouldReset = window.confirm('현재 작곡 내용을 초기화할까요?');
    if (!shouldReset) {
      return;
    }

    Tone.Transport.stop();
    Tone.Transport.position = 0;
    stopBackingTrack(false);
    clear();
    setCurrentStep(0);
    setPlaying(false);
    navigate('/composer', { replace: true });
  };

  const handleLoadProject = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) {
      return;
    }

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SongProject;
      useSongStore.getState().loadProject(parsed);
      if (!new URLSearchParams(location.search).has('collab')) {
        navigate('/composer?source=file', { replace: true });
      }
    } catch (error) {
      console.error(error);
      alert('프로젝트 파일을 불러오지 못했습니다.');
    }
  };

  const handleSaveConfirm = async () => {
    if (isExporting) {
      return;
    }

    const title = saveTitle.trim();
    if (!title) {
      alert('프로젝트 제목을 입력해 주세요.');
      return;
    }

    if (saveFormat === 'flac') {
      alert('FLAC 저장은 아직 준비 중입니다. WAV 또는 MP3를 선택해 주세요.');
      return;
    }

    const filenameBase = sanitizeFileName(title);
    const project = createProjectSnapshot();

    setIsExporting(true);
    try {
      if (saveBackupEnabled) {
        persistRecord(SAVE_BACKUP_STORAGE_KEY, {
          id: `backup-${Date.now()}`,
          title,
          description: saveDescription.trim(),
          genre: saveGenre,
          bpm,
          steps,
          volumes,
          createdAt: Date.now(),
          project,
        });
      }

      await saveComposerProject({
        title,
        description: saveDescription.trim(),
        genre: saveGenre,
        bpm,
        steps,
        project,
        creatorName: user?.name ?? '게스트',
        creatorEmail: user?.email ?? 'guest@songmaker.local',
        exportFormat: saveFormat,
      });

      const blob = saveFormat === 'wav' ? await exportSongAsWav() : await exportSongAsMp3();
      const extension = saveFormat === 'wav' ? 'wav' : 'mp3';
      downloadBlob(blob, `${filenameBase}.${extension}`);

      if (saveBackupEnabled) {
        downloadBlob(
          new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' }),
          `${filenameBase}.json`
        );
      }

      closeDialog();
      alert('프로젝트를 저장했습니다.');
    } catch (error) {
      console.error('Project save failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`저장에 실패했습니다.\n\n${message}`);
    } finally {
      setIsExporting(false);
    }
  };

  const handleShareConfirm = async () => {
    const title = shareTitle.trim();
    if (!title) {
      alert('공유 제목을 입력해 주세요.');
      return;
    }

    try {
      let uploadedCover:
        | {
            imageUrl: string;
            imageStorageKey: string;
            imageFileName: string;
          }
        | undefined;

      if (shareCoverFile) {
        setIsUploadingShareCover(true);
        // 🌟 수정된 부분: 파일과 이메일을 객체로 묶어서 서버에 전송합니다.
        uploadedCover = await uploadMusicShareCoverOnServer({
          file: shareCoverFile,
          creatorEmail: user?.email,
        });
      }

      await shareComposerProject({
        title,
        description: shareDescription.trim(),
        genre: shareGenre,
        shareVisibility: shareIsPublic ? 'public' : 'private',
        shareMidiEnabled,
        bpm,
        steps,
        project: createProjectSnapshot(),
        creatorName: user?.name ?? 'guest',
        creatorEmail: user?.email ?? 'guest@songmaker.local',
        coverImageUrl: uploadedCover?.imageUrl || "",
        coverImageStorageKey: uploadedCover?.imageStorageKey || "",
        coverImageFileName: uploadedCover?.imageFileName || "",
      });

      clearShareCover();
      closeDialog();
      alert('공유했습니다.');
    } catch (error) {
      console.error('Project share failed:', error);
      const message = error instanceof Error ? error.message : String(error);
      alert(`공유에 실패했습니다.\n\n${message}`);
    } finally {
      setIsUploadingShareCover(false);
    }
  };

  const handleAiGenerate = async () => {
    const summary = aiSummary.trim();
    const details = aiDetails.trim();

    if (!summary && !details) {
      alert('AI에게 전달할 분위기나 조건을 적어 주세요.');
      return;
    }

    const prompt = [
      summary ? `한 줄 설명: ${summary}` : '',
      details ? `상세 요청:\n${details}` : '',
      `프로젝트 설정:\n- BPM: ${bpm}\n- Steps: ${steps}\n- Melody Volume: ${volumes.melody}\n- Drums Volume: ${volumes.drums}\n- Bass Volume: ${volumes.bass} \n Guitar Volume: ${volumes.guitar}`,
    ]
      .slice(0, 2)
      .filter(Boolean)
      .join('\n\n');

    setIsGenerating(true);
    try {
      const generationStartedAt = performance.now();
      const aiGeneratedProject = (await fetchAiMusic(prompt)) as SongProject;
      const elapsedMs = performance.now() - generationStartedAt;
      if (elapsedMs < MIN_AI_GENERATION_MS) {
        await new Promise((resolve) => window.setTimeout(resolve, MIN_AI_GENERATION_MS - elapsedMs));
      }
      useSongStore.getState().loadProject(aiGeneratedProject);
      setAiCompletionToast('compose');
      setIsAiPanelOpen(false);
    } catch (error) {
      console.error('AI generation failed:', error);
      const message =
        error instanceof Error ? error.message : 'AI 생성 요청을 처리하지 못했습니다.';
      alert(`AI 생성에 실패했습니다.\n\n${message}`);
    } finally {
      setIsGenerating(false);
    }
  };

  return (
    <div className="transport-bar">
      <div className="transport-primary">
        <button
          type="button"
          className="transport-play-button"
          onClick={handleTogglePlay}
          aria-label={isPlaying ? 'Stop playback' : 'Start playback'}
        >
          {isPlaying ? (
            <div className="transport-play-icon transport-play-icon--pause">
              <span />
              <span />
            </div>
          ) : (
            <div className="transport-play-icon transport-play-icon--play" />
          )}
        </button>

        <button
          type="button"
          className="transport-button transport-button--micro transport-button--icon-only"
          onClick={handleGoToFirstBar}
          aria-label="첫마디로 이동"
          title="첫마디로 이동"
        >
          <FirstBarIcon />
        </button>

        <div className="transport-control">
          <span className="transport-label">Tempo</span>
          <input
            type="range"
            min={60}
            max={200}
            value={bpm}
            onChange={(event) => setBpm(Number(event.target.value))}
            className="transport-range"
          />
          <strong className="transport-value">{bpm}</strong>
        </div>

        <div className="transport-divider" />

        <div className="transport-control transport-control--status">
          <span className="transport-label">Bar</span>
          <strong className="transport-value">
            {currentBar}/{totalBars}
          </strong>
          <button
            type="button"
            className={`transport-status-chip${loopRange ? ' is-active' : ''}`}
            onClick={toggleLoopCurrentBar}
            aria-pressed={Boolean(loopRange)}
            title="현재 마디 반복 켜기/끄기"
          >
            {loopRange ? `${loopRange.start + 1}-${loopRange.end + 1}` : `${currentBar}-${currentBar}`} 반복
          </button>
        </div>
      </div>

      <div className="transport-actions">
        <button
          type="button"
          className="transport-button transport-button--with-icon transport-button--tool"
          onClick={undo}
          disabled={!canUndo}
        >
          <UndoIcon />
          <span>되돌리기</span>
        </button>
        <button
          type="button"
          className="transport-button transport-button--with-icon transport-button--tool"
          onClick={redo}
          disabled={!canRedo}
        >
          <RedoIcon />
          <span>다시하기</span>
        </button>
        <button
          type="button"
          className="transport-button transport-button--with-icon transport-button--tool"
          onClick={handleResetProject}
        >
          <ResetIcon />
          <span>초기화</span>
        </button>
        <button type="button" className="transport-button transport-button--dna" onClick={handleOpenDna}>
          DNA 보기
        </button>
        <button
          type="button"
          className="transport-button"
          onClick={() => navigate(getRecruitUrlFromSketch(saveTitle.trim() || shareTitle.trim() || '내 곡 스케치'))}
        >
          파트 모집
        </button>
        <button type="button" className="transport-button" onClick={() => openDialog('save')}>
          저장하기
        </button>
        <button type="button" className="transport-button" onClick={() => openDialog('share')}>
          공유하기
        </button>
        <button type="button" className="transport-button" onClick={handleLoadProjectClick}>
          불러오기
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="application/json"
          onChange={handleLoadProject}
          style={{ display: 'none' }}
        />
        <button
          type="button"
          className={`transport-button transport-button--accent${
            isAiPanelOpen ? ' is-open' : ''
          }`}
          onClick={() => setIsAiPanelOpen((open) => !open)}
        >
          작곡 AI
        </button>
      </div>

      {songDna ? (
        <div className="transport-dialog-backdrop" onClick={() => setSongDna(null)} aria-hidden="true">
          <section
            className="transport-dialog transport-dna-dialog"
            onClick={(event) => event.stopPropagation()}
            aria-label="곡 스케치 DNA"
          >
            <div className="transport-dialog-header">
              <div className="transport-dialog-title">
                <span className="transport-dialog-icon">D</span>
                <strong>곡 스케치 DNA</strong>
              </div>
              <button
                type="button"
                className="transport-dialog-close"
                onClick={() => setSongDna(null)}
                aria-label="닫기"
              >
                ×
              </button>
            </div>

            <div className="transport-dna-summary">
              <span>{songDna.title}</span>
              <strong>{songDna.summary}</strong>
            </div>

            <div className="transport-dna-grid">
              <article>
                <span>Mood</span>
                <strong>{songDna.mood}</strong>
              </article>
              <article>
                <span>Melody</span>
                <strong>{songDna.melodyType}</strong>
              </article>
              <article>
                <span>Rhythm</span>
                <strong>{songDna.rhythmDensity}</strong>
              </article>
              <article>
                <span>Hook</span>
                <strong>{songDna.hookType}</strong>
              </article>
              <article>
                <span>Use</span>
                <strong>{songDna.useCase}</strong>
              </article>
              <article>
                <span>Parts</span>
                <strong>{songDna.activeParts.length ? songDna.activeParts.join(', ') : '아직 없음'}</strong>
              </article>
            </div>
          </section>
        </div>
      ) : null}

      {activeDialog ? (
        <div className="transport-dialog-backdrop" onClick={closeDialog} aria-hidden="true">
          <section
            className="transport-dialog"
            onClick={(event) => event.stopPropagation()}
            aria-label={activeDialog === 'save' ? '프로젝트 저장' : '프로젝트 공유'}
          >
            {activeDialog === 'save' ? (
              <>
                <div className="transport-dialog-header">
                  <div className="transport-dialog-title">
                    <span className="transport-dialog-icon">S</span>
                    <strong>저장하기</strong>
                  </div>
                  <button
                    type="button"
                    className="transport-dialog-close"
                    onClick={closeDialog}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>

                <div className="transport-dialog-group">
                  <span className="transport-dialog-kicker">기본 정보</span>
                  <label className="transport-dialog-field">
                    <span>제목</span>
                    <input
                      type="text"
                      value={saveTitle}
                      onChange={(event) => setSaveTitle(event.target.value)}
                      placeholder="프로젝트 제목을 입력해 주세요."
                    />
                  </label>
                  <label className="transport-dialog-field">
                    <span>설명</span>
                    <textarea
                      value={saveDescription}
                      onChange={(event) => setSaveDescription(event.target.value)}
                      placeholder="곡에 대한 설명을 입력해 주세요."
                    />
                  </label>
                  <label className="transport-dialog-field">
                    <span>장르</span>
                    <select value={saveGenre} onChange={(event) => setSaveGenre(event.target.value)}>
                      {GENRE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <div className="transport-dialog-group">
                  <span className="transport-dialog-kicker">파일 설정</span>
                  <div className="transport-dialog-field">
                    <span>형식</span>
                    <div className="transport-dialog-format-row" role="tablist" aria-label="형식">
                      {(['wav', 'mp3', 'flac'] as const).map((format) => (
                        <button
                          key={format}
                          type="button"
                          className={`transport-dialog-format-button${
                            saveFormat === format ? ' is-active' : ''
                          }`}
                          onClick={() => setSaveFormat(format)}
                        >
                          {format.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="transport-dialog-group">
                  <button
                    type="button"
                    className="transport-dialog-toggle-row"
                    onClick={() => setSaveBackupEnabled((value) => !value)}
                  >
                    <div className="transport-dialog-toggle-copy">
                      <span>백업 저장</span>
                      <small>프로젝트 JSON 파일도 함께 저장합니다.</small>
                    </div>
                    <span className={`transport-dialog-switch${saveBackupEnabled ? ' is-on' : ''}`}>
                      <span />
                    </span>
                  </button>
                </div>

                <div className="transport-dialog-actions">
                  <button type="button" className="transport-dialog-button" onClick={closeDialog}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="transport-dialog-button transport-dialog-button--confirm"
                    onClick={handleSaveConfirm}
                    disabled={isExporting}
                  >
                    {isExporting ? '저장 중...' : '저장하기'}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="transport-dialog-header">
                  <div className="transport-dialog-title">
                    <span className="transport-dialog-icon transport-dialog-icon--share">↗</span>
                    <strong>공유하기</strong>
                  </div>
                  <button
                    type="button"
                    className="transport-dialog-close"
                    onClick={closeDialog}
                    aria-label="닫기"
                  >
                    ×
                  </button>
                </div>

                <div className="transport-dialog-group">
                  <label className="transport-dialog-field">
                    <span>제목</span>
                    <input
                      type="text"
                      value={shareTitle}
                      onChange={(event) => setShareTitle(event.target.value)}
                      placeholder="공유 제목을 입력해 주세요."
                    />
                  </label>
                  <label className="transport-dialog-field">
                    <span>설명</span>
                    <textarea
                      value={shareDescription}
                      onChange={(event) => setShareDescription(event.target.value)}
                      placeholder="공유할 곡 설명을 적어 주세요."
                    />
                  </label>
                  <label className="transport-dialog-field">
                    <span>장르</span>
                    <select
                      value={shareGenre}
                      onChange={(event) => setShareGenre(event.target.value)}
                    >
                      {GENRE_OPTIONS.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="transport-dialog-field">
                    <span>파일 업로드</span>
                    <input type="file" accept="image/*" onChange={handleSelectShareCover} />
                    <small>업로드할 파일을 선택해주세요 (20mb 이하).</small>
                  </label>
                  {shareCoverPreviewUrl ? (
                    <div className="transport-dialog-image-preview">
                      <div
                        className="transport-dialog-image-preview-visual"
                        style={{ backgroundImage: `url(${shareCoverPreviewUrl})` }}
                      />
                      <div className="transport-dialog-image-preview-copy">
                        <strong>{shareCoverFile?.name ?? '선택한 이미지'}</strong>
                        <button type="button" onClick={clearShareCover}>
                          이미지 제거
                        </button>
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="transport-dialog-group">
                  <button
                    type="button"
                    className="transport-dialog-toggle-row"
                    onClick={() => setShareIsPublic((value) => !value)}
                  >
                    <div className="transport-dialog-toggle-copy">
                      <span>공개 여부</span>
                      <small>끄면 본인만 볼 수 있습니다.</small>
                    </div>
                    <span className={`transport-dialog-switch${shareIsPublic ? ' is-on' : ''}`}>
                      <span />
                    </span>
                  </button>

                  <button
                    type="button"
                    className="transport-dialog-toggle-row"
                    onClick={() => setShareMidiEnabled((value) => !value)}
                  >
                    <div className="transport-dialog-toggle-copy">
                      <span>MIDI 공유</span>
                      <small>원본 편집 정보도 함께 공유합니다.</small>
                    </div>
                    <span className={`transport-dialog-switch${shareMidiEnabled ? ' is-on' : ''}`}>
                      <span />
                    </span>
                  </button>
                </div>

                <div className="transport-dialog-actions">
                  <button type="button" className="transport-dialog-button" onClick={closeDialog}>
                    취소
                  </button>
                  <button
                    type="button"
                    className="transport-dialog-button transport-dialog-button--confirm"
                    onClick={handleShareConfirm}
                    disabled={isUploadingShareCover}
                  >
                    {isUploadingShareCover ? '공유 중...' : '공유하기'}
                  </button>
                </div>
              </>
            )}
          </section>
        </div>
      ) : null}

      {isAiPanelOpen ? (
        <section className="transport-ai-panel" aria-label="AI composition panel">
          {isGenerating ? (
            <div className="transport-ai-generating" role="status" aria-live="polite">
              <div className="transport-ai-scan" aria-hidden="true" />
              <div className="transport-ai-notes" aria-hidden="true">
                {['♪', '♬', '✦', '♩', '✧'].map((note, index) => (
                  <span key={`${note}-${index}`}>{note}</span>
                ))}
              </div>
              <div className="transport-ai-orb" aria-hidden="true">
                <span />
                <span />
                <span />
              </div>
              <strong>AI가 곡을 생성 중입니다</strong>
              <p>
                프롬프트에 맞는 장르, 코드 진행, 악기 구성을 고르고 있어요.
              </p>
              <div className="transport-ai-wave" aria-hidden="true">
                {Array.from({ length: 18 }).map((_, index) => (
                  <span key={index} style={{ animationDelay: `${index * 42}ms` }} />
                ))}
              </div>
              <div className="transport-ai-steps" aria-hidden="true">
                <span>프롬프트 분석</span>
                <span>코드 진행</span>
                <span>악기 배치</span>
              </div>
            </div>
          ) : null}
          <div className="transport-ai-header">
            <div>
              <span className="transport-ai-eyebrow">작곡 AI</span>
              <strong>원하는 곡을 바로 만들어보세요.</strong>
            </div>
            <button
              type="button"
              className="transport-ai-close"
              onClick={() => setIsAiPanelOpen(false)}
              aria-label="Close AI panel"
            >
              ×
            </button>
          </div>

          <label className="transport-ai-field">
            <span>한 줄 요약</span>
            <input
              type="text"
              className="transport-ai-input"
              value={aiSummary}
              onChange={(event) => setAiSummary(event.target.value)}
              placeholder="예: 몽환적인 시티팝 무드, 여름 밤처럼"
            />
          </label>

          <label className="transport-ai-field">
            <span>상세 요청</span>
            <textarea
              className="transport-ai-textarea"
              value={aiDetails}
              onChange={(event) => setAiDetails(event.target.value)}
              placeholder="분위기, 참고곡, 악기 구성, 리듬 무드 등을 자세히 적어 주세요."
            />
          </label>

          <p className="transport-ai-helper">
            AI가 장르, 분위기, BPM, 악기 조건을 분석해서 코드 진행과 필요한 악기 파트를 생성합니다.
          </p>

          <div className="transport-ai-actions">
            <button
              type="button"
              className="transport-button"
              onClick={() => setIsAiPanelOpen(false)}
            >
              닫기
            </button>
            <button
              type="button"
              className="transport-button transport-button--accent is-open"
              onClick={handleAiGenerate}
              disabled={isGenerating}
            >
              {isGenerating ? '생성 중...' : 'AI로 생성'}
            </button>
          </div>
        </section>
      ) : null}

      {aiCompletionToast ? (
        <div className="transport-ai-complete" role="status" aria-live="polite">
          <div className="transport-ai-complete-burst" aria-hidden="true">
            {Array.from({ length: 8 }).map((_, index) => (
              <span key={index} />
            ))}
          </div>
          <div className="transport-ai-complete-orb" aria-hidden="true">
            <span />
            <span />
          </div>
          <div className="transport-ai-complete-copy">
            <strong>AI 곡이 배치됐습니다</strong>
            <span>
              프롬프트에 맞춰 피아노롤에 바로 펼쳐놨어요.
            </span>
          </div>
          <div className="transport-ai-complete-wave" aria-hidden="true">
            {Array.from({ length: 14 }).map((_, index) => (
              <i key={index} style={{ animationDelay: `${index * 46}ms` }} />
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
};
