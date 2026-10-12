import { getMusicShareTrackImage, type MusicShareTrackCard } from '../../dummy/musicShareLibrary';

type TrendingMusicProps = {
  tracks: MusicShareTrackCard[];
  onOpen: (track: MusicShareTrackCard) => void;
  onPlay: (track: MusicShareTrackCard) => void;
};

export default function TrendingMusic({ tracks, onOpen, onPlay }: TrendingMusicProps) {
  if (!tracks.length) return null;

  return (
    <section className="main-trending" aria-labelledby="main-trending-title">
      <button type="button" className="main-trending-heading" onClick={() => onPlay(tracks[0])}>
        <i>▶</i>
        <strong id="main-trending-title">지금 떠오르는 인기곡</strong>
        <span>›</span>
      </button>
      <div className="main-trending-list">
        {tracks.map((track, index) => (
          <button type="button" className="main-trending-item" key={track.id} onClick={() => onOpen(track)}>
            <img src={getMusicShareTrackImage(track)} alt="" />
            <b>{String(index + 1).padStart(2, '0')}</b>
            <span><strong>{track.title}</strong><small>{track.creatorName}</small></span>
          </button>
        ))}
      </div>
    </section>
  );
}
