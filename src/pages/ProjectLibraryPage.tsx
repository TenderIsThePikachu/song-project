import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import { useCollabStore, type CollabProject, type CollabStatus } from '../store/collabStore';
import { useComposerLibraryStore, type ComposerProjectRecord } from '../store/composerLibraryStore';
import { useSongStore } from '../store/songStore';
import './ProjectLibraryPage.css';

type LibraryTab = 'work' | 'shared' | 'collab';

const tabLabels: Record<LibraryTab, string> = {
  work: '내 작업',
  shared: '공유됨',
  collab: '협업 중',
};

const statusLabels: Record<CollabStatus, string> = {
  planning: '기획',
  working: '작업 중',
  feedback: '피드백',
};

function formatDate(value: number) {
  if (!value) {
    return '날짜 없음';
  }

  return new Intl.DateTimeFormat('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(new Date(value));
}

function getProjectMeta(project: ComposerProjectRecord) {
  return `${project.genre} · ${project.bpm} BPM · ${project.steps} steps`;
}

export default function ProjectLibraryPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const projects = useComposerLibraryStore((state) => state.projects);
  const bootstrapStatus = useComposerLibraryStore((state) => state.bootstrapStatus);
  const bootstrapError = useComposerLibraryStore((state) => state.bootstrapError);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const deleteProject = useComposerLibraryStore((state) => state.deleteProject);
  const collabProjects = useCollabStore((state) => state.projects);
  const collabStatus = useCollabStore((state) => state.connectionStatus);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const loadProject = useSongStore((state) => state.loadProject);
  const [activeTab, setActiveTab] = useState<LibraryTab>('work');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  useEffect(() => {
    void seedLibrary().catch((error) => {
      console.error(error);
    });
  }, [seedLibrary]);

  useEffect(() => {
    void initializeRealtime().catch((error) => {
      console.error(error);
    });
  }, [initializeRealtime]);

  const visibleProjects = useMemo(() => {
    if (!user?.email) {
      return projects;
    }

    return projects.filter((project) => project.creatorEmail === user.email);
  }, [projects, user?.email]);

  const workProjects = useMemo(
    () =>
      visibleProjects
        .filter((project) => !project.isShared)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [visibleProjects]
  );

  const sharedProjects = useMemo(
    () =>
      visibleProjects
        .filter((project) => project.isShared)
        .sort((left, right) => right.updatedAt - left.updatedAt),
    [visibleProjects]
  );

  const myCollabProjects = useMemo(() => {
    if (!user?.email) {
      return [] as CollabProject[];
    }

    return collabProjects
      .filter(
        (project) =>
          project.ownerEmail === user.email ||
          project.members.some((member) => member.email === user.email)
      )
      .sort((left, right) => right.updatedAt - left.updatedAt);
  }, [collabProjects, user?.email]);

  const counts: Record<LibraryTab, number> = {
    work: workProjects.length,
    shared: sharedProjects.length,
    collab: myCollabProjects.length,
  };

  const handleOpenProject = (project: ComposerProjectRecord) => {
    loadProject(project.project);
    navigate(`/composer?project=${encodeURIComponent(project.id)}`);
  };

  const handleDeleteProject = async (project: ComposerProjectRecord) => {
    if (!user?.email) {
      alert('로그인 후 삭제할 수 있습니다.');
      return;
    }

    const confirmed = window.confirm(`"${project.title}" 프로젝트를 삭제할까요?`);
    if (!confirmed) {
      return;
    }

    setDeletingId(project.id);
    try {
      await deleteProject(project.id, user.email);
    } catch (error) {
      console.error(error);
      alert('프로젝트 삭제에 실패했습니다.');
    } finally {
      setDeletingId(null);
    }
  };

  const renderProjectCard = (project: ComposerProjectRecord) => (
    <article key={project.id} className="library-project-card">
      <button type="button" className="library-project-main" onClick={() => handleOpenProject(project)}>
        <span className="library-project-kicker">
          {project.isShared ? '공유 프로젝트' : '개인 작업'}
        </span>
        <strong>{project.title}</strong>
        <p>{project.description || '설명 없이 저장된 프로젝트입니다.'}</p>
        <div className="library-project-meta">
          <span>{getProjectMeta(project)}</span>
          <span>{formatDate(project.updatedAt)}</span>
        </div>
      </button>

      <div className="library-project-actions">
        <button type="button" onClick={() => handleOpenProject(project)}>
          열기
        </button>
        <button type="button" onClick={() => navigate('/community/music')}>
          공유곡 보기
        </button>
        <button
          type="button"
          className="is-danger"
          onClick={() => void handleDeleteProject(project)}
          disabled={deletingId === project.id}
        >
          {deletingId === project.id ? '삭제 중' : '삭제'}
        </button>
      </div>
    </article>
  );

  const renderCollabCard = (project: CollabProject) => (
    <article key={project.id} className="library-project-card library-project-card--collab">
      <button
        type="button"
        className="library-project-main"
        onClick={() => navigate(`/collab/${project.id}`)}
      >
        <span className="library-project-kicker">{statusLabels[project.status]}</span>
        <strong>{project.title}</strong>
        <p>{project.summary || '협업 설명이 없습니다.'}</p>
        <div className="library-project-meta">
          <span>{project.genre} · {project.bpm} BPM · {project.members.length}명</span>
          <span>{formatDate(project.updatedAt)}</span>
        </div>
      </button>

      <div className="library-project-actions">
        <button type="button" onClick={() => navigate(`/collab/${project.id}`)}>
          작업방
        </button>
        <button type="button" onClick={() => navigate(`/composer?collab=${project.id}`)}>
          작곡 열기
        </button>
      </div>
    </article>
  );

  const emptyText =
    activeTab === 'work'
      ? '아직 저장한 작업이 없습니다.'
      : activeTab === 'shared'
        ? '아직 공유한 프로젝트가 없습니다.'
        : '참여 중인 협업 프로젝트가 없습니다.';

  return (
    <div className="library-page">
      <SiteHeader activeSection="library" />

      <main className="library-shell">
        <section className="library-hero">
          <div>
            <span>MY MUSIC</span>
            <h1>내 음악을 한 곳에서 관리하세요.</h1>
            <p>
              저장한 작곡 프로젝트와 공유한 곡을 다시 열고 이어서 작업할 수 있습니다.
            </p>
          </div>
          <button type="button" onClick={() => navigate('/composer?new=1')}>
            새 작업 만들기
          </button>
        </section>

        <section className="library-summary" aria-label="프로젝트 요약">
          {(Object.keys(tabLabels) as LibraryTab[]).map((tab) => (
            <button
              key={tab}
              type="button"
              className={activeTab === tab ? 'is-active' : ''}
              onClick={() => setActiveTab(tab)}
            >
              <span>{tabLabels[tab]}</span>
              <strong>{counts[tab]}</strong>
            </button>
          ))}
        </section>

        {bootstrapStatus === 'error' ? (
          <div className="library-notice">{bootstrapError ?? '프로젝트 목록을 불러오지 못했습니다.'}</div>
        ) : null}
        {collabStatus === 'error' ? (
          <div className="library-notice">협업 목록을 불러오지 못했습니다.</div>
        ) : null}

        <section className="library-list" aria-label={tabLabels[activeTab]}>
          {activeTab === 'work' && workProjects.map(renderProjectCard)}
          {activeTab === 'shared' && sharedProjects.map(renderProjectCard)}
          {activeTab === 'collab' && myCollabProjects.map(renderCollabCard)}

          {!counts[activeTab] ? (
            <div className="library-empty">
              <strong>{emptyText}</strong>
              <span>
                {activeTab === 'work'
                  ? '작곡 화면에서 저장하기를 누르면 여기에 표시됩니다.'
                  : activeTab === 'shared'
                    ? '작곡 화면에서 공유하기를 누르면 공유 프로젝트로 정리됩니다.'
                    : '협업 페이지에서 프로젝트를 만들거나 참여하면 여기에 표시됩니다.'}
              </span>
            </div>
          ) : null}
        </section>
      </main>
    </div>
  );
}
