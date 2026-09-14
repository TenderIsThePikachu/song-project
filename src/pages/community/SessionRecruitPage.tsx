import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { useSearchParams } from 'react-router-dom';
import CollabHubTabs from '../../components/collab/CollabHubTabs';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { useSessionRecruitStore } from '../../store/sessionRecruitStore';
import type {
  SessionRecruitPost,
  SessionMeetingType,
  SessionRegion,
  SessionRole,
  SessionStatus,
} from '../../types/sessionRecruit';
import './SessionRecruitPage.css';

type RoleFilter = 'all' | SessionRole;
type RegionFilter = 'all' | SessionRegion;
type StatusFilter = 'all' | SessionStatus;

const ROLE_OPTIONS: Array<{ key: RoleFilter; label: string }> = [
  { key: 'all', label: '전체' },
  { key: 'vocal', label: '보컬' },
  { key: 'guitar', label: '기타' },
  { key: 'bass', label: '베이스' },
  { key: 'drums', label: '드럼' },
  { key: 'keys', label: '건반' },
  { key: 'producer', label: '프로듀서' },
  { key: 'mix', label: '믹스/레코딩' },
];

const REGION_OPTIONS: Array<{ key: RegionFilter; label: string }> = [
  { key: 'all', label: '전체 지역' },
  { key: 'seoul', label: '서울' },
  { key: 'gyeonggi', label: '경기' },
  { key: 'incheon', label: '인천' },
  { key: 'busan', label: '부산' },
  { key: 'online', label: '온라인' },
];

const STATUS_OPTIONS: Array<{ key: StatusFilter; label: string }> = [
  { key: 'all', label: '전체 상태' },
  { key: 'open', label: '모집중' },
  { key: 'closing', label: '마감 임박' },
  { key: 'closed', label: '모집 완료' },
];

const PAGE_SIZE = 6;

const FORM_ROLE_OPTIONS: Array<{ key: SessionRole; label: string }> = [
  { key: 'vocal', label: '보컬' },
  { key: 'guitar', label: '기타' },
  { key: 'bass', label: '베이스' },
  { key: 'drums', label: '드럼' },
  { key: 'keys', label: '건반' },
  { key: 'producer', label: '프로듀서' },
  { key: 'mix', label: '믹스/레코딩' },
];

const FORM_REGION_OPTIONS: Array<{ key: SessionRegion; label: string }> = [
  { key: 'seoul', label: '서울' },
  { key: 'gyeonggi', label: '경기' },
  { key: 'incheon', label: '인천' },
  { key: 'busan', label: '부산' },
  { key: 'online', label: '온라인' },
];

const FORM_MEETING_OPTIONS = ['온라인', '오프라인', '온/오프 병행'] as const;

