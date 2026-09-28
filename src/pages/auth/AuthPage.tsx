import { useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { useAuthStore } from '../../store/authStore';
import { connectFirebaseUserToServer } from '../../utils/authApi';
import './AuthPage.css';

// 🔥 1. 기존 커스텀 API 대신 파이어베이스 도구들을 불러옵니다.
import { auth } from '../../firebase'; // ★주의: firebase.ts 파일을 만든 위치에 맞게 경로를 수정해주세요! (예: '../../firebase')
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword, 
  sendPasswordResetEmail, 
  updateProfile 
} from 'firebase/auth';

export type AuthMode = 'login' | 'signup' | 'reset';

type NoticeState = {
  kind: 'success' | 'error';
  message: string;
} | null;

type AuthPageProps = {
  mode: AuthMode;
};

const PAGE_META: Record<
  AuthMode,
  {
    eyebrow: string;
    title: string;
    description: string;
    submitLabel: string;
    helperTitle: string;
    helperBody: string;
  }
> = {
  login: {
    eyebrow: 'MEMBER LOGIN',
    title: '다시 돌아와서\n작업을 이어가세요',
    description:
      '작곡 프로젝트와 커뮤니티 활동을 같은 계정으로 이어볼 수 있어요.',
    submitLabel: '로그인',
    helperTitle: '바로 이어서 작업하기',
    helperBody:
      '로그인하면 작곡, 커뮤니티, 음악 공유 흐름이 하나의 계정으로 자연스럽게 이어집니다.',
  },
  signup: {
    eyebrow: 'CREATE ACCOUNT',
    title: '새 계정을 만들고\n커뮤니티에 참여하세요',
    description:
      '회원가입 후 커뮤니티 글쓰기, 중고거래 문의, 저장 프로젝트를 한 번에 관리할 수 있어요.',
    submitLabel: '회원가입',
    helperTitle: '처음 들어오는 사용자를 위한 흐름',
    helperBody:
      '꼭 필요한 정보만 입력받고, 이후 기능 확장에도 잘 붙을 수 있는 인증 구조로 연결했습니다.',
  },
  reset: {
    eyebrow: 'PASSWORD RESET',
    title: '비밀번호를 잊어도\n바로 다시 시작할 수 있어요',
    description:
      '가입한 이메일을 입력하면 재설정 요청을 서버에 기록하고, 이어서 로그인 흐름으로 돌아올 수 있게 준비합니다.',
    submitLabel: '재설정 링크 보내기',
    helperTitle: '복구 흐름도 깔끔하게',
    helperBody:
      '로그인과 회원가입 화면과 같은 구조를 유지하면서, 비밀번호 찾기 요청도 실제 백엔드 API로 연결합니다.',
  },
};

const FEATURE_ITEMS = [
  {
    label: '작업 기록',
    title: '작곡 가이드 진행도와 즐겨찾기 흐름을 같은 계정 기준으로 이어서 관리',
  },
  {
    label: '커뮤니티',
    title: '게시글, 음악 공유, 중고거래 활동을 한 계정으로 묶어서 사용',
  },
  {
    label: '백엔드 연동',
    title: '회원가입과 로그인 정보가 서버에 저장되고, 로그인 시 실제 검증을 거칩니다.',
  },
];

// 🔥 2. 파이어베이스 에러 코드를 한국어로 예쁘게 바꿔주는 도우미 함수 추가
function getFirebaseErrorMessage(error: unknown, mode: AuthMode) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error
      ? String(error.code)
      : '';
  switch (code) {
    case 'auth/email-already-in-use': return '이미 가입된 이메일입니다.';
    case 'auth/invalid-credential': return '이메일 또는 비밀번호가 잘못되었습니다.';
    case 'auth/wrong-password': return '비밀번호가 틀렸습니다.';
    case 'auth/user-not-found': return '가입되지 않은 이메일입니다.';
    case 'auth/weak-password': return '비밀번호는 6자리 이상이어야 합니다.';
    case 'auth/invalid-email': return '유효하지 않은 이메일 형식입니다.';
    default:
      if (error instanceof Error && error.message) return error.message;
      if (mode === 'reset') return '비밀번호 재설정 요청 중 오류가 발생했습니다.';
      if (mode === 'signup') return '회원가입 처리 중 오류가 발생했습니다.';
      return '로그인 처리 중 오류가 발생했습니다.';
  }
}

