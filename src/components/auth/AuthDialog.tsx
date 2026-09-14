import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { createPortal } from 'react-dom';
import {
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth';
import { auth } from '../../firebase';
import { useAuthStore } from '../../store/authStore';
import './AuthDialog.css';

export type AuthDialogMode = 'login' | 'signup' | 'reset';

type AuthDialogProps = {
  mode: AuthDialogMode;
  onClose: () => void;
  onModeChange: (mode: AuthDialogMode) => void;
  inline?: boolean;
};

type NoticeState = {
  kind: 'success' | 'error';
  message: string;
} | null;

const AUTH_COPY: Record<
  AuthDialogMode,
  {
    title: string;
    submitLabel: string;
    footerLabel: string;
  }
> = {
  login: {
    title: '로그인',
    submitLabel: '로그인',
    footerLabel: '작곡밥 회원가입',
  },
  signup: {
    title: '회원가입',
    submitLabel: '회원가입',
    footerLabel: '이미 계정이 있으신가요? 로그인',
  },
  reset: {
    title: '비밀번호 찾기',
    submitLabel: '재설정 메일 보내기',
    footerLabel: '로그인으로 돌아가기',
  },
};

function getFirebaseErrorMessage(error: unknown, mode: AuthDialogMode) {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : '';

  switch (code) {
    case 'auth/email-already-in-use':
      return '이미 가입된 이메일입니다.';
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return '아이디 또는 비밀번호가 올바르지 않습니다.';
    case 'auth/user-not-found':
      return '가입되지 않은 아이디입니다.';
    case 'auth/weak-password':
      return '비밀번호는 6자리 이상이어야 합니다.';
    case 'auth/invalid-email':
      return '유효하지 않은 이메일 형식입니다.';
    default:
      if (mode === 'reset') return '비밀번호 재설정 요청 중 오류가 발생했습니다.';
      if (mode === 'signup') return '회원가입 처리 중 오류가 발생했습니다.';
      return '로그인 처리 중 오류가 발생했습니다.';
  }
}

export default function AuthDialog({ mode, onClose, onModeChange, inline = false }: AuthDialogProps) {
  const login = useAuthStore((state) => state.login);
  const signup = useAuthStore((state) => state.signup);
  const copy = AUTH_COPY[mode];

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [nickname, setNickname] = useState('');
  const [rememberMe, setRememberMe] = useState(true);
  const [agreeTerms, setAgreeTerms] = useState(false);
  const [notice, setNotice] = useState<NoticeState>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (inline) return;

    const previousOverflow = document.body.style.overflow;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };

    document.body.style.overflow = 'hidden';
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [inline, onClose]);

  const handleModeChange = (nextMode: AuthDialogMode) => {
    onModeChange(nextMode);
    setNotice(null);
  };

  const handleFooterClick = () => {
    handleModeChange(mode === 'login' ? 'signup' : 'login');
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (isSubmitting) return;

    const trimmedEmail = email.trim();
    const trimmedNickname = nickname.trim();

    if (!trimmedEmail) {
      setNotice({ kind: 'error', message: '아이디를 입력해주세요.' });
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
        setNotice({ kind: 'error', message: '이용약관에 동의해주세요.' });
        return;
      }
    }

    setNotice(null);
    setIsSubmitting(true);

    try {
      if (mode === 'signup') {
        const userCredential = await createUserWithEmailAndPassword(auth, trimmedEmail, password);
        await updateProfile(userCredential.user, { displayName: trimmedNickname });
        const token = await userCredential.user.getIdToken();

        signup({
          email: userCredential.user.email || trimmedEmail,
          nickname: trimmedNickname,
          avatarUrl: userCredential.user.photoURL || undefined,
          sessionToken: token,
        });
        onClose();
        return;
      }

      if (mode === 'login') {
        const userCredential = await signInWithEmailAndPassword(auth, trimmedEmail, password);
        const token = await userCredential.user.getIdToken();

        login({
          email: userCredential.user.email || trimmedEmail,
          name: userCredential.user.displayName || 'Guest',
          avatarUrl: userCredential.user.photoURL || undefined,
          sessionToken: token,
        });

        if (rememberMe) {
          localStorage.setItem('song-maker-remember-email', trimmedEmail);
        } else {
          localStorage.removeItem('song-maker-remember-email');
        }

        onClose();
        return;
      }

      await sendPasswordResetEmail(auth, trimmedEmail);
      setNotice({
        kind: 'success',
        message: '비밀번호 재설정 메일을 보냈습니다. 메일함을 확인해주세요.',
      });
    } catch (error: unknown) {
      console.error('Auth Error:', error);
      setNotice({
        kind: 'error',
        message: getFirebaseErrorMessage(error, mode),
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const dialog = (
    <section className="auth-modal" role="dialog" aria-modal={!inline} aria-labelledby="auth-title">
      <button type="button" className="auth-modal-close" onClick={onClose} aria-label="닫기">
        ×
      </button>

      <form className="auth-form" onSubmit={handleSubmit}>
        <h1 id="auth-title">{copy.title}</h1>

        <div className="auth-form-fields">
          {mode === 'signup' ? (
            <label className="auth-field">
              <span>닉네임</span>
              <input
                type="text"
                value={nickname}
                onChange={(event) => setNickname(event.target.value)}
                placeholder="닉네임을 입력해주세요."
                autoComplete="nickname"
              />
            </label>
          ) : null}

          <label className="auth-field">
            <span>아이디</span>
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="아이디를 입력해주세요."
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
                placeholder="비밀번호를 입력해주세요."
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
                placeholder="비밀번호를 다시 입력해주세요."
                autoComplete="new-password"
              />
            </label>
          ) : null}
        </div>

        {mode === 'login' ? (
          <div className="auth-support-row">
            <label className="auth-check-row">
              <input
                type="checkbox"
                checked={rememberMe}
                onChange={(event) => setRememberMe(event.target.checked)}
              />
              <span>자동 로그인</span>
            </label>
            <button type="button" onClick={() => handleModeChange('reset')}>
              아이디 찾기 | 비밀번호 찾기
            </button>
          </div>
        ) : null}

        {mode === 'signup' ? (
          <label className="auth-check-row auth-check-row--terms">
            <input
              type="checkbox"
              checked={agreeTerms}
              onChange={(event) => setAgreeTerms(event.target.checked)}
            />
            <span>이용약관과 개인정보 처리방침에 동의합니다.</span>
          </label>
        ) : null}

        {notice ? <div className={`auth-notice auth-notice--${notice.kind}`}>{notice.message}</div> : null}

        <button type="submit" className="auth-submit-button" disabled={isSubmitting}>
          {isSubmitting ? '처리 중...' : copy.submitLabel}
        </button>

        <div className="auth-divider" />

        <button type="button" className="auth-footer-link" onClick={handleFooterClick}>
          {copy.footerLabel}
        </button>
      </form>
    </section>
  );

  if (inline) return dialog;

  return createPortal(
    <div className="auth-dialog-backdrop" onMouseDown={onClose}>
      <div className="auth-dialog-position" onMouseDown={(event) => event.stopPropagation()}>
        {dialog}
      </div>
    </div>,
    document.body,
  );
}
