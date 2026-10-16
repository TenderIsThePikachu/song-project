import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type AppNotificationKind = 'community' | 'shorts' | 'music' | 'collab';
export type AppNotificationFilter = 'all' | 'unread' | AppNotificationKind;

export type AppNotification = {
  id: string;
  kind: AppNotificationKind;
  title: string;
  body: string;
  route: string;
  createdAt: number;
  isRead: boolean;
  actorName?: string;
};

type NotificationStoreState = {
  notifications: AppNotification[];
  pushNotification: (
    payload: Omit<AppNotification, 'id' | 'createdAt' | 'isRead'>
  ) => void;
  markRead: (id: string) => void;
  markAllRead: () => void;
};

function createId(prefix: string) {
  const randomId = globalThis.crypto?.randomUUID?.();
  return randomId
    ? `${prefix}-${randomId}`
    : `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

const INITIAL_NOTIFICATIONS: AppNotification[] = [
  {
    id: 'notification-community-1',
    kind: 'community',
    title: '커뮤니티 새 반응',
    body: '코드 진행 질문 글에 새 댓글이 달렸습니다.',
    route: '/community/1',
    createdAt: new Date('2026-03-22T09:10:00+09:00').getTime(),
    isRead: false,
    actorName: 'groovepark',
  },
  {
    id: 'notification-shorts-1',
    kind: 'shorts',
    title: '숏폼 좋아요',
    body: '업로드한 숏폼에 좋아요가 늘고 있습니다.',
    route: '/community/shorts',
    createdAt: new Date('2026-03-22T08:35:00+09:00').getTime(),
    isRead: false,
    actorName: 'loopmaker',
  },
  {
    id: 'notification-music-1',
    kind: 'music',
    title: '공유곡 다운로드',
    body: '공유한 곡이 새로 다운로드되었습니다.',
    route: '/community/music',
    createdAt: new Date('2026-03-22T07:50:00+09:00').getTime(),
    isRead: false,
    actorName: 'chordnote',
  },
  {
    id: 'notification-collab-1',
    kind: 'collab',
    title: '협업 모집 알림',
    body: '모집글 지원과 승인 상태를 여기서 확인할 수 있습니다.',
    route: '/collab',
    createdAt: new Date('2026-03-22T07:20:00+09:00').getTime(),
    isRead: false,
    actorName: 'songmaker',
  },
];

export const useNotificationStore = create<NotificationStoreState>()(
  persist(
    (set) => ({
      notifications: INITIAL_NOTIFICATIONS,
      pushNotification: (payload) => {
        set((state) => ({
          notifications: [
            {
              id: createId('notification'),
              createdAt: Date.now(),
              isRead: false,
              ...payload,
            },
            ...state.notifications,
          ].slice(0, 40),
        }));
      },
      markRead: (id) => {
        set((state) => ({
          notifications: state.notifications.map((notification) =>
            notification.id === id ? { ...notification, isRead: true } : notification
          ),
        }));
      },
      markAllRead: () => {
        set((state) => ({
          notifications: state.notifications.map((notification) => ({
            ...notification,
            isRead: true,
          })),
        }));
      },
    }),
    {
      name: 'song-maker-notifications',
    }
  )
);
