import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CollabHubTabs from '../components/collab/CollabHubTabs';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import { useCollabStore, type CollabProject } from '../store/collabStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import { useSessionRecruitStore } from '../store/sessionRecruitStore';
import { isLocalDevelopmentHost } from '../utils/localEnvironment';
import './CollabPage.css';

const STATUS_LABEL: Record<CollabProject['status'], string> = {
  planning: '준비 중',
  working: '작업 중',
  feedback: '마감 임박',
};

const COLLAB_COVERS = [
  '/landing-assets/shared-fallback-ballad.jpg',
  '/landing-assets/shared-fallback-film.jpg',
  '/landing-assets/shared-fallback-band.jpg',
  '/landing-assets/shared-fallback-dream.jpg',
];

type CollabIconName = 'activity' | 'check' | 'folder' | 'message' | 'plus' | 'userPlus' | 'users';

function CollabIcon({ name }: { name: CollabIconName }) {
  const paths: Record<CollabIconName, React.ReactNode> = {
    activity: <><path d="M3 12h4l2.2-6 4.1 12 2.2-6H21" /></>,
    check: <><rect x="3.5" y="3.5" width="17" height="17" rx="3" /><path d="m8 12 2.7 2.7L16.5 9" /></>,
    folder: <><path d="M3 7.5h6l2-2h3l2 2h5v11H3z" /><path d="M3 10h18" /></>,
    message: <><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 3v-3.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    userPlus: <><circle cx="9" cy="8" r="3" /><path d="M3.5 19c.6-3.2 2.4-5 5.5-5s4.9 1.8 5.5 5M18 7v6M15 10h6" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 19c.5-3.2 2.5-5 6-5s5.5 1.8 6 5M16 6.5a3 3 0 0 1 0 5.8M17 14c2.3.4 3.6 2 4 4.5" /></>,
  };

  return <svg className="collab-ui-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function formatDate(value: number) {
  return new Date(value).toLocaleDateString('ko-KR');
}

function formatCount(value: number) {
  return value.toLocaleString('ko-KR');
}

function getInitial(value: string) {
  return value.trim().slice(0, 1).toUpperCase() || '?';
}

function getConnectionLabel(status: ReturnType<typeof useCollabStore.getState>['connectionStatus']) {
  if (status === 'connected') return '실시간 서버 연결됨';
  if (status === 'connecting') return '실시간 서버 연결 중';
  if (status === 'error') return '실시간 서버 연결 실패';
  return '실시간 서버 대기 중';
}

