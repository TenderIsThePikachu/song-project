import { type ChangeEvent, useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { BASE_SHARED_TRACK_LIBRARY, buildSharedTrackCard } from '../dummy/musicShareLibrary';
import { LESSON_LIBRARY } from '../dummy/learnData';
import { useAuthStore } from '../store/authStore';
import { useCommunityStore } from '../store/communityStore';
import { useCollabStore } from '../store/collabStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import { useLearnProgressStore } from '../store/learnProgressStore';
import { useMusicShareStore } from '../store/musicShareStore';
import { useNotificationStore } from '../store/notificationStore';
import { useSongStore } from '../store/songStore';
import { fetchUserProfile, updateUserAvatarOnServer } from '../utils/profileApi';
import './ProfilePage.css';

type ProfileTab = 'music' | 'community' | 'activity';
type ProjectSort = 'latest' | 'oldest' | 'title';
type ProfileIconName = 'calendar' | 'chevron' | 'clock' | 'collab' | 'edit' | 'mail' | 'message' | 'more' | 'music' | 'pin' | 'plus' | 'posts' | 'search' | 'sort' | 'users';

const MAX_AVATAR_FILE_SIZE = 2 * 1024 * 1024;
const ACCEPTED_AVATAR_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const PROFILE_TABS: Array<{ key: ProfileTab; label: string }> = [
  { key: 'music', label: '음악' },
  { key: 'community', label: '커뮤니티 글' },
  { key: 'activity', label: '활동' },
];

const OVERVIEW_ITEMS = [
  { key: 'shared', label: '공유한 곡', description: '음악공유에 올린 내 프로젝트', icon: 'music', tone: 'mint' },
  { key: 'collab', label: '협업 프로젝트', description: '함께 작업 중인 프로젝트', icon: 'collab', tone: 'violet' },
  { key: 'alerts', label: '안읽은 알림', description: '커뮤니티, 공유곡 반응', icon: 'users', tone: 'green' },
  { key: 'recent', label: '최근 본 공유곡', description: '다시 열어본 음악공유 기록', icon: 'clock', tone: 'blue' },
] as const;

function ProfileIcon({ name }: { name: ProfileIconName }) {
  const paths: Record<ProfileIconName, React.ReactNode> = {
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></>,
    collab: <><rect x="3" y="6" width="18" height="14" rx="2" /><path d="M9 6V4h6v2M3 11h18M10 11v2h4v-2" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
    message: <><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 3v-3.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z" /><path d="M8 10h8M8 13h5" /></>,
    more: <><circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" /><circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" /></>,
    music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    pin: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    plus: <path d="M12 5v14M5 12h14" />,
    posts: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sort: <><path d="M4 7h12M4 12h9M4 17h6" /><path d="m17 14 3 3 3-3M20 17V7" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 6a3 3 0 0 1 0 6M17 14c2.5.5 3.8 2.3 4 5" /></>,
  };

  return <svg className="profile-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR');
}

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ko-KR');
}

function formatProjectDate(timestamp: number) {
  return new Date(timestamp).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
}

function getExcerpt(content: string) {
  const normalized = content.replace(/\s+/g, ' ').trim();
  return normalized.length <= 96 ? normalized : `${normalized.slice(0, 96)}...`;
}