function matchesKeyword(post: SessionRecruitPost, keyword: string) {
  if (!keyword) {
    return true;
  }

  return [
    post.title,
    post.genre,
    post.hostName,
    post.summary,
    post.location,
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

function formatRelativeTime(timestamp: number) {
  const diffMs = Date.now() - timestamp;
  const hour = 60 * 60 * 1000;
  const day = 24 * hour;

  if (diffMs < hour) {
    const minutes = Math.max(1, Math.floor(diffMs / (60 * 1000)));
    return `${minutes}분 전`;
  }

  if (diffMs < day) {
    return `${Math.floor(diffMs / hour)}시간 전`;
  }

  return `${Math.floor(diffMs / day)}일 전`;
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

  const [roleFilter, setRoleFilter] = useState<RoleFilter>('all');
  const [regionFilter, setRegionFilter] = useState<RegionFilter>('all');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [searchKeyword, setSearchKeyword] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [isWriteOpen, setIsWriteOpen] = useState(false);
  const [writeError, setWriteError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [title, setTitle] = useState('');
  const [genre, setGenre] = useState('');
  const [summary, setSummary] = useState('');
  const [location, setLocation] = useState('');
  const [schedule, setSchedule] = useState('');
  const [region, setRegion] = useState<SessionRegion>('online');
  const [meetingType, setMeetingType] = useState<(typeof FORM_MEETING_OPTIONS)[number]>('온라인');
  const [wantedRoles, setWantedRoles] = useState<SessionRole[]>(['producer']);
  const [maxMembers, setMaxMembers] = useState('4');
  const [tagInput, setTagInput] = useState('');
  const [urgent, setUrgent] = useState(false);

  useEffect(() => {
    void seedSessionRecruit().catch((error) => {
      console.error(error);
    });
  }, [seedSessionRecruit]);

  useEffect(() => {
    if (searchParams.get('write') !== '1') {
      return;
    }

    setIsWriteOpen(true);
    setTitle(searchParams.get('title') ?? '');
    setGenre(searchParams.get('genre') ?? '');
    setSummary(searchParams.get('summary') ?? '');
    setLocation('온라인');
    setSchedule('협의');
    setRegion('online');
    setMeetingType('온라인');
    const roles = (searchParams.get('roles') ?? '')
      .split(',')
      .filter((role): role is SessionRole =>
        FORM_ROLE_OPTIONS.some((option) => option.key === role)
      );
    setWantedRoles(roles.length ? roles : ['producer']);
    setTagInput('#작곡 #협업 #파트모집');
  }, [searchParams]);

  const filteredPosts = useMemo(() => {
    const normalizedKeyword = searchKeyword.trim().toLowerCase();

    return posts
      .filter((post) => {
        const matchesRole =
          roleFilter === 'all' ? true : post.wantedRoles.includes(roleFilter);
        const matchesRegion =
          regionFilter === 'all' ? true : post.region === regionFilter;
        const matchesStatus =
          statusFilter === 'all' ? true : post.status === statusFilter;

        return (
          matchesRole &&
          matchesRegion &&
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
  }, [posts, regionFilter, roleFilter, searchKeyword, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredPosts.length / PAGE_SIZE));
  const safePage = Math.min(currentPage, totalPages);
  const startIndex = (safePage - 1) * PAGE_SIZE;
  const visiblePosts = filteredPosts.slice(startIndex, startIndex + PAGE_SIZE);
  const pageNumbers = Array.from({ length: totalPages }, (_, index) => index + 1);

  const sessionMetrics = useMemo(
    () => [
      {
        label: '모집중 세션',
        value: posts.filter((post) => post.status === 'open').length,
        note: '바로 연락 가능한 팀',
      },
      {
        label: '온라인 가능',
        value: posts.filter((post) => post.region === 'online').length,
        note: '원격 협업 중심 세션',
      },
      {
        label: '마감 임박',
        value: posts.filter((post) => post.status === 'closing').length,
        note: '빠른 합류가 필요한 팀',
      },
      {
        label: '공연 목표',
        value: posts.filter((post) => post.tags.includes('공연')).length,
        note: '라이브/쇼케이스 준비 팀',
      },
    ],
    [posts]
  );

  const myApplications = useMemo(() => {
    if (!user) {
      return [];
    }

    return posts
      .flatMap((post) =>
        (post.applicants ?? [])
          .filter((applicant) => applicant.email === user.email)
          .map((applicant) => ({ post, applicant }))
      )
      .sort((left, right) => right.applicant.updatedAt - left.applicant.updatedAt);
  }, [posts, user]);

  const handleMoveWithAuth = (route: string) => {
    navigate(user ? route : '/login');
  };

  const handleOpenWrite = () => {
    if (!user) {
      navigate('/login');
      return;
    }

    setIsWriteOpen((current) => !current);
    setWriteError('');
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
    setLocation('');
    setSchedule('');
    setRegion('online');
    setMeetingType('온라인');
    setWantedRoles(['producer']);
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
    const trimmedLocation = location.trim();
    const trimmedSchedule = schedule.trim();
    const nextMaxMembers = Math.max(1, Number.parseInt(maxMembers, 10) || 1);
    const tags = tagInput
      .split(/[,\s]+/)
      .map((tag) => tag.replace(/^#/, '').trim())
      .filter(Boolean)
      .slice(0, 6);

    if (!trimmedTitle || !trimmedGenre || !trimmedSummary || !trimmedLocation || !trimmedSchedule) {
      setWriteError('제목, 장르, 소개, 지역, 일정을 모두 입력해주세요.');
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
        location: trimmedLocation,
        region,
        meetingType: meetingType as SessionMeetingType,
        status: 'open',
        wantedRoles,
        tags,
        currentMembers: 1,
        maxMembers: nextMaxMembers,
        schedule: trimmedSchedule,
        urgent,
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
    setRegionFilter('all');
    setStatusFilter('all');
    setSearchKeyword('');
    setCurrentPage(1);
  };

  return (
    <div className="session-page">
      <SiteHeader activeSection="collab" />

      <main className="session-shell">
        <CollabHubTabs activeTab="sessions" />

        <section className="session-hero">
          <div className="session-hero-copy">
            <span className="session-eyebrow">SESSION BOARD</span>
            <h1>합주와 세션 모집을 한곳에서 바로 이어보세요</h1>

            <div className="session-hero-actions">
              <button
                type="button"
                className="session-primary-button"
                onClick={() => handleMoveWithAuth('/messages')}
              >
                메시지로 바로 연락하기
              </button>
              <button
                type="button"
                className="session-secondary-button"
                onClick={() => handleMoveWithAuth('/collab')}
              >
                협업 작업실 보러가기
              </button>
            </div>
          </div>

          <div className="session-hero-panel">
            <div className="session-hero-panel-card">
              <span>이번 주 추천</span>
              <strong>공연 준비 팀, 온라인 세션, 자작곡 밴드</strong>
              <p>지금 모집중인 팀을 보고 바로 메시지와 협업으로 이어질 수 있어요.</p>
            </div>
          </div>
        </section>

        <div className="session-layout">
          <aside className="session-sidebar">
            <section className="session-side-card">
              <div className="session-side-head">
                <span className="session-side-kicker">ROLE</span>
                <strong>모집 파트</strong>
              </div>

              <div className="session-side-list">
                {ROLE_OPTIONS.map((option) => (
                  <button
                    key={option.key}
                    type="button"
                    className={`session-side-button${
                      roleFilter === option.key ? ' is-active' : ''
                    }`}
                    onClick={() => {
                      setRoleFilter(option.key);
                      setCurrentPage(1);
                    }}
                  >
                    {option.label}
                  </button>
                ))}
              </div>
            </section>

            <section className="session-side-card">
              <div className="session-side-head">
                <span className="session-side-kicker">COMMUNITY</span>
                <strong>다른 공간도 보기</strong>
              </div>

              <div className="session-shortcut-list">
                <button
                  type="button"
                  className="session-shortcut-button"
                  onClick={() => navigate('/community')}
                >
                  커뮤니티 게시판
                </button>
                <button
                  type="button"
                  className="session-shortcut-button"
                  onClick={() => navigate('/community/music')}
                >
                  음악 공유
                </button>
              </div>
            </section>

            <section className="session-side-card session-side-card--accent">
              <span className="session-side-kicker">TIP</span>
              <strong>모집글엔 일정, 목표, 원하는 파트를 같이 적는 게 가장 반응이 빠릅니다.</strong>
              <p>
                연습 빈도, 공연 여부, 원격 가능 여부까지 같이 적어두면 팀원을
                구하는 시간이 훨씬 줄어듭니다.
              </p>
            </section>
          </aside>

          <section className="session-content">
            <div className="session-metric-grid">
              {sessionMetrics.map((metric) => (
                <article key={metric.label} className="session-metric-card">
                  <span>{metric.label}</span>
                  <strong>{metric.value}</strong>
                  <small>{metric.note}</small>
                </article>
              ))}
            </div>

            {user && myApplications.length ? (
              <section className="session-my-application-panel">
                <div className="session-panel-headline">
                  <span className="session-board-kicker">MY APPLICATIONS</span>
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
              <div className="session-board-head">
                <div>
                  <span className="session-board-kicker">BAND / SESSION RECRUIT</span>
                </div>

                <button
                  type="button"
                  className="session-reset-button"
                  onClick={handleFilterReset}
                >
                  필터 초기화
                </button>
              </div>

              <div className="session-write-entry">
                <button
                  type="button"
                  className="session-primary-button"
                  onClick={handleOpenWrite}
                >
                  {isWriteOpen ? '작성 닫기' : '모집글 작성'}
                </button>
              </div>

              {isWriteOpen ? (
                <form className="session-write-panel" onSubmit={handleSubmitRecruit}>
                  <div className="session-write-head">
                    <span>SESSION WRITE</span>
                    <strong>모집글 작성</strong>
                    <p>현재 작업에 필요한 파트, 일정, 진행 방식을 적어 팀원을 모집하세요.</p>
                  </div>

                  <div className="session-write-grid">
                    <label className="session-write-field session-write-field--wide">
                      <span>제목</span>
                      <input
                        value={title}
                        onChange={(event) => setTitle(event.target.value)}
                        placeholder="예: 주말 합주할 기타/보컬 구합니다"
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
                      <span>지역</span>
                      <input
                        value={location}
                        onChange={(event) => setLocation(event.target.value)}
                        placeholder="홍대 / 온라인 / 부산 서면"
                        maxLength={60}
                      />
                    </label>

                    <label className="session-write-field">
                      <span>지역 분류</span>
                      <select
                        value={region}
                        onChange={(event) => setRegion(event.target.value as SessionRegion)}
                      >
                        {FORM_REGION_OPTIONS.map((option) => (
                          <option key={option.key} value={option.key}>
                            {option.label}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="session-write-field">
                      <span>진행 방식</span>
                      <select
                        value={meetingType}
                        onChange={(event) =>
                          setMeetingType(event.target.value as (typeof FORM_MEETING_OPTIONS)[number])
                        }
                      >
                        {FORM_MEETING_OPTIONS.map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="session-write-field">
                      <span>일정</span>
                      <input
                        value={schedule}
                        onChange={(event) => setSchedule(event.target.value)}
                        placeholder="매주 토요일 오후 / 협의"
                        maxLength={80}
                      />
                    </label>

                    <label className="session-write-field">
                      <span>최대 인원</span>
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
                        placeholder="어떤 음악을 하고 싶은지, 필요한 파트와 작업 방식을 적어주세요."
                        maxLength={240}
                        rows={4}
                      />
                    </label>

                    <label className="session-write-field session-write-field--wide">
                      <span>태그</span>
                      <input
                        value={tagInput}
                        onChange={(event) => setTagInput(event.target.value)}
                        placeholder="#공연 #작곡 #커버"
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
                      disabled={isSubmitting}
                    >
                      {isSubmitting ? '등록 중...' : '등록하기'}
                    </button>
                  </div>
                </form>
              ) : null}

              <div className="session-toolbar">
                <label className="session-search" aria-label="세션 모집 검색">
                  <input
                    type="search"
                    value={searchKeyword}
                    onChange={(event) => {
                      setSearchKeyword(event.target.value);
                      setCurrentPage(1);
                    }}
                    placeholder="제목, 장르, 지역, 태그로 검색하세요"
                  />
                </label>

                <div className="session-filter-group">
                  {REGION_OPTIONS.map((option) => (
                    <button
                      key={option.key}
                      type="button"
                      className={`session-chip${
                        regionFilter === option.key ? ' is-active' : ''
                      }`}
                      onClick={() => {
                        setRegionFilter(option.key);
                        setCurrentPage(1);
                      }}
                    >
                      {option.label}
                    </button>
                  ))}
                </div>

                <div className="session-filter-group">
                  {STATUS_OPTIONS.map((option) => (
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
                  ))}
                </div>
              </div>

              <div className="session-board-summary">
                <strong>{filteredPosts.length}개의 모집글</strong>
                <span>지역, 파트, 상태 필터를 조합해서 바로 맞는 팀을 찾을 수 있어요.</span>
              </div>

              {bootstrapStatus === 'loading' ? (
                <div className="session-empty-state">
                  <strong>세션 모집 데이터를 불러오는 중입니다.</strong>
                  <span>잠시만 기다리면 최신 모집글이 표시됩니다.</span>
                </div>
              ) : null}

              {bootstrapStatus === 'error' ? (
                <div className="session-empty-state">
                  <strong>세션 모집 데이터를 불러오지 못했습니다.</strong>
                  <span>{bootstrapError ?? '서버 연결 상태를 확인해주세요.'}</span>
                </div>
              ) : null}

              {bootstrapStatus !== 'loading' && bootstrapStatus !== 'error' ? (
                <>
                  <div className="session-card-grid">
                    {visiblePosts.map((post) => (
                      <article key={post.id} className="session-card">
                        <div className="session-card-badges">
                          <span className={`session-status-chip is-${post.status}`}>
                            {getStatusLabel(post.status)}
                          </span>
                          <span className="session-meta-chip">{post.meetingType}</span>
                          {post.urgent ? (
                            <span className="session-meta-chip is-urgent">급구</span>
                          ) : null}
                          {post.collabProjectId ? (
                            <span className="session-meta-chip is-linked">작업실 연결됨</span>
                          ) : null}
                          {user && post.hostEmail === user.email ? (
                            <span className="session-meta-chip is-owner">
                              지원자 {(post.applicants ?? []).length}명
                            </span>
                          ) : null}
                          {user &&
                          post.hostEmail !== user.email &&
                          (post.applicants ?? []).some((applicant) => applicant.email === user.email) ? (
                            <span className="session-meta-chip is-applied">
                              {getApplicationStatusLabel(
                                (post.applicants ?? []).find(
                                  (applicant) => applicant.email === user.email
                                )?.status ?? 'pending'
                              )}
                            </span>
                          ) : null}
                        </div>

                        <div className="session-card-copy">
                          <strong>{post.title}</strong>
                          <p>{post.summary}</p>
                        </div>

                        <dl className="session-meta-grid">
                          <div>
                            <dt>장르</dt>
                            <dd>{post.genre}</dd>
                          </div>
                          <div>
                            <dt>지역</dt>
                            <dd>{post.location}</dd>
                          </div>
                          <div>
                            <dt>일정</dt>
                            <dd>{post.schedule}</dd>
                          </div>
                          <div>
                            <dt>인원</dt>
                            <dd>
                              {post.currentMembers}/{post.maxMembers}
                            </dd>
                          </div>
                        </dl>

                        <div className="session-role-list">
                          {post.wantedRoles.map((role) => (
                            <span key={role} className="session-role-chip">
                              {getRoleLabel(role)}
                            </span>
                          ))}
                        </div>

                        <div className="session-tag-list">
                          {post.tags.map((tag) => (
                            <span key={tag} className="session-tag-chip">
                              #{tag}
                            </span>
                          ))}
                        </div>

                        <div className="session-card-footer">
                          <div className="session-card-host">
                            <strong>{post.hostName}</strong>
                            <span>{formatRelativeTime(post.createdAt)}</span>
                          </div>

                          <div className="session-card-actions">
                            <button
                              type="button"
                              className="session-card-button"
                              onClick={() => navigate(`/community/sessions/${post.id}`)}
                            >
                              상세 보기
                            </button>
                            <button
                              type="button"
                              className="session-card-button"
                              onClick={() => handleMoveWithAuth('/messages')}
                            >
                              메시지
                            </button>
                            <button
                              type="button"
                              className="session-card-button is-primary"
                              onClick={() => handleMoveWithAuth('/collab')}
                            >
                              협업 보기
                            </button>
                          </div>
                        </div>
                      </article>
                    ))}
                  </div>

                  {visiblePosts.length === 0 ? (
                    <div className="session-empty-state">
                      <strong>조건에 맞는 모집글이 아직 없습니다.</strong>
                      <span>검색어를 바꾸거나 다른 파트/지역 필터를 선택해보세요.</span>
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
        </div>
      </main>
    </div>
  );
}
