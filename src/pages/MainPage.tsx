import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { exportSongProjectAsMp3 } from '../audio/engine';
import CoverFlow from '../components/home/CoverFlow';
import LegacyHomeSections from '../components/home/LegacyHomeSections';
import TrendingMusic from '../components/home/TrendingMusic';
import SiteHeader from '../components/layout/SiteHeader';
import {
  BASE_SHARED_TRACK_LIBRARY,
  buildSharedTrackCard,
  type MusicShareTrackCard,
} from '../dummy/musicShareLibrary';
import { useAuthStore } from '../store/authStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import { useMusicShareStore } from '../store/musicShareStore';
import { getProjectFromSharedTrack } from '../utils/songSketchDna';
import './MainPage.css';

const GUEST_LIKED_TRACKS_KEY = 'song-project-main-guest-likes';

function readGuestLikedTracks() {
  try {
    const value = JSON.parse(localStorage.getItem(GUEST_LIKED_TRACKS_KEY) ?? '[]');
    return Array.isArray(value) ? value.filter((id): id is string => typeof id === 'string') : [];
  } catch {
    return [];
  }
}

function mergeUniqueTracks(...groups: MusicShareTrackCard[][]) {
  const tracks = new Map<string, MusicShareTrackCard>();
  groups.flat().forEach((track) => tracks.set(track.id, track));
  return [...tracks.values()];
}

function getTrackDurationSeconds(track: MusicShareTrackCard) {
  if (track.project) {
    return Math.max(1, Math.round(track.project.steps * (60 / Math.max(1, track.project.bpm) / 4)));
  }

  const hash = Array.from(track.id).reduce((sum, character) => sum + character.charCodeAt(0), 0);
  return 105 + (hash % 106);
}

