import { type ReactNode, useEffect } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
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
  { key: 'composer', label: '작곡', route: '/composer?tab=melody' },
  { key: 'collab', label: '협업', route: '/collab' },
  { key: 'community', label: '커뮤니티', route: '/community' },
  { key: 'shorts', label: '숏폼', route: '/community/shorts' },
];

type VisibleHeaderSection = 'composer' | 'collab' | 'community' | 'shorts';

const LAST_HEADER_SECTION_KEY = 'song-project-last-header-section';
const ACCOUNT_PATHS = ['/profile', '/library', '/messages', '/settings'];

function isVisibleHeaderSection(section: SiteHeaderSection): section is VisibleHeaderSection {
  return NAV_ITEMS.some((item) => item.key === section);
}

function getLastHeaderSection(): VisibleHeaderSection {
  if (typeof window === 'undefined') return 'composer';

  const savedSection = window.sessionStorage.getItem(LAST_HEADER_SECTION_KEY) as SiteHeaderSection;
  return isVisibleHeaderSection(savedSection) ? savedSection : 'composer';
}

export default function SiteHeader({ activeSection = null, rightSlot = null }: SiteHeaderProps) {
  const navigate = useNavigate();
  const location = useLocation();
  const isAccountPage = ACCOUNT_PATHS.some(
    (path) => location.pathname === path || location.pathname.startsWith(`${path}/`)
  );
  const resolvedActiveSection = isVisibleHeaderSection(activeSection)
    ? activeSection
    : isAccountPage
      ? getLastHeaderSection()
      : null;

  useEffect(() => {
    if (isVisibleHeaderSection(activeSection)) {
      window.sessionStorage.setItem(LAST_HEADER_SECTION_KEY, activeSection);
    }
  }, [activeSection]);

  const handleNavClick = (section: VisibleHeaderSection, route: string) => {
    window.sessionStorage.setItem(LAST_HEADER_SECTION_KEY, section);
    navigate(route);
  };

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
                resolvedActiveSection === item.key ? ' is-active' : ''
              }`}
              onClick={() => handleNavClick(item.key as VisibleHeaderSection, item.route)}
              aria-current={resolvedActiveSection === item.key ? 'page' : undefined}
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
