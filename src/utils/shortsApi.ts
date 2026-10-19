import {
  collection, doc, getDoc, getDocs, setDoc, updateDoc, deleteDoc,
  arrayRemove, arrayUnion, increment, query, limit, orderBy
} from 'firebase/firestore';
import { ref, uploadBytes, getDownloadURL, deleteObject } from 'firebase/storage';
import { isLocalDevelopmentHost } from './localEnvironment';
import { fetchServerJson, uploadServerFile } from './serverApi';
import { auth, db, storage } from '../firebase'; // ★ 주의: 실제 firebase.ts 경로에 맞게 수정하세요!

export type ShortsSnapshot = {
  shorts: any[];
  comments: any[];
};

function removeUndefinedFields(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.filter((item) => item !== undefined).map(removeUndefinedFields);
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, item]) => item !== undefined)
        .map(([key, item]) => [key, removeUndefinedFields(item)])
    );
  }

  return value;
}

async function ensureFirebaseUploadSession() {
  await auth.authStateReady();
  if (auth.currentUser) return;

  const error = new Error('Firebase 로그인이 만료되었습니다. 다시 로그인해 주세요.') as Error & {
    code?: string;
  };
  error.code = 'storage/unauthorized';
  throw error;
}

function getVideoContentType(file: File) {
  if (file.type.startsWith('video/')) return file.type;

  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'mov') return 'video/quicktime';
  if (extension === 'webm') return 'video/webm';
  return 'video/mp4';
}

// ============================================================================
// 🔥 파이어베이스 숏폼(Shorts) API (Firestore & Storage 연동)
// ============================================================================

export async function fetchShortsBootstrap(): Promise<ShortsSnapshot> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<ShortsSnapshot>('/api/shorts/bootstrap');
  }

  // 숏폼 게시글과 댓글을 각각 파이어베이스에서 가져옵니다.
  const shortsQuery = query(collection(db, 'shorts'), orderBy('createdAt', 'desc'), limit(10));
  const shortsSnap = await getDocs(shortsQuery);

  const commentsQuery = query(collection(db, 'shorts_comments'), orderBy('createdAt', 'desc'), limit(30));
  const commentsSnap = await getDocs(commentsQuery);

  // 🌟 👇 에러 해결: 끝에 `as any`를 붙여서 타입스크립트를 안심시켜 줍니다!
  const shorts = shortsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));
  const comments = commentsSnap.docs.map(d => ({ id: d.id, ...d.data() } as any));

  // 최신순 정렬
  shorts.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
  comments.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

  return { shorts, comments };
}

export async function uploadShortVideoOnServer(payload: { creatorEmail: string; file: File; }) {
  if (isLocalDevelopmentHost()) {
    const query = new URLSearchParams({
      fileName: payload.file.name,
      creatorEmail: payload.creatorEmail,
    });
    const result = await uploadServerFile<{
      videoUrl: string;
      videoStorageKey: string;
      storageKey?: string;
    }>(`/api/shorts/upload?${query.toString()}`, payload.file);
    return {
      url: result.videoUrl,
      storageKey: result.storageKey ?? result.videoStorageKey,
    };
  }

  await ensureFirebaseUploadSession();

  // 1. 영상이 저장될 이름 만들기 (중복 방지를 위해 현재 시간 추가)
  const storageKey = `shorts/${Date.now()}_${payload.file.name}`;
  
  // 2. 파이어베이스 스토리지(Storage)에 파일 업로드
  const videoRef = ref(storage, storageKey);
  await uploadBytes(videoRef, payload.file, { contentType: getVideoContentType(payload.file) });

  // 3. 웹에서 볼 수 있는 다운로드 URL 가져오기
  const url = await getDownloadURL(videoRef);

  // 스토어에서 기대하는 형태로 반환
  return { url, storageKey };
}

export async function uploadShortAudioOnServer(payload: { creatorEmail: string; file: File; }) {
  if (isLocalDevelopmentHost()) {
    const query = new URLSearchParams({
      fileName: payload.file.name,
      creatorEmail: payload.creatorEmail,
    });
    const result = await uploadServerFile<{
      audioUrl: string;
      audioStorageKey: string;
      storageKey?: string;
    }>(`/api/shorts/upload-audio?${query.toString()}`, payload.file);
    return {
      url: result.audioUrl,
      storageKey: result.storageKey ?? result.audioStorageKey,
    };
  }

  await ensureFirebaseUploadSession();

  const storageKey = `shorts_audio/${Date.now()}_${payload.file.name}`;
  const audioRef = ref(storage, storageKey);
  await uploadBytes(audioRef, payload.file, { contentType: payload.file.type || 'audio/mpeg' });
  const url = await getDownloadURL(audioRef);

  return { url, storageKey };
}

