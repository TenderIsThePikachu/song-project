import { useEffect, useMemo, useState } from 'react';
import type { FormEvent, ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import CollabHubTabs from '../../components/collab/CollabHubTabs';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useCollabStore } from '../../store/collabStore';
import { useSessionRecruitStore } from '../../store/sessionRecruitStore';
import type {
  SessionRecruitPost,
  SessionRole,
  SessionStatus,
} from '../../types/sessionRecruit';
import './SessionRecruitPage.css';

type RoleFilter = 'all' | SessionRole;
type StatusFilter = 'all' | SessionStatus;

const ROLE_OPTIONS: Array<{ key: RoleFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'lyrics', label: '작사' },
  { key: 'melody', label: '멜로디·작곡' },
  { key: 'arrangement', label: '코드·편곡' },
  { key: 'drums', label: '드럼' },
  { key: 'bass', label: '베이스' },
  { key: 'instrument', label: '악기 파트' },
  { key: 'vocal', label: '보컬' },
  { key: 'mix', label: '믹싱' },
];

const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '전체 상태' },
  { key: 'open', label: '모집중' },
  { key: 'closing', label: '마감 임박' },
  { key: 'closed', label: '모집 완료' },
];

const PAGE_SIZE = 6;

const FORM_ROLE_OPTIONS: Array<{ key: SessionRole; label: string }> = [
  { key: 'lyrics', label: '작사' },
  { key: 'melody', label: '멜로디·작곡' },
  { key: 'arrangement', label: '코드·편곡' },
  { key: 'drums', label: '드럼' },
  { key: 'bass', label: '베이스' },
  { key: 'instrument', label: '악기 파트' },
  { key: 'vocal', label: '보컬' },
  { key: 'mix', label: '믹싱' },
];

const SESSION_COVERS = [
  '/landing-assets/shared-fallback-band.webp',
  '/landing-assets/shared-fallback-groove.webp',
  '/landing-assets/shared-fallback-jazz.webp',
  '/landing-assets/shared-fallback-film.webp',
];

type SessionIconName = 'arrow' | 'calendar' | 'crown' | 'location' | 'message' | 'music' | 'plus' | 'search' | 'sparkle' | 'stats' | 'users' | 'wifi';

