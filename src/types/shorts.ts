export type ShortVisibility = 'public' | 'private';
export type ShortTone = 'lime' | 'cyan' | 'violet' | 'amber';

export type ShortComment = {
  id: string;
  shortId: string;
  authorName: string;
  authorEmail: string;
  content: string;
  createdAt: number;
};

export type ShortItem = {
  id: string;
  title: string;
  description: string;
  creatorName: string;
  creatorEmail: string;
  genre: string;
  tags: string[];
  createdAt: number;
  durationLabel: string;
  likeCount: number;
  viewCount: number;
  visibility: ShortVisibility;
  tone: ShortTone;
  likedBy: string[];
  videoUrl?: string;
  videoStorageKey?: string;
  videoFileName?: string;
  videoSizeBytes?: number;
  audioUrl?: string;
  audioStorageKey?: string;
  audioFileName?: string;
  audioSizeBytes?: number;
  musicProjectId?: string;
  musicProjectTitle?: string;
  musicShareTrackId?: string;
};

export const SHORT_TONE_BACKGROUNDS: Record<ShortTone, string> = {
  lime: `
    radial-gradient(circle at 50% 18%, rgba(174, 255, 123, 0.36), transparent 24%),
    linear-gradient(180deg, rgba(82, 88, 96, 0.96) 0%, rgba(31, 32, 36, 0.98) 100%)
  `,
  cyan: `
    radial-gradient(circle at 50% 18%, rgba(92, 226, 255, 0.34), transparent 24%),
    linear-gradient(180deg, rgba(79, 86, 98, 0.96) 0%, rgba(30, 32, 38, 0.98) 100%)
  `,
  violet: `
    radial-gradient(circle at 50% 18%, rgba(176, 135, 255, 0.34), transparent 24%),
    linear-gradient(180deg, rgba(84, 81, 95, 0.96) 0%, rgba(31, 29, 38, 0.98) 100%)
  `,
  amber: `
    radial-gradient(circle at 50% 18%, rgba(255, 204, 112, 0.34), transparent 24%),
    linear-gradient(180deg, rgba(95, 84, 68, 0.96) 0%, rgba(36, 32, 28, 0.98) 100%)
  `,
};
