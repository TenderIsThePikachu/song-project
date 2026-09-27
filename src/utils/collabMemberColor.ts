export type CollabMemberColor = {
  accent: string;
  soft: string;
  ink: string;
};

const COLLAB_MEMBER_COLORS: CollabMemberColor[] = [
  { accent: '#3b82f6', soft: '#dbeafe', ink: '#1d4ed8' },
  { accent: '#8b5cf6', soft: '#ede9fe', ink: '#6d28d9' },
  { accent: '#ec4899', soft: '#fce7f3', ink: '#be185d' },
  { accent: '#d69a2d', soft: '#fef3c7', ink: '#92400e' },
  { accent: '#06b6d4', soft: '#cffafe', ink: '#0e7490' },
  { accent: '#84cc16', soft: '#ecfccb', ink: '#4d7c0f' },
  { accent: '#f97316', soft: '#ffedd5', ink: '#c2410c' },
];

export const COLLAB_MEMBER_COLOR_OPTIONS = COLLAB_MEMBER_COLORS.map((color) => color.accent);

export function createRandomCollabMemberColor(): CollabMemberColor {
  const randomValues = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(randomValues);
  const colorIndex = globalThis.crypto
    ? randomValues[0] % COLLAB_MEMBER_COLORS.length
    : Math.floor(Math.random() * COLLAB_MEMBER_COLORS.length);

  return COLLAB_MEMBER_COLORS[colorIndex];
}

export function isCollabMemberColor(color?: string | null): color is string {
  return Boolean(color && COLLAB_MEMBER_COLOR_OPTIONS.includes(color));
}

export function getCollabMemberColor(identity: string): CollabMemberColor {
  const normalizedIdentity = identity.trim().toLowerCase();
  let hash = 0;

  for (let index = 0; index < normalizedIdentity.length; index += 1) {
    hash = (hash * 31 + normalizedIdentity.charCodeAt(index)) >>> 0;
  }

  return COLLAB_MEMBER_COLORS[hash % COLLAB_MEMBER_COLORS.length];
}

export function getCollabMemberInitial(name: string): string {
  return name.trim().charAt(0).toUpperCase() || '?';
}
