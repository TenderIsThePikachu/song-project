import { 
  collection, getDocs, doc, setDoc, deleteDoc, addDoc, updateDoc, increment, arrayUnion, arrayRemove, getDoc, query, orderBy, limit, where
} from 'firebase/firestore';
import { db, storage } from '../firebase'; // ★ 주의: 실제 firebase.ts 경로에 맞게 수정하세요!
import { ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import type { SongProject } from '../store/songStore';
import { isLocalDevelopmentHost } from './localEnvironment';
import { fetchServerJson } from './serverApi';
// ============================================================================
// 1. 타입 정의
// ============================================================================
export type ComposerLibrarySnapshot = {
  projects: any[];
  favoriteTrackIdsByUser: Record<string, string[]>;
};

export type MusicShareSnapshot = {
  tracks: Array<{
    id: string;
    title: string;
    progression: string;
    reference: string;
    category: string;
    tags: string[];
    palette: string;
    createdAt: number;
    creatorName: string;
    creatorEmail?: string;
    imageUrl?: string;
    youtubeUrl?: string;
    likeCount?: number;
    viewCount?: number;
    downloadCount?: number;
    project?: SongProject;
  }>;
  likedTrackIdsByUser: Record<string, string[]>;
  recentOpenedTrackIdsByUser: Record<string, string[]>;
  trackMetricsById: Record<string, { likeCount: number; viewCount: number; downloadCount: number }>;
  comments: any[];
};

export type ComposerMagicSnapshot = ComposerLibrarySnapshot & {
  composer: ComposerLibrarySnapshot;
  share: MusicShareSnapshot;
};

// ============================================================================
// 🔥 2. 파이어베이스 2차원 배열 에러 방지용 "마법의 번역기"
// ============================================================================

// 저장할 때: 2차원 배열을 만나면 몰래 문자열(JSON)로 변환해서 포장합니다.
function sanitizeForFirestore(data: any): any {
  if (Array.isArray(data)) {
    if (data.some(Array.isArray)) {
      return { _isSerializedArray: true, data: JSON.stringify(data) };
    }
    return data.map(sanitizeForFirestore);
  } else if (data !== null && typeof data === 'object') {
    const res: any = {};
    for (const key of Object.keys(data)) {
      res[key] = sanitizeForFirestore(data[key]);
    }
    return res;
  }
  return data;
}

// 꺼낼 때: 포장된 문자열을 발견하면 원래의 2차원 배열로 완벽하게 복구합니다.
function restoreFromFirestore(data: any): any {
  // ★ 수정됨: 배열(Array)인지 가장 먼저 확인해야 합니다!
  if (Array.isArray(data)) {
    return data.map(restoreFromFirestore);
  } 
  // 그 다음 일반 객체(Object)인지 확인합니다.
  else if (data !== null && typeof data === 'object') {
    if (data._isSerializedArray) {
      try {
        return JSON.parse(data.data);
      } catch (e) {
        return [];
      }
    }
    const res: any = {};
    for (const key of Object.keys(data)) {
      res[key] = restoreFromFirestore(data[key]);
    }
    return res;
  }
  return data;
}

// ============================================================================
// 🔥 3. 메타 데이터 도우미 함수
// ============================================================================
async function fetchLibraryUserMetas() {
  const metaSnap = await getDocs(collection(db, 'library_user_meta'));
  const favoriteTrackIdsByUser: Record<string, string[]> = {};
  const likedTrackIdsByUser: Record<string, string[]> = {};
  const recentOpenedTrackIdsByUser: Record<string, string[]> = {};

  metaSnap.forEach(docSnap => {
    const email = docSnap.id;
    const data = docSnap.data();
    if (data.favoriteTrackIds) favoriteTrackIdsByUser[email] = data.favoriteTrackIds;
    if (data.likedTrackIds) likedTrackIdsByUser[email] = data.likedTrackIds;
    if (data.recentOpenedTrackIds) recentOpenedTrackIdsByUser[email] = data.recentOpenedTrackIds;
  });

  return { favoriteTrackIdsByUser, likedTrackIdsByUser, recentOpenedTrackIdsByUser };
}

// ============================================================================
// 🔥 4. 작곡 라이브러리 (내 프로젝트) API
// ============================================================================
export async function fetchComposerLibraryBootstrap(): Promise<ComposerLibrarySnapshot> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<ComposerLibrarySnapshot>('/api/composer-library');
  }

  const q = query(collection(db, 'composer_projects'), limit(20)); // createdAt 필드가 있다면 orderBy도 추가하세요
  const projectsSnap = await getDocs(q);  
  // 꺼낼 때 번역기를 거쳐서 원래 배열로 복구!
  const projects = projectsSnap.docs.map(doc => restoreFromFirestore({ id: doc.id, ...doc.data() }));
  const metas = await fetchLibraryUserMetas();

  return { projects, favoriteTrackIdsByUser: metas.favoriteTrackIdsByUser };
}

