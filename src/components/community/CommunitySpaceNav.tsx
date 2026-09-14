import { useNavigate } from 'react-router-dom';
import './CommunitySpaceNav.css';

type CommunitySpaceNavProps = {
  active: 'board' | 'music';
};

const ITEMS = [
  { key: 'board', label: '게시판', route: '/community' },
  { key: 'music', label: '음악 공유', route: '/community/music' },
] as const;

export default function CommunitySpaceNav({ active }: CommunitySpaceNavProps) {
  const navigate = useNavigate();

  return (
    <nav className="community-space-nav" aria-label="커뮤니티 메뉴">
      <div className="community-space-nav-list">
        {ITEMS.map((item) => (
          <button
            key={item.key}
            type="button"
            className={`community-space-nav-button${active === item.key ? ' is-active' : ''}`}
            onClick={() => navigate(item.route)}
          >
            {item.label}
          </button>
        ))}
      </div>
    </nav>
  );
}