function SessionIcon({ name }: { name: SessionIconName }) {
  const paths: Record<SessionIconName, ReactNode> = {
    arrow: <><path d="m9 18 6-6-6-6" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M8 3v4M16 3v4M3 10h18" /></>,
    crown: <><path d="m4 8 4 3 4-6 4 6 4-3-2 10H6z" /><path d="M7 21h10" /></>,
    location: <><path d="M20 10c0 5-8 11-8 11S4 15 4 10a8 8 0 1 1 16 0Z" /><circle cx="12" cy="10" r="2.5" /></>,
    message: <><path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 3v-3.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z" /></>,
    music: <><path d="M9 18V6l10-2v12" /><circle cx="6" cy="18" r="3" /><circle cx="16" cy="16" r="3" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    search: <><circle cx="11" cy="11" r="7" /><path d="m20 20-4-4" /></>,
    sparkle: <><path d="m12 3 1.5 4.5L18 9l-4.5 1.5L12 15l-1.5-4.5L6 9l4.5-1.5zM19 16l.7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7z" /></>,
    stats: <><path d="M5 20V10M12 20V4M19 20v-7" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3 19c.5-3.2 2.5-5 6-5s5.5 1.8 6 5M16 6.5a3 3 0 0 1 0 5.8M17 14c2.3.4 3.6 2 4 4.5" /></>,
    wifi: <><path d="M4 9a12 12 0 0 1 16 0M7 12a8 8 0 0 1 10 0M10 15a4 4 0 0 1 4 0" /><circle cx="12" cy="19" r="1" /></>,
  };

  return <svg className="session-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

function matchesKeyword(post: SessionRecruitPost, keyword: string) {
  if (!keyword) {
    return true;
  }

  return [
    post.title,
    post.genre,
    post.hostName,
    post.summary,
    ...post.tags,
  ].some((value) => value.toLowerCase().includes(keyword));
}

function getStatusLabel(status: SessionStatus) {
  if (status === 'closing') {
    return '마감 임박';
  }

  if (status === 'closed') {
    return '모집 완료';
  }

  return '모집중';
}

function getRoleLabel(role: SessionRole) {
  return ROLE_OPTIONS.find((option) => option.key === role)?.label ?? role;
}

function getApplicationStatusLabel(status: 'pending' | 'approved' | 'rejected') {
  if (status === 'approved') {
    return '승인됨';
  }

  if (status === 'rejected') {
    return '거절됨';
  }

  return '대기중';
}

export default function SessionRecruitPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const posts = useSessionRecruitStore((state) => state.posts);
  const bootstrapStatus = useSessionRecruitStore((state) => state.bootstrapStatus);
  const bootstrapError = useSessionRecruitStore((state) => state.bootstrapError);
  const seedSessionRecruit = useSessionRecruitStore((state) => state.seedSessionRecruit);
  const createPost = useSessionRecruitStore((state) => state.createPost);
  const collabProjects = useCollabStore((state) => state.projects);
  const initializeRealtime = useCollabStore((state) => state.initializeRealtime);

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [summary, setSummary] = useState('');
  const [schedule, setSchedule] = useState('');
  const [selectedCollabProjectId, setSelectedCollabProjectId] = useState('');
  const [wantedRoles, setWantedRoles] = useState<SessionRole[]>(['melody']);
  const [maxMembers, setMaxMembers] = useState('4');
  const [tagInput, setTagInput] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    void seedSessionRecruit().catch((error) => {
      console.error(error);
    });
    void initializeRealtime().catch((error) => {
      console.error(error);
    });
  }, [initializeRealtime, seedSessionRecruit]);

  const ownedCollabProjects = useMemo(
    () => user
      ? collabProjects.filter((project) => project.ownerEmail.toLowerCase() === user.email.toLowerCase())
      : [],
    [collabProjects, user]
  );
  const workspacePosts = useMemo(
    () => posts.filter((post) => Boolean(post.collabProjectId)),
    [posts]
  );

  useEffect(() => {
    if (!selectedCollabProjectId && ownedCollabProjects.length) {
      setSelectedCollabProjectId(ownedCollabProjects[0].id);
    }
  }, [ownedCollabProjects, selectedCollabProjectId]);

  useEffect(() => {
    if (searchParams.get('write') !== '1') {
      return;
    }

    setIsWriteOpen(true);
    setTitle(searchParams.get('title') ?? '');
    setGenre(searchParams.get('genre') ?? '');
    setSummary(searchParams.get('summary') ?? '');
    setSchedule('협의');
    setSelectedCollabProjectId(searchParams.get('collabProjectId') ?? '');
    const roles = (searchParams.get('roles') ?? '')
      .split(',')
      .filter((role): role is SessionRole =>
        FORM_ROLE_OPTIONS.some((option) => option.key === role)
      );
    setWantedRoles(roles.length ? roles : ['melody']);
    setTagInput('#작곡 #온라인협업 #팀원모집');
  }, [searchParams]);

  const filteredPosts = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return workspacePosts
      .filter((post) => {
        const matchesRole =
          roleFilter === 'all' ? true : post.wantedRoles.includes(roleFilter);
        const matchesStatus =
          statusFilter === 'all' ? true : post.status === statusFilter;

        return (
          matchesRole &&
          matchesStatus &&
          matchesKeyword(post, normalizedKeyword)
        );
      })
      .sort((left, right) => {
        if (left.status !== right.status) {
          const order = { open: 0, closing: 1, closed: 2 };
          return order[left.status] - order[right.status];
        }

        if (left.urgent !== right.urgent) {
          return Number(right.urgent) - Number(left.urgent);
        }

        return right.updatedAt - left.updatedAt;
      });
  }, [roleFilter, searchKeyword, statusFilter, workspacePosts]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visiblePosts = filteredPosts.slice(startIndex, startIndex + PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  const sessionMetrics = useMemo(
    () => [
      {
        label: '모집 중 프로젝트',
        value: workspacePosts.filter((post) => post.status === 'open').length,
        note: '지금 지원 가능한 작업',
      },
      {
        label: '모집 중인 파트',
        value: workspacePosts.reduce((total, post) => total + post.wantedRoles.length, 0),
        note: '작업실에서 필요한 역할',
      },
      {
        label: '마감 임박',
        value: workspacePosts.filter((post) => post.status === 'closing').length,
        note: '빠른 합류가 필요한 작업',
      },
      {
        label: '작업실 연결',
        value: workspacePosts.length,
        note: '승인 후 바로 참여 가능',
      },
    ],
    [workspacePosts]
  );

  const myApplications = useMemo(() => {
    if (!user) {
      return [];
    }

    return workspacePosts
      .flatMap((post) =>
        (post.applicants ?? [])
          .filter((applicant) => applicant.email === user.email)
          .map((applicant) => ({ post, applicant }))
      )
      .sort((left, right) => right.applicant.updatedAt - left.applicant.updatedAt);
  }, [user, workspacePosts]);

  const handleMoveWithAuth = (route: string) => {
    navigate(user ? route : '/login');
  };

  const handleOpenWrite = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setIsWriteOpen((current) => !current);
    setWriteError(ownedCollabProjects.length ? '' : '먼저 내 작업실을 만든 뒤 팀원을 모집할 수 있습니다.');
  };

  const handleToggleWantedRole = (role: SessionRole) => {
    setWantedRoles((current) => {
      if (current.includes(role)) {
        return current.length > 1 ? current.filter((item) => item !== role) : current;
      }

      return [...current, role];
    });
  };

  const resetWriteForm = () => {
    setTitle('');
    setGenre('');
    setSummary('');
    setSchedule('');
    setSelectedCollabProjectId(ownedCollabProjects[0]?.id ?? '');
    setWantedRoles(['melody']);
    setMaxMembers('4');
    setTagInput('');
    setUrgent(false);
  };

  const handleSubmitRecruit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      navigate('/login');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedGenre = genre.trim();
    const trimmedSummary = summary.trim();
    const trimmedSchedule = schedule.trim();
    const nextMaxMembers = Math.max(1, Number.parseInt(maxMembers, 10) || 1);
    const tags = tagInput
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 6);

    if (!selectedCollabProjectId || !ownedCollabProjects.some((project) => project.id === selectedCollabProjectId)) {
      setWriteError('팀원을 모집할 내 작업실을 선택해주세요.');
      return;
    }

    if (!trimmedTitle || !trimmedGenre || !trimmedSummary || !trimmedSchedule) {
      setWriteError('제목, 장르, 소개, 작업 마감을 모두 입력해주세요.');
      return;
    }

    try {
      setIsSubmitting(true);
      setWriteError('');
      const postId = await createPost({
        title: trimmedTitle,
        genre: trimmedGenre,
        hostName: user.name,
        hostEmail: user.email,
        summary: trimmedSummary,
        location: '작곡밥 온라인 작업실',
        region: 'online',
        meetingType: '온라인',
        status: 'open',
        wantedRoles,
        tags,
        currentMembers: 1,
        maxMembers: nextMaxMembers,
        schedule: trimmedSchedule,
        urgent,
        collabProjectId: selectedCollabProjectId,
      });

      resetWriteForm();
      setIsWriteOpen(false);
      setCurrentPage(1);
      navigate(`/community/sessions/${postId}`);
    } catch (error) {
      console.error(error);
      setWriteError(error instanceof Error ? error.message : '모집글을 등록하지 못했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleFilterReset = () => {
    setRoleFilter('all');
    setStatusFilter('all');
    setSearchKeyword('');
    setCurrentPage(1);
  };

  return (
    <div className="session-page">
      <SiteHeader activeSection="collab" />

      <main className="session-shell">
        <div className="session-tabs-row">
          <CollabHubTabs activeTab="sessions" />
        </div>

        <div className="session-layout">
          <aside className="session-left-sidebar">
            <section className="session-side-card session-role-card">
              <div className="session-side-head"><SessionIcon name="stats" /><strong>모집 파트</strong></div>
              <div className="session-side-list">
                {ROLE_OPTIONS.map((option) => {
                  const count = option.key === 'all'
                    ? workspacePosts.length
                    : workspacePosts.filter((post) => post.wantedRoles.includes(option.key as SessionRole)).length;
                  return (
                    <button key={option.key} type="button" className={`session-side-button${roleFilter === option.key ? ' is-active' : ''}`} onClick={() => { setRoleFilter(option.key); setCurrentPage(1); }}>
                      <span>{option.label}</span><b>{count}</b>
                    </button>
                  );
                })}
              </div>
            </section>

          </aside>

          <section className="session-content">
            <section className="session-hero">
              <div className="session-hero-copy">
                <h1>함께 곡을 완성할 팀원을<br />여기서 찾아보세요</h1>
                <div className="session-hero-actions">
                  <button type="button" className="session-primary-button" onClick={handleOpenWrite}><SessionIcon name="plus" />팀원 모집하기 <span>→</span></button>
                  <button type="button" className="session-secondary-button" onClick={() => handleMoveWithAuth('/collab')}>내 작업실 보기</button>
                </div>
              </div>
            </section>

            {user && myApplications.length ? (
              <section className="session-my-application-panel">
                <div className="session-panel-headline">
                  <strong>내 지원 현황</strong>
                </div>

                <div className="session-my-application-list">
                  {myApplications.slice(0, 4).map(({ post, applicant }) => (
                    <button
                      key={`${post.id}-${applicant.id}`}
                      type="button"
                      className={`session-my-application-card is-${applicant.status}`}
                      onClick={() =>
                        navigate(
                          applicant.status === 'approved' && post.collabProjectId
                            ? `/collab/${post.collabProjectId}`
                            : `/community/sessions/${post.id}`
                        )
                      }
                    >
                      <strong>{post.title}</strong>
                      <span>
                        {getRoleLabel(applicant.role)} · {getApplicationStatusLabel(applicant.status)}
                        {applicant.status === 'approved' && post.collabProjectId
                          ? ' · 작업실 바로가기'
                          : ''}
                      </span>
                    </button>
                  ))}
                </div>
              </section>
            ) : null}

            <section className={`session-board${isWriteOpen ? ' is-writing' : ''}`}>
              <div className="session-search-row">
                <label className="session-search" aria-label="팀원 모집 검색"><SessionIcon name="search" /><input type="search" value={searchKeyword} onChange={(event) => { setSearchKeyword(event.target.value); setCurrentPage(1); }} placeholder="프로젝트, 장르, 파트로 검색하세요" /></label>
                <button type="button" className="session-primary-button session-write-button" onClick={handleOpenWrite}><SessionIcon name="plus" />{isWriteOpen ? '작성 닫기' : '팀원 모집하기'}</button>
              </div>

              {isWriteOpen ? (
                <form className="session-write-panel" onSubmit={handleSubmitRecruit}>
                  <div className="session-write-head">
                    <strong>팀원 모집하기</strong>
                  </div>

                  <div className="session-write-grid">
                    <label className="session-write-field session-write-field--wide">
                      <span>모집할 작업실</span>
                      <select
                        value={selectedCollabProjectId}
                        onChange={(event) => setSelectedCollabProjectId(event.target.value)}
                        disabled={!ownedCollabProjects.length}
                      >
                        {ownedCollabProjects.length ? ownedCollabProjects.map((project) => (
                          <option key={project.id} value={project.id}>{project.title}</option>
                        )) : <option value="">먼저 내 작업실을 만들어주세요</option>}
                      </select>
                    </label>

                    <label className="session-write-field session-write-field--wide">
                      <span>제목</span>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="예: 시티팝 데모를 함께 완성할 보컬을 찾습니다"
                        maxLength={80}
                      />
                    </label>

                    <label className="session-write-field">
                      <span>장르</span>
                      <input
                        value={genre}
                        onChange={(event) => setGenre(event.target.value)}
                        placeholder="인디, R&B, 재즈..."
                        maxLength={40}
                      />
                    </label>

                    <label className="session-write-field">
                      <span>작업 마감</span>
                      <input
                        value={schedule}
                        onChange={(event) => setSchedule(event.target.value)}
                        placeholder="마감 목표 또는 가능한 일정"
                        maxLength={80}
                      />
                    </label>

                    <label className="session-write-field">
                      <span>모집 인원</span>
                      <input
                        type="number"
                        min="1"
                        max="20"
                        value={maxMembers}
                        onChange={(event) => setMaxMembers(event.target.value)}
                      />
                    </label>

                    <label className="session-write-field session-write-field--wide">
                      <span>소개</span>
                      <textarea
                        value={summary}
                        onChange={(event) => setSummary(event.target.value)}
                        placeholder="현재 곡의 상태와 팀원이 작업실에서 맡을 내용을 적어주세요."
                        maxLength={240}
                        rows={4}
                      />
                    </label>

                    <label className="session-write-field session-write-field--wide">
                      <span>태그</span>
                      <input
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        placeholder="#작곡 #편곡 #보컬녹음"
                        maxLength={80}
                      />
                    </label>
                  </div>

                  <div className="session-write-role-group" aria-label="모집 파트">
                    {FORM_ROLE_OPTIONS.map((option) => (
                      <button
                        key={option.key}
                        type="button"
                        className={`session-chip${wantedRoles.includes(option.key) ? ' is-active' : ''}`}
                        onClick={() => handleToggleWantedRole(option.key)}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>

                  <label className="session-write-check">
                    <input
                      type="checkbox"
                      checked={urgent}
                      onChange={(event) => setUrgent(event.target.checked)}
                    />
                    <span>급구 표시</span>
                  </label>

                  {writeError ? <div className="session-write-error">{writeError}</div> : null}

                  <div className="session-write-actions">
                    <button
                      type="button"
                      className="session-secondary-button"
                      onClick={() => {
                        setIsWriteOpen(false);
                        setWriteError('');
                      }}
                    >
                      취소
                    </button>
                    <button
                      type="submit"
                      className="session-primary-button"
                      disabled={isSubmitting || !ownedCollabProjects.length}
                    >
                      {isSubmitting ? '등록 중...' : '등록하기'}
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="session-toolbar">
                <div className="session-filter-row"><strong>상태</strong><div className="session-filter-group">{STATUS_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`session-chip${
                        statusFilter === option.key ? ' is-active' : ''
                      }`}
                      onClick={() => {
                        setStatusFilter(option.key);
                        setCurrentPage(1);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}</div>
                  <div className="session-result-tools"><span>총 <b>{filteredPosts.length}</b>개의 모집글</span><select aria-label="모집글 정렬" defaultValue="latest"><option value="latest">최신순</option></select><button type="button" className="session-reset-button" onClick={handleFilterReset}>초기화</button></div>
                </div>
              </div>

              {!workspacePosts.length && bootstrapStatus === 'loading' ? (
                <div className="session-empty-state">
                  <strong>팀원 모집글을 불러오는 중입니다.</strong>
                  <span>잠시만 기다리면 최신 프로젝트가 표시됩니다.</span>
                </div>
              ) : null}

              {!workspacePosts.length && bootstrapStatus === 'error' ? (
                <div className="session-empty-state">
                  <strong>팀원 모집글을 불러오지 못했습니다.</strong>
                  <span>{bootstrapError ?? '서버 연결 상태를 확인해주세요.'}</span>
                </div>
              ) : null}

              {workspacePosts.length || (bootstrapStatus !== 'loading' && bootstrapStatus !== 'error') ? (
                <>
                  <div className="session-card-grid">
                    {visiblePosts.map((post, index) => (
                      <article
                        key={post.id}
                        className="session-card"
                        role="link"
                        tabIndex={0}
                        onClick={() => navigate(`/community/sessions/${post.id}`)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') navigate(`/community/sessions/${post.id}`);
                        }}
                      >
                        <img className="session-card-cover" src={SESSION_COVERS[index % SESSION_COVERS.length]} alt="" />
                        <div className="session-card-body">
                          <div className="session-card-title"><strong>{post.title}</strong><span className={`session-status-chip is-${post.status}`}>{getStatusLabel(post.status)}</span></div>
                          <p>{post.summary}</p>
                          <div className="session-card-chips">
                            <span className="session-meta-chip is-meeting">온라인 작업실</span>
                            {post.wantedRoles.map((role) => <span key={role} className="session-role-chip">{getRoleLabel(role)}</span>)}
                            <span className="session-tag-chip">{post.genre}</span>
                            {post.urgent ? <span className="session-meta-chip is-urgent">급구</span> : null}
                            {post.collabProjectId ? <span className="session-meta-chip is-linked">작업실 연결됨</span> : null}
                            {user && post.hostEmail === user.email ? <span className="session-meta-chip is-owner">지원자 {(post.applicants ?? []).length}명</span> : null}
                            {user && post.hostEmail !== user.email && (post.applicants ?? []).some((applicant) => applicant.email === user.email) ? <span className="session-meta-chip is-applied">{getApplicationStatusLabel((post.applicants ?? []).find((applicant) => applicant.email === user.email)?.status ?? 'pending')}</span> : null}
                          </div>
                        </div>
                        <div className="session-card-side">
                          <div className="session-applicant-avatars"><i>{post.hostName.slice(0, 1)}</i>{(post.applicants ?? []).slice(0, 2).map((applicant) => <i key={applicant.id}>{applicant.name.slice(0, 1)}</i>)}{(post.applicants ?? []).length > 2 ? <i className="is-more">+{(post.applicants ?? []).length - 2}</i> : null}</div>
                          <span className="session-card-date"><SessionIcon name="calendar" />{post.schedule}</span>
                          <div className="session-card-actions">
                            <button
                              type="button"
                              className={`session-card-button${post.status !== 'closed' ? ' is-primary' : ''}`}
                              onClick={() => navigate(`/community/sessions/${post.id}`)}
                            >
                              {post.status === 'closed' ? '자세히 보기' : '지원하기'}
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {visiblePosts.length === 0 ? (
                    <div className="session-empty-state">
                      <strong>조건에 맞는 모집글이 아직 없습니다.</strong>
                      <span>작업실에서 팀원 모집을 시작하거나 다른 파트·상태 필터를 선택해보세요.</span>
                    </div>
                  ) : null}

                  <div className="session-pagination">
                    <button
                      type="button"
                      className="session-page-button"
                      onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
                      disabled={safePage === 1}
                    >
                      이전
                    </button>

                    {pageNumbers.map((pageNumber) => (
                      <button
                        key={pageNumber}
                        type="button"
                        className={`session-page-button${
                          safePage === pageNumber ? ' is-active' : ''
                        }`}
                        onClick={() => setCurrentPage(pageNumber)}
                      >
                        {pageNumber}
                      </button>
                    ))}

                    <button
                      type="button"
                      className="session-page-button"
                      onClick={() =>
                        setCurrentPage((page) => Math.min(totalPages, page + 1))
                      }
                      disabled={safePage === totalPages}
                    >
                      다음
                    </button>
                  </div>
                </>
              ) : null}
            </section>
          </section>

          <aside className="session-right-sidebar">
            <section className="session-side-card session-status-card">
              <div className="session-side-head"><SessionIcon name="stats" /><strong>협업 현황</strong></div>
              <div className="session-metric-grid">
                {sessionMetrics.map((metric, index) => <article key={metric.label} className={`session-metric-card is-${index + 1}`}><span>{metric.label}</span><strong>{metric.value}</strong><SessionIcon name={index === 0 ? 'users' : index === 1 ? 'wifi' : index === 2 ? 'calendar' : 'music'} /></article>)}
              </div>
            </section>

            <section className="session-side-card session-popular-card">
              <header><span><SessionIcon name="users" />많이 찾는 파트</span><button type="button" onClick={handleFilterReset}>전체 보기 ›</button></header>
              <ol>{FORM_ROLE_OPTIONS.slice(0, 5).map((option, index) => <li key={option.key}><i>{index + 1}</i><b>{option.label}</b><span>{workspacePosts.filter((post) => post.wantedRoles.includes(option.key)).length}</span></li>)}</ol>
            </section>
          </aside>
        </div>
      </main>
    </div>
  );
}
