import type { ComposerProjectRecord } from '../store/composerLibraryStore';
import type { SongProject } from '../store/songStore';

export type MusicShareCategory =
  | 'all'
  | 'classic'
  | 'pop'
  | 'ballad'
  | 'jazz'
  | 'citypop'
  | 'ost'
  | 'anime'
  | 'game'
  | 'rock';

export type MusicShareTrackCard = {
  id: string;
  title: string;
  progression: string;
  reference: string;
  category: Exclude<MusicShareCategory, 'all'>;
  tags: string[];
  palette: string;
  createdAt: number;
  creatorName: string;
  isSharedProject?: boolean;
  projectId?: string;
  creatorEmail?: string;
  imageUrl?: string;
  project?: SongProject;
};

export const MUSIC_SHARE_FALLBACK_IMAGES = [
  '/landing-assets/shared-fallback-band.jpg',
  '/landing-assets/shared-fallback-film.jpg',
  '/landing-assets/shared-fallback-pink-sketch.jpg',
  '/landing-assets/shared-fallback-groove.jpg',
  '/landing-assets/shared-fallback-dream.jpg',
  '/landing-assets/shared-fallback-ballad.jpg',
  '/landing-assets/shared-fallback-jazz.jpg',
  '/landing-assets/shared-fallback-pink-sketch.jpg',
] as const;

export function getMusicShareTrackImage(track: Pick<MusicShareTrackCard, 'id' | 'imageUrl'>) {
  const imageUrl = track.imageUrl?.trim();
  if (imageUrl) {
    return imageUrl;
  }

  const hash = Array.from(track.id).reduce(
    (value, character) => (value * 31 + character.charCodeAt(0)) >>> 0,
    0
  );

  return MUSIC_SHARE_FALLBACK_IMAGES[hash % MUSIC_SHARE_FALLBACK_IMAGES.length];
}

export const MUSIC_SHARE_CATEGORIES: Array<{
  key: MusicShareCategory;
  label: string;
}> = [
  { key: 'all', label: '전체' },
  { key: 'classic', label: '클래식' },
  { key: 'pop', label: '팝' },
  { key: 'ballad', label: '발라드' },
  { key: 'jazz', label: '재즈' },
  { key: 'citypop', label: '시티팝' },
  { key: 'ost', label: 'OST' },
  { key: 'anime', label: '애니' },
  { key: 'game', label: '게임' },
  { key: 'rock', label: '록' },
];

export const MUSIC_SHARE_TAGS = [
  '전체',
  '입문',
  '감성',
  '재즈',
  '발라드',
  '록',
  'OST',
  '애니',
  '시티팝',
  '공유곡',
];

export const BASE_SHARED_TRACK_LIBRARY: MusicShareTrackCard[] = [
  {
    id: 'share-base-1',
    title: '머니 코드 데모',
    progression: 'I - V - vi - IV',
    reference: 'Johann Pachelbel - Canon',
    category: 'classic',
    tags: ['입문', '감성'],
    palette:
      'linear-gradient(180deg, rgba(95,95,99,0.92) 0%, rgba(55,55,58,0.96) 100%)',
    imageUrl: '/landing-assets/shared-fallback-film.jpg',
    createdAt: new Date('2026-03-17T10:20:00+09:00').getTime(),
    creatorName: 'loopmaker',
  },
  {
    id: 'share-base-2',
    title: '비틀즈 무드 진행',
    progression: 'I - V - vi - IV',
    reference: 'The Beatles - Let It Be',
    category: 'pop',
    tags: ['발라드', '감성'],
    palette:
      'linear-gradient(180deg, rgba(89,89,94,0.92) 0%, rgba(51,51,54,0.96) 100%)',
    imageUrl: '/landing-assets/shared-fallback-band.jpg',
    createdAt: new Date('2026-03-18T08:10:00+09:00').getTime(),
    creatorName: 'chordnote',
  },
  {
    id: 'share-base-3',
    title: '루트 중심 진행',
    progression: 'I - vi - IV - V',
    reference: 'Ben E. King - Stand By Me',
    category: 'pop',
    tags: ['감성', '입문'],
    palette:
      'linear-gradient(180deg, rgba(94,94,98,0.92) 0%, rgba(53,53,57,0.96) 100%)',
    imageUrl: '/landing-assets/emotional-bridge.jpg',
    createdAt: new Date('2026-03-18T19:45:00+09:00').getTime(),
    creatorName: 'groovepark',
  },
  {
    id: 'share-base-4',
    title: '재즈 발라드 루프',
    progression: 'ii - V - I',
    reference: 'Jazz Standard',
    category: 'jazz',
    tags: ['재즈', '입문'],
    palette:
      'linear-gradient(180deg, rgba(91,91,96,0.92) 0%, rgba(50,50,55,0.96) 100%)',
    imageUrl: '/landing-assets/shared-fallback-jazz.jpg',
    createdAt: new Date('2026-03-19T11:05:00+09:00').getTime(),
    creatorName: 'bluekeys',
  },
  {
    id: 'share-base-5',
    title: '시티팝 브리지',
    progression: 'I - V - vi - iii - IV - I - IV - V',
    reference: 'Plastic Love',
    category: 'citypop',
    tags: ['시티팝', '감성'],
    palette:
      'linear-gradient(180deg, rgba(96,96,101,0.92) 0%, rgba(54,54,58,0.96) 100%)',
    imageUrl: '/landing-assets/deep-house-line.jpg',
    createdAt: new Date('2026-03-19T20:10:00+09:00').getTime(),
    creatorName: 'nightsynth',
  },
  {
    id: 'share-base-6',
    title: '영화 OST 루프',
    progression: 'vi - IV - I - V',
    reference: 'Film OST',
    category: 'ost',
    tags: ['OST', '감성'],
    palette:
      'linear-gradient(180deg, rgba(95,95,100,0.92) 0%, rgba(52,52,56,0.96) 100%)',
    imageUrl: '/landing-assets/shared-fallback-film.jpg',
    createdAt: new Date('2026-03-20T09:00:00+09:00').getTime(),
    creatorName: 'scenecomposer',
  },
  {
    id: 'share-base-7',
    title: '애니 엔딩 무드',
    progression: 'vi - IV - V - IV',
    reference: 'Anime Ending',
    category: 'anime',
    tags: ['애니', 'OST'],
    palette:
      'linear-gradient(180deg, rgba(92,92,96,0.92) 0%, rgba(50,50,54,0.96) 100%)',
    imageUrl: '/landing-assets/shared-fallback-pink-sketch.jpg',
    createdAt: new Date('2026-03-20T16:35:00+09:00').getTime(),
    creatorName: 'animechord',
  },
  {
    id: 'share-base-8',
    title: '게임 메인 테마',
    progression: 'I - vi - ii - V',
    reference: 'Game Theme',
    category: 'game',
    tags: ['게임', 'OST'],
    palette:
      'linear-gradient(180deg, rgba(87,87,90,0.92) 0%, rgba(48,48,52,0.96) 100%)',
    imageUrl: '/landing-assets/shared-fallback-dream.jpg',
    createdAt: new Date('2026-03-20T23:15:00+09:00').getTime(),
    creatorName: 'arcadescore',
  },
  {
    id: 'share-base-9',
    title: '시험 때 사용할 노래',
    progression: 'I - V - vi - IV',
    reference: '시험 연습용 공유곡',
    category: 'pop',
    tags: ['시험', '연습', '공유곡'],
    palette:
      'linear-gradient(180deg, rgba(68,86,102,0.92) 0%, rgba(31,37,45,0.96) 100%)',
    imageUrl: '/landing-assets/shared-fallback-groove.jpg',
    createdAt: new Date('2026-05-09T09:00:00+09:00').getTime(),
    creatorName: 'songmaker',
  },
];

