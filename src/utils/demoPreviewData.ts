import type { CollabProject } from '../store/collabStore';
import type { SessionRecruitPost } from '../types/sessionRecruit';

export const DEMO_COLLAB_ID = 'demo-collab-preview';
export const DEMO_COLLAB_PROJECT: CollabProject = {
  id: DEMO_COLLAB_ID,
  title: '123',
  summary: '멤버들과 함께 좋은 곡을 만들어보세요.',
  genre: 'ballad', bpm: 100, steps: 640, status: 'working',
  createdAt: 1788843120000 - 86_400_000, updatedAt: 1788843120000,
  ownerEmail: 'demo@songbap.local', ownerName: '123', sourceProjectId: null,
  snapshotRevision: 0, snapshotUpdatedByEmail: null, snapshotUpdatedBySessionId: null,
  members: [
    { email: 'demo@songbap.local', name: '123', role: 'owner', joinedAt: Date.now() - 86_400_000 },
    { email: 'demo2@songbap.local', name: 'test', role: 'editor', joinedAt: Date.now() - 43_200_000 },
    { email: 'demo3@songbap.local', name: '20312', role: 'editor', joinedAt: Date.now() - 21_600_000 },
  ],
  tags: ['발라드', '보컬'],
};

export const DEMO_SESSION_ID = 'demo-session-preview';
export const DEMO_SESSION_POST: SessionRecruitPost = {
  id: DEMO_SESSION_ID,
  title: '합주 모집', genre: '자유',
  hostName: '테스트용', hostEmail: 'demo@songbap.local',
  summary: '다 같이 멋진 곡을 만들어봐요!',
  location: '부천', region: 'gyeonggi', meetingType: '온라인', status: 'open',
  wantedRoles: ['producer'], tags: [], currentMembers: 1, maxMembers: 4,
  schedule: '협의', createdAt: Date.now() - 86_400_000, updatedAt: Date.now() - 3_600_000,
  urgent: false,
  applicants: [],
  collabProjectId: null,
};