export default function ProfilePage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const clearAvatar = useAuthStore((state) => state.clearAvatar);
  const posts = useCommunityStore((state) => state.posts);
  const likedPostIdsByUser = useCommunityStore((state) => state.likedPostIdsByUser);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const collabProjects = useCollabStore((state) => state.projects);
  const projects = useComposerLibraryStore((state) => state.projects);
  const libraryStatus = useComposerLibraryStore((state) => state.bootstrapStatus);
  const libraryError = useComposerLibraryStore((state) => state.bootstrapError);
  const favoriteTrackIdsByUser = useComposerLibraryStore((state) => state.favoriteTrackIdsByUser);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const favoriteByUser = useLearnProgressStore((state) => state.favoriteByUser);
  const seedLearnProgress = useLearnProgressStore((state) => state.seedLearnProgress);
  const notifications = useNotificationStore((state) => state.notifications);
  const recentOpenedTrackIdsByUser = useMusicShareStore((state) => state.recentOpenedTrackIdsByUser);
  const seedMusicShare = useMusicShareStore((state) => state.seedMusicShare);
  const loadProject = useSongStore((state) => state.loadProject);

  const [activeTab, setActiveTab] = useState<ProfileTab>('music');
  const [avatarError, setAvatarError] = useState('');
  const [avatarUrl, setAvatarUrl] = useState<string | undefined>(user?.avatarUrl);
  const [profileCreatedAt, setProfileCreatedAt] = useState<number | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [projectQuery, setProjectQuery] = useState('');
  const [projectSort, setProjectSort] = useState<ProjectSort>('latest');
  const avatarInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!user?.email) return;
    let cancelled = false;

    const syncProfile = async () => {
      try {
        const response = await fetchUserProfile(user.email);
        if (cancelled) return;
        setAvatarUrl(response.user.avatarUrl);
        setProfileCreatedAt(response.user.createdAt);
        updateProfile({
          email: response.user.email,
          name: response.user.name,
          avatarUrl: response.user.avatarUrl,
        });
      } catch (error) {
        console.error(error);
      }
    };

    void syncProfile();
    return () => {
      cancelled = true;
    };
  }, [updateProfile, user?.email]);

  useEffect(() => {
    void seedCommunity().catch(console.error);
    void seedLibrary().catch(console.error);
    void seedMusicShare().catch(console.error);
  }, [seedCommunity, seedLibrary, seedMusicShare]);

  const profileKey = user?.email ?? 'guest';
  useEffect(() => {
    void seedLearnProgress(profileKey).catch(console.error);
  }, [profileKey, seedLearnProgress]);

  const displayProfileName = user?.name ?? '게스트';
  const displayEmail = user?.email;
  const profileInitial = displayProfileName.slice(0, 1).toUpperCase();

  const myProjects = useMemo(
    () => user
      ? projects
        .filter((project) => project.creatorEmail === user.email)
        .sort((left, right) => right.updatedAt - left.updatedAt)
      : [],
    [projects, user]
  );

  const visibleProjects = useMemo(() => {
    const keyword = projectQuery.trim().toLocaleLowerCase('ko-KR');
    const filtered = keyword
      ? myProjects.filter((project) => project.title.toLocaleLowerCase('ko-KR').includes(keyword))
      : [...myProjects];

    return filtered.sort((left, right) => {
      if (projectSort === 'oldest') return left.updatedAt - right.updatedAt;
      if (projectSort === 'title') return left.title.localeCompare(right.title, 'ko-KR');
      return right.updatedAt - left.updatedAt;
    });
  }, [myProjects, projectQuery, projectSort]);

  const sharedTracks = useMemo(
    () => myProjects
      .map((project) => buildSharedTrackCard(project))
      .filter((track): track is NonNullable<typeof track> => Boolean(track)),
    [myProjects]
  );

  const myPosts = useMemo(() => {
    if (!user) return [];
    return posts.filter((post) => post.authorId === user.email || post.authorId === user.name);
  }, [posts, user]);

  const likedPosts = useMemo(() => {
    if (!user) return [];
    const likedIds = likedPostIdsByUser[user.email] ?? [];
    return posts.filter((post) => likedIds.includes(post.id));
  }, [likedPostIdsByUser, posts, user]);

  const savedTracks = useMemo(() => {
    if (!user) return [];
    const favoriteIds = favoriteTrackIdsByUser[user.email] ?? [];
    const dynamicTracks = projects
      .map((project) => buildSharedTrackCard(project))
      .filter((track): track is NonNullable<typeof track> => Boolean(track));
    return [...dynamicTracks, ...BASE_SHARED_TRACK_LIBRARY].filter((track) => favoriteIds.includes(track.id));
  }, [favoriteTrackIdsByUser, projects, user]);

  const favoriteLessons = favoriteByUser[profileKey] ?? [];
  const favoriteLessonCards = favoriteLessons.map((lessonId) => LESSON_LIBRARY[lessonId]);
  const unreadNotifications = notifications.filter((notification) => !notification.isRead);

  const recentTrackLibrary = useMemo(() => {
    const dynamicTracks = projects
      .map((project) => buildSharedTrackCard(project))
      .filter((track): track is NonNullable<typeof track> => Boolean(track));
    return [...dynamicTracks, ...BASE_SHARED_TRACK_LIBRARY];
  }, [projects]);

  const recentOpenedTracks = useMemo(() => {
    if (!user) return [];
    const ids = recentOpenedTrackIdsByUser[user.email] ?? [];
    return ids
      .map((trackId) => recentTrackLibrary.find((track) => track.id === trackId))
      .filter((track): track is NonNullable<typeof track> => Boolean(track));
  }, [recentOpenedTrackIdsByUser, recentTrackLibrary, user]);

  const joinedCollabProjects = useMemo(() => {
    if (!user) return [];
    return collabProjects.filter((project) => project.members.some((member) => member.email === user.email));
  }, [collabProjects, user]);

  const tabCounts: Record<ProfileTab, number> = {
    music: myProjects.length,
    community: myPosts.length,
    activity: savedTracks.length + likedPosts.length + Math.min(myProjects.length, 4) + favoriteLessonCards.length,
  };

  const overviewCounts = [sharedTracks.length, joinedCollabProjects.length, unreadNotifications.length, recentOpenedTracks.length];

  const handleOpenProject = (project: (typeof myProjects)[number]) => {
    loadProject(project.project);
    navigate(`/composer?project=${encodeURIComponent(project.id)}`);
  };

  const handlePickAvatar = () => avatarInputRef.current?.click();

  const handleAvatarChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file || !user) return;

    if (!ACCEPTED_AVATAR_TYPES.has(file.type)) {
      setAvatarError('JPG, PNG, WEBP 이미지 파일만 업로드할 수 있습니다.');
      return;
    }
    if (file.size > MAX_AVATAR_FILE_SIZE) {
      setAvatarError('프로필 이미지는 2MB 이하 파일만 사용할 수 있습니다.');
      return;
    }

    try {
      setIsUploading(true);
      setAvatarError('');
      const response = await updateUserAvatarOnServer({ email: user.email, file });
      setAvatarUrl(response.user.avatarUrl);
      updateProfile({ email: response.user.email, name: response.user.name, avatarUrl: response.user.avatarUrl });
    } catch (error) {
      console.error(error);
      setAvatarError('프로필 이미지를 불러오지 못했습니다. 다시 시도해 주세요.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleClearAvatar = async () => {
    if (!user) return;
    try {
      setIsUploading(true);
      await updateUserAvatarOnServer({ email: user.email, avatarUrl: null });
      setAvatarUrl(undefined);
      clearAvatar(user.email);
      setAvatarError('');
    } catch (error) {
      console.error(error);
      setAvatarError('프로필 이미지를 초기화하지 못했습니다. 다시 시도해주세요.');
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <div className="profile-page">
      <SiteHeader />
      <main className="profile-shell">
        <section className="profile-hero">
          <div className="profile-summary">
            <div className="profile-avatar-shell">
              <div className="profile-avatar">
                {avatarUrl ? <img src={avatarUrl} alt={`${displayProfileName} 프로필`} className="profile-avatar-image" /> : <span>{profileInitial}</span>}
              </div>
              {user ? (
                <div className="profile-avatar-actions">
                  <input ref={avatarInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="profile-avatar-input" onChange={handleAvatarChange} disabled={isUploading} />
                  <div className="profile-avatar-button-row">
                    <button type="button" className="profile-avatar-button" onClick={handlePickAvatar} disabled={isUploading}>{isUploading ? '업로드 중...' : '이미지 변경'}</button>
                    {avatarUrl ? <button type="button" className="profile-avatar-reset" onClick={handleClearAvatar} disabled={isUploading} aria-label="기본 이미지로 변경">×</button> : null}
                  </div>
                  <span className="profile-avatar-hint">PNG, JPG, WEBP · 최대 2MB</span>
                  {avatarError ? <p className="profile-avatar-error">{avatarError}</p> : null}
                </div>
              ) : null}
            </div>

            <div className="profile-meta">
              <h1>{displayProfileName}</h1>
              {displayEmail ? <span className="profile-email"><ProfileIcon name="mail" />{displayEmail}</span> : null}
              <p>좋은 음악이 더 많은 사람들에게 닿을 수 있도록, 오늘도 하나의 곡을 만들어갑니다.</p>
              <div className="profile-meta-row">
                <span><ProfileIcon name="calendar" />{profileCreatedAt ? `${formatDate(profileCreatedAt)} 가입` : '가입 정보 없음'}</span>
                <span><ProfileIcon name="pin" />작곡하는 중</span>
              </div>
            </div>
          </div>

          <div className="profile-hero-actions">
            <button type="button" className="profile-edit-button" onClick={handlePickAvatar} disabled={!user || isUploading}><ProfileIcon name="edit" /> 프로필 편집</button>
            <button type="button" className="profile-message-button" onClick={() => navigate('/messages')}><ProfileIcon name="message" /> 메시지함</button>
          </div>
        </section>

        <section className="profile-overview-grid" aria-label="프로필 현황">
          {OVERVIEW_ITEMS.map((item, index) => (
            <button key={item.key} type="button" className="profile-overview-card" onClick={() => {
              if (item.key === 'shared' || item.key === 'recent') setActiveTab('music');
              if (item.key === 'collab') navigate('/collab');
              if (item.key === 'alerts') setActiveTab('activity');
            }}>
              <span className={`profile-overview-icon is-${item.tone}`}><ProfileIcon name={item.icon} /></span>
              <span className="profile-overview-copy"><small>{item.label}</small><strong>{formatCount(overviewCounts[index])}</strong><em>{item.description}</em></span>
              <span className="profile-card-chevron"><ProfileIcon name="chevron" /></span>
            </button>
          ))}
        </section>

        <section className="profile-content">
          <header className="profile-content-toolbar">
            <div className="profile-tab-row" role="tablist" aria-label="프로필 탭">
              {PROFILE_TABS.map((tab) => (
                <button key={tab.key} type="button" role="tab" className={`profile-tab-button${activeTab === tab.key ? ' is-active' : ''}`} aria-selected={activeTab === tab.key} onClick={() => setActiveTab(tab.key)}>{tab.label} ({tabCounts[tab.key]})</button>
              ))}
            </div>

            {activeTab === 'music' ? (
              <div className="profile-project-tools">
                <label className="profile-project-search"><ProfileIcon name="search" /><input value={projectQuery} onChange={(event) => setProjectQuery(event.target.value)} placeholder="프로젝트 제목으로 검색하세요..." /></label>
                <label className="profile-sort-select"><ProfileIcon name="sort" /><span className="sr-only">프로젝트 정렬</span><select value={projectSort} onChange={(event) => setProjectSort(event.target.value as ProjectSort)}><option value="latest">최신순</option><option value="oldest">오래된순</option><option value="title">이름순</option></select></label>
                <button type="button" className="profile-new-project" onClick={() => navigate('/composer')}><ProfileIcon name="plus" /> 새 프로젝트 만들기</button>
              </div>
            ) : null}
          </header>

          {activeTab === 'music' ? (
            <div className="profile-project-section">
              <div className="profile-section-heading"><div><h2>내 프로젝트</h2><p>저장한 곡을 다시 열어 이어서 작업할 수 있어요.</p></div></div>
              {libraryStatus === 'loading' && !myProjects.length ? <div className="profile-status-panel">프로젝트를 불러오는 중입니다.</div> : null}
              {libraryStatus === 'error' && !myProjects.length ? <div className="profile-status-panel is-error">{libraryError || '프로젝트를 불러오지 못했습니다.'}</div> : null}

              {libraryStatus !== 'loading' && visibleProjects.length ? (
                <div className="profile-project-layout">
                  <div className="profile-music-grid">
                    {visibleProjects.slice(0, 8).map((project) => (
                      <button key={project.id} type="button" className="profile-track-card" onClick={() => handleOpenProject(project)}>
                        <div className="profile-track-cover" style={project.coverImageUrl ? { backgroundImage: `url(${project.coverImageUrl})` } : undefined}>{!project.coverImageUrl ? <span className="profile-track-note"><ProfileIcon name="music" /></span> : null}<span className="profile-track-more"><ProfileIcon name="more" /></span></div>
                        <div className="profile-track-body"><strong>{project.steps} steps · {project.bpm} BPM</strong><h3>{project.title}</h3><div className="profile-track-tags"><span>{project.genre.toUpperCase()}</span><span>{project.isShared ? '공유됨' : '개인 보관'}</span></div><footer><ProfileIcon name="clock" />{formatProjectDate(project.updatedAt)}</footer></div>
                      </button>
                    ))}
                  </div>
                </div>
              ) : null}

              {libraryStatus !== 'loading' && !visibleProjects.length && libraryStatus !== 'error' ? <div className="profile-empty-state"><span><ProfileIcon name="music" /></span><strong>{projectQuery ? '검색 결과가 없습니다.' : '더 많은 음악을 만들어보세요!'}</strong><p>{projectQuery ? '다른 프로젝트 제목으로 검색해보세요.' : '새 프로젝트를 만들고 당신만의 음악을 저장해보세요.'}</p>{!projectQuery ? <button type="button" onClick={() => navigate('/composer')}><ProfileIcon name="plus" /> 새 프로젝트 만들기</button> : null}</div> : null}
            </div>
          ) : null}

          {activeTab === 'community' ? (
            <div className="profile-post-list">
              {myPosts.length ? myPosts.map((post) => <button key={post.id} type="button" className="profile-post-card" onClick={() => navigate(`/community/${post.id}`)}><span className="profile-post-category">{post.category || '일반'}</span><strong>{post.title}</strong><p>{getExcerpt(post.content)}</p><footer><span>{formatDate(post.createdAt)}</span><span>조회 {formatCount(post.viewCount ?? 0)} · 댓글 {formatCount(post.commentCount ?? 0)} · 좋아요 {formatCount(post.likeCount)}</span></footer></button>) : <div className="profile-empty-state"><span><ProfileIcon name="posts" /></span><strong>작성한 커뮤니티 글이 없습니다.</strong><p>작업 맥락과 고민을 커뮤니티에서 나눠보세요.</p></div>}
            </div>
          ) : null}

          {activeTab === 'activity' ? (
            <div className="profile-activity-layout">
              <section className="profile-activity-card"><h2>최근 작업 프로젝트</h2>{myProjects.length ? myProjects.slice(0, 4).map((project) => <button key={project.id} type="button" onClick={() => handleOpenProject(project)}><span>프로젝트 수정</span><strong>{project.title}</strong><time>{formatProjectDate(project.updatedAt)}</time></button>) : <p>최근 작업 기록이 없습니다.</p>}</section>
              <section className="profile-activity-card"><h2>좋아요한 글</h2>{likedPosts.length ? likedPosts.slice(0, 4).map((post) => <button key={post.id} type="button" onClick={() => navigate(`/community/${post.id}`)}><span>좋아요</span><strong>{post.title}</strong><time>{formatDate(post.createdAt)}</time></button>) : <p>아직 좋아요한 글이 없습니다.</p>}</section>
              <section className="profile-activity-card"><h2>저장한 곡과 가이드</h2>{savedTracks.slice(0, 2).map((track) => <button key={track.id} type="button" onClick={() => navigate('/community/music')}><span>저장한 곡</span><strong>{track.title}</strong></button>)}{favoriteLessonCards.slice(0, 2).map((lesson) => <button key={lesson.id} type="button" onClick={() => navigate('/composer')}><span>즐겨찾기 가이드</span><strong>{lesson.label}</strong></button>)}{!savedTracks.length && !favoriteLessonCards.length ? <p>아직 저장한 활동이 없습니다.</p> : null}</section>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
