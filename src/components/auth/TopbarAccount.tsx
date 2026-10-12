import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthStore } from '../../store/authStore';
import { logoutOnServer } from '../../utils/authApi';
import AuthDialog, { type AuthDialogMode } from './AuthDialog';

export default function TopbarAccount() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const logout = useAuthStore((state) => state.logout);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [authDialogMode, setAuthDialogMode] = useState<AuthDialogMode | null>(null);

  useEffect(() => {
    if (!isMenuOpen) {
      return;
    }

    const handlePointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    };

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setIsMenuOpen(false);
      }
    };

    window.addEventListener('pointerdown', handlePointerDown);
    window.addEventListener('keydown', handleEscape);

    return () => {
      window.removeEventListener('pointerdown', handlePointerDown);
      window.removeEventListener('keydown', handleEscape);
    };
  }, [isMenuOpen]);

  const closeMenu = () => {
    setIsMenuOpen(false);
  };

  const handleLogout = async () => {
    closeMenu();
    try {
      await logoutOnServer();
    } catch (error) {
      console.error(error);
    }
    logout();
    navigate('/');
  };

  const handleMove = (route: string) => {
    closeMenu();
    navigate(route);
  };

  if (!user) {
    return (
      <div className="topbar-account">
        <button type="button" className="topbar-account-link" onClick={() => setAuthDialogMode('login')}>
          로그인
        </button>
        <button
          type="button"
          className="topbar-account-link is-primary"
          onClick={() => setAuthDialogMode('signup')}
        >
          회원가입
        </button>

        {authDialogMode ? (
          <AuthDialog
            mode={authDialogMode}
            onClose={() => setAuthDialogMode(null)}
            onModeChange={setAuthDialogMode}
          />
        ) : null}
      </div>
    );
  }

  return (
    <div ref={containerRef} className="topbar-account topbar-account-shell">
      <button
        type="button"
        className={`topbar-account-profile topbar-account-profile-button${
          isMenuOpen ? ' is-open' : ''
        }`}
        aria-label={`${user.name} 프로필 메뉴`}
        aria-expanded={isMenuOpen}
        onClick={() => setIsMenuOpen((current) => !current)}
      >
        <span className="topbar-account-avatar" aria-hidden="true">
          {user.avatarUrl ? (
            <img src={user.avatarUrl} alt="" className="topbar-account-avatar-image" />
          ) : (
            <span className="topbar-account-avatar-fallback">
              {user.name.slice(0, 1).toUpperCase()}
            </span>
          )}
        </span>
        <span className="topbar-account-name">{user.name}</span>
        <span className="topbar-account-caret" aria-hidden="true" />
      </button>

      {isMenuOpen ? (
        <div className="topbar-account-menu" role="menu" aria-label="프로필 메뉴">
          <button
            type="button"
            className="topbar-account-menu-button"
            role="menuitem"
            onClick={() => handleMove('/profile')}
          >
            내 프로필
          </button>
          <button
            type="button"
            className="topbar-account-menu-button"
            role="menuitem"
            onClick={() => handleMove('/messages')}
          >
            메시지
          </button>
          <button
            type="button"
            className="topbar-account-menu-button"
            role="menuitem"
            onClick={() => handleMove('/settings')}
          >
            설정
          </button>
          <button
            type="button"
            className="topbar-account-menu-button is-danger"
            role="menuitem"
            onClick={() => {
              void handleLogout();
            }}
          >
            로그아웃
          </button>
        </div>
      ) : null}
    </div>
  );
}