async function getComposerMagicSnapshot(): Promise<ComposerMagicSnapshot> {
  const composer = await fetchComposerLibraryBootstrap();
  const share = await fetchMusicShareBootstrap();
  return { ...composer, composer, share };
}

export async function saveComposerProjectOnServer(payload: Record<string, any>): Promise<{ projectId: string; snapshot: ComposerMagicSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ projectId: string; snapshot: ComposerMagicSnapshot }>(
      '/api/composer-library/projects/save',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  const projectId = (payload.id as string) || doc(collection(db, 'composer_projects')).id;
  const projectRef = doc(db, 'composer_projects', projectId);
  const existingProject = await getDoc(projectRef);
  
  // 저장할 때 번역기를 거쳐서 2차원 배열 에러를 방지!
  const safePayload = sanitizeForFirestore(payload);
  
  await setDoc(projectRef, {
    ...safePayload,
    id: projectId,
    createdAt: existingProject.exists()
      ? existingProject.data().createdAt ?? Date.now()
      : Date.now(),
    updatedAt: Date.now()
  }, { merge: true });

  return { projectId, snapshot: await getComposerMagicSnapshot() };
}

export async function deleteComposerProjectOnServer(payload: { projectId: string; userEmail: string }): Promise<{ snapshot: ComposerMagicSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: ComposerMagicSnapshot }>(
      `/api/composer-library/projects/${encodeURIComponent(payload.projectId)}/delete`,
      { method: 'POST', body: JSON.stringify({ userEmail: payload.userEmail }) }
    );
  }

  await deleteDoc(doc(db, 'composer_projects', payload.projectId));
  return { snapshot: await getComposerMagicSnapshot() };
}

export async function toggleFavoriteTrackOnServer(payload: { trackId: string; userEmail: string }): Promise<{ snapshot: ComposerMagicSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: ComposerMagicSnapshot }>(
      '/api/composer-library/favorites/toggle',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  const userMetaRef = doc(db, 'library_user_meta', payload.userEmail);
  const userMetaSnap = await getDoc(userMetaRef);
  let isFavorite = false;
  
  if (userMetaSnap.exists()) {
    isFavorite = userMetaSnap.data().favoriteTrackIds?.includes(payload.trackId);
  }

  if (isFavorite) {
    await setDoc(userMetaRef, { favoriteTrackIds: arrayRemove(payload.trackId) }, { merge: true });
  } else {
    await setDoc(userMetaRef, { favoriteTrackIds: arrayUnion(payload.trackId) }, { merge: true });
  }

  return { snapshot: await getComposerMagicSnapshot() };
}

