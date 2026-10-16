import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import { useCollabStore, type CollabProject, type CollabStatus } from '../store/collabStore';
import { useComposerLibraryStore, type ComposerProjectRecord } from '../store/composerLibraryStore';
import { useSongStore } from '../store/songStore';
import { formatTimeSignature, type TimeSignatureBeatType } from '../utils/timeSignature';
import './ProjectLibraryPage.css';

type LibraryTab = 'all' | 'recent' | 'shared' | 'collab';
type SortOrder = 'latest' | 'oldest' | 'title';
type LibraryEntry =
  | { kind: 'project'; updatedAt: number; project: ComposerProjectRecord }
  | { kind: 'collab'; updatedAt: number; project: CollabProject };

const tabLabels: Record<LibraryTab, string> = {
  all: '전체',
  recent: '최근 작업',
  shared: '공유곡',
  collab: '협업 프로젝트',
};

const statusLabels: Record<CollabStatus, string> = {
  planning: '기획',
  working: '작업 중',
  feedback: '피드백',
};

const NEW_PROJECT_GENRES = [
  { value: 'ballad', label: '발라드' },
  { value: 'pop', label: '팝' },
  { value: 'indie-pop', label: '인디팝' },
  { value: 'jazz', label: '재즈' },
  { value: 'rnb', label: 'R&B' },
  { value: 'hiphop', label: '힙합' },
  { value: 'rock', label: '록' },
  { value: 'electronic', label: '일렉트로닉' },
  { value: 'ost', label: 'OST' },
  { value: 'lofi', label: '로파이' },
] as const;

const COMMON_TIME_SIGNATURES = [
  { beats: 4, beatType: 4 },
  { beats: 3, beatType: 4 },
  { beats: 2, beatType: 4 },
  { beats: 6, beatType: 8 },
  { beats: 9, beatType: 8 },
  { beats: 12, beatType: 8 },
  { beats: 5, beatType: 4 },
  { beats: 7, beatType: 8 },
] as const;

