import { create } from 'zustand';
import { useFriendStore } from './friendStore';
import {
  addFriendOnServer,
  createDirectThreadOnServer,
  createGroupThreadOnServer,
  fetchMessagesBootstrap,
  markThreadReadOnServer,
  removeFriendOnServer,
  sendThreadMessageOnServer,
  subscribeToMessagesRealtime, 
  type MessageSnapshot,
} from '../utils/messagesApi'; 

export type MessageMember = { name: string; email: string; };
export type MessageThreadType = 'direct' | 'group';

export type MessageThread = {
  id: string; ownerEmail: string; type: MessageThreadType; title: string;
  participantName?: string; participantEmail?: string; members: MessageMember[];
  lastMessageAt: number; lastPreview: string; readBy?: string[];
};

export type DirectMessage = {
  id: string; threadId: string; authorName: string; authorEmail: string;
  content: string; createdAt: number; isRead: boolean;
};

type MessageStoreState = {
  threads: MessageThread[];
  messagesByThread: Record<string, DirectMessage[]>;
  inboxStatus: 'idle' | 'loading' | 'ready' | 'error';
  inboxError: string | null;
  seedInbox: (payload: { ownerEmail: string; ownerName: string }) => Promise<void>;
  addFriend: (payload: { ownerEmail: string; ownerName: string; friendName: string; friendEmail: string; }) => Promise<void>;
  removeFriend: (payload: { ownerEmail: string; ownerName: string; friendEmail: string; }) => Promise<void>;
  createDirectThread: (payload: { ownerEmail: string; ownerName: string; participantName: string; participantEmail: string; openingMessage?: string; }) => Promise<string>;
  createGroupThread: (payload: { ownerEmail: string; ownerName: string; title: string; members: MessageMember[]; openingMessage?: string; }) => Promise<string>;
  sendMessage: (payload: { threadId: string; authorName: string; authorEmail: string; content: string; }) => Promise<void>;
  markThreadRead: (payload: { threadId: string; readerEmail: string; }) => Promise<void>;
};

let messagesUnsubscribe: (() => void) | null = null; // ★ 파이어베이스 구독 해제용 변수

function applySnapshot(ownerEmail: string, snapshot: MessageSnapshot) {
  useFriendStore.getState().replaceFriends(ownerEmail, snapshot.friends ?? []);
  useMessageStore.setState((state) => ({
    ...state,
    threads: snapshot.threads ?? [],
    messagesByThread: snapshot.messagesByThread ?? {},
    inboxStatus: 'ready',
    inboxError: null,
  }));
}

export const useMessageStore = create<MessageStoreState>((set) => ({
  threads: [],
  messagesByThread: {},
  inboxStatus: 'idle',
  inboxError: null,

  seedInbox: async (payload) => {
    set({ inboxStatus: 'loading', inboxError: null });
    try {
      // 1. 초기 데이터 1회 불러오기
      const snapshot = await fetchMessagesBootstrap(payload);
      applySnapshot(payload.ownerEmail, snapshot);

      // 2. 파이어베이스 실시간 리스너 켜기 (카톡처럼 실시간 동기화)
      if (messagesUnsubscribe) messagesUnsubscribe();
      messagesUnsubscribe = subscribeToMessagesRealtime(payload.ownerEmail, (newSnapshot) => {
        applySnapshot(payload.ownerEmail, newSnapshot);
      });
    } catch {
      set({ inboxStatus: 'error', inboxError: '메시지 데이터를 불러오지 못했습니다.' });
    }
  },

  addFriend: async (payload) => {
    const response = await addFriendOnServer(payload);
    applySnapshot(payload.ownerEmail, response.snapshot);
  },
  
  removeFriend: async (payload) => {
    const response = await removeFriendOnServer(payload);
    applySnapshot(payload.ownerEmail, response.snapshot);
  },

  createDirectThread: async (payload) => {
    const response = await createDirectThreadOnServer(payload);
    applySnapshot(payload.ownerEmail, response.snapshot);
    return response.threadId;
  },

  createGroupThread: async (payload) => {
    const response = await createGroupThreadOnServer(payload);
    applySnapshot(payload.ownerEmail, response.snapshot);
    return response.threadId;
  },

  sendMessage: async (payload) => {
    const createdAt = Date.now();
    const tempMessage: DirectMessage = {
      id: `local-${payload.threadId}-${createdAt}`,
      threadId: payload.threadId,
      authorName: payload.authorName,
      authorEmail: payload.authorEmail,
      content: payload.content,
      createdAt,
      isRead: false,
    };

    set((state) => ({
      messagesByThread: {
        ...state.messagesByThread,
        [payload.threadId]: [
          ...(state.messagesByThread[payload.threadId] ?? []),
          tempMessage,
        ],
      },
      threads: state.threads.map((thread) =>
        thread.id === payload.threadId
          ? {
              ...thread,
              lastMessageAt: createdAt,
              lastPreview: payload.content,
              readBy: [payload.authorEmail],
            }
          : thread
      ),
    }));

    try {
      const response = await sendThreadMessageOnServer({
        ownerEmail: payload.authorEmail,
        threadId: payload.threadId,
        authorName: payload.authorName,
        content: payload.content
      });

      set((state) => ({
        messagesByThread: {
          ...state.messagesByThread,
          [payload.threadId]: (state.messagesByThread[payload.threadId] ?? [])
            .map((message) => (message.id === tempMessage.id ? response.message : message))
            .sort((left, right) => left.createdAt - right.createdAt),
        },
        threads: state.threads.map((thread) =>
          thread.id === payload.threadId
            ? {
                ...thread,
                lastMessageAt: response.threadPatch.lastMessageAt,
                lastPreview: response.threadPatch.lastPreview,
                readBy: response.threadPatch.readBy,
              }
            : thread
        ),
      }));
    } catch (error) {
      set((state) => ({
        messagesByThread: {
          ...state.messagesByThread,
          [payload.threadId]: (state.messagesByThread[payload.threadId] ?? []).filter(
            (message) => message.id !== tempMessage.id
          ),
        },
      }));
      throw error;
    }
  },

  markThreadRead: async (payload) => {
    const response = await markThreadReadOnServer(payload);
    applySnapshot(payload.readerEmail, response.snapshot);
  }
}));