export async function shareComposerProjectOnServer(payload: Record<string, any>): Promise<{ projectId: string; snapshot: ComposerMagicSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ projectId: string; snapshot: ComposerMagicSnapshot }>(
      '/api/composer-library/projects/share',
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  const trackId = (payload.id as string) || doc(collection(db, 'music_share_tracks')).id;
  const trackRef = doc(db, 'music_share_tracks', trackId);

  // 공유할 때도 번역기를 거쳐서 에러 방지!
  const safePayload = sanitizeForFirestore(payload);

  await setDoc(trackRef, {
    ...safePayload,
    id: trackId,
    likeCount: 0,
    viewCount: 0,
    downloadCount: 0,
    createdAt: Date.now()
  }, { merge: true });

  return { projectId: trackId, snapshot: await getComposerMagicSnapshot() };
}

// ============================================================================
// 🔥 5. 음악 공유 (뮤직 쉐어) API
// ============================================================================
export async function fetchMusicShareBootstrap(): Promise<MusicShareSnapshot> {
  const tracksSnap = await getDocs(query(collection(db, 'music_share_tracks'), orderBy('createdAt', 'desc')));
  const commentsSnap = await getDocs(query(collection(db, 'music_share_comments'), orderBy('createdAt', 'asc')));
  
  // 꺼낼 때 번역기를 거쳐서 복구!
  const tracks = tracksSnap.docs.map(doc => restoreFromFirestore({ id: doc.id, ...doc.data() }) as any);
  const comments = commentsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  const metas = await fetchLibraryUserMetas();

  const trackMetricsById: Record<string, { likeCount: number; viewCount: number; downloadCount: number }> = {};
  tracks.forEach((track: any) => {
    trackMetricsById[track.id] = {
      likeCount: track.likeCount || 0,
      viewCount: track.viewCount || 0,
      downloadCount: track.downloadCount || 0,
    };
  });

  return { tracks, comments, likedTrackIdsByUser: metas.likedTrackIdsByUser, recentOpenedTrackIdsByUser: metas.recentOpenedTrackIdsByUser, trackMetricsById };
}

export async function toggleTrackLikeOnServer(payload: { trackId: string; userEmail: string }): Promise<{ liked: boolean; snapshot: MusicShareSnapshot }> {
  const userMetaRef = doc(db, 'library_user_meta', payload.userEmail);
  const userMetaSnap = await getDoc(userMetaRef);
  let isLiked = false;
  
  if (userMetaSnap.exists()) {
    isLiked = userMetaSnap.data().likedTrackIds?.includes(payload.trackId);
  }

  let nextLiked = false;
  if (isLiked) {
    await setDoc(userMetaRef, { likedTrackIds: arrayRemove(payload.trackId) }, { merge: true });
    await updateDoc(doc(db, 'music_share_tracks', payload.trackId), { likeCount: increment(-1) });
    nextLiked = false;
  } else {
    await setDoc(userMetaRef, { likedTrackIds: arrayUnion(payload.trackId) }, { merge: true });
    await updateDoc(doc(db, 'music_share_tracks', payload.trackId), { likeCount: increment(1) });
    nextLiked = true;
  }

  return { liked: nextLiked, snapshot: await fetchMusicShareBootstrap() };
}

export async function addTrackCommentOnServer(payload: { trackId: string; authorName: string; authorEmail: string; content: string; }): Promise<{ snapshot: MusicShareSnapshot }> {
  await addDoc(collection(db, 'music_share_comments'), { ...payload, createdAt: Date.now() });
  return { snapshot: await fetchMusicShareBootstrap() };
}

export async function recordTrackViewOnServer(payload: { trackId: string; userEmail?: string }): Promise<{ snapshot: MusicShareSnapshot }> {
  await updateDoc(doc(db, 'music_share_tracks', payload.trackId), { viewCount: increment(1) });
  return { snapshot: await fetchMusicShareBootstrap() };
}

export async function recordTrackDownloadOnServer(payload: { trackId: string; userEmail?: string }): Promise<{ snapshot: MusicShareSnapshot }> {
  await updateDoc(doc(db, 'music_share_tracks', payload.trackId), { downloadCount: increment(1) });
  return { snapshot: await fetchMusicShareBootstrap() };
}

