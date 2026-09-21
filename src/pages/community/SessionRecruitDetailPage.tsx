import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useCollabStore } from '../../store/collabStore';
import { useComposerLibraryStore } from '../../store/composerLibraryStore';
import { useNotificationStore } from '../../store/notificationStore';
import { useSessionRecruitStore } from '../../store/sessionRecruitStore';
import type { SessionRole, SessionStatus } from '../../types/sessionRecruit';
import { DEMO_SESSION_ID, DEMO_SESSION_POST } from '../../utils/demoPreviewData';
import './SessionRecruitDetailPage.css';

const ROLE_LABELS: Record<SessionRole, string> = {
  vocal: '보컬',
  guitar: '기타',
  bass: '베이스',
  drums: '드럼',
  keys: '건반',
  producer: '프로듀서',
  mix: '믹스/레코딩',
};

const STATUS_LABELS: Record<SessionStatus, string> = {
  open: '모집중',
  closing: '마감 임박',
  closed: '모집 완료',
};

type DetailIconName =
  | 'arrow'
  | 'calendar'
  | 'file'
  | 'location'
  | 'message'
  | 'music'
  | 'parts'
  | 'send'
  | 'tag'
  | 'user'
  | 'users';

function DetailIcon({ name }: { name: DetailIconName }) {
  const paths: Record<DetailIconName, React.ReactNode> = {
    arrow: <><path d="M19 12H5" /><path d="m11 18-6-6 6-6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    file: <><path d="M6 2h8l4 4v16H6z" /><path d="M14 2v5h5M9 12h6M9 16h6" /></>,
    location: <><path d="M20 10c0 5-8 12-8 12S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    message: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 3v-3.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z" />,
    music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    parts: <><path d="M4 7h9M17 7h3M4 17h3M11 17h9" /><circle cx="15" cy="7" r="2" /><circle cx="9" cy="17" r="2" /></>,
    send: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    tag: <path d="M20 13 12 21 3 12V3h9l8 8a1.5 1.5 0 0 1 0 2Z" />,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-5 3.4-7 8-7s7.2 2 8 7" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 6a3 3 0 0 1 0 6M17 14c2.5.5 3.8 2.3 4 5" /></>,
  };

  return <svg viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

const DETAIL_PARTS: Array<{
  key: string;
  role?: SessionRole;
  label: string;
  description: string;
  icon: DetailIconName;
}> = [
  { key: 'producer', role: 'producer', label: '프로듀서', description: '곡 전체 기획', icon: 'user' },
  { key: 'guitar', role: 'guitar', label: '작곡', description: '멜로디/코드', icon: 'music' },
  { key: 'keys', role: 'keys', label: '편곡', description: '사운드 배치', icon: 'parts' },
  { key: 'vocal', role: 'vocal', label: '보컬', description: '가이드/녹음', icon: 'message' },
  { key: 'mix', role: 'mix', label: '믹싱', description: '음향 편집', icon: 'parts' },
  { key: 'master', label: '마스터링', description: '최종 음원', icon: 'music' },
  { key: 'video', label: '영상', description: '뮤직비디오', icon: 'file' },
  { key: 'other', label: '기타', description: '직접 입력', icon: 'parts' },
];

function formatDate(timestamp: number) {
  return new Date(timestamp).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

export default function SessionRecruitDetailPage() {
  const { postId } = useParams<{ postId: string }>();
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const posts = useSessionRecruitStore((state) => state.posts);
  const bootstrapStatus = useSessionRecruitStore((state) => state.bootstrapStatus);
  const bootstrapError = useSessionRecruitStore((state) => state.bootstrapError);
  const seedSessionRecruit = useSessionRecruitStore((state) => state.seedSessionRecruit);
  const applyPost = useSessionRecruitStore((state) => state.applyPost);
  const reviewApplication = useSessionRecruitStore((state) => state.reviewApplication);
  const linkCollabProject = useSessionRecruitStore((state) => state.linkCollabProject);
  const setRecruitStatus = useSessionRecruitStore((state) => state.setRecruitStatus);
  const composerProjects = useComposerLibraryStore((state) => state.projects);
  const seedLibrary = useComposerLibraryStore((state) => state.seedLibrary);
  const collabProjects = useCollabStore((state) => state.projects);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);
  const createFromComposerProject = useCollabStore((state) => state.createFromComposerProject);
  const joinProject = useCollabStore((state) => state.joinProject);
  const pushNotification = useNotificationStore((state) => state.pushNotification);
  const [applicationRole, setApplicationRole] = useState<SessionRole>('vocal');
  const [applicationMessage, setApplicationMessage] = useState('');
  const [applicationError, setApplicationError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const [reviewingApplicantId, setReviewingApplicantId] = useState<string | null>(null);
  const [selectedSourceProjectId, setSelectedSourceProjectId] = useState('');
  const [isCreatingCollab, setIsCreatingCollab] = useState(false);
  const [isChangingStatus, setIsChangingStatus] = useState(false);

  useEffect(() => {
    void seedSessionRecruit().catch((error) => {
      console.error(error);
    });
  }, [seedSessionRecruit]);

  useEffect(() => {
    void seedLibrary().catch((error) => {
      console.error(error);
    });
    void initializeRealtime().catch((error) => {
      console.error(error);
    });
  }, [initializeRealtime, seedLibrary]);

  const post = postId === DEMO_SESSION_ID
    ? DEMO_SESSION_POST
    : posts.find((item) => item.id === postId) ?? null;
  const applicants = post?.applicants ?? [];
  const isOwner = Boolean(user && post?.hostEmail === user.email);
  const linkedCollabProject = post?.collabProjectId
    ? collabProjects.find((project) => project.id === post.collabProjectId) ?? null
    : null;
  const ownerComposerProjects = user
    ? composerProjects.filter((project) => project.creatorEmail === user.email)
    : [];
  const myApplication = user
    ? applicants.find((applicant) => applicant.email === user.email && applicant.status !== 'rejected')
    : null;
  const pendingApplicants = useMemo(
    () => applicants.filter((applicant) => applicant.status === 'pending'),
    [applicants]
  );
  const reviewedApplicants = useMemo(
    () => applicants.filter((applicant) => applicant.status !== 'pending'),
    [applicants]
  );

  useEffect(() => {
    if (post?.wantedRoles.length && !post.wantedRoles.includes(applicationRole)) {
      setApplicationRole(post.wantedRoles[0]);
    }
  }, [applicationRole, post]);

  useEffect(() => {
    if (!selectedSourceProjectId && ownerComposerProjects.length) {
      setSelectedSourceProjectId(ownerComposerProjects[0].id);
    }
  }, [ownerComposerProjects, selectedSourceProjectId]);

  const handleMoveWithAuth = (route: string) => {
    navigate(user ? route : '/login');
  };

  const handleApply = async () => {
    if (!post) {
      return;
    }

    if (!user) {
      navigate('/login');
      return;
    }

    try {
      setIsApplying(true);
      setApplicationError('');
      await applyPost({
        postId: post.id,
        email: user.email,
        name: user.name,
        role: applicationRole,
        message: applicationMessage.trim(),
      });
      pushNotification({
        kind: 'collab',
        title: '모집글 지원 완료',
        body: `${post.title}에 ${ROLE_LABELS[applicationRole]} 파트로 지원했습니다.`,
        route: `/community/sessions/${post.id}`,
        actorName: user.name,
      });
      setApplicationMessage('');
    } catch (error) {
      console.error(error);
      setApplicationError(error instanceof Error ? error.message : '지원하지 못했습니다.');
    } finally {
      setIsApplying(false);
    }
  };

  const handleReview = async (applicantId: string, status: 'approved' | 'rejected') => {
    if (!post || !user) {
      return;
    }

    try {
      setReviewingApplicantId(applicantId);
      setApplicationError('');
      await reviewApplication({
        postId: post.id,
        applicantId,
        userEmail: user.email,
        status,
      });

      const applicant = applicants.find((item) => item.id === applicantId);

      if (status === 'approved' && applicant && post.collabProjectId) {
        await joinProject(post.collabProjectId, {
          email: applicant.email,
          name: applicant.name,
        });
      }

      pushNotification({
        kind: 'collab',
        title: status === 'approved' ? '지원자를 승인했습니다' : '지원자를 거절했습니다',
        body: applicant
          ? `${applicant.name}님의 ${ROLE_LABELS[applicant.role]} 지원을 ${
              status === 'approved' ? '승인' : '거절'
            }했습니다.`
          : '지원자 상태를 변경했습니다.',
        route: `/community/sessions/${post.id}`,
        actorName: user.name,
      });
    } catch (error) {
      console.error(error);
      setApplicationError(
        error instanceof Error ? error.message : '지원자 상태를 바꾸지 못했습니다.'
      );
    } finally {
      setReviewingApplicantId(null);
    }
  };

  const handleCreateCollabProject = async () => {
    if (!post || !user) {
      navigate('/login');
      return;
    }

    if (!selectedSourceProjectId) {
      setApplicationError('연결할 저장곡을 먼저 선택해주세요.');
      return;
    }

    const sourceProject = ownerComposerProjects.find((project) => project.id === selectedSourceProjectId);

    if (!sourceProject) {
      setApplicationError('선택한 저장곡을 찾을 수 없습니다.');
      return;
    }

    try {
      setIsCreatingCollab(true);
      setApplicationError('');
      const collabProjectId = await createFromComposerProject({
        sourceProjectId: sourceProject.id,
        title: post.title,
        summary: post.summary,
        genre: post.genre || sourceProject.genre,
        bpm: sourceProject.bpm,
        steps: sourceProject.steps,
        ownerEmail: user.email,
        ownerName: user.name,
        snapshot: sourceProject.project,
      });
      await linkCollabProject({
        postId: post.id,
        userEmail: user.email,
        collabProjectId,
      });
      pushNotification({
        kind: 'collab',
        title: '모집글에 협업 작업실을 연결했습니다',
        body: `${post.title}에서 바로 작업실로 이동할 수 있습니다.`,
        route: `/collab/${collabProjectId}`,
        actorName: user.name,
      });
    } catch (error) {
      console.error(error);
      setApplicationError(
        error instanceof Error ? error.message : '협업 작업실을 만들지 못했습니다.'
      );
    } finally {
      setIsCreatingCollab(false);
    }
  };

  const handleSetRecruitStatus = async (status: SessionStatus) => {
    if (!post || !user) {
      return;
    }

    try {
      setIsChangingStatus(true);
      setApplicationError('');
      await setRecruitStatus({
        postId: post.id,
        userEmail: user.email,
        status,
      });
      pushNotification({
        kind: 'collab',
        title: status === 'closed' ? '모집을 마감했습니다' : '모집을 다시 열었습니다',
        body: `${post.title} 상태가 ${STATUS_LABELS[status]}으로 변경되었습니다.`,
        route: `/community/sessions/${post.id}`,
        actorName: user.name,
      });
    } catch (error) {
      console.error(error);
      setApplicationError(
        error instanceof Error ? error.message : '모집 상태를 바꾸지 못했습니다.'
      );
    } finally {
      setIsChangingStatus(false);
    }
  };

  if (bootstrapStatus === 'loading' && !post) {
    return (
      <div className="session-detail-page">
        <SiteHeader activeSection="collab" />
        <main className="session-detail-shell">
          <section className="session-detail-empty">
            <strong>모집글을 불러오는 중입니다.</strong>
            <span>잠시만 기다려주세요.</span>
          </section>
        </main>
      </div>
    );
  }

  if (!post) {
    return (
      <div className="session-detail-page">
        <SiteHeader activeSection="collab" />
        <main className="session-detail-shell">
          <section className="session-detail-empty">
            <strong>모집글을 찾을 수 없습니다.</strong>
            <span>
              {bootstrapStatus === 'error'
                ? bootstrapError ?? '데이터를 불러오지 못했습니다.'
                : '삭제되었거나 잘못된 주소일 수 있습니다.'}
            </span>
            <button type="button" onClick={() => navigate('/community/sessions')}>
              목록으로 돌아가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="session-detail-page">
      <SiteHeader activeSection="collab" />

      <main className="session-detail-shell">
        <button
          type="button"
          className="session-detail-back"
          onClick={() => navigate('/community/sessions')}
        >
          <DetailIcon name="arrow" /> 목록으로
        </button>

        <section className="session-detail-layout">
          <div className="session-detail-main">
            <article className="session-detail-hero">
              <span className={`session-detail-status is-${post.status}`}>{STATUS_LABELS[post.status]}</span>
              <span className="session-detail-menu" aria-hidden="true">•••</span>
              <span className="session-detail-note-art" aria-hidden="true"><DetailIcon name="music" /></span>

              <div className="session-detail-title">
                <h1>{post.title}</h1>
                <p>{post.summary || '함께 멋진 곡을 만들어보세요.'}</p>
                <div className="session-detail-badges">
                  <span>{post.genre || '자유'}</span>
                  <span>{post.location}</span>
                  <span>{post.schedule}</span>
                  <span>{post.currentMembers}/{post.maxMembers}</span>
                  {post.wantedRoles[0] ? <span>{ROLE_LABELS[post.wantedRoles[0]]}</span> : null}
                  {post.urgent ? <span className="is-urgent">급구</span> : null}
                </div>
              </div>

              <dl className="session-detail-meta-grid">
                <div><i><DetailIcon name="music" /></i><span>장르<strong>{post.genre || '자유'}</strong></span></div>
                <div><i><DetailIcon name="location" /></i><span>지역<strong>{post.location}</strong></span></div>
                <div><i><DetailIcon name="calendar" /></i><span>일정<strong>{post.schedule}</strong></span></div>
                <div><i><DetailIcon name="users" /></i><span>모집 인원<strong>{post.currentMembers}/{post.maxMembers}</strong></span></div>
              </dl>

              <div className="session-detail-intro">
                <h2><DetailIcon name="parts" /> 프로젝트 소개</h2>
                <p>{post.summary || '등록된 프로젝트 소개가 없습니다.'}</p>
              </div>

              {isOwner ? (
                <div className="session-status-control">
                  <strong>모집 상태 관리</strong>
                  <button
                    type="button"
                    onClick={() => handleSetRecruitStatus(post.status === 'closed' ? 'open' : 'closed')}
                    disabled={isChangingStatus}
                  >
                    {post.status === 'closed' ? '다시 모집하기' : '모집 마감'}
                  </button>
                </div>
              ) : null}
            </article>

            <article className="session-detail-apply-card">
              <h2><DetailIcon name="file" /> 지원하기</h2>

              <div className="session-collab-link-panel">
                <div>
                  <strong>연결된 협업 작업실</strong>
                  <p>{post.collabProjectId ? linkedCollabProject?.title ?? '협업 작업실이 연결되어 있습니다.' : '모집글과 연결된 작업실이 아직 없습니다.'}</p>
                </div>
                {post.collabProjectId ? (
                  <button type="button" onClick={() => navigate(`/collab/${post.collabProjectId}`)}>작업실 열기</button>
                ) : isOwner ? (
                  <div className="session-collab-create">
                    <select value={selectedSourceProjectId} onChange={(event) => setSelectedSourceProjectId(event.target.value)} disabled={!ownerComposerProjects.length}>
                      {ownerComposerProjects.length ? ownerComposerProjects.map((project) => <option key={project.id} value={project.id}>{project.title}</option>) : <option value="">저장곡 없음</option>}
                    </select>
                    <button type="button" onClick={handleCreateCollabProject} disabled={!ownerComposerProjects.length || isCreatingCollab}>{isCreatingCollab ? '연결 중...' : '작업실 만들기'}</button>
                  </div>
                ) : (
                  <button type="button" onClick={() => handleMoveWithAuth('/collab')}>작업 목록 보기</button>
                )}
              </div>

              {isOwner ? (
                <div className="session-application-owner">
                  <div className="session-application-summary">
                    <strong>지원자 {applicants.length}명</strong>
                    <small>대기 {pendingApplicants.length}명 · 승인 {applicants.filter((applicant) => applicant.status === 'approved').length}명</small>
                  </div>
                  {pendingApplicants.length ? (
                    <div className="session-applicant-list">
                      {pendingApplicants.map((applicant) => (
                        <article key={applicant.id} className="session-applicant-card">
                          <div><strong>{applicant.name}</strong><span>{ROLE_LABELS[applicant.role]} 지원</span><p>{applicant.message || '남긴 메시지가 없습니다.'}</p></div>
                          <div className="session-applicant-actions">
                            <button type="button" onClick={() => handleReview(applicant.id, 'approved')} disabled={reviewingApplicantId === applicant.id}>승인</button>
                            <button type="button" onClick={() => handleReview(applicant.id, 'rejected')} disabled={reviewingApplicantId === applicant.id}>거절</button>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : <div className="session-detail-note">아직 대기 중인 지원자가 없습니다.</div>}
                  {reviewedApplicants.length ? <div className="session-reviewed-list">{reviewedApplicants.map((applicant) => <span key={applicant.id}>{applicant.name} · {ROLE_LABELS[applicant.role]} · {applicant.status === 'approved' ? '승인됨' : '거절됨'}</span>)}</div> : null}
                </div>
              ) : (
                <div className="session-application-form">
                  {myApplication ? (
                    <div className={`session-application-state is-${myApplication.status}`}><strong>{myApplication.status === 'approved' ? '지원이 승인되었습니다.' : '지원이 접수되었습니다.'}</strong><span>{ROLE_LABELS[myApplication.role]} 파트로 지원했어요.</span></div>
                  ) : (
                    <>
                      <label><span>지원 파트</span><select value={applicationRole} onChange={(event) => setApplicationRole(event.target.value as SessionRole)}>{post.wantedRoles.map((role) => <option key={role} value={role}>{ROLE_LABELS[role]}</option>)}</select></label>
                      <label className="session-application-message"><span>지원 메시지</span><span className="session-message-field"><textarea value={applicationMessage} onChange={(event) => setApplicationMessage(event.target.value)} placeholder={'가능한 일정, 맡고 싶은 파트, 간단한 소개를 적어주세요.\n예) 안녕하세요! 비슷한 장르 작업 경험이 있습니다. 함께 작업하고 싶어요!'} rows={4} maxLength={240} /><small>{applicationMessage.length}/240</small></span></label>
                      <button type="button" onClick={handleApply} disabled={isApplying}><DetailIcon name="send" /> {isApplying ? '지원 중...' : '지원하기'}</button>
                    </>
                  )}
                </div>
              )}
              {applicationError ? <div className="session-application-error">{applicationError}</div> : null}
            </article>
          </div>

          <aside className="session-detail-side">
            <article className="session-detail-side-card session-author-card">
              <header><h2><DetailIcon name="user" /> 작성자</h2><span aria-hidden="true">•••</span></header>
              <div className="session-author-profile"><i><DetailIcon name="user" /></i><span><strong>{post.hostName}</strong><small>{formatDate(post.createdAt)} 작성</small></span></div>
              <div className="session-detail-actions">
                <button type="button" onClick={() => handleMoveWithAuth('/messages')}><DetailIcon name="message" /> 메시지 보내기</button>
                <button type="button" onClick={() => handleMoveWithAuth('/profile')}><DetailIcon name="user" /> 프로필 보기</button>
              </div>
            </article>

            <article className="session-detail-side-card session-parts-card">
              <header><h2><DetailIcon name="parts" /> 필요한 파트</h2><span>{post.wantedRoles.length}개 선택됨</span></header>
              <div className="session-part-grid">
                {DETAIL_PARTS.map((item) => {
                  const isSelected = Boolean(item.role && post.wantedRoles.includes(item.role));
                  return <div key={item.key} className={`session-part-item${isSelected ? ' is-selected' : ''}`}><i><DetailIcon name={item.icon} /></i><strong>{item.label}</strong><small>{item.description}</small>{isSelected ? <b>✓</b> : null}</div>;
                })}
              </div>
            </article>

            <article className="session-detail-side-card session-tags-card">
              <header><h2><DetailIcon name="tag" /> 태그</h2></header>
              <div className="session-detail-tag-list">
                {post.tags.length ? post.tags.map((tag) => <strong key={tag}>#{tag}</strong>) : <em>등록된 태그가 없습니다.</em>}
              </div>
            </article>
          </aside>
        </section>
      </main>
    </div>
  );
}