export default function MainPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const serverTracks = useMusicShareStore((state) => state.tracks);
  const trackMetricsById = useMusicShareStore((state) => state.trackMetricsById);
  const likedTrackIdsByUser = useMusicShareStore((state) => state.likedTrackIdsByUser);
  const seedMusicShare = useMusicShareStore((state) => state.seedMusicShare);
  const toggleTrackLike = useMusicShareStore((state) => state.toggleTrackLike);
  const recordTrackView = useMusicShareStore((state) => state.recordTrackView);
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [playingTrackId, setPlayingTrackId] = useState<string | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreparing, setIsPreparing] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [audioDuration, setAudioDuration] = useState(0);
  const [isShuffle, setIsShuffle] = useState(false);
  const [isRepeat, setIsRepeat] = useState(false);
  const [guestLikedTrackIds, setGuestLikedTrackIds] = useState<string[]>(readGuestLikedTracks);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const audioUrlCacheRef = useRef(new Map<string, string>());
  const playbackRequestRef = useRef(0);

  useEffect(() => {
    void Promise.allSettled([seedLibrary(), seedMusicShare()]);
  }, [seedLibrary, seedMusicShare]);

  useEffect(() => () => {
    audioUrlCacheRef.current.forEach((url) => URL.revokeObjectURL(url));
    audioUrlCacheRef.current.clear();
  }, []);

  const sharedProjectTracks = useMemo(
    () => projects.map(buildSharedTrackCard).filter((track): track is MusicShareTrackCard => Boolean(track)),
    [projects]
  );

  const tracks = useMemo(
    () => mergeUniqueTracks(BASE_SHARED_TRACK_LIBRARY, sharedProjectTracks, serverTracks),
    [serverTracks, sharedProjectTracks]
  );

  useEffect(() => {
    if (selectedIndex >= tracks.length) setSelectedIndex(0);
  }, [selectedIndex, tracks.length]);

  const likedTrackIds = user ? likedTrackIdsByUser[user.email] ?? [] : guestLikedTrackIds;
  const selectedTrack = tracks[selectedIndex] ?? null;

  const selectTrack = useCallback((index: number) => {
    if (!tracks.length) return;
    setSelectedIndex((index + tracks.length) % tracks.length);
  }, [tracks.length]);

  const startTrack = useCallback(async (track: MusicShareTrackCard) => {
    const audio = audioRef.current;
    if (!audio) return;

    const requestId = playbackRequestRef.current + 1;
    playbackRequestRef.current = requestId;

    try {
      const trackIndex = tracks.findIndex((item) => item.id === track.id);
      if (trackIndex >= 0) setSelectedIndex(trackIndex);

      if (playingTrackId === track.id && audio.src) {
        if (audio.paused) await audio.play();
        else audio.pause();
        return;
      }

      setIsPreparing(true);
      let audioUrl = audioUrlCacheRef.current.get(track.id);
      if (!audioUrl) {
        const sourceProject = track.projectId
          ? projects.find((project) => project.id === track.projectId)?.project
          : undefined;
        const project = getProjectFromSharedTrack(track, sourceProject);
        const blob = await exportSongProjectAsMp3(project);
        audioUrl = URL.createObjectURL(blob);
        audioUrlCacheRef.current.set(track.id, audioUrl);
      }

      if (requestId !== playbackRequestRef.current) return;
      audio.pause();
      audio.src = audioUrl;
      audio.currentTime = 0;
      setPlayingTrackId(track.id);
      setCurrentTime(0);
      setAudioDuration(0);
      await audio.play();
      void recordTrackView(track.id, user?.email);
    } catch (error) {
      console.error('Main page track preview failed:', error);
      setIsPlaying(false);
    } finally {
      if (requestId === playbackRequestRef.current) setIsPreparing(false);
    }
  }, [playingTrackId, projects, recordTrackView, tracks, user?.email]);

  const playAtIndex = useCallback((index: number) => {
    if (!tracks.length) return;
    const nextIndex = (index + tracks.length) % tracks.length;
    setSelectedIndex(nextIndex);
    void startTrack(tracks[nextIndex]);
  }, [startTrack, tracks]);

  const moveTrack = useCallback((direction: -1 | 1, playAfterMove = false) => {
    if (!tracks.length) return;
    let nextIndex: number;
    if (isShuffle && playAfterMove) {
      nextIndex = tracks.length === 1
        ? 0
        : (selectedIndex + 1 + Math.floor(Math.random() * (tracks.length - 1))) % tracks.length;
    } else {
      nextIndex = (selectedIndex + direction + tracks.length) % tracks.length;
    }
    if (playAfterMove) playAtIndex(nextIndex);
    else selectTrack(nextIndex);
  }, [isShuffle, playAtIndex, selectTrack, selectedIndex, tracks.length]);

  const toggleLike = useCallback(async (track: MusicShareTrackCard) => {
    if (!user) {
      setGuestLikedTrackIds((current) => {
        const next = current.includes(track.id)
          ? current.filter((id) => id !== track.id)
          : [...current, track.id];
        localStorage.setItem(GUEST_LIKED_TRACKS_KEY, JSON.stringify(next));
        return next;
      });
      return;
    }
    await toggleTrackLike(track.id, user.email);
  }, [toggleTrackLike, user]);

  const trendingTracks = useMemo(
    () => [...tracks]
      .sort((left, right) => {
        const leftMetrics = trackMetricsById[left.id];
        const rightMetrics = trackMetricsById[right.id];
        const leftScore = (leftMetrics?.viewCount ?? 0) + (leftMetrics?.likeCount ?? 0) * 4;
        const rightScore = (rightMetrics?.viewCount ?? 0) + (rightMetrics?.likeCount ?? 0) * 4;
        return rightScore - leftScore || right.createdAt - left.createdAt;
      })
      .slice(0, 5),
    [trackMetricsById, tracks]
  );

  return (
    <div className="main-page">
      <SiteHeader />
      <main className="main-shell">
        <section className="main-featured-screen">
          <header className="main-recommendation-heading">
            <h1>오늘의 <em>추천</em></h1>
            <p>작곡밥의 AI가 엄선한, 지금 이 순간을 위한 음악이에요.</p>
          </header>

          {selectedTrack ? (
            <CoverFlow
              tracks={tracks}
              selectedIndex={selectedIndex}
              playingTrackId={playingTrackId}
              isPlaying={isPlaying}
              isPreparing={isPreparing}
              currentTime={playingTrackId === selectedTrack.id ? currentTime : 0}
              duration={playingTrackId === selectedTrack.id && audioDuration
                ? audioDuration
                : getTrackDurationSeconds(selectedTrack)}
              likedTrackIds={likedTrackIds}
              isShuffle={isShuffle}
              isRepeat={isRepeat}
              onSelect={selectTrack}
              onPlay={(track) => void startTrack(track)}
              onMove={(direction) => moveTrack(direction)}
              onTransportMove={(direction) => moveTrack(direction, true)}
              onToggleLike={(track) => void toggleLike(track)}
              onToggleShuffle={() => setIsShuffle((current) => !current)}
              onToggleRepeat={() => setIsRepeat((current) => !current)}
              onOpen={(track) => navigate(`/community/music/${track.id}`)}
              onSeek={(ratio) => {
                const audio = audioRef.current;
                if (!audio || playingTrackId !== selectedTrack.id || !Number.isFinite(audio.duration)) return;
                audio.currentTime = Math.max(0, Math.min(1, ratio)) * audio.duration;
              }}
            />
          ) : (
            <section className="main-empty-state">
              <strong>추천할 음악을 불러오는 중입니다.</strong>
              <span>잠시 후 음악 공유 목록이 표시됩니다.</span>
            </section>
          )}

          <TrendingMusic
            tracks={trendingTracks}
            onOpen={(track) => navigate(`/community/music/${track.id}`)}
            onPlay={(track) => void startTrack(track)}
          />
        </section>

        <LegacyHomeSections />

        <audio
          ref={audioRef}
          className="main-audio-element"
          onPlay={() => setIsPlaying(true)}
          onPause={() => setIsPlaying(false)}
          onTimeUpdate={(event) => setCurrentTime(event.currentTarget.currentTime)}
          onLoadedMetadata={(event) => setAudioDuration(event.currentTarget.duration || 0)}
          onError={() => {
            setIsPlaying(false);
            setIsPreparing(false);
          }}
          onEnded={() => {
            if (isRepeat && audioRef.current) {
              audioRef.current.currentTime = 0;
              void audioRef.current.play();
              return;
            }
            moveTrack(1, true);
          }}
        />
      </main>
    </div>
  );
}