export async function recordTrackOpenOnServer(payload: { trackId: string; userEmail: string }): Promise<{ snapshot: MusicShareSnapshot }> {
  const userMetaRef = doc(db, 'library_user_meta', payload.userEmail);
  const userMetaSnap = await getDoc(userMetaRef);
  
  let recents = userMetaSnap.exists() ? (userMetaSnap.data().recentOpenedTrackIds || []) : [];
  recents = [payload.trackId, ...recents.filter((id: string) => id !== payload.trackId)].slice(0, 10);
  
  await setDoc(userMetaRef, { recentOpenedTrackIds: recents }, { merge: true });
  return { snapshot: await fetchMusicShareBootstrap() };
}

export async function uploadMusicShareCoverOnServer(payload: { file: File; creatorEmail?: string; }): Promise<{ imageUrl: string; imageStorageKey: string; imageFileName: string; }> {
  // 1. 파이어베이스 스토리지에 저장될 고유한 이름(경로) 만들기
  const storageKey = `share_covers/${Date.now()}_${payload.file.name}`;
  
  // 2. 파이어베이스 스토리지 참조 위치 만들고 파일 업로드하기
  const imageRef = ref(storage, storageKey);
  await uploadBytes(imageRef, payload.file);
  
  // 3. 업로드된 이미지의 진짜 웹 다운로드 URL 가져오기
  const imageUrl = await getDownloadURL(imageRef);
  
  console.log("커버 이미지 실제 업로드 완료:", imageUrl);
  
  return {
    imageUrl: imageUrl,
    imageStorageKey: storageKey,
    imageFileName: payload.file.name
  };
}

export async function deleteTrackOnServer(payload: { trackId: string }) {
  
  await deleteDoc(doc(db, 'music_share_tracks', payload.trackId));

  const commentsQuery = query(collection(db, 'music_share_comments'), where('trackId', '==', payload.trackId));
  const commentsSnap = await getDocs(commentsQuery);
  commentsSnap.forEach((commentDoc) => { deleteDoc(commentDoc.ref); });

  return { snapshot: await fetchMusicShareBootstrap() };
}

export type UpdateMusicShareTrackPayload = {
  trackId: string;
  creatorEmail: string;
  title: string;
  reference: string;
  progression: string;
  category: string;
  tags: string[];
  youtubeUrl?: string;
};

export async function updateMusicShareTrackOnServer(
  payload: UpdateMusicShareTrackPayload
): Promise<{ snapshot: MusicShareSnapshot }> {
  if (isLocalDevelopmentHost()) {
    return fetchServerJson<{ snapshot: MusicShareSnapshot }>(
      `/api/music-share/tracks/${encodeURIComponent(payload.trackId)}/update`,
      { method: 'POST', body: JSON.stringify(payload) }
    );
  }

  const trackRef = doc(db, 'music_share_tracks', payload.trackId);
  const trackSnapshot = await getDoc(trackRef);
  if (!trackSnapshot.exists()) throw new Error('수정할 공유곡을 찾을 수 없습니다.');

  const ownerEmail = String(trackSnapshot.data().creatorEmail ?? '').trim().toLowerCase();
  if (!ownerEmail || ownerEmail !== payload.creatorEmail.trim().toLowerCase()) {
    throw new Error('본인이 올린 공유곡만 수정할 수 있습니다.');
  }

  await updateDoc(trackRef, {
    title: payload.title.trim(),
    reference: payload.reference.trim(),
    progression: payload.progression.trim(),
    category: payload.category,
    tags: payload.tags,
    youtubeUrl: payload.youtubeUrl?.trim() || '',
    updatedAt: Date.now(),
  });

  return { snapshot: await fetchMusicShareBootstrap() };
}
