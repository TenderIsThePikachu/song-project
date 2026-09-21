import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import CollabHubTabs from '../components/collab/CollabHubTabs';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import { useCollabStore, type CollabProject } from '../store/collabStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
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

function formatTime(value: number) {
  return new Date(value).toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

function formatRelativeTime(value: number) {
  const minutes = Math.max(1, Math.floor((Date.now() - value) / 60_000));
  if (minutes < 60) return `${minutes}분 전`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}시간 전`;
  return `${Math.floor(hours / 24)}일 전`;
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
  const projects = useCollabStore((state) => state.projects);
  const messages = useCollabStore((state) => state.messages);
  const tasks = useCollabStore((state) => state.tasks);
  const joinProject = useCollabStore((state) => state.joinProject);
  const createFromComposerProject = useCollabStore((state) => state.createFromComposerProject);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const [actionError, setActionError] = useState('');

  useEffect(() => {
    void initializeRealtime().catch(console.error);
  }, [initializeRealtime]);

  useEffect(() => {
    void seedLibrary().catch(console.error);
  }, [seedLibrary]);

  const sortedProjects = useMemo(
    () => [...projects].sort((left, right) => right.updatedAt - left.updatedAt),
    [projects]
  );

  const myComposerProjects = useMemo(
    () =>
      user
        ? composerProjects
            .filter((project) => project.creatorEmail === user.email)
            .sort((left, right) => right.updatedAt - left.updatedAt)
        : [],
    [composerProjects, user]
  );

  const linkedProjectIds = useMemo(
    () =>
      new Set(
        projects
          .map((project) => project.sourceProjectId)
          .filter((value): value is string => Boolean(value))
      ),
    [projects]
  );

  const readyProjects = useMemo(
    () => myComposerProjects.filter((project) => !linkedProjectIds.has(project.id)),
    [linkedProjectIds, myComposerProjects]
  );

  const totalMembers = useMemo(() => {
    const uniqueEmails = new Set(projects.flatMap((project) => project.members.map((member) => member.email)));
    return uniqueEmails.size;
  }, [projects]);

  const openTaskCount = useMemo(() => tasks.filter((task) => !task.completed).length, [tasks]);

  const latestMessageByProject = useMemo(() => {
    const map = new Map<string, string>();
    [...messages]
      .sort((left, right) => right.createdAt - left.createdAt)
      .forEach((message) => {
        if (!map.has(message.projectId)) map.set(message.projectId, message.content);
      });
    return map;
  }, [messages]);

  const openTasksByProject = useMemo(() => {
    const map = new Map<string, number>();
    tasks.forEach((task) => {
      if (!task.completed) map.set(task.projectId, (map.get(task.projectId) ?? 0) + 1);
    });
    return map;
  }, [tasks]);

  const recentMessages = useMemo(
    () => [...messages].sort((left, right) => right.createdAt - left.createdAt).slice(0, 3),
    [messages]
  );

  const featuredMembers = useMemo(() => {
    const members = new Map<string, string>();
    projects.forEach((project) => {
      project.members.forEach((member) => members.set(member.email, member.name));
    });
    return [...members.entries()].slice(0, 3);
  }, [projects]);

  const handleCreateCollab = async (projectId: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const sourceProject = myComposerProjects.find((project) => project.id === projectId);
    if (!sourceProject) return;

    try {
      setActionError('');
      const collabId = await createFromComposerProject({
        sourceProjectId: sourceProject.id,
        title: sourceProject.title,
        summary: sourceProject.description,
        genre: sourceProject.genre,
        bpm: sourceProject.bpm,
        steps: sourceProject.steps,
        ownerEmail: user.email,
        ownerName: user.name,
        snapshot: sourceProject.project,
      });

      navigate(`/collab/${collabId}`);
    } catch (error) {
      console.error(error);
      setActionError(error instanceof Error ? error.message : '협업 프로젝트를 만들지 못했습니다.');
    }
  };

  const handleOpenProject = async (project: CollabProject) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const isMember = project.members.some((member) => member.email === user.email);
    if (!isMember) {
      try {
        setActionError('');
        await joinProject(project.id, { email: user.email, name: user.name });
      } catch (error) {
        console.error(error);
        setActionError(error instanceof Error ? error.message : '협업 프로젝트에 참여하지 못했습니다.');
        return;
      }
    }

    navigate(`/collab/${project.id}`);
  };

  const handleCreateFromFirstProject = () => {
    const sourceProject = readyProjects[0];
    if (sourceProject) {
      void handleCreateCollab(sourceProject.id);
      return;
    }
    navigate(user ? '/library' : '/login');
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
                  <CollabIcon name="plus" /> 작업실 열기
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
            <article className="collab-stat-card is-members">
              <span className="collab-stat-icon"><CollabIcon name="users" /></span>
              <div><span>참여 멤버</span><strong>{formatCount(totalMembers)}</strong></div>
              <a href="#collab-projects">멤버 관리 ›</a>
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
              <h2>진행 중인 협업</h2>
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
                const projectTasks = tasks.filter((task) => task.projectId === project.id);
                const completedTasks = projectTasks.filter((task) => task.completed).length;
                const fallbackProgress = project.status === 'feedback' ? 80 : project.status === 'working' ? 60 : 20;
                const progress = projectTasks.length ? Math.round((completedTasks / projectTasks.length) * 100) : fallbackProgress;
                const lastMessage = latestMessageByProject.get(project.id);

                return (
                  <article className="collab-project-card" key={project.id}>
                    <button type="button" className="collab-project-main" onClick={() => void handleOpenProject(project)}>
                      <img className="collab-project-cover" src={COLLAB_COVERS[index % COLLAB_COVERS.length]} alt="" />
                      <span className="collab-project-copy">
                        <strong>{project.title}</strong>
                        <small>{project.summary || lastMessage || '함께 완성해가는 협업 프로젝트입니다.'}</small>
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
                        <button type="button" className="collab-more-button" aria-label={`${project.title} 메뉴`}>⋮</button>
                      </div>
                    </div>

                    <div className="collab-project-progress">
                      <span><strong>{progress}%</strong><small>남은 작업 {openTasksByProject.get(project.id) ?? 0}</small></span>
                      <i><b style={{ width: `${progress}%` }} /></i>
                    </div>
                    <button type="button" className="collab-card-open" onClick={() => void handleOpenProject(project)}>{isMember ? '작업실 열기' : '참여하기'}</button>
                  </article>
                );
              }) : <div className="collab-empty-card">아직 진행 중인 협업 프로젝트가 없습니다.</div>}
            </div>
          </section>

          <aside className="collab-sidebar">
            <section className="collab-side-card collab-chat-card">
              <header><h2><CollabIcon name="message" /> 팀 채팅</h2><a href={sortedProjects[0] ? `/collab/${sortedProjects[0].id}` : '#collab-projects'}>전체 채팅 보기 ›</a></header>
              <div className="collab-chat-list">
                {recentMessages.length ? recentMessages.map((message, index) => (
                  <article key={message.id}>
                    <span className={`collab-avatar is-${(index % 3) + 1}`}>{getInitial(message.authorName)}</span>
                    <div><strong>{message.authorName}<time>{formatTime(message.createdAt)}</time></strong><p>{message.content}</p></div>
                    {index < 2 ? <b>{index + 1}</b> : null}
                  </article>
                )) : <p className="collab-side-empty">아직 팀 채팅 메시지가 없습니다.</p>}
              </div>
            </section>

            <section className="collab-side-card collab-activity-card">
              <header><h2><CollabIcon name="activity" /> 최근 활동</h2><a href="#collab-projects">전체 보기 ›</a></header>
              <div className="collab-activity-list">
                {sortedProjects.slice(0, 4).map((project, index) => (
                  <article key={project.id}>
                    <span className={`collab-activity-dot is-${(index % 3) + 1}`}>{getInitial(project.ownerName)}</span>
                    <p><strong>{project.ownerName}</strong>님이 <b>{project.title}</b> 프로젝트를 업데이트했어요.</p>
                    <time>{formatRelativeTime(project.updatedAt)}</time>
                  </article>
                ))}
                {!sortedProjects.length ? <p className="collab-side-empty">아직 최근 활동이 없습니다.</p> : null}
              </div>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