export default function AuthPage({ mode }: AuthPageProps) {
  const navigate = useNavigate();
  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const pageMeta = PAGE_META[mode];
  const showHeroCard = mode === 'reset';
  const showGuideCard = mode === 'reset';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [rememberMe, setRememberMe] = useState(false);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) {
      return;
    }

    const trimmedEmail = email.trim();
    const trimmedNickname = nickname.trim();

    if (!trimmedEmail) {
      setNotice({ kind: 'error', message: '이메일을 입력해주세요.' });
      return;
    }

    if (mode !== 'reset' && !password.trim()) {
      setNotice({ kind: 'error', message: '비밀번호를 입력해주세요.' });
      return;
    }

    if (mode === 'signup') {
      if (!trimmedNickname) {
        setNotice({ kind: 'error', message: '닉네임을 입력해주세요.' });
        return;
      }

      if (password !== confirmPassword) {
        setNotice({ kind: 'error', message: '비밀번호 확인이 일치하지 않습니다.' });
        return;
      }

      if (!agreeTerms) {
        setNotice({ kind: 'error', message: '가입 안내에 동의해주세요.' });
        return;
      }
    }

    setNotice(null);
    setIsSubmitting(true);

    try {
      // 🔥 3. 파이어베이스로 회원가입 처리하기
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        
        // 가입 직후 파이어베이스 프로필에 닉네임 저장
        await updateProfile(userCredential.user, { displayName: trimmedNickname });
        
        const serverSession = await connectFirebaseUserToServer({
          email: userCredential.user.email || trimmedEmail,
          password,
          name: trimmedNickname,
          mode: 'signup',
        });

        signup({
          email: userCredential.user.email || trimmedEmail,
          nickname: trimmedNickname,
          avatarUrl: userCredential.user.photoURL || undefined,
          sessionToken: serverSession.sessionToken,
        });
        navigate('/');
        return;
      }

      // 🔥 4. 파이어베이스로 로그인 처리하기
      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const serverSession = await connectFirebaseUserToServer({
          email: userCredential.user.email || trimmedEmail,
          password,
          name: userCredential.user.displayName || 'Guest',
          mode: 'login',
        });

        login({
          email: userCredential.user.email || trimmedEmail,
          name: userCredential.user.displayName || 'Guest',
          avatarUrl: userCredential.user.photoURL || undefined,
          sessionToken: serverSession.sessionToken,
        });

        if (rememberMe) {
          localStorage.setItem('song-maker-remember-email', trimmedEmail);
        } else {
          localStorage.removeItem('song-maker-remember-email');
        }

        navigate('/');
        return;
      }

      // 🔥 5. 파이어베이스로 비밀번호 재설정 이메일 보내기
      await sendPasswordResetEmail(auth, trimmedEmail);
      setNotice({ kind: 'success', message: '비밀번호 재설정 이메일을 보냈습니다. 메일함을 확인해주세요!' });
      
    } catch (error: unknown) {
      console.error("Auth Error:", error);
      setNotice({
        kind: 'error',
        message: getFirebaseErrorMessage(error, mode),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="auth-page">
      <SiteHeader />

      <main className="auth-shell">
        {showHeroCard ? <section className="auth-hero-card">
          <div className="auth-hero-copy">
            <span className="auth-eyebrow">{pageMeta.eyebrow}</span>
            <h1 className="auth-title">
              {pageMeta.title.split('\n').map((line) => (
                <span key={line} className="auth-title-line">
                  {line}
                </span>
              ))}
            </h1>
            <p className="auth-description">{pageMeta.description}</p>
          </div>

          <div className="auth-feature-list">
            {FEATURE_ITEMS.map((item) => (
              <article key={item.label} className="auth-feature-card">
                <span>{item.label}</span>
                <strong>{item.title}</strong>
              </article>
            ))}
          </div>
        </section> : null}

        <section className={`auth-layout${showGuideCard ? '' : ' auth-layout--single'}`}>
          {showGuideCard ? <aside className="auth-side-card">
            <span className="auth-side-kicker">GUIDE</span>
            <strong>{pageMeta.helperTitle}</strong>
            <p>{pageMeta.helperBody}</p>

            <div className="auth-side-links">
              <button type="button" onClick={() => navigate('/login')}>
                로그인
              </button>
              <button type="button" onClick={() => navigate('/signup')}>
                회원가입
              </button>
              <button type="button" onClick={() => navigate('/forgot-password')}>
                비밀번호 찾기
              </button>
            </div>
          </aside> : null}

          <form className="auth-form-card" onSubmit={handleSubmit}>
            <div className="auth-form-head">
              <span className="auth-form-kicker">ACCOUNT</span>
              <h2>{pageMeta.submitLabel}</h2>
            </div>

            <div className="auth-form-body">
              {mode === 'signup' ? (
                <label className="auth-field">
                  <span>닉네임</span>
                  <input
                    type="text"
                    value={nickname}
                    onChange={(event) => setNickname(event.target.value)}
                    placeholder="사용할 닉네임"
                    autoComplete="nickname"
                  />
                </label>
              ) : null}

              <label className="auth-field">
                <span>이메일</span>
                <input
                  type="email"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  placeholder="name@example.com"
                  autoComplete="email"
                />
              </label>

              {mode !== 'reset' ? (
                <label className="auth-field">
                  <span>비밀번호</span>
                  <input
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    placeholder="비밀번호 입력"
                    autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                  />
                </label>
              ) : null}

              {mode === 'signup' ? (
                <label className="auth-field">
                  <span>비밀번호 확인</span>
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    placeholder="비밀번호 다시 입력"
                    autoComplete="new-password"
                  />
                </label>
              ) : null}

              {mode === 'login' ? (
                <label className="auth-check-row">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(event) => setRememberMe(event.target.checked)}
                  />
                  <span>로그인 상태 유지</span>
                </label>
              ) : null}

              {mode === 'signup' ? (
                <label className="auth-check-row">
                  <input
                    type="checkbox"
                    checked={agreeTerms}
                    onChange={(event) => setAgreeTerms(event.target.checked)}
                  />
                  <span>가입 안내와 기본 이용 흐름에 동의합니다.</span>
                </label>
              ) : null}

              {notice ? (
                <div className={`auth-notice auth-notice--${notice.kind}`}>{notice.message}</div>
              ) : null}
            </div>

            <div className="auth-form-actions">
              <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
                {isSubmitting ? '처리 중...' : pageMeta.submitLabel}
              </button>

              <div className="auth-inline-links">
                {mode !== 'login' ? (
                  <button type="button" onClick={() => navigate('/login')}>
                    로그인으로 돌아가기
                  </button>
                ) : null}

                {mode !== 'signup' ? (
                  <button type="button" onClick={() => navigate('/signup')}>
                    회원가입
                  </button>
                ) : null}

                {mode !== 'reset' ? (
                  <button type="button" onClick={() => navigate('/forgot-password')}>
                    비밀번호 찾기
                  </button>
                ) : null}
              </div>
            </div>
          </form>
        </section>
      </main>
    </div>
  );
}
