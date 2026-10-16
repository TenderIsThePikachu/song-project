import { useEffect, useMemo, useRef } from 'react';
import { getMusicShareTrackImage, type MusicShareTrackCard } from '../../dummy/musicShareLibrary';

type CoverFlowProps = {
  tracks: MusicShareTrackCard[];
  selectedIndex: number;
  playingTrackId: string | null;
  isPlaying: boolean;
  isPreparing: boolean;
  currentTime: number;
  duration: number;
  likedTrackIds: string[];
  isShuffle: boolean;
  isRepeat: boolean;
  onSelect: (index: number) => void;
  onPlay: (track: MusicShareTrackCard) => void;
  onMove: (direction: -1 | 1) => void;
  onTransportMove: (direction: -1 | 1) => void;
  onToggleLike: (track: MusicShareTrackCard) => void;
  onToggleShuffle: () => void;
  onToggleRepeat: () => void;
  onOpen: (track: MusicShareTrackCard) => void;
  onSeek: (ratio: number) => void;
};

function getCircularOffset(index: number, selectedIndex: number, length: number) {
  let offset = index - selectedIndex;
  if (offset > length / 2) offset -= length;
  if (offset < -length / 2) offset += length;
  return offset;
}

function formatTime(seconds: number) {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00';
  const wholeSeconds = Math.floor(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, '0')}`;
}

function getFallbackDuration(trackId: string) {
  const hash = Array.from(trackId).reduce(
    (value, character) => Math.imul(value ^ character.charCodeAt(0), 16777619) >>> 0,
    2166136261
  );
  return 105 + (hash % 141);
}

function getWaveform(trackId: string, count: number) {
  let seed = Array.from(trackId).reduce((sum, character) => sum + character.charCodeAt(0), 0) || 1;
  return Array.from({ length: count }, (_, index) => {
    seed = (seed * 9301 + 49297 + index * 17) % 233280;
    return 22 + Math.round((seed / 233280) * 70);
  });
}

function getPreviewProgress(trackId: string) {
  const hash = Array.from(trackId).reduce(
    (sum, character, index) => sum + character.charCodeAt(0) * (index + 5),
    23
  );
  const positions = [0.18, 0.34, 0.52, 0.64, 0.76, 0.86];
  const base = positions[hash % positions.length];
  return Math.min(0.88, base + ((hash >>> 3) % 5) / 100);
}

function Waveform({ trackId, progress, compact = false }: { trackId: string; progress: number; compact?: boolean }) {
  const bars = useMemo(() => getWaveform(trackId, 48), [trackId]);
  return (
    <span className={`main-cover-wave${compact ? ' is-compact' : ''}`} aria-hidden="true">
      {bars.map((height, index) => (
        <i
          key={`${trackId}-${index}`}
          className={(index + 1) / bars.length <= progress ? 'is-played' : undefined}
          style={{ height: `${height}%` }}
        />
      ))}
    </span>
  );
}

type PlayerIconName = 'shuffle' | 'previous' | 'play' | 'pause' | 'next' | 'repeat';

function PlayerIcon({ name }: { name: PlayerIconName }) {
  const paths: Record<PlayerIconName, React.ReactNode> = {
    shuffle: (
      <>
        <path d="M4 7h2.5c4.8 0 6.2 10 11 10H20" />
        <path d="m17 14 3 3-3 3M4 17h2.5c1.7 0 3-1.2 4.1-2.8M13.4 9.8C14.6 8.2 15.8 7 17.5 7H20" />
        <path d="m17 4 3 3-3 3" />
      </>
    ),
    previous: (
      <>
        <path d="M6 5v14" />
        <path d="m18 6-8 6 8 6Z" fill="currentColor" stroke="none" />
      </>
    ),
    play: <path d="m8 5 11 7-11 7Z" fill="currentColor" stroke="none" />,
    pause: <><path d="M9 6v12M15 6v12" /></>,
    next: (
      <>
        <path d="M18 5v14" />
        <path d="m6 6 8 6-8 6Z" fill="currentColor" stroke="none" />
      </>
    ),
    repeat: (
      <>
        <path d="M17 4l3 3-3 3" />
        <path d="M4 11V9a2 2 0 0 1 2-2h14M7 20l-3-3 3-3" />
        <path d="M20 13v2a2 2 0 0 1-2 2H4" />
      </>
    ),
  };

  return <svg className="main-player-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function ChevronIcon({ direction }: { direction: 'left' | 'right' }) {
  return (
    <svg className="main-cover-arrow-icon" viewBox="0 0 24 24" aria-hidden="true">
      <path d={direction === 'left' ? 'm15 5-7 7 7 7' : 'm9 5 7 7-7 7'} />
    </svg>
  );
}

export default function CoverFlow({
  tracks,
  selectedIndex,
  playingTrackId,
  isPlaying,
  isPreparing,
  currentTime,
  duration,
  likedTrackIds,
  isShuffle,
  isRepeat,
  onSelect,
  onPlay,
  onMove,
  onTransportMove,
  onToggleLike,
  onToggleShuffle,
  onToggleRepeat,
  onOpen,
  onSeek,
}: CoverFlowProps) {
  const dragStartRef = useRef<number | null>(null);
  const onMoveRef = useRef(onMove);
  const selectedTrack = tracks[selectedIndex];
  const isSelectedPlaying = playingTrackId === selectedTrack.id && isPlaying;
  const progress = duration > 0 ? Math.min(1, currentTime / duration) : 0;
  const paginationIndexes = useMemo(() => {
    const maximumDots = 7;
    if (tracks.length <= maximumDots) return tracks.map((_, index) => index);

    const halfWindow = Math.floor(maximumDots / 2);
    const start = Math.min(
      Math.max(0, selectedIndex - halfWindow),
      tracks.length - maximumDots
    );
    return Array.from({ length: maximumDots }, (_, index) => start + index);
  }, [selectedIndex, tracks]);

  useEffect(() => {
    onMoveRef.current = onMove;
  }, [onMove]);

  useEffect(() => {
    if (tracks.length < 2) return undefined;

    const timer = window.setInterval(() => {
      if (dragStartRef.current === null && !document.hidden) {
        onMoveRef.current(1);
      }
    }, 6000);

    return () => window.clearInterval(timer);
  }, [selectedIndex, tracks.length]);

  const requestMove = (direction: -1 | 1) => {
    onMove(direction);
  };

  const requestSelect = (index: number) => {
    if (index === selectedIndex) return;
    onSelect(index);
  };

  const finishDrag = (clientX: number) => {
    const start = dragStartRef.current;
    dragStartRef.current = null;
    if (start === null) return;
    const distance = clientX - start;
    if (Math.abs(distance) < 45) return;
    requestMove(distance < 0 ? 1 : -1);
  };

  return (
    <section className="main-coverflow" aria-label="오늘의 추천 음악">
      <button type="button" className="main-cover-arrow is-left" onClick={() => requestMove(-1)} aria-label="이전 곡"><ChevronIcon direction="left" /></button>
      <div
        className="main-cover-stage"
        onPointerDown={(event) => {
          dragStartRef.current = event.clientX;
          event.currentTarget.setPointerCapture(event.pointerId);
        }}
        onPointerUp={(event) => finishDrag(event.clientX)}
        onPointerCancel={() => { dragStartRef.current = null; }}
      >
        {tracks.map((track, index) => {
          const offset = getCircularOffset(index, selectedIndex, tracks.length);
          if (Math.abs(offset) > 4) return null;
          const isCenter = offset === 0;
          const trackIsPlaying = playingTrackId === track.id && isPlaying;
          const cardDuration = isCenter && duration > 0 ? duration : getFallbackDuration(track.id);
          const cardProgress = playingTrackId === track.id ? progress : getPreviewProgress(track.id);
          const cardCurrentTime = cardDuration * cardProgress;

          return (
            <article
              key={track.id}
              className={`main-cover-card${isCenter ? ' is-center' : ' is-side'}`}
              data-offset={offset}
              onClick={() => { if (!isCenter) requestSelect(index); }}
            >
              <div className="main-cover-art-wrap">
                <img src={getMusicShareTrackImage(track)} alt={`${track.title} 앨범 커버`} draggable={false} />
                <button
                  type="button"
                  className={`main-cover-like${likedTrackIds.includes(track.id) ? ' is-active' : ''}`}
                  aria-label={likedTrackIds.includes(track.id) ? '좋아요 취소' : '좋아요'}
                  onClick={(event) => {
                    event.stopPropagation();
                    onToggleLike(track);
                  }}
                >
                  {likedTrackIds.includes(track.id) ? '♥' : '♡'}
                </button>
              </div>

              <div className="main-cover-info">
                <button type="button" className="main-cover-title" onClick={() => onOpen(track)}>{track.title}</button>
                <span className="main-cover-artist">{track.creatorName}</span>
                <span className="main-cover-progression" aria-hidden={!isCenter}>{track.progression}</span>
                <Waveform trackId={track.id} progress={cardProgress} compact={!isCenter} />

                <div className="main-cover-player-zone">
                  <div className="main-center-player" aria-hidden={!isCenter}>
                    <div className="main-cover-time-row"><span>{formatTime(cardCurrentTime)}</span><span>{formatTime(cardDuration)}</span></div>
                    <button
                      type="button"
                      className="main-cover-progress"
                      aria-label="재생 위치 이동"
                      onClick={(event) => {
                        event.stopPropagation();
                        const bounds = event.currentTarget.getBoundingClientRect();
                        onSeek((event.clientX - bounds.left) / bounds.width);
                      }}
                    >
                      <i style={{ width: `${cardProgress * 100}%` }} />
                    </button>
                    <div className="main-cover-controls">
                      <button type="button" className={isShuffle ? 'is-active' : undefined} aria-pressed={isShuffle} onClick={(event) => { event.stopPropagation(); onToggleShuffle(); }} aria-label="셔플"><PlayerIcon name="shuffle" /></button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onTransportMove(-1); }} aria-label="이전 곡"><PlayerIcon name="previous" /></button>
                      <button
                        type="button"
                        className="is-play"
                        disabled={isPreparing}
                        onClick={(event) => {
                          event.stopPropagation();
                          onPlay(track);
                        }}
                        aria-label={isSelectedPlaying ? '일시정지' : '재생'}
                      >
                        {isPreparing ? '…' : <PlayerIcon name={isSelectedPlaying ? 'pause' : 'play'} />}
                      </button>
                      <button type="button" onClick={(event) => { event.stopPropagation(); onTransportMove(1); }} aria-label="다음 곡"><PlayerIcon name="next" /></button>
                      <button type="button" className={isRepeat ? 'is-active' : undefined} aria-pressed={isRepeat} onClick={(event) => { event.stopPropagation(); onToggleRepeat(); }} aria-label="반복"><PlayerIcon name="repeat" /></button>
                    </div>
                  </div>
                  <div className="main-side-play-row" aria-hidden={isCenter}>
                    <span>{formatTime(cardCurrentTime)}</span>
                    <button
                      type="button"
                      tabIndex={isCenter ? -1 : 0}
                      aria-label={`${track.title} 재생`}
                      onClick={(event) => {
                        event.stopPropagation();
                        requestSelect(index);
                        onPlay(track);
                      }}
                    >
                      <PlayerIcon name={trackIsPlaying ? 'pause' : 'play'} />
                    </button>
                    <span>{formatTime(cardDuration)}</span>
                  </div>
                </div>
              </div>
            </article>
          );
        })}
      </div>
      <button type="button" className="main-cover-arrow is-right" onClick={() => requestMove(1)} aria-label="다음 곡"><ChevronIcon direction="right" /></button>

      <div className="main-cover-pagination" aria-label="추천 음악 페이지">
        {paginationIndexes.map((index) => {
          const track = tracks[index];
          return (
          <button
            type="button"
            key={track.id}
            className={index === selectedIndex ? 'is-active' : undefined}
            onClick={() => requestSelect(index)}
            aria-label={`${index + 1}번째 곡`}
          />
          );
        })}
      </div>
    </section>
  );
}