export default function CollabPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const isLocalHost = isLocalDevelopmentHost();
  const projects = useCollabStore((state) => state.projects);
  const tasks = useCollabStore((state) => state.tasks);
  const renameProject = useCollabStore((state) => state.renameProject);
  const deleteProject = useCollabStore((state) => state.deleteProject);
  const createFromComposerProject = useCollabStore((state) => state.createFromComposerProject);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const recruitPosts = useSessionRecruitStore((state) => state.posts);
  const seedSessionRecruit = useSessionRecruitStore((state) => state.seedSessionRecruit);
  const [actionError, setActionError] = useState('');
  const [openMenuProjectId, setOpenMenuProjectId] = useState<string | null>(null);
  const [renameTarget, setRenameTarget] = useState<CollabProject | null>(null);
  const [renameTitle, setRenameTitle] = useState('');
  const [deleteTarget, setDeleteTarget] = useState<CollabProject | null>(null);
  const [isManagingProject, setIsManagingProject] = useState(false);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [creatingProjectId, setCreatingProjectId] = useState<string | null>(null);

  useEffect(() => {
    void initializeRealtime().catch(console.error);
  }, [initializeRealtime]);

  useEffect(() => {
    void seedLibrary().catch(console.error);
  }, [seedLibrary]);

  useEffect(() => {
    void seedSessionRecruit().catch(console.error);
  }, [seedSessionRecruit]);

  const sortedProjects = useMemo(
    () => [...projects].sort((left, right) => right.updatedAt - left.updatedAt),
    [projects]
  );

  const myComposerProjects = useMemo(
    () =>
      user
        ? composerProjects
            .filter(
              (project) =>
                project.creatorEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
            )
            .sort((left, right) => right.updatedAt - left.updatedAt)
        : isLocalHost
          ? [...composerProjects].sort((left, right) => right.updatedAt - left.updatedAt)
          : [],
    [composerProjects, isLocalHost, user]
  );

  const linkedProjectsBySource = useMemo(
    () => new Map(
      projects
        .filter((project) => Boolean(project.sourceProjectId))
        .map((project) => [project.sourceProjectId as string, project])
    ),
    [projects]
  );

  const recruitPostByProject = useMemo(
    () => new Map(
      recruitPosts
        .filter((post) => Boolean(post.collabProjectId))
        .map((post) => [post.collabProjectId as string, post])
    ),
    [recruitPosts]
  );

  const nearCompletionCount = useMemo(
    () => projects.filter((project) => {
      const projectTasks = tasks.filter((task) => task.projectId === project.id);
      if (!projectTasks.length) return false;
      const completedTasks = projectTasks.filter((task) => task.completed).length;
      return completedTasks / projectTasks.length >= 0.8;
    }).length,
    [projects, tasks]
  );

  const openTaskCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);

  const openTasksByProject = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((task) => {
      if (!task.completed) map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1);
    });
    return map;
  }, [tasks]);

  const featuredMembers = useMemo(() => {
    const members = new Map<string, string>();
    projects.forEach((project) => {
      project.members.forEach((member) => members.set(member.email, member.name));
    });
    return [...members.entries()].slice(0, 3);
  }, [projects]);

  const handleCreateCollab = async (projectId: string) => {
    if (!user && !isLocalHost) {
      navigate('/login');
      return;
    }

    const sourceProject = myComposerProjects.find((project) => project.id === projectId);
    if (!sourceProject) return;

    try {
      setCreatingProjectId(projectId);
      setActionError('');
      const collabId = await createFromComposerProject({
        sourceProjectId: sourceProject.id,
        title: sourceProject.title,
        summary: sourceProject.description,
        genre: sourceProject.genre,
        bpm: sourceProject.bpm,
        steps: sourceProject.steps,
        ownerEmail: user?.email ?? sourceProject.creatorEmail,
        ownerName: user?.name ?? sourceProject.creatorName,
        snapshot: sourceProject.project,
      });

      setIsCreateDialogOpen(false);
      navigate(`/collab/${collabId}`);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : '협업 프로젝트를 만들지 못했습니다.');
    } finally {
      setCreatingProjectId(null);
    }
  };

  const handleOpenProject = (project: CollabProject) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const isMember = project.members.some((member) => member.email === user.email);
    if (isMember) {
      navigate(`/collab/${project.id}`);
      return;
    }

    const recruitPost = recruitPostByProject.get(project.id);
    if (recruitPost) {
      navigate(`/community/sessions/${recruitPost.id}`);
      return;
    }

    setActionError('이 작업실은 연결된 팀원 모집글에서 지원하고 승인받아야 참여할 수 있습니다.');
  };

  const handleCreateFromFirstProject = () => {
    if (!user && !isLocalHost) {
      navigate('/login');
      return;
    }

    if (!myComposerProjects.length) {
      navigate('/composer');
      return;
    }

    setActionError('');
    setIsCreateDialogOpen(true);
  };

  const openRenameDialog = (project: CollabProject) => {
    setOpenMenuProjectId(null);
    setRenameTarget(project);
    setRenameTitle(project.title);
  };

  const handleRenameProject = async () => {
    if (!user || !renameTarget || !renameTitle.trim()) return;

    try {
      setIsManagingProject(true);
      setActionError('');
      await renameProject(renameTarget.id, user.email, renameTitle);
      setRenameTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '작업실 이름을 변경하지 못했습니다.');
    } finally {
      setIsManagingProject(false);
    }
  };

  const handleDeleteProject = async () => {
    if (!user || !deleteTarget) return;

    try {
      setIsManagingProject(true);
      setActionError('');
      await deleteProject(deleteTarget.id, user.email);
      setDeleteTarget(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : '작업실을 삭제하지 못했습니다.');
    } finally {
      setIsManagingProject(false);
    }
  };

  return (
    <div className="collab-page">
      <SiteHeader activeSection="collab" />

      <main className="collab-shell">
        <CollabHubTabs activeTab="collab" />

        <div className="collab-overview-grid">
          <section className="collab-hero">
            <div className="collab-hero-copy">
              <h1>같이 만드는 곡은 더 멀리 갑니다</h1>

              <div className="collab-hero-actions">
                <button
                  type="button"
                  className="collab-primary-button"
                  onClick={() => sortedProjects[0] && void handleOpenProject(sortedProjects[0])}
                  disabled={!projects.length}
                >
                  <CollabIcon name="plus" /> 최근 작업실 열기
                </button>
                <button type="button" className="collab-secondary-button" onClick={handleCreateFromFirstProject}>
                  <CollabIcon name="userPlus" /> 새 협업 만들기
                </button>
              </div>

              <div className="collab-connection-row">
                <span className={`collab-connection-chip is-${connectionStatus}`}>
                  <i aria-hidden="true" /> {getConnectionLabel(connectionStatus)}
                </span>
                {connectionError || actionError ? <small>{actionError || connectionError}</small> : null}
              </div>
            </div>

            <div className="collab-hero-art" aria-hidden="true">
              <div className="collab-wave-card">
                {(featuredMembers.length ? featuredMembers : [['one', '지민'], ['two', '현우'], ['three', '서연']]).map(
                  ([email, name], index) => (
                    <div className={`collab-wave-row is-${index + 1}`} key={email}>
                      <span className="collab-avatar">{getInitial(name)}</span>
                      <span className="collab-wave-line" />
                    </div>
                  )
                )}
                <span className="collab-wave-playhead" />
              </div>
            </div>
          </section>

          <section className="collab-stat-stack" aria-label="협업 현황">
            <article className="collab-stat-card is-projects">
              <span className="collab-stat-icon"><CollabIcon name="folder" /></span>
              <div><span>협업 프로젝트</span><strong>{formatCount(projects.length)}</strong></div>
              <a href="#collab-projects">전체 보기 ›</a>
            </article>
            <article className="collab-stat-card is-near-completion">
              <span className="collab-stat-icon"><CollabIcon name="activity" /></span>
              <div><span>완료 임박</span><strong>{formatCount(nearCompletionCount)}</strong></div>
              <a href="#collab-projects">프로젝트 확인 ›</a>
            </article>
            <article className="collab-stat-card is-tasks">
              <span className="collab-stat-icon"><CollabIcon name="check" /></span>
              <div><span>남은 작업</span><strong>{formatCount(openTaskCount)}</strong></div>
              <a href="#collab-projects">작업 확인 ›</a>
            </article>
          </section>
        </div>

        <div className="collab-content-grid">
          <section className="collab-project-panel" id="collab-projects">
            <header className="collab-section-head">
              <h2>내 작업실</h2>
              <div className="collab-project-controls">
                <select aria-label="협업 프로젝트 정렬" defaultValue="latest"><option value="latest">최신순</option><option value="oldest">오래된순</option></select>
                <span className="is-active">전체 {projects.length}</span>
                <span>작업 중 {projects.filter((project) => project.status === 'working').length}</span>
                <span>준비 중 {projects.filter((project) => project.status === 'planning').length}</span>
                <span>마감 임박 {projects.filter((project) => project.status === 'feedback').length}</span>
              </div>
            </header>

            <div className="collab-project-list">
              {sortedProjects.length ? sortedProjects.map((project, index) => {
                const isMember = user ? project.members.some((member) => member.email === user.email) : false;
                const recruitPost = recruitPostByProject.get(project.id);
                const isOwner = user
                  ? project.ownerEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
                  : false;
                const projectTasks = tasks.filter((task) => task.projectId === project.id);
                const completedTasks = projectTasks.filter((task) => task.completed).length;
                const progress = projectTasks.length
                  ? Math.round((completedTasks / projectTasks.length) * 100)
                  : 0;

                return (
                  <article className="collab-project-card" key={project.id}>
                    <button type="button" className="collab-project-main" onClick={() => void handleOpenProject(project)}>
                      <img className="collab-project-cover" src={COLLAB_COVERS[index % COLLAB_COVERS.length]} alt="" />
                      <span className="collab-project-copy">
                        <strong>{project.title}</strong>
                        <small>{project.summary || `방장 ${project.ownerName}`}</small>
                        <span className="collab-project-meta">
                          <i>{project.genre || '장르 미정'}</i><i>{project.bpm} BPM</i><i>{project.steps} steps</i><i>{project.members.length}명 참여</i>
                        </span>
                      </span>
                    </button>

                    <div className="collab-project-side">
                      <span className={`collab-status-chip is-${project.status}`}>{STATUS_LABEL[project.status]}</span>
                      <span className="collab-project-date">최근 수정 {formatDate(project.updatedAt)}</span>
                      <div className="collab-member-row">
                        <span className="collab-member-avatars">
                          {project.members.slice(0, 3).map((member, memberIndex) => <i key={member.email} className={`is-${memberIndex + 1}`}>{getInitial(member.name)}</i>)}
                          {project.members.length > 3 ? <i className="is-more">+{project.members.length - 3}</i> : null}
                        </span>
                        {isOwner ? (
                          <div className="collab-project-menu-wrap">
                            <button
                              type="button"
                              className="collab-more-button"
                              aria-label={`${project.title} 관리 메뉴`}
                              aria-expanded={openMenuProjectId === project.id}
                              onClick={() =>
                                setOpenMenuProjectId((current) => current === project.id ? null : project.id)
                              }
                            >
                              ⋮
                            </button>
                            {openMenuProjectId === project.id ? (
                              <div className="collab-project-menu" role="menu">
                                <button type="button" role="menuitem" onClick={() => openRenameDialog(project)}>
                                  이름 변경
                                </button>
                                <button
                                  type="button"
                                  role="menuitem"
                                  className="is-danger"
                                  onClick={() => {
                                    setOpenMenuProjectId(null);
                                    setDeleteTarget(project);
                                  }}
                                >
                                  작업실 삭제
                                </button>
                              </div>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    </div>

                    <div className="collab-project-progress">
                      <span><strong>{progress}%</strong><small>남은 작업 {openTasksByProject.get(project.id) ?? 0}</small></span>
                      <i><b style={{ width: `${progress}%` }} /></i>
                    </div>
                    <button
                      type="button"
                      className="collab-card-open"
                      onClick={() => handleOpenProject(project)}
                      disabled={!isMember && !recruitPost}
                    >
                      {isMember ? '작업실 열기' : recruitPost ? '모집글에서 지원하기' : '모집 준비 중'}
                    </button>
                  </article>
                );
              }) : <div className="collab-empty-card">아직 진행 중인 협업 프로젝트가 없습니다.</div>}
            </div>
          </section>

        </div>
      </main>

      {isCreateDialogOpen ? (
        <div className="collab-manage-overlay" role="presentation" onMouseDown={() => setIsCreateDialogOpen(false)}>
          <section
            className="collab-manage-dialog collab-create-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collab-create-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <strong id="collab-create-title">새 협업 만들기</strong>
              <p>새 작업실로 가져올 내 곡을 선택하세요.</p>
            </div>
            <div className="collab-create-project-list">
              {myComposerProjects.map((project) => {
                const linkedProject = linkedProjectsBySource.get(project.id);
                const isCreating = creatingProjectId === project.id;
                return (
                  <article key={project.id}>
                    <span>
                      <strong>{project.title || '제목 없는 곡'}</strong>
                      <small>{project.genre || '장르 미정'} · {project.bpm} BPM</small>
                    </span>
                    <button
                      type="button"
                      className={linkedProject ? '' : 'is-primary'}
                      disabled={Boolean(creatingProjectId)}
                      onClick={() => {
                        if (linkedProject) {
                          setIsCreateDialogOpen(false);
                          void handleOpenProject(linkedProject);
                          return;
                        }
                        void handleCreateCollab(project.id);
                      }}
                    >
                      {linkedProject ? '기존 작업실 열기' : isCreating ? '만드는 중...' : '협업 만들기'}
                    </button>
                  </article>
                );
              })}
            </div>
            {actionError ? <p className="collab-create-error" role="alert">{actionError}</p> : null}
            <div className="collab-manage-actions">
              <button type="button" onClick={() => setIsCreateDialogOpen(false)} disabled={Boolean(creatingProjectId)}>닫기</button>
            </div>
          </section>
        </div>
      ) : null}

      {renameTarget ? (
        <div className="collab-manage-overlay" role="presentation" onMouseDown={() => setRenameTarget(null)}>
          <form
            className="collab-manage-dialog"
            onSubmit={(event) => {
              event.preventDefault();
              void handleRenameProject();
            }}
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <strong>작업실 이름 변경</strong>
              <p>팀원에게 표시할 새로운 작업실 이름을 입력하세요.</p>
            </div>
            <label>
              <span>작업실 이름</span>
              <input
                autoFocus
                maxLength={60}
                value={renameTitle}
                onChange={(event) => setRenameTitle(event.target.value)}
              />
            </label>
            <div className="collab-manage-actions">
              <button type="button" onClick={() => setRenameTarget(null)} disabled={isManagingProject}>취소</button>
              <button type="submit" className="is-primary" disabled={isManagingProject || !renameTitle.trim()}>
                {isManagingProject ? '변경 중...' : '변경하기'}
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="collab-manage-overlay" role="presentation" onMouseDown={() => setDeleteTarget(null)}>
          <div
            className="collab-manage-dialog"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="collab-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <strong id="collab-delete-title">작업실을 삭제할까요?</strong>
              <p><b>{deleteTarget.title}</b>의 작업 내용, 채팅, 할 일과 로그가 모두 삭제됩니다.</p>
            </div>
            <div className="collab-manage-actions">
              <button type="button" onClick={() => setDeleteTarget(null)} disabled={isManagingProject}>취소</button>
              <button type="button" className="is-danger" onClick={() => void handleDeleteProject()} disabled={isManagingProject}>
                {isManagingProject ? '삭제 중...' : '작업실 삭제'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
