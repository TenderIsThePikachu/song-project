import { useNavigate } from 'react-router-dom';
import './CollabHubTabs.css';

type CollabHubTabsProps = {
  activeTab: 'collab' | 'sessions';
};

export default function CollabHubTabs({ activeTab }: CollabHubTabsProps) {
  const navigate = useNavigate();

  return (
    <div className="collab-hub-tabs" role="tablist" aria-label="합작 메뉴">
      <button
        type="button"
        className={`collab-hub-tab${activeTab === 'collab' ? ' is-active' : ''}`}
        aria-selected={activeTab === 'collab'}
        onClick={() => navigate('/collab')}
      >
        내 작업실
      </button>
      <button
        type="button"
        className={`collab-hub-tab${activeTab === 'sessions' ? ' is-active' : ''}`}
        aria-selected={activeTab === 'sessions'}
        onClick={() => navigate('/community/sessions')}
      >
        팀원 찾기
      </button>
    </div>
  );
}
