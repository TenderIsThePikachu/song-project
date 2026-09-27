export type CollabMemberColor = {
  accent: string;
  soft: string;
  ink: string;
};

const COLLAB_MEMBER_COLORS: CollabMemberColor[] = [
  { accent: '#14b8a6', soft: '#ccfbf1', ink: '#0f766e' },
  { accent: '#3b82f6', soft: '#dbeafe', ink: '#1d4ed8' },
  { accent: '#8b5cf6', soft: '#ede9fe', ink: '#6d28d9' },
  { accent: '#ec4899', soft: '#fce7f3', ink: '#be185d' },
  { accent: '#f59e0b', soft: '#fef3c7', ink: '#b45309' },
  { accent: '#06b6d4', soft: '#cffafe', ink: '#0e7490' },
  { accent: '#84cc16', soft: '#ecfccb', ink: '#4d7c0f' },
  { accent: '#f97316', soft: '#ffedd5', ink: '#c2410c' },
];

export function createRandomCollabMemberColor(): CollabMemberColor {
  const randomValues = new Uint32Array(1);
  globalThis.crypto?.getRandomValues?.(randomValues);
  const hue = globalThis.crypto
    ? randomValues[0] % 360
    : Math.floor(Math.random() * 360);

  return {
    accent: `hsl(${hue} 68% 48%)`,
    soft: `hsl(${hue} 72% 93%)`,
    ink: `hsl(${hue} 70% 32%)`,
  };
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
