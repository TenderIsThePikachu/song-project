const LOCAL_HOSTNAMES = new Set(['localhost', '127.0.0.1', '0.0.0.0', '::1']);

export const LOCAL_COLLAB_GUEST = {
  email: 'guest@songmaker.local',
  name: '로컬 게스트',
} as const;

export function isLocalDevelopmentHost() {
  if (typeof window === 'undefined') return false;

  return import.meta.env.DEV || LOCAL_HOSTNAMES.has(window.location.hostname);
}
