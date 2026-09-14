import { type ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';
import TopbarAccount from '../auth/TopbarAccount';
import NotificationBell from '../notifications/NotificationBell';
import ThemeToggle from '../theme/ThemeToggle';
import './SiteHeader.css';

export type SiteHeaderSection =
  | 'composer'
  | 'library'
  | 'collab'
  | 'community'
  | 'music'
  | 'market'
  | 'shorts'
  | null;

type SiteHeaderProps = {
  activeSection?: SiteHeaderSection;
  rightSlot?: ReactNode;
};

const NAV_ITEMS: Array<{
  key: Exclude<SiteHeaderSection, null>;
  label: string;
  route: string;
}> = [
  { key: 'composer', label: '작곡', route: '/composer' },
  { key: 'collab', label: '협업', route: '/collab' },
  { key: 'community', label: '커뮤니티', route: '/community' },
  { key: 'shorts', label: '숏폼', route: '/community/shorts' },
];

export default function SiteHeader({ activeSection = null, rightSlot = null }: SiteHeaderProps) {
  const navigate = useNavigate();

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <button
          type="button"
          className="site-header-brand"
          onClick={() => navigate('/')}
          aria-label="메인 페이지로 이동"
        >
          <span className="site-header-brand-mark" aria-hidden="true">
            <img className="site-header-brand-logo" src="/composer-bap-logo.svg" alt="" />
          </span>
          <span className="site-header-brand-name">
            작곡<span>밥</span>
          </span>
        </button>

        <nav className="site-header-nav" aria-label="상단 메뉴">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.key}
              type="button"
              className={`site-header-nav-link${
                activeSection === item.key ? ' is-active' : ''
              }`}
              onClick={() => navigate(item.route)}
              aria-current={activeSection === item.key ? 'page' : undefined}
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="site-header-tools">
          <ThemeToggle />
          <NotificationBell />
          <div className="site-header-account">
            <TopbarAccount />
          </div>
          {rightSlot ? <div className="site-header-extra">{rightSlot}</div> : null}
        </div>
      </div>
    </header>
  );
}
