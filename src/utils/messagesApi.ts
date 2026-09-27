import { collection, doc, setDoc, deleteDoc, getDocs, query, where, updateDoc, arrayUnion, onSnapshot, writeBatch } from 'firebase/firestore';
import { db } from '../firebase'; // ★ 주의: 실제 firebase.ts 경로에 맞게 수정하세요!
import type { FriendProfile } from '../store/friendStore';
import type { DirectMessage, MessageMember, MessageThread } from '../store/messageStore';

export type MessageSnapshot = {
  friends: FriendProfile[];
  threads: MessageThread[];
  messagesByThread: Record<string, DirectMessage[]>;
};

// ============================================================================
// 🔥 파이어베이스 실시간 채팅 & 친구 API
// ============================================================================

export async function fetchMessagesBootstrap(payload: { ownerEmail: string; ownerName: string }): Promise<MessageSnapshot> {
  const snap: MessageSnapshot = { friends: [], threads: [], messagesByThread: {} };
  
  // 1. 친구 목록 가져오기
  const friendsSnap = await getDocs(query(collection(db, 'messages_friends'), where('ownerEmail', '==', payload.ownerEmail)));
  snap.friends = friendsSnap.docs.map(d => ({ name: d.data().friendName, email: d.data().friendEmail }));
  
  // 2. 내가 속한 채팅방 가져오기
  const threadsSnap = await getDocs(query(collection(db, 'messages_threads'), where('memberEmails', 'array-contains', payload.ownerEmail)));
  snap.threads = threadsSnap.docs.map(d => ({ id: d.id, ...d.data() } as MessageThread));
  
  // 3. 채팅방별 메시지 가져오기
  for (const t of snap.threads) {
    const msgsSnap = await getDocs(query(collection(db, 'messages_items'), where('threadId', '==', t.id)));
    snap.messagesByThread[t.id] = msgsSnap.docs.map(d => ({ id: d.id, ...d.data() } as DirectMessage))
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  return snap;
}

export async function addFriendOnServer(payload: { ownerEmail: string; ownerName: string; friendName: string; friendEmail: string; }) {
  const docId = `${payload.ownerEmail}_${payload.friendEmail}`;
  await setDoc(doc(db, 'messages_friends', docId), {
    ownerEmail: payload.ownerEmail,
    friendName: payload.friendName,
    friendEmail: payload.friendEmail
  });
  return { snapshot: await fetchMessagesBootstrap(payload) };
}

export async function removeFriendOnServer(payload: { ownerEmail: string; ownerName: string; friendEmail: string; }) {
  const docId = `${payload.ownerEmail}_${payload.friendEmail}`;
  await deleteDoc(doc(db, 'messages_friends', docId));
  return { snapshot: await fetchMessagesBootstrap(payload) };
}

export async function createDirectThreadOnServer(payload: { ownerEmail: string; ownerName: string; participantName: string; participantEmail: string; openingMessage?: string; }) {
  const threadsSnap = await getDocs(query(collection(db, 'messages_threads'), where('memberEmails', 'array-contains', payload.ownerEmail)));
  const existingThread = threadsSnap.docs.find(d => d.data().type === 'direct' && d.data().memberEmails.includes(payload.participantEmail));
  
  let threadId = existingThread?.id;

  if (!threadId) {
    const newRef = doc(collection(db, 'messages_threads'));
    threadId = newRef.id;
    await setDoc(newRef, {
      ownerEmail: payload.ownerEmail,
      type: 'direct',
      title: `${payload.participantName}님과의 대화`,
      participantName: payload.participantName,
      participantEmail: payload.participantEmail,
      memberEmails: [payload.ownerEmail, payload.participantEmail],
      members: [
        { email: payload.ownerEmail, name: payload.ownerName },
        { email: payload.participantEmail, name: payload.participantName }
      ],
      lastMessageAt: Date.now(),
      lastPreview: payload.openingMessage || '채팅방이 생성되었습니다.',
      readBy: [payload.ownerEmail]
    });
  }

  if (payload.openingMessage) {
    await sendThreadMessageOnServer({ ownerEmail: payload.ownerEmail, threadId, authorName: payload.ownerName, content: payload.openingMessage });
  }
  return { threadId, snapshot: await fetchMessagesBootstrap({ ownerEmail: payload.ownerEmail, ownerName: payload.ownerName }) };
}

export async function createGroupThreadOnServer(payload: { ownerEmail: string; ownerName: string; title: string; members: MessageMember[]; openingMessage?: string; }) {
  const newRef = doc(collection(db, 'messages_threads'));
  const threadId = newRef.id;
  const memberEmails = payload.members.map(m => m.email);
  if (!memberEmails.includes(payload.ownerEmail)) {
    memberEmails.push(payload.ownerEmail);
    payload.members.push({ email: payload.ownerEmail, name: payload.ownerName });
  }

  await setDoc(newRef, {
    ownerEmail: payload.ownerEmail,
    type: 'group',
    title: payload.title,
    memberEmails,
    members: payload.members,
    lastMessageAt: Date.now(),
    lastPreview: payload.openingMessage || '그룹 채팅방이 생성되었습니다.',
    readBy: [payload.ownerEmail]
  });

  if (payload.openingMessage) {
    await sendThreadMessageOnServer({ ownerEmail: payload.ownerEmail, threadId, authorName: payload.ownerName, content: payload.openingMessage });
  }
  return { threadId, snapshot: await fetchMessagesBootstrap({ ownerEmail: payload.ownerEmail, ownerName: payload.ownerName }) };
}

export async function sendThreadMessageOnServer(payload: { ownerEmail: string; threadId: string; authorName: string; content: string; }) {
  const msgRef = doc(collection(db, 'messages_items'));
  const threadRef = doc(db, 'messages_threads', payload.threadId);
  const createdAt = Date.now();
  const message: DirectMessage = {
    id: msgRef.id,
    threadId: payload.threadId,
    authorEmail: payload.ownerEmail,
    authorName: payload.authorName,
    content: payload.content,
    createdAt,
    isRead: false
  };
  const batch = writeBatch(db);

  batch.set(msgRef, {
    threadId: message.threadId,
    authorEmail: message.authorEmail,
    authorName: message.authorName,
    content: message.content,
    createdAt: message.createdAt,
    isRead: message.isRead
  });

  batch.update(threadRef, {
    lastMessageAt: createdAt,
    lastPreview: payload.content,
    readBy: [payload.ownerEmail] // 새 메시지가 오면 읽음 처리 초기화
  });

  await batch.commit();

  return {
    message,
    threadPatch: {
      id: payload.threadId,
      lastMessageAt: createdAt,
      lastPreview: payload.content,
      readBy: [payload.ownerEmail],
    },
  };
}

export async function markThreadReadOnServer(payload: { threadId: string; readerEmail: string }) {
  await updateDoc(doc(db, 'messages_threads', payload.threadId), {
    readBy: arrayUnion(payload.readerEmail)
  });
  return { snapshot: await fetchMessagesBootstrap({ ownerEmail: payload.readerEmail, ownerName: '' }) };
}

// 🔥 핵심: 예전 SSE(EventSource)를 대체하는 파이어베이스 실시간 리스너
let unsubscribers: (() => void)[] = [];
export function subscribeToMessagesRealtime(ownerEmail: string, onUpdate: (snapshot: MessageSnapshot) => void) {
  // 기존 리스너 청소
  unsubscribers.forEach(unsub => unsub());
  unsubscribers = [];

  const state: MessageSnapshot = { friends: [], threads: [], messagesByThread: {} };
  let messageUnsubscribers: (() => void)[] = [];

  // 친구 목록 실시간 구독
  const unsubFriends = onSnapshot(query(collection(db, 'messages_friends'), where('ownerEmail', '==', ownerEmail)), (snap) => {
    state.friends = snap.docs.map(d => ({ name: d.data().friendName, email: d.data().friendEmail }));
    onUpdate({ ...state });
  });
  unsubscribers.push(unsubFriends);

  // 채팅방 및 메시지 실시간 구독
  const unsubThreads = onSnapshot(query(collection(db, 'messages_threads'), where('memberEmails', 'array-contains', ownerEmail)), (snap) => {
    const threads = snap.docs.map(d => ({ id: d.id, ...d.data() } as MessageThread));
    state.threads = threads;
    messageUnsubscribers.forEach(unsub => unsub());
    messageUnsubscribers = [];
    state.messagesByThread = Object.fromEntries(
      threads.map((thread) => [thread.id, state.messagesByThread[thread.id] ?? []])
    );
    
    threads.forEach(t => {
       const unsubMsgs = onSnapshot(
         query(
            collection(db, 'messages_items'),
            where('threadId', '==', t.id)
          ),
         (mSnap) => {
           state.messagesByThread[t.id] = mSnap.docs
              .map(d => ({ id: d.id, ...d.data() } as DirectMessage))
              .sort((a, b) => a.createdAt - b.createdAt)
              .slice(-50);
           
           onUpdate({ ...state });
          }
       );
       messageUnsubscribers.push(unsubMsgs);
       unsubscribers.push(unsubMsgs); // (참고) 기존 코드에 맞춰 구독 해제 배열에 추가
    });
    onUpdate({ ...state });
  });
  unsubscribers.push(unsubThreads);

  return () => {
    messageUnsubscribers.forEach(unsub => unsub());
    messageUnsubscribers = [];
    unsubscribers.forEach(unsub => unsub());
    unsubscribers = [];
  };
}
