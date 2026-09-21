import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import {
  COLLAB_PRESENCE_PING_INTERVAL_MS,
  COLLAB_PRESENCE_TIMEOUT_MS,
  useCollabStore,
  type CollabStatus,
} from '../store/collabStore';
import { useComposerLibraryStore } from '../store/composerLibraryStore';
import { useSongStore } from '../store/songStore';
import { getRecruitUrlFromSketch } from '../utils/songSketchDna';
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
  const user = useAuthStore((state) => state.user);
  const projects = useCollabStore((state) => state.projects);
  const messages = useCollabStore((state) => state.messages);
  const tasks = useCollabStore((state) => state.tasks);
  const composerHistoryByProject = useCollabStore((state) => state.composerHistoryByProject);
  const connectionStatus = useCollabStore((state) => state.connectionStatus);
  const connectionError = useCollabStore((state) => state.connectionError);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const joinProject = useCollabStore((state) => state.joinProject);
  const addMessage = useCollabStore((state) => state.addMessage);
  const addTask = useCollabStore((state) => state.addTask);
  const toggleTask = useCollabStore((state) => state.toggleTask);
  const setStatus = useCollabStore((state) => state.setStatus);
  const presenceByProject = useCollabStore((state) => state.presenceByProject);
  const touchPresence = useCollabStore((state) => state.touchPresence);
  const leavePresence = useCollabStore((state) => state.leavePresence);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const loadProject = useSongStore((state) => state.loadProject);

  const [messageDraft, setMessageDraft] = useState('');
  const [taskDraft, setTaskDraft] = useState('');
  const [presenceNow, setPresenceNow] = useState(() => Date.now());
  const [roomError, setRoomError] = useState('');

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
        .sort((left, right) => right.createdAt - left.createdAt),
    [messages, projectId]
  );

  const projectTasks = useMemo(
    () => tasks
      .filter((task) => task.projectId === projectId)
      .sort((left, right) => Number(left.completed) - Number(right.completed)),
    [tasks, projectId]
  );

  const projectHistory = useMemo(
    () => projectId ? (composerHistoryByProject[projectId] ?? []).slice(0, 8) : [],
    [composerHistoryByProject, projectId]
  );

  const isMember = user ? project?.members.some((member) => member.email === user.email) ?? false : false;
  const canEdit = isMember;

  const activePresenceMembers = useMemo(() => {
    const entries = presenceByProject[projectId ?? ''] ?? [];
    const grouped = new Map<string, string>();

    entries
      .filter((presence) => presenceNow - presence.lastSeenAt <= COLLAB_PRESENCE_TIMEOUT_MS)
      .forEach((presence) => {
        grouped.set(presence.email, presence.name);
      });

    return Array.from(grouped, ([email, name]) => ({ email, name }));
  }, [presenceByProject, presenceNow, projectId]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setPresenceNow(Date.now());
    }, 4_000);

    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!projectId || !user || !isMember) return;

    const payload = { email: user.email, name: user.name };
    void touchPresence(projectId, payload).catch(console.error);

    const timer = window.setInterval(() => {
      void touchPresence(projectId, payload).catch(console.error);
    }, COLLAB_PRESENCE_PING_INTERVAL_MS);

    return () => {
      window.clearInterval(timer);
      void leavePresence(projectId).catch(console.error);
    };
  }, [isMember, leavePresence, projectId, touchPresence, user]);

  if (!project) {
    return (
      <div className="collab-room-page">
        <SiteHeader activeSection="collab" />
        <main className="collab-room-shell">
          <section className="collab-room-missing">
            <strong>협업 작업실을 찾을 수 없습니다.</strong>
            <button type="button" className="collab-secondary-button" onClick={() => navigate('/collab')}>
              협업 목록으로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  const handleJoin = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setRoomError('');
      await joinProject(project.id, { email: user.email, name: user.name });
    } catch (error) {
      console.error(error);
      setRoomError(error instanceof Error ? error.message : '협업 참여에 실패했습니다.');
    }
  };

  const handleOpenComposer = () => {
    const snapshot = project.snapshot ?? linkedProject?.project;
    if (!snapshot) return;

    loadProject(snapshot);
    navigate(`/composer?collab=${project.id}`);
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
                <button type="button" className="collab-hero-menu" aria-label="프로젝트 메뉴">•••</button>
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
                <button type="button" className="collab-item-menu" aria-label="체크리스트 메뉴">⋮</button>
              </div>

              <div className="collab-room-task-list">
                {projectTasks.length ? (
                  projectTasks.map((task) => (
                    <div key={task.id} className={`collab-task-card${task.completed ? ' is-done' : ''}`}>
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
                      <button type="button" className="collab-item-menu" aria-label={`${task.content} 메뉴`}>⋮</button>
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

              <div className="collab-room-message-list">
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
                  return (
                    <div key={`${project.id}-${member.email}`} className="collab-member-card">
                      <span className="collab-member-avatar"><RoomIcon name="user" /></span>
                      <div>
                        <strong>{member.name}{member.role === 'owner' ? <span className="collab-owner-mark" aria-label="프로젝트 소유자">♛</span> : null}</strong>
                        <span>{member.role}</span>
                      </div>
                      <em className={isOnline ? 'is-online' : 'is-offline'}>{isOnline ? '온라인' : '오프라인'}</em>
                      <button type="button" className="collab-item-menu" aria-label={`${member.name} 메뉴`}>⋮</button>
                    </div>
                  );
                })}
              </div>
            </article>

            <article className="collab-room-panel">
              <div className="collab-room-panel-head"><strong><i className="collab-heading-glyph"><RoomIcon name="bolt" /></i> 빠른 액션</strong></div>

              <div className="collab-room-side-actions">
                {!isMember ? (
                  <button type="button" className="collab-primary-button" onClick={handleJoin}>
                    협업 참여하기
                  </button>
                ) : null}

                <button
                  type="button"
                  className="collab-primary-button collab-composer-button"
                  onClick={handleOpenComposer}
                  disabled={!linkedProject && !project.snapshot}
                >
                  <RoomIcon name="music" /> 작곡 화면 열기
                </button>

                <button type="button" className="collab-secondary-button" onClick={() => navigate('/collab')}>
                  <RoomIcon name="list" /> 협업 목록으로
                </button>

                <button
                  type="button"
                  className="collab-secondary-button"
                  onClick={() => navigate(getRecruitUrlFromSketch(project.title, project.genre, 'vocal,guitar,drums,bass'))}
                >
                  <RoomIcon name="users" /> 파트 모집 자동 연결
                </button>

                <button type="button" className="collab-leave-button" onClick={() => navigate('/collab')}><RoomIcon name="exit" /> 나가기</button>
              </div>
            </article>

            <article className="collab-room-panel collab-history-panel">
              <div className="collab-room-panel-head">
                <strong><i className="collab-heading-glyph is-clock"><RoomIcon name="clock" /></i> 작업 히스토리</strong>
                <button type="button" className="collab-history-more">전체보기</button>
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
    </div>
  );
}