const GENRE_CATEGORY_MAP: Record<string, Exclude<MusicShareCategory, 'all'>> = {
  ballad: 'ballad',
  pop: 'pop',
  jazz: 'jazz',
  ost: 'ost',
  citypop: 'citypop',
  electronic: 'game',
};

const GENRE_LABEL_MAP: Record<string, string> = {
  ballad: '발라드',
  pop: '팝',
  jazz: '재즈',
  ost: 'OST',
  citypop: '시티팝',
  electronic: '일렉트로닉',
};

const GENRE_PALETTE_MAP: Record<string, string> = {
  ballad:
    'linear-gradient(180deg, rgba(83,87,95,0.92) 0%, rgba(43,45,50,0.96) 100%)',
  pop:
    'linear-gradient(180deg, rgba(88,92,101,0.92) 0%, rgba(42,44,49,0.96) 100%)',
  jazz:
    'linear-gradient(180deg, rgba(96,88,76,0.92) 0%, rgba(48,41,36,0.96) 100%)',
  ost:
    'linear-gradient(180deg, rgba(82,88,102,0.92) 0%, rgba(40,43,51,0.96) 100%)',
  citypop:
    'linear-gradient(180deg, rgba(94,76,102,0.92) 0%, rgba(43,37,48,0.96) 100%)',
  electronic:
    'linear-gradient(180deg, rgba(70,90,104,0.92) 0%, rgba(34,41,48,0.96) 100%)',
};

const SHARED_TRACK_IMAGE_MAP: Record<string, string> = {
  'share-base-1': '/landing-assets/shared-fallback-film.jpg',
  'share-base-2': '/landing-assets/shared-fallback-band.jpg',
  'share-base-3': '/landing-assets/emotional-bridge.jpg',
  'share-base-4': '/landing-assets/shared-fallback-jazz.jpg',
  'share-base-5': '/landing-assets/deep-house-line.jpg',
  'share-base-6': '/landing-assets/shared-fallback-film.jpg',
  'share-base-7': '/landing-assets/shared-fallback-pink-sketch.jpg',
  'share-base-8': '/landing-assets/shared-fallback-dream.jpg',
};

export function getGenreLabel(genre: string) {
  return GENRE_LABEL_MAP[genre] ?? genre;
}

export function buildSharedTrackCard(
  project: ComposerProjectRecord
): MusicShareTrackCard | null {
  if (!project.isShared || project.shareVisibility !== 'public') {
    return null;
  }

  const category = GENRE_CATEGORY_MAP[project.genre] ?? 'pop';
  const label = getGenreLabel(project.genre);

  return {
    id: project.id,
    title: project.title,
    progression: `${project.steps} steps · ${project.bpm} BPM`,
    reference: `${project.creatorName} 공유`,
    category,
    tags: [label, '공유곡', ...(project.shareMidiEnabled ? ['MIDI'] : [])],
    palette: GENRE_PALETTE_MAP[project.genre] ?? GENRE_PALETTE_MAP.pop,
    createdAt: project.createdAt,
    creatorName: project.creatorName,
    isSharedProject: true,
    projectId: project.id,
    creatorEmail: project.creatorEmail,
    project: project.project,
    imageUrl:
      project.coverImageUrl ||
      SHARED_TRACK_IMAGE_MAP[project.id] ||
      (category === 'classic'
        ? '/seed-images/music/classic.svg'
        : category === 'jazz'
          ? '/seed-images/music/jazz.svg'
          : category === 'citypop'
            ? '/seed-images/music/citypop.svg'
            : category === 'ost' || category === 'anime' || category === 'game'
              ? '/seed-images/music/screen.svg'
              : '/seed-images/music/pop.svg'),
  };
}