function LibraryIcon({ name }: { name: 'music' | 'share' | 'users' | 'info' | 'search' | 'edit' | 'chevron' }) {
  const paths: Record<typeof name, ReactNode> = {
    music: <><path d="M9 18V5l10-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    share: <><circle cx="18" cy="5" r="3" /><circle cx="6" cy="12" r="3" /><circle cx="18" cy="19" r="3" /><path d="m8.7 10.7 6.6-4.3M8.7 13.3l6.6 4.3" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    info: <><circle cx="12" cy="12" r="9" /><path d="M12 11v6M12 7h.01" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    edit: <><path d="M12 20h9" /><path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L8 18l-4 1 1-4Z" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
  };
  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function formatDate(value: number) {
  if (!value) return '날짜 없음';
  return new Intl.DateTimeFormat('ko-KR', { year: 'numeric', month: 'short', day: 'numeric' }).format(new Date(value));
}

function getProjectMeta(project: ComposerProjectRecord) {
  return `${project.genre} · ${project.bpm} BPM · ${formatTimeSignature(project.project.timeSignature ?? { beats: 4, beatType: 4 })}`;
}

export default function ProjectLibraryPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useComposerLibraryStore((state) => state.projects);
  const bootstrapStatus = useComposerLibraryStore((state) => state.bootstrapStatus);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const deleteProject = useComposerLibraryStore((state) => state.deleteProject);
  const collabProjects = useCollabStore((state) => state.projects);
  const collabStatus = useCollabStore((state) => state.connectionStatus);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const loadProject = useSongStore((state) => state.loadProject);
  const [activeTab, setActiveTab] = useState<LibraryTab>('all');
  const [sortOrder, setSortOrder] = useState<SortOrder>('latest');
  const [query, setQuery] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [newProjectTitle, setNewProjectTitle] = useState('');
  const [newProjectBpm, setNewProjectBpm] = useState(120);
  const [newProjectGenre, setNewProjectGenre] = useState('ballad');
  const [newProjectBeats, setNewProjectBeats] = useState(4);
  const [newProjectBeatType, setNewProjectBeatType] = useState<TimeSignatureBeatType>(4);

  useEffect(() => {
    void seedLibrary().catch(console.error);
  }, [seedLibrary]);

  useEffect(() => {
    void initializeRealtime().catch(console.error);
  }, [initializeRealtime]);

  useEffect(() => {
    if (!isCreateDialogOpen) return;

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsCreateDialogOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isCreateDialogOpen]);

  const visibleProjects = useMemo(() => {
    if (!user?.email) return projects;
    return projects.filter((project) => project.creatorEmail === user.email);
  }, [projects, user?.email]);

  const workProjects = useMemo(
    () => visibleProjects.filter((project) => !project.isShared),
    [visibleProjects]
  );
  const sharedProjects = useMemo(
    () => visibleProjects.filter((project) => project.isShared),
    [visibleProjects]
  );
  const myCollabProjects = useMemo(() => {
    if (!user?.email) return [] as CollabProject[];
    return collabProjects.filter(
      (project) =>
        project.ownerEmail === user.email ||
        project.members.some((member) => member.email === user.email)
    );
  }, [collabProjects, user?.email]);

  const entries = useMemo(() => {
    const projectSource = activeTab === 'shared'
      ? sharedProjects
      : activeTab === 'recent'
        ? workProjects
        : activeTab === 'collab'
          ? []
          : visibleProjects;
    const normalizedQuery = query.trim().toLocaleLowerCase('ko-KR');
    const nextEntries: LibraryEntry[] = [
      ...projectSource.map((project) => ({
        kind: 'project' as const,
        updatedAt: project.updatedAt,
        project,
      })),
      ...(activeTab === 'all' || activeTab === 'collab'
        ? myCollabProjects.map((project) => ({
            kind: 'collab' as const,
            updatedAt: project.updatedAt,
            project,
          }))
        : []),
    ].filter((entry) => {
      if (!normalizedQuery) return true;
      const searchText = entry.kind === 'project'
        ? `${entry.project.title} ${entry.project.creatorName} ${entry.project.genre}`
        : `${entry.project.title} ${entry.project.ownerName} ${entry.project.genre}`;
      return searchText.toLocaleLowerCase('ko-KR').includes(normalizedQuery);
    });
    return nextEntries.sort((left, right) => {
      if (sortOrder === 'title') {
        return left.project.title.localeCompare(right.project.title, 'ko-KR');
      }
      return sortOrder === 'oldest'
        ? left.updatedAt - right.updatedAt
        : right.updatedAt - left.updatedAt;
    });
  }, [activeTab, myCollabProjects, query, sharedProjects, sortOrder, visibleProjects, workProjects]);

  const counts = {
    work: workProjects.length,
    shared: sharedProjects.length,
    collab: myCollabProjects.length,
  };

  const handleOpenProject = (project: ComposerProjectRecord) => {
    loadProject(project.project);
    navigate(`/composer?project=${encodeURIComponent(project.id)}`);
  };
  const handleOpenCreateDialog = () => {
    setNewProjectTitle('');
    setNewProjectBpm(120);
    setNewProjectGenre('ballad');
    setNewProjectBeats(4);
    setNewProjectBeatType(4);
    setIsCreateDialogOpen(true);
  };
  const handleCreateProject = () => {
    const params = new URLSearchParams({
      new: '1',
      title: newProjectTitle.trim() || '제목 없는 곡',
      bpm: String(newProjectBpm),
      genre: newProjectGenre,
      beats: String(newProjectBeats),
      beatType: String(newProjectBeatType),
    });
    setIsCreateDialogOpen(false);
    navigate(`/composer?${params.toString()}`);
  };
  const handleDeleteProject = async (project: ComposerProjectRecord) => {
    if (!user?.email) { alert('프로젝트를 삭제하려면 로그인이 필요합니다.'); return; }
    if (!window.confirm(`"${project.title}" 프로젝트를 삭제할까요?`)) return;
    setDeletingId(project.id);
    try { await deleteProject(project.id, user.email); }
    catch (error) { console.error(error); alert('프로젝트를 삭제하지 못했습니다. 잠시 후 다시 시도해주세요.'); }
    finally { setDeletingId(null); }
  };

  const renderProjectCard = (project: ComposerProjectRecord) => (
    <article key={project.id} className="library-project-card">
      <button type="button" className="library-project-main" onClick={() => handleOpenProject(project)}>
        <span className="library-project-thumbnail"><LibraryIcon name="music" /></span>
        <span className="library-project-copy"><span className="library-project-kicker">{project.isShared ? '공유곡' : '내 작업'}</span><strong>{project.title}</strong><p>{project.description || '설명 없이 저장된 프로젝트입니다.'}</p><span className="library-project-meta"><span>{getProjectMeta(project)}</span><span>최근 수정 {formatDate(project.updatedAt)}</span></span></span>
      </button>
      <div className="library-project-actions"><button type="button" onClick={() => handleOpenProject(project)}>작업 열기</button>{project.isShared ? <button type="button" onClick={() => navigate('/community/music')}>공유곡 보기</button> : null}<button type="button" className="is-danger" onClick={() => void handleDeleteProject(project)} disabled={deletingId === project.id}>{deletingId === project.id ? '삭제 중' : '삭제'}</button></div>
    </article>
  );

  const renderCollabCard = (project: CollabProject) => (
    <article key={project.id} className="library-project-card library-project-card--collab">
      <button type="button" className="library-project-main" onClick={() => navigate(`/collab/${project.id}`)}>
        <span className="library-project-thumbnail is-collab"><LibraryIcon name="users" /></span>
        <span className="library-project-copy"><span className="library-project-kicker">{statusLabels[project.status]}</span><strong>{project.title}</strong><p>{project.summary || '협업 프로젝트 설명이 없습니다.'}</p><span className="library-project-meta"><span>{project.genre} · {project.bpm} BPM · {project.members.length}명</span><span>최근 수정 {formatDate(project.updatedAt)}</span></span></span>
      </button>
      <div className="library-project-actions"><button type="button" onClick={() => navigate(`/collab/${project.id}`)}>협업방</button><button type="button" onClick={() => navigate(`/composer?collab=${project.id}`)}>작곡 열기</button></div>
    </article>
  );

  const isLoading = bootstrapStatus === 'loading' || collabStatus === 'connecting';
  const hasError = bootstrapStatus === 'error' || collabStatus === 'error';

  return (
    <div className="library-page">
      <SiteHeader activeSection="composer" />
      <main className="library-shell">
        <section className="library-hero"><div><span>MUSIC STUDIO</span><h1>나의 음악 스튜디오</h1><p>새로운 음악을 시작하거나 저장한 곡을 다시 열어 이어서 완성해보세요.</p></div><button type="button" className="library-primary-button" onClick={handleOpenCreateDialog}><b>+</b> 새 음악 설정</button></section>
        <section className="library-summary" aria-label="프로젝트 요약">
          <button type="button" className={activeTab === 'all' || activeTab === 'recent' ? 'is-active' : ''} onClick={() => setActiveTab('recent')}><i><LibraryIcon name="music" /></i><span><b>내 작업</b><strong>{counts.work}<small>개</small></strong><em>내가 만든 작곡 프로젝트</em></span><LibraryIcon name="chevron" /></button>
          <button type="button" className={activeTab === 'shared' ? 'is-active' : ''} onClick={() => setActiveTab('shared')}><i><LibraryIcon name="share" /></i><span><b>공유됨</b><strong>{counts.shared}<small>개</small></strong><em>다른 사용자와 공유한 곡</em></span><LibraryIcon name="chevron" /></button>
          <button type="button" className={activeTab === 'collab' ? 'is-active' : ''} onClick={() => setActiveTab('collab')}><i><LibraryIcon name="users" /></i><span><b>협업 중</b><strong>{counts.collab}<small>개</small></strong><em>함께 작업하는 프로젝트</em></span><LibraryIcon name="chevron" /></button>
        </section>
        {!user ? <section className="library-login-notice"><i><LibraryIcon name="info" /></i><span><strong>일부 기능을 사용하려면 로그인이 필요합니다.</strong><small>지금 로그인하고 더 많은 기능을 이용해보세요.</small></span><button type="button" onClick={() => navigate('/login')}>로그인하기</button></section> : null}
        {hasError ? <section className="library-status-notice"><LibraryIcon name="info" /><span><strong>데이터를 불러올 수 없습니다.</strong><small>로그인 상태 또는 접근 권한을 확인해주세요.</small></span></section> : null}
        <section className="library-toolbar"><div className="library-tabs" role="tablist" aria-label="내 음악 필터">{(Object.keys(tabLabels) as LibraryTab[]).map((tab) => <button key={tab} type="button" role="tab" aria-selected={activeTab === tab} className={activeTab === tab ? 'is-active' : ''} onClick={() => setActiveTab(tab)}>{tabLabels[tab]}</button>)}</div><div className="library-tools"><label><LibraryIcon name="search" /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="작업 제목, 아티스트명으로 검색하세요..." /></label><select value={sortOrder} onChange={(event) => setSortOrder(event.target.value as SortOrder)} aria-label="정렬"><option value="latest">최신순</option><option value="oldest">오래된순</option><option value="title">제목순</option></select></div></section>
        <section className="library-list" aria-label={tabLabels[activeTab]}>
          {isLoading ? <div className="library-loading">작업 목록을 불러오는 중입니다.</div> : entries.map((entry) => entry.kind === 'project' ? renderProjectCard(entry.project) : renderCollabCard(entry.project))}
          {!isLoading && !entries.length ? <div className="library-empty"><i><LibraryIcon name="music" /></i><strong>{query ? '검색 결과가 없습니다.' : '아직 저장한 작업이 없습니다.'}</strong><span>{query ? '검색어를 바꾸거나 다른 분류를 확인해보세요.' : '지금 바로 첫 번째 곡을 만들어보세요.'}</span><div><button type="button" className="is-primary" onClick={handleOpenCreateDialog}><b>+</b> 새 음악 설정</button><button type="button" onClick={() => navigate('/composer')}><LibraryIcon name="edit" /> 스튜디오로 이동</button></div></div> : null}
        </section>
      </main>
      {isCreateDialogOpen ? (
        <div
          className="library-create-backdrop"
          role="presentation"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsCreateDialogOpen(false);
          }}
        >
          <form
            className="library-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="library-create-title"
            onSubmit={(event) => {
              event.preventDefault();
              handleCreateProject();
            }}
          >
            <header className="library-create-header">
              <div>
                <span>NEW COMPOSITION</span>
                <h2 id="library-create-title">새 작곡 설정</h2>
                <p>곡의 기본 정보를 정한 뒤 스튜디오를 시작하세요.</p>
              </div>
              <button
                type="button"
                className="library-create-close"
                aria-label="새 작곡 설정 닫기"
                onClick={() => setIsCreateDialogOpen(false)}
              >
                ×
              </button>
            </header>

            <div className="library-create-body">
              <label className="library-create-field">
                <span>곡 이름</span>
                <input
                  autoFocus
                  value={newProjectTitle}
                  maxLength={60}
                  placeholder="새로운 곡의 이름을 입력하세요"
                  onChange={(event) => setNewProjectTitle(event.target.value)}
                />
                <small>{newProjectTitle.length}/60</small>
              </label>

              <fieldset className="library-create-tempo">
                <legend>BPM</legend>
                <div className="library-create-bpm-row">
                  <input
                    type="number"
                    min={60}
                    max={200}
                    value={newProjectBpm}
                    aria-label="BPM 직접 입력"
                    onChange={(event) =>
                      setNewProjectBpm(
                        Math.min(200, Math.max(60, Number(event.target.value) || 60))
                      )
                    }
                  />
                  <span>beats per minute</span>
                </div>
                <input
                  className="library-create-bpm-slider"
                  type="range"
                  min={60}
                  max={200}
                  value={newProjectBpm}
                  onChange={(event) => setNewProjectBpm(Number(event.target.value))}
                />
                <div className="library-create-presets" aria-label="BPM 빠른 선택">
                  {[80, 100, 120, 140].map((tempo) => (
                    <button
                      key={tempo}
                      type="button"
                      className={newProjectBpm === tempo ? 'is-active' : ''}
                      onClick={() => setNewProjectBpm(tempo)}
                    >
                      {tempo}
                    </button>
                  ))}
                </div>
              </fieldset>

              <fieldset className="library-create-signature">
                <legend>박자표</legend>
                <div className="library-create-signature-presets" aria-label="자주 쓰는 박자표">
                  {COMMON_TIME_SIGNATURES.map((signature) => {
                    const active =
                      newProjectBeats === signature.beats &&
                      newProjectBeatType === signature.beatType;
                    return (
                      <button
                        key={`${signature.beats}-${signature.beatType}`}
                        type="button"
                        className={active ? 'is-active' : ''}
                        onClick={() => {
                          setNewProjectBeats(signature.beats);
                          setNewProjectBeatType(signature.beatType);
                        }}
                      >
                        {signature.beats}/{signature.beatType}
                      </button>
                    );
                  })}
                </div>
                <div className="library-create-signature-custom">
                  <label>
                    <span>분자</span>
                    <input
                      type="number"
                      min={1}
                      max={32}
                      value={newProjectBeats}
                      onChange={(event) =>
                        setNewProjectBeats(
                          Math.min(32, Math.max(1, Number(event.target.value) || 1))
                        )
                      }
                    />
                  </label>
                  <span aria-hidden="true">/</span>
                  <label>
                    <span>분모</span>
                    <select
                      value={newProjectBeatType}
                      onChange={(event) =>
                        setNewProjectBeatType(Number(event.target.value) as TimeSignatureBeatType)
                      }
                    >
                      {[2, 4, 8, 16].map((beatType) => (
                        <option key={beatType} value={beatType}>{beatType}</option>
                      ))}
                    </select>
                  </label>
                </div>
              </fieldset>

              <label className="library-create-genre">
                <span>장르</span>
                <select
                  value={newProjectGenre}
                  onChange={(event) => setNewProjectGenre(event.target.value)}
                >
                  {NEW_PROJECT_GENRES.map((genre) => (
                    <option key={genre.value} value={genre.value}>{genre.label}</option>
                  ))}
                </select>
              </label>
            </div>

            <footer className="library-create-actions">
              <button type="button" onClick={() => setIsCreateDialogOpen(false)}>취소</button>
              <button type="submit" className="is-primary">만들기</button>
            </footer>
          </form>
        </div>
      ) : null}
    </div>
  );
}
