import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import {
  COLLAB_PRESENCE_PING_INTERVAL_MS,
  COLLAB_PRESENCE_TIMEOUT_MS,
  useCollabStore,
  type CollabStatus,
  type CollabMember,
  type CollabTask,
} from '../store/collabStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import type { SongProject } from '../store/songStore';
import { isLocalDevelopmentHost, LOCAL_COLLAB_GUEST } from '../utils/localEnvironment';
import {
  getCollabMemberColor,
  getCollabMemberInitial,
  isCollabMemberColor,
} from '../utils/collabMemberColor';
import './CollabPage.css';
import './CollabRoomPage.css';

const STATUS_OPTIONS: Array<{ key: CollabStatus; label: string }> = [
  { key: 'planning', label: '준비 중' },
  { key: 'working', label: '작업 중' },
  { key: 'feedback', label: '피드백' },
];

type RoomIconName = 'bolt' | 'bars' | 'chat' | 'clock' | 'exit' | 'link' | 'list' | 'music' | 'overview' | 'user' | 'users';

function RoomIcon({ name }: { name: RoomIconName }) {
  const paths: Record<RoomIconName, React.ReactNode> = {
    bolt: <path d="m13 2-8 12h6l-1 8 8-12h-6l1-8Z" />,
    bars: <><path d="M5 20V10M12 20V4M19 20v-7" /><path d="M3 20h18" /></>,
    chat: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 3v-3.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z" />,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v6l4 2" /></>,
    exit: <><path d="M14 8V5H5v14h9v-3" /><path d="M10 12h11m-4-4 4 4-4 4" /></>,
    link: <><path d="m10 13 4-4" /><path d="M8.5 16.5 6 19a4 4 0 0 1-6-6l3-3a4 4 0 0 1 5.5-.5" /><path d="M15.5 7.5 18 5a4 4 0 0 1 6 6l-3 3a4 4 0 0 1-5.5.5" /></>,
    list: <><path d="M9 6h12M9 12h12M9 18h12" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></>,
    music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    overview: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-5 3.4-7 8-7s7.2 2 8 7" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 6a3 3 0 0 1 0 6M17 14c2.5.5 3.8 2.3 4 5" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function formatDateTime(value: number) {
  return new Date(value).toLocaleString('ko-KR', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function getConnectionLabel(status: ReturnType<typeof useCollabStore.getState>['connectionStatus']) {
  if (status === 'connected') return '실시간 서버 연결됨';
  if (status === 'connecting') return '실시간 서버 연결 중';
  if (status === 'error') return '실시간 서버 연결 실패';
  return '실시간 서버 대기 중';
}

export default function CollabRoomPage() {
  const navigate = useNavigate();
  const { projectId: routeProjectId } = useParams<{ projectId: string }>();
  const projectId = routeProjectId;
  const authenticatedUser = useAuthStore((state) => state.user);
  const isLocalHost = isLocalDevelopmentHost();
  const user = authenticatedUser ?? (isLocalHost ? LOCAL_COLLAB_GUEST : null);
  const projects = useCollabStore((state) => state.projects);
  const messages = useCollabStore((state) => state.messages);
  const tasks = useCollabStore((state) => state.tasks);
  const composerHistoryByProject = useCollabStore((state) => state.composerHistoryByProject);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const joinProject = useCollabStore((state) => state.joinProject);
  const updateComposerSnapshot = useCollabStore((state) => state.updateComposerSnapshot);
  const setCollabMemberColor = useCollabStore((state) => state.setMemberColor);
  const addMessage = useCollabStore((state) => state.addMessage);
  const addTask = useCollabStore((state) => state.addTask);
  const toggleTask = useCollabStore((state) => state.toggleTask);
  const deleteTask = useCollabStore((state) => state.deleteTask);
  const updateProjectDetails = useCollabStore((state) => state.updateProjectDetails);
  const manageMember = useCollabStore((state) => state.manageMember);
  const deleteProject = useCollabStore((state) => state.deleteProject);
  const setStatus = useCollabStore((state) => state.setStatus);
  const presenceByProject = useCollabStore((state) => state.presenceByProject);
  const touchPresence = useCollabStore((state) => state.touchPresence);
  const leavePresence = useCollabStore((state) => state.leavePresence);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);

  const [messageDraft, setMessageDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const [roomError, setRoomError] = useState('');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [isJoiningLocalGuest, setIsJoiningLocalGuest] = useState(false);
  const [localGuestJoinFailed, setLocalGuestJoinFailed] = useState(false);
  const [isOpeningComposer, setIsOpeningComposer] = useState(false);
  const [openTaskMenuId, setOpenTaskMenuId] = useState<string | null>(null);
  const [taskDeleteTarget, setTaskDeleteTarget] = useState<CollabTask | 'completed' | null>(null);
  const [isDeletingTask, setIsDeletingTask] = useState(false);
  const [isProjectMenuOpen, setIsProjectMenuOpen] = useState(false);
  const [openMemberMenuEmail, setOpenMemberMenuEmail] = useState<string | null>(null);
  const [isRoomEditOpen, setIsRoomEditOpen] = useState(false);
  const [isRoomDeleteOpen, setIsRoomDeleteOpen] = useState(false);
  const [memberRemoveTarget, setMemberRemoveTarget] = useState<CollabMember | null>(null);
  const [isManagingRoom, setIsManagingRoom] = useState(false);
  const [roomEditForm, setRoomEditForm] = useState({ title: '', summary: '', genre: '', bpm: 120 });
  const messageListRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    void initializeRealtime().catch(console.error);
  }, [initializeRealtime]);

  useEffect(() => {
    void seedLibrary().catch(console.error);
  }, [seedLibrary]);

  const project = projects.find((item) => item.id === projectId) ?? null;
  const linkedProject = composerProjects.find((item) => item.id === project?.sourceProjectId) ?? null;

  const projectMessages = useMemo(
    () =>
      messages
        .filter((message) => message.projectId === projectId)
        .sort((left, right) => left.createdAt - right.createdAt),
    [messages, projectId]
  );

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      const messageList = messageListRef.current;
      if (!messageList) return;
      messageList.scrollTo({ top: messageList.scrollHeight, behavior: 'smooth' });
    });

    return () => window.cancelAnimationFrame(frame);
  }, [projectMessages]);

  const projectTasks = useMemo(
    () => tasks
      .filter((task) => task.projectId === projectId)
      .sort((left, right) => Number(left.completed) - Number(right.completed)),
    [tasks, projectId]
  );

  const projectHistory = useMemo(
    () => projectId ? (composerHistoryByProject[projectId] ?? []) : [],
    [composerHistoryByProject, projectId]
  );

  useEffect(() => {
    if (!isHistoryOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setIsHistoryOpen(false);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isHistoryOpen]);

  useEffect(() => {
    if (!openTaskMenuId) return;

    const closeTaskMenu = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.collab-task-menu-wrap')) return;
      setOpenTaskMenuId(null);
    };
    const closeTaskMenuWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpenTaskMenuId(null);
    };

    window.addEventListener('pointerdown', closeTaskMenu);
    window.addEventListener('keydown', closeTaskMenuWithEscape);
    return () => {
      window.removeEventListener('pointerdown', closeTaskMenu);
      window.removeEventListener('keydown', closeTaskMenuWithEscape);
    };
  }, [openTaskMenuId]);

  useEffect(() => {
    if (!isProjectMenuOpen && !openMemberMenuEmail) return;

    const closeManageMenus = (event: PointerEvent) => {
      const target = event.target;
      if (target instanceof Element && target.closest('.collab-room-manage-menu-wrap, .collab-member-menu-wrap')) return;
      setIsProjectMenuOpen(false);
      setOpenMemberMenuEmail(null);
    };
    const closeManageMenusWithEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsProjectMenuOpen(false);
        setOpenMemberMenuEmail(null);
      }
    };

    window.addEventListener('pointerdown', closeManageMenus);
    window.addEventListener('keydown', closeManageMenusWithEscape);
    return () => {
      window.removeEventListener('pointerdown', closeManageMenus);
      window.removeEventListener('keydown', closeManageMenusWithEscape);
    };
  }, [isProjectMenuOpen, openMemberMenuEmail]);

  const isMember = user ? project?.members.some((member) => member.email === user.email) ?? false : false;
  const isOwner = Boolean(
    user && project && project.ownerEmail.trim().toLowerCase() === user.email.trim().toLowerCase()
  );
  const currentMember = user
    ? project?.members.find((member) => member.email === user.email) ?? null
    : null;
  const canEdit = Boolean(currentMember && currentMember.role !== 'viewer');
  const memberColorStorageKey = projectId && user
    ? `collab-member-color:${projectId}:${user.email.toLowerCase()}`
    : null;
  const storedMemberColor = memberColorStorageKey
    ? window.localStorage.getItem(memberColorStorageKey)
    : null;
  const roomMemberColor = isCollabMemberColor(currentMember?.color)
    ? currentMember.color
    : isCollabMemberColor(storedMemberColor)
      ? storedMemberColor
      : getCollabMemberColor(`${projectId}:${user?.email ?? ''}`).accent;

  useEffect(() => {
    if (
      !projectId ||
      !project ||
      !isLocalHost ||
      !user ||
      isMember ||
      isJoiningLocalGuest ||
      localGuestJoinFailed
    ) return;

    setIsJoiningLocalGuest(true);
    void joinProject(projectId, user)
      .catch((error) => {
        console.error(error);
        setLocalGuestJoinFailed(true);
        setRoomError(error instanceof Error ? error.message : '로컬 작업실에 들어가지 못했습니다.');
      })
      .finally(() => setIsJoiningLocalGuest(false));
  }, [
    isJoiningLocalGuest,
    isLocalHost,
    isMember,
    joinProject,
    localGuestJoinFailed,
    project,
    projectId,
    user,
  ]);

  useEffect(() => {
    if (!projectId || !user || !currentMember) return;

    const storageKey = `collab-member-color:${projectId}:${user.email.toLowerCase()}`;
    window.localStorage.setItem(storageKey, roomMemberColor);

    if (currentMember.color !== roomMemberColor) {
      void setCollabMemberColor(projectId, user.email, roomMemberColor).catch(console.error);
    }
  }, [currentMember, projectId, roomMemberColor, setCollabMemberColor, user]);

  const activePresenceMembers = useMemo(() => {
    const entries = presenceByProject[projectId ?? ''] ?? [];
    const grouped = new Map<string, { name: string; color: string; lastSeenAt: number }>();

    entries
      .filter((presence) => presenceNow - presence.lastSeenAt <= COLLAB_PRESENCE_TIMEOUT_MS)
      .forEach((presence) => {
        const member = project?.members.find((item) => item.email === presence.email);
        const fallbackColor = getCollabMemberColor(
          `${projectId}:${member?.joinedAt ?? presence.lastSeenAt}:${presence.name}`
        ).accent;
        const previous = grouped.get(presence.email);
        if (previous && previous.lastSeenAt >= presence.lastSeenAt) return;
        grouped.set(presence.email, {
          name: presence.name,
          color: isCollabMemberColor(member?.color)
            ? member.color
            : isCollabMemberColor(presence.color)
              ? presence.color
              : fallbackColor,
          lastSeenAt: presence.lastSeenAt,
        });
      });

    return Array.from(grouped, ([email, presence]) => ({ email, ...presence }));
  }, [presenceByProject, presenceNow, project, projectId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceNow(Date.now());
    }, 4_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!projectId || !user || !isMember) return;

    const payload = { email: user.email, name: user.name, color: roomMemberColor };
    void touchPresence(projectId, payload).catch(console.error);

    const timer = window.setInterval(() => {
      void touchPresence(projectId, payload).catch(console.error);
    }, COLLAB_PRESENCE_PING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      void leavePresence(projectId).catch(console.error);
    };
  }, [isMember, leavePresence, projectId, roomMemberColor, touchPresence, user]);

  if (!project) {
    return (
      <div className="collab-room-page">
        <SiteHeader activeSection="collab" />
        <main className="collab-room-shell">
          <section className="collab-room-missing">
            <strong>작업실을 찾을 수 없습니다.</strong>
            <button type="button" className="collab-secondary-button" onClick={() => navigate('/collab')}>
              협업 목록으로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  if (isLocalHost && !isMember && !localGuestJoinFailed) {
    return (
      <div className="collab-room-page">
        <SiteHeader activeSection="collab" />
        <main className="collab-room-shell">
          <section className="collab-room-missing">
            <strong>로컬 작업실에 들어가는 중입니다.</strong>
          </section>
        </main>
      </div>
    );
  }

  if (!user || !isMember) {
    return (
      <div className="collab-room-page">
        <SiteHeader activeSection="collab" />
        <main className="collab-room-shell">
          <section className="collab-room-missing">
            <strong>승인된 멤버만 작업실에 들어갈 수 있습니다.</strong>
            <span>이 작업실은 승인된 멤버만 들어갈 수 있습니다.</span>
            {!user ? (
              <button type="button" className="collab-primary-button" onClick={() => navigate('/login')}>
                로그인하기
              </button>
            ) : null}
            <button type="button" className="collab-secondary-button" onClick={() => navigate('/collab')}>
              협업 목록으로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  const handleOpenComposer = async () => {
    if (!user || !canEdit || isOpeningComposer) return;

    const existingSnapshot = project.snapshot ?? linkedProject?.project;

    try {
      setIsOpeningComposer(true);
      setRoomError('');

      if (!existingSnapshot) {
        const initialSnapshot: SongProject = {
          version: 2,
          compositionMode: 'standard',
          timeSignature: { beats: 4, beatType: 4 },
          timeSignatureChanges: [{ bar: 0, beats: 4, beatType: 4 }],
          bpm: project.bpm,
          tempoAutomation: [],
          steps: project.steps,
          noteLyrics: {},
          barLyrics: [''],
          lyricsStartBar: 1,
          tracks: {
            melody: [],
            violin: [],
            saxophone: [],
            guitar: [],
            drums: [],
            bass: [],
          },
          extraTracks: [],
        };

        await updateComposerSnapshot(project.id, {
          snapshot: initialSnapshot,
          email: user.email,
          name: user.name,
          baseRevision: project.snapshotRevision,
        });
      }

      navigate(`/composer?collab=${project.id}`);
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '작곡 화면을 열지 못했습니다.');
    } finally {
      setIsOpeningComposer(false);
    }
  };

  const handleSendMessage = async () => {
    if (!user || !messageDraft.trim()) return;

    const content = messageDraft.trim();
    setMessageDraft('');
    try {
      setRoomError('');
      await addMessage(project.id, {
        email: user.email,
        name: user.name,
        color: roomMemberColor,
        content,
      });
    } catch (error) {
      console.error(error);
      setMessageDraft(content);
      setRoomError(error instanceof Error ? error.message : '코멘트를 남기지 못했습니다.');
    }
  };

  const handleAddTask = async () => {
    if (!user || !taskDraft.trim()) return;

    const content = taskDraft.trim();
    setTaskDraft('');
    try {
      setRoomError('');
      await addTask(project.id, {
        content,
        assigneeName: user.name,
      });
    } catch (error) {
      console.error(error);
      setTaskDraft(content);
      setRoomError(error instanceof Error ? error.message : '작업을 추가하지 못했습니다.');
    }
  };

  const handleDeleteTasks = async () => {
    if (!taskDeleteTarget || isDeletingTask) return;

    const targets = taskDeleteTarget === 'completed'
      ? projectTasks.filter((task) => task.completed)
      : [taskDeleteTarget];
    if (!targets.length) {
      setTaskDeleteTarget(null);
      return;
    }

    try {
      setIsDeletingTask(true);
      setRoomError('');
      for (const task of targets) {
        await deleteTask(project.id, task.id);
      }
      setTaskDeleteTarget(null);
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '작업을 삭제하지 못했습니다.');
    } finally {
      setIsDeletingTask(false);
    }
  };

  const openRoomEditDialog = () => {
    setIsProjectMenuOpen(false);
    setRoomEditForm({
      title: project.title,
      summary: project.summary,
      genre: project.genre,
      bpm: project.bpm,
    });
    setIsRoomEditOpen(true);
  };

  const handleSaveRoom = async () => {
    if (!user || !isOwner || !roomEditForm.title.trim()) return;
    try {
      setIsManagingRoom(true);
      setRoomError('');
      await updateProjectDetails(project.id, {
        userEmail: user.email,
        title: roomEditForm.title,
        summary: roomEditForm.summary,
        genre: roomEditForm.genre,
        bpm: roomEditForm.bpm,
      });
      setIsRoomEditOpen(false);
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '방 정보를 수정하지 못했습니다.');
    } finally {
      setIsManagingRoom(false);
    }
  };

  const handleDeleteRoom = async () => {
    if (!user || !isOwner) return;
    try {
      setIsManagingRoom(true);
      setRoomError('');
      await deleteProject(project.id, user.email);
      navigate('/collab');
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '방을 삭제하지 못했습니다.');
    } finally {
      setIsManagingRoom(false);
    }
  };

  const handleMemberRole = async (member: CollabMember, role: 'editor' | 'viewer') => {
    if (!user || !isOwner) return;
    try {
      setIsManagingRoom(true);
      setOpenMemberMenuEmail(null);
      setRoomError('');
      await manageMember(project.id, {
        userEmail: user.email,
        memberEmail: member.email,
        action: 'set-role',
        role,
      });
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '멤버 권한을 변경하지 못했습니다.');
    } finally {
      setIsManagingRoom(false);
    }
  };

  const handleRemoveMember = async () => {
    if (!user || !isOwner || !memberRemoveTarget) return;
    try {
      setIsManagingRoom(true);
      setRoomError('');
      await manageMember(project.id, {
        userEmail: user.email,
        memberEmail: memberRemoveTarget.email,
        action: 'remove',
      });
      setMemberRemoveTarget(null);
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '멤버를 강퇴하지 못했습니다.');
    } finally {
      setIsManagingRoom(false);
    }
  };

  return (
    <div className="collab-room-page">
      <SiteHeader activeSection="collab" />

      <main className="collab-room-shell">
        <section className="collab-room-layout">
          <div className="collab-room-main">
            <section className="collab-room-hero">
              <div className="collab-room-hero-copy">
                <span className="collab-room-eyebrow">PROJECT ROOM</span>
                <div className="collab-room-title-row"><h1>{project.title}</h1></div>
                <p>{project.summary || '멤버들과 함께 좋은 곡을 만들어보세요.'}</p>
                <div className="collab-connection-row">
                  <span className={`collab-connection-chip is-${connectionStatus}`}>
                    <i aria-hidden="true" /> {getConnectionLabel(connectionStatus)}
                  </span>
                  {connectionError || roomError ? <small>{roomError || connectionError}</small> : null}
                </div>
              </div>

              <div className="collab-room-hero-tools">
                {isOwner ? (
                  <div className="collab-room-manage-menu-wrap">
                    <button
                      type="button"
                      className="collab-hero-menu"
                      aria-label="방 관리 메뉴"
                      aria-haspopup="menu"
                      aria-expanded={isProjectMenuOpen}
                      onClick={() => setIsProjectMenuOpen((open) => !open)}
                    >
                      •••
                    </button>
                    {isProjectMenuOpen ? (
                      <div className="collab-room-manage-menu" role="menu">
                        <button type="button" role="menuitem" onClick={openRoomEditDialog}>방 정보 수정</button>
                        <button
                          type="button"
                          role="menuitem"
                          className="is-danger"
                          onClick={() => {
                            setIsProjectMenuOpen(false);
                            setIsRoomDeleteOpen(true);
                          }}
                        >
                          방 삭제
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
                <span className="collab-room-music-mark" aria-hidden="true">♫</span>
                <div className="collab-room-status-group" aria-label="프로젝트 상태">
                  {STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`collab-status-button${project.status === option.key ? ' is-active' : ''}`}
                      onClick={() => {
                        void setStatus(project.id, option.key).catch((error) => {
                          console.error(error);
                          setRoomError(error instanceof Error ? error.message : '상태를 바꾸지 못했습니다.');
                        });
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>
              </div>
            </section>

            <article className="collab-room-panel collab-overview-panel">
              <div className="collab-room-panel-head">
                <strong><i className="collab-section-icon"><RoomIcon name="overview" /></i> 프로젝트 개요</strong>
              </div>

              <div className="collab-room-summary-grid">
                <div className="collab-room-summary-card">
                  <i className="collab-summary-icon"><RoomIcon name="user" /></i>
                  <span>오너</span>
                  <strong>{project.ownerName}</strong>
                </div>
                <div className="collab-room-summary-card">
                  <i className="collab-summary-icon"><RoomIcon name="users" /></i>
                  <span>멤버</span>
                  <strong>{project.members.length}명</strong>
                </div>
                <div className="collab-room-summary-card">
                  <i className="collab-summary-icon"><RoomIcon name="bars" /></i>
                  <span>최근 수정</span>
                  <strong>{formatDateTime(project.updatedAt)}</strong>
                </div>
                <div className="collab-room-summary-card">
                  <i className="collab-summary-icon"><RoomIcon name="link" /></i>
                  <span>연결 프로젝트</span>
                  <strong>{linkedProject?.title ?? '스냅샷 작업'}</strong>
                </div>
              </div>
            </article>

            <article className="collab-room-panel">
              <div className="collab-room-panel-head collab-checklist-head">
                <div>
                  <strong><i className="collab-section-icon" aria-hidden="true">✓</i> 작업 체크리스트</strong>
                  <span>해야 할 일을 정리하고 완료된 작업을 바로 체크하세요.</span>
                </div>
                <div className="collab-task-menu-wrap">
                  <button
                    type="button"
                    className="collab-item-menu"
                    aria-label="체크리스트 메뉴"
                    aria-haspopup="menu"
                    aria-expanded={openTaskMenuId === 'checklist'}
                    onClick={() => setOpenTaskMenuId((current) => current === 'checklist' ? null : 'checklist')}
                  >
                    ⋮
                  </button>
                  {openTaskMenuId === 'checklist' ? (
                    <div className="collab-task-menu" role="menu">
                      <button
                        type="button"
                        role="menuitem"
                        className="is-danger"
                        disabled={!projectTasks.some((task) => task.completed)}
                        onClick={() => {
                          setOpenTaskMenuId(null);
                          setTaskDeleteTarget('completed');
                        }}
                      >
                        완료 작업 삭제
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="collab-room-task-list">
                {projectTasks.length ? (
                  projectTasks.map((task) => (
                    <div key={task.id} className={`collab-task-card${task.completed ? ' is-done' : ''}${openTaskMenuId === task.id ? ' is-menu-open' : ''}`}>
                      <input
                        type="checkbox"
                        aria-label={`${task.content} 완료 상태`}
                        checked={task.completed}
                        onChange={() => {
                          void toggleTask(project.id, task.id).catch((error) => {
                            console.error(error);
                            setRoomError(error instanceof Error ? error.message : '작업 상태를 바꾸지 못했습니다.');
                          });
                        }}
                        disabled={!canEdit}
                      />
                      <div>
                        <strong>{task.content}</strong>
                        <span>{task.assigneeName}</span>
                      </div>
                      <div className="collab-task-menu-wrap">
                        <button
                          type="button"
                          className="collab-item-menu"
                          aria-label={`${task.content} 메뉴`}
                          aria-haspopup="menu"
                          aria-expanded={openTaskMenuId === task.id}
                          onClick={() => setOpenTaskMenuId((current) => current === task.id ? null : task.id)}
                        >
                          ⋮
                        </button>
                        {openTaskMenuId === task.id ? (
                          <div className="collab-task-menu" role="menu">
                            <button
                              type="button"
                              role="menuitem"
                              className="is-danger"
                              onClick={() => {
                                setOpenTaskMenuId(null);
                                setTaskDeleteTarget(task);
                              }}
                            >
                              작업 삭제
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="collab-room-empty">아직 등록된 작업이 없습니다.</div>
                )}
              </div>

              <div className="collab-room-form collab-task-form">
                <input
                  value={taskDraft}
                  onChange={(event) => setTaskDraft(event.target.value)}
                  placeholder={canEdit ? '새 작업을 입력하세요' : '참여 후 작업을 추가할 수 있어요'}
                  disabled={!canEdit}
                />
                <button type="button" className="collab-primary-button" onClick={handleAddTask} disabled={!canEdit}>
                  작업 추가
                </button>
              </div>
            </article>

            <article className="collab-room-panel">
              <div className="collab-room-panel-head">
                <strong><i className="collab-section-icon is-round"><RoomIcon name="chat" /></i> 팀 채팅 / 코멘트</strong>
              </div>

              <div ref={messageListRef} className="collab-room-message-list">
                {projectMessages.length ? (
                  projectMessages.map((message) => (
                    <article key={message.id} className="collab-message-card">
                      <div className="collab-message-meta">
                        <strong>{message.authorName}</strong>
                        <span>{formatDateTime(message.createdAt)}</span>
                      </div>
                      <p>{message.content}</p>
                    </article>
                  ))
                ) : (
                  <div className="collab-room-empty collab-comment-empty">
                    <i aria-hidden="true"><RoomIcon name="chat" /></i>
                    <span><strong>아직 남겨진 코멘트가 없습니다.</strong><small>첫 번째 코멘트를 남겨보세요!</small></span>
                  </div>
                )}
              </div>

              <div className="collab-room-form collab-comment-form">
                <textarea
                  value={messageDraft}
                  onChange={(event) => setMessageDraft(event.target.value)}
                  placeholder={canEdit ? '수정 방향이나 피드백을 남겨보세요.' : '참여 후 코멘트를 남길 수 있어요'}
                  rows={2}
                  disabled={!canEdit}
                />
                <button type="button" className="collab-primary-button" onClick={handleSendMessage} disabled={!canEdit}>
                  코멘트 남기기
                </button>
              </div>
            </article>

          </div>

          <aside className="collab-room-side">
            <article className="collab-room-panel">
              <div className="collab-room-panel-head collab-member-head">
                <strong><i className="collab-heading-glyph"><RoomIcon name="users" /></i> 참여 멤버 <b>{project.members.length}</b></strong>
                <button type="button" className="collab-invite-button" onClick={() => navigate('/messages')}>+ 멤버 초대</button>
              </div>

              <div className="collab-member-list">
                {project.members.map((member) => {
                  const isOnline = activePresenceMembers.some((activeMember) => activeMember.email === member.email);
                  const fallbackColor = getCollabMemberColor(
                    `${project.id}:${member.joinedAt}:${member.name}`
                  ).accent;
                  const activeMemberColor = activePresenceMembers.find(
                    (activeMember) => activeMember.email === member.email
                  )?.color;
                  const memberColor = isCollabMemberColor(member.color)
                    ? member.color
                    : isCollabMemberColor(activeMemberColor)
                      ? activeMemberColor
                      : fallbackColor;
                  return (
                    <div
                      key={`${project.id}-${member.email}`}
                      className="collab-member-card"
                      style={{
                        '--member-color': memberColor,
                        '--member-soft': `color-mix(in srgb, ${memberColor} 16%, #ffffff)`,
                        '--member-ink': memberColor,
                      } as CSSProperties}
                    >
                      <span className="collab-member-avatar has-initial">
                        {getCollabMemberInitial(member.name)}
                      </span>
                      <div>
                        <strong>{member.name}{member.role === 'owner' ? <span className="collab-owner-mark" aria-label="프로젝트 소유자">♛</span> : null}</strong>
                        <span>{member.role}</span>
                      </div>
                      <em className={isOnline ? 'is-online' : 'is-offline'}>{isOnline ? '온라인' : '오프라인'}</em>
                      {isOwner && member.role !== 'owner' ? (
                        <div className="collab-member-menu-wrap">
                          <button
                            type="button"
                            className="collab-item-menu"
                            aria-label={`${member.name} 관리 메뉴`}
                            aria-haspopup="menu"
                            aria-expanded={openMemberMenuEmail === member.email}
                            onClick={() => setOpenMemberMenuEmail((email) => email === member.email ? null : member.email)}
                          >
                            ⋮
                          </button>
                          {openMemberMenuEmail === member.email ? (
                            <div className="collab-member-menu" role="menu">
                              <button type="button" role="menuitem" onClick={() => void handleMemberRole(member, 'editor')}>편집 권한</button>
                              <button type="button" role="menuitem" onClick={() => void handleMemberRole(member, 'viewer')}>보기 전용</button>
                              <button
                                type="button"
                                role="menuitem"
                                className="is-danger"
                                onClick={() => {
                                  setOpenMemberMenuEmail(null);
                                  setMemberRemoveTarget(member);
                                }}
                              >
                                멤버 강퇴
                              </button>
                            </div>
                          ) : null}
                        </div>
                      ) : <span />}
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="collab-room-panel">
              <div className="collab-room-panel-head"><strong><i className="collab-heading-glyph"><RoomIcon name="bolt" /></i> 빠른 액션</strong></div>

              <div className="collab-room-side-actions">
                <button
                  type="button"
                  className="collab-primary-button collab-composer-button"
                  onClick={() => void handleOpenComposer()}
                  disabled={!canEdit || isOpeningComposer}
                >
                  <RoomIcon name="music" /> {isOpeningComposer ? '작곡 화면 여는 중' : '작곡 화면 열기'}
                </button>

                <button type="button" className="collab-secondary-button" onClick={() => navigate('/collab')}>
                  <RoomIcon name="list" /> 협업 목록으로
                </button>

                <button type="button" className="collab-leave-button" onClick={() => navigate('/collab')}><RoomIcon name="exit" /> 나가기</button>
              </div>
            </article>

            <article className="collab-room-panel collab-history-panel">
              <div className="collab-room-panel-head">
                <strong><i className="collab-heading-glyph is-clock"><RoomIcon name="clock" /></i> 작업 히스토리</strong>
                <button
                  type="button"
                  className="collab-history-more"
                  onClick={() => setIsHistoryOpen(true)}
                  aria-haspopup="dialog"
                >
                  전체보기
                </button>
              </div>

              <div className="collab-history-list">
                {projectHistory.length ? (
                  projectHistory.slice(0, 5).map((entry) => (
                    <article key={entry.id} className="collab-history-card">
                      <i aria-hidden="true" />
                      <div>
                        <strong>{entry.summary}</strong>
                        <span>{`${entry.authorName} · ${formatDateTime(entry.createdAt)}`}</span>
                      </div>
                      <em>{entry.instrument}</em>
                    </article>
                  ))
                ) : (
                  <div className="collab-room-empty">아직 저장된 작업 히스토리가 없습니다.</div>
                )}
              </div>
            </article>
          </aside>
        </section>
      </main>

      {isRoomEditOpen ? (
        <div className="collab-manage-overlay" role="presentation" onMouseDown={() => !isManagingRoom && setIsRoomEditOpen(false)}>
          <section
            className="collab-manage-dialog collab-room-edit-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collab-room-edit-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <strong id="collab-room-edit-title">방 정보 수정</strong>
              <p>협업방에 표시되는 기본 정보를 변경합니다.</p>
            </div>
            <div className="collab-room-edit-form">
              <label>
                <span>방 이름</span>
                <input
                  value={roomEditForm.title}
                  maxLength={60}
                  onChange={(event) => setRoomEditForm((form) => ({ ...form, title: event.target.value }))}
                />
              </label>
              <label>
                <span>설명</span>
                <textarea
                  value={roomEditForm.summary}
                  maxLength={180}
                  onChange={(event) => setRoomEditForm((form) => ({ ...form, summary: event.target.value }))}
                />
              </label>
              <div>
                <label>
                  <span>장르</span>
                  <input
                    value={roomEditForm.genre}
                    onChange={(event) => setRoomEditForm((form) => ({ ...form, genre: event.target.value }))}
                  />
                </label>
                <label>
                  <span>BPM</span>
                  <input
                    type="number"
                    min={40}
                    max={240}
                    value={roomEditForm.bpm}
                    onChange={(event) => setRoomEditForm((form) => ({ ...form, bpm: Number(event.target.value) }))}
                  />
                </label>
              </div>
            </div>
            <div className="collab-manage-actions">
              <button type="button" onClick={() => setIsRoomEditOpen(false)} disabled={isManagingRoom}>취소</button>
              <button type="button" className="is-primary" onClick={() => void handleSaveRoom()} disabled={isManagingRoom || !roomEditForm.title.trim()}>
                {isManagingRoom ? '저장 중...' : '저장'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isRoomDeleteOpen ? (
        <div className="collab-manage-overlay" role="presentation" onMouseDown={() => !isManagingRoom && setIsRoomDeleteOpen(false)}>
          <section className="collab-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="collab-room-delete-title" onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <strong id="collab-room-delete-title">협업방을 삭제할까요?</strong>
              <p><b>{project.title}</b>의 작업, 채팅, 체크리스트와 기록이 모두 삭제됩니다.</p>
            </div>
            <div className="collab-manage-actions">
              <button type="button" onClick={() => setIsRoomDeleteOpen(false)} disabled={isManagingRoom}>취소</button>
              <button type="button" className="is-danger" onClick={() => void handleDeleteRoom()} disabled={isManagingRoom}>
                {isManagingRoom ? '삭제 중...' : '방 삭제'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {memberRemoveTarget ? (
        <div className="collab-manage-overlay" role="presentation" onMouseDown={() => !isManagingRoom && setMemberRemoveTarget(null)}>
          <section className="collab-manage-dialog" role="dialog" aria-modal="true" aria-labelledby="collab-member-remove-title" onMouseDown={(event) => event.stopPropagation()}>
            <div>
              <strong id="collab-member-remove-title">멤버를 강퇴할까요?</strong>
              <p><b>{memberRemoveTarget.name}</b>님은 이 협업방에 더 이상 접근할 수 없습니다.</p>
            </div>
            <div className="collab-manage-actions">
              <button type="button" onClick={() => setMemberRemoveTarget(null)} disabled={isManagingRoom}>취소</button>
              <button type="button" className="is-danger" onClick={() => void handleRemoveMember()} disabled={isManagingRoom}>
                {isManagingRoom ? '처리 중...' : '강퇴'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {taskDeleteTarget ? (
        <div
          className="collab-manage-overlay"
          role="presentation"
          onMouseDown={() => !isDeletingTask && setTaskDeleteTarget(null)}
        >
          <section
            className="collab-manage-dialog"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collab-task-delete-title"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div>
              <strong id="collab-task-delete-title">
                {taskDeleteTarget === 'completed' ? '완료한 작업을 모두 삭제할까요?' : '작업을 삭제할까요?'}
              </strong>
              <p>
                {taskDeleteTarget === 'completed'
                  ? `완료한 작업 ${projectTasks.filter((task) => task.completed).length}개가 삭제됩니다.`
                  : `“${taskDeleteTarget.content}” 작업이 삭제됩니다.`}
              </p>
            </div>
            <div className="collab-manage-actions">
              <button type="button" onClick={() => setTaskDeleteTarget(null)} disabled={isDeletingTask}>취소</button>
              <button type="button" className="is-danger" onClick={() => void handleDeleteTasks()} disabled={isDeletingTask}>
                {isDeletingTask ? '삭제 중...' : '삭제'}
              </button>
            </div>
          </section>
        </div>
      ) : null}

      {isHistoryOpen ? (
        <div
          className="collab-history-modal-backdrop"
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) setIsHistoryOpen(false);
          }}
        >
          <section
            className="collab-history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="collab-history-modal-title"
          >
            <header className="collab-history-modal-head">
              <div>
                <h2 id="collab-history-modal-title">작업 히스토리</h2>
                <p>전체 {projectHistory.length}개의 작업 기록</p>
              </div>
              <button
                type="button"
                className="collab-history-modal-close"
                onClick={() => setIsHistoryOpen(false)}
                aria-label="작업 히스토리 닫기"
              >
                ×
              </button>
            </header>

            <div className="collab-history-modal-list">
              {projectHistory.length ? (
                projectHistory.map((entry) => (
                  <article key={entry.id} className="collab-history-card">
                    <i aria-hidden="true" />
                    <div>
                      <strong>{entry.summary}</strong>
                      <span>{`${entry.authorName} · ${formatDateTime(entry.createdAt)}`}</span>
                    </div>
                    <em>{entry.instrument}</em>
                  </article>
                ))
              ) : (
                <div className="collab-room-empty">아직 저장된 작업 히스토리가 없습니다.</div>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </div>
  );
}