export async function createShortOnServer(payload: Record<string, any>) {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ shortId: string; snapshot: ShortsSnapshot }>('/api/shorts', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const newRef = doc(collection(db, 'shorts'));
  const shortId = newRef.id;

  const {
    audioUrl,
    audioStorageKey,
    audioFileName,
    audioSizeBytes,
    ...rest
  } = payload;

  const document = removeUndefinedFields({
    ...rest,
    ...(audioUrl ? { audioUrl } : {}),
    ...(audioStorageKey ? { audioStorageKey } : {}),
    ...(audioFileName ? { audioFileName } : {}),
    ...(audioSizeBytes !== undefined ? { audioSizeBytes } : {}),
    id: shortId,
    createdAt: Date.now(),
    likeCount: 0,
    viewCount: 0,
    likedBy: []
  }) as Record<string, unknown>;

  try {
    await setDoc(newRef, document);
  } catch (error) {
    if (payload.videoStorageKey) {
      await deleteObject(ref(storage, payload.videoStorageKey)).catch(() => undefined);
    }
    if (payload.audioStorageKey) {
      await deleteObject(ref(storage, payload.audioStorageKey)).catch(() => undefined);
    }
    throw error;
  }

  return {
    shortId,
    snapshot: await fetchShortsBootstrap()
  };
}

export async function updateShortOnServer(payload: { shortId: string } & Record<string, any>) {
  const { shortId, ...updateData } = payload;

  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: ShortsSnapshot }>(
      `/api/shorts/${encodeURIComponent(shortId)}/update`,
      { method: 'POST', body: JSON.stringify(updateData) }
    );
  }

  const docRef = doc(db, 'shorts', shortId);

  // 기존 글 수정
  await updateDoc(docRef, {
    ...(removeUndefinedFields(updateData) as Record<string, unknown>),
    updatedAt: Date.now()
  });

  return { snapshot: await fetchShortsBootstrap() };
}

export async function deleteShortOnServer(payload: { shortId: string; userEmail: string }) {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: ShortsSnapshot }>(
      `/api/shorts/${encodeURIComponent(payload.shortId)}/delete`,
      { method: 'POST', body: JSON.stringify({ userEmail: payload.userEmail }) }
    );
  }

  const shortRef = doc(db, 'shorts', payload.shortId);
  const shortSnap = await getDoc(shortRef);

  if (shortSnap.exists()) {
    const shortData = shortSnap.data();

    // 1. 파이어베이스 스토리지에서 실제 동영상 파일 먼저 삭제
    if (shortData.videoStorageKey) {
      const videoRef = ref(storage, shortData.videoStorageKey);
      try {
        await deleteObject(videoRef);
        console.log('스토리지에서 동영상 파일 삭제 완료!');
      } catch (error) {
        // 혹시 파일이 이미 없거나 지우는 데 실패하더라도, 앱이 멈추지 않게 처리
        console.error('동영상 파일 삭제 실패:', error);
      }
    }

    if (shortData.audioStorageKey) {
      const audioRef = ref(storage, shortData.audioStorageKey);
      try {
        await deleteObject(audioRef);
      } catch (error) {
        console.error('숏폼 MP3 파일 삭제 실패:', error);
      }
    }
  }

  // 2. 파이어베이스 데이터베이스에서 게시글 데이터 삭제 🗑️
  await deleteDoc(shortRef);

  return { snapshot: await fetchShortsBootstrap() };
}

export async function toggleShortLikeOnServer(payload: { shortId: string; userEmail: string }) {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: ShortsSnapshot }>('/api/shorts/like', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const docRef = doc(db, 'shorts', payload.shortId);
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    const data = docSnap.data();
    const hasLiked = (data.likedBy || []).includes(payload.userEmail);

    // 파이어베이스 자체 기능(arrayRemove/Union, increment)으로 좋아요 카운트 계산
    if (hasLiked) {
      await updateDoc(docRef, {
        likedBy: arrayRemove(payload.userEmail),
        likeCount: increment(-1)
      });
    } else {
      await updateDoc(docRef, {
        likedBy: arrayUnion(payload.userEmail),
        likeCount: increment(1)
      });
    }
  }

  return { snapshot: await fetchShortsBootstrap() };
}

export async function addShortCommentOnServer(payload: { shortId: string; authorName: string; authorEmail: string; content: string; }) {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: ShortsSnapshot }>('/api/shorts/comments', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const newRef = doc(collection(db, 'shorts_comments'));
  
  await setDoc(newRef, {
    ...payload,
    id: newRef.id,
    createdAt: Date.now()
  });

  return { snapshot: await fetchShortsBootstrap() };
}

export async function recordShortViewOnServer(payload: { shortId: string }) {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: ShortsSnapshot }>('/api/shorts/view', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  const docRef = doc(db, 'shorts', payload.shortId);
  
  // 조회수 1 증가시키기
  await updateDoc(docRef, {
    viewCount: increment(1)
  });

  return { snapshot: await fetchShortsBootstrap() };
}
