import { type ReactNode, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import {
  DEFAULT_USER_SETTINGS,
  getUserSettings,
  type UserSettings,
  useSettingsStore,
} from '../store/settingsStore';
import { updateUserProfileOnServer } from '../utils/profileApi';
import './SettingsPage.css';

type SettingToggleKey = keyof Pick<
  UserSettings,
  | 'communityNotifications'
  | 'musicNotifications'
  | 'collabNotifications'
  | 'profilePublic'
  | 'showActivity'
>;

type SettingsIconName = 'activity' | 'bell' | 'camera' | 'check' | 'chevron' | 'collab' | 'community' | 'eye' | 'folder' | 'lock' | 'mail' | 'message' | 'music' | 'navigation' | 'user';

function SettingsIcon({ name }: { name: SettingsIconName }) {
  const paths: Record<SettingsIconName, ReactNode> = {
    activity: <><path d="M5 4h14v16H5z" /><path d="M8 8h8M8 12h8M8 16h5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></>,
    camera: <><path d="M4 7h4l2-3h4l2 3h4v13H4z" /><circle cx="12" cy="13" r="4" /></>,
    check: <path d="m5 12 4 4L19 6" />,
    chevron: <path d="m9 18 6-6-6-6" />,
    collab: <><path d="M8 12 5 9l-3 3 5 5 3-3" /><path d="m16 12 3-3 3 3-5 5-3-3" /><path d="m8 12 2-2a3 3 0 0 1 4 0l2 2M10 14l2 2 2-2" /></>,
    community: <><circle cx="9" cy="8" r="3" /><path d="M3 20c.5-4 2.5-6 6-6s5.5 2 6 6M16 6a3 3 0 0 1 0 6M17 14c2.5.5 3.8 2.3 4 5" /></>,
    eye: <><path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12Z" /><circle cx="12" cy="12" r="3" /></>,
    folder: <path d="M3 6h7l2 2h9v11H3z" />,
    lock: <><rect x="5" y="10" width="14" height="11" rx="2" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 15v2" /></>,
    mail: <><rect x="3" y="5" width="18" height="14" rx="3" /><path d="m4 7 8 6 8-6" /></>,
    message: <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H9l-5 3v-3.5A2 2 0 0 1 3 15V7a2 2 0 0 1 2-2Z" />,
    music: <><path d="M9 18V5l11-2v13" /><circle cx="6" cy="18" r="3" /><circle cx="17" cy="16" r="3" /></>,
    navigation: <><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></>,
    user: <><circle cx="12" cy="8" r="4" /><path d="M4 21c.8-5 3.4-7 8-7s7.2 2 8 7" /></>,
  };

  return <svg className="settings-icon" viewBox="0 0 24 24" aria-hidden="true">{paths[name]}</svg>;
}

const NOTIFICATION_SETTING_ITEMS: Array<{
  key: SettingToggleKey;
  title: string;
  description: string;
  icon: SettingsIconName;
}> = [
  {
    key: 'communityNotifications',
    title: '커뮤니티 알림',
    description: '댓글, 좋아요, 게시글 반응을 바로 확인할 수 있어요.',
    icon: 'community',
  },
  {
    key: 'musicNotifications',
    title: '음악 공유 알림',
    description: '공유한 곡의 좋아요, 댓글, 다운로드 반응을 빠르게 받아볼 수 있어요.',
    icon: 'music',
  },
  {
    key: 'collabNotifications',
    title: '협업 알림',
    description: '협업방 메시지와 상태 변경을 실시간 흐름에 가깝게 확인할 수 있어요.',
    icon: 'collab',
  },
];

const PRIVACY_SETTING_ITEMS: Array<{
  key: SettingToggleKey;
  title: string;
  description: string;
  icon: SettingsIconName;
}> = [
  {
    key: 'profilePublic',
    title: '프로필 공개',
    description: '다른 사용자가 내 공개 프로필과 업로드한 작업을 볼 수 있어요.',
    icon: 'eye',
  },
  {
    key: 'showActivity',
    title: '활동 기록 공개',
    description: '좋아요, 최근 작업, 저장한 곡 같은 활동을 프로필에 노출할 수 있어요.',
    icon: 'activity',
  },
];

export default function SettingsPage() {
  const navigate = useNavigate();
  const user = useAuthStore((state) => state.user);
  const updateProfile = useAuthStore((state) => state.updateProfile);
  const settingsByEmail = useSettingsStore((state) => state.settingsByEmail);
  const ensureSettings = useSettingsStore((state) => state.ensureSettings);
  const updateSettings = useSettingsStore((state) => state.updateSettings);

  const [displayName, setDisplayName] = useState(() => user?.name ?? '');
  const [draftSettings, setDraftSettings] = useState<UserSettings>(DEFAULT_USER_SETTINGS);
  const [feedbackMessage, setFeedbackMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setDisplayName(user?.name ?? '');
  }, [user?.name]);

  useEffect(() => {
    if (!user) {
      return;
    }

    let cancelled = false;

    const loadSettings = async () => {
      setIsLoading(true);

      try {
        const nextSettings = await ensureSettings(user.email);
        if (!cancelled) {
          setDraftSettings(nextSettings ?? getUserSettings(settingsByEmail, user.email));
          setFeedbackMessage('');
        }
      } catch (error) {
        if (!cancelled) {
          setFeedbackMessage(
            error instanceof Error ? error.message : '설정을 불러오지 못했습니다.'
          );
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    };

    void loadSettings();

    return () => {
      cancelled = true;
    };
  }, [ensureSettings, settingsByEmail, user]);

  const handleToggle = (key: SettingToggleKey) => {
    setDraftSettings((current) => ({
      ...current,
      [key]: !current[key],
    }));
  };

  const handleSave = async () => {
    if (!user || isSaving) {
      if (!user) {
        navigate('/login');
      }
      return;
    }

    const nextName = displayName.trim();
    if (!nextName) {
      setFeedbackMessage('닉네임을 입력해주세요.');
      return;
    }

    setIsSaving(true);
    setFeedbackMessage('');

    try {
      const [profileResponse, settingsResponse] = await Promise.all([
        updateUserProfileOnServer({
          email: user.email,
          name: nextName,
        }),
        updateSettings(user.email, draftSettings),
      ]);

      updateProfile({
        email: profileResponse.user.email,
        name: profileResponse.user.name,
      });
      setDraftSettings(settingsResponse);
      setFeedbackMessage('설정이 서버에 저장되었습니다.');
    } catch (error) {
      setFeedbackMessage(error instanceof Error ? error.message : '설정을 저장하지 못했습니다.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!user) {
    return (
      <div className="settings-page">
        <SiteHeader />
        <main className="settings-shell">
          <section className="settings-empty-card">
            <strong>설정 페이지는 로그인 후 사용할 수 있습니다.</strong>
            <button type="button" onClick={() => navigate('/login')}>
              로그인하러 가기
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="settings-page">
      <SiteHeader />

      <main className="settings-shell">
        <section className="settings-hero">
          <div>
            <span className="settings-kicker">SETTINGS</span>
            <h1>내 계정과 알림 설정</h1>
            <p>닉네임, 알림, 공개 범위를 서버에 저장하고 다음 로그인에도 그대로 이어집니다.</p>
          </div>

          <div className="settings-hero-actions">
            <button
              type="button"
              className="settings-outline-button"
              onClick={() => navigate('/profile')}
            >
              <SettingsIcon name="eye" /> 프로필 보기
            </button>
            <button
              type="button"
              className="settings-primary-button"
              onClick={() => void handleSave()}
              disabled={isSaving}
            >
              <SettingsIcon name="check" /> {isSaving ? '저장 중...' : '저장하기'}
            </button>
          </div>
        </section>

        <section className="settings-grid">
          <article className="settings-card">
            <div className="settings-section-head">
              <span className="settings-section-icon"><SettingsIcon name="user" /></span>
              <div><strong>계정 정보</strong><span>프로필 기본 정보를 관리할 수 있어요.</span></div>
            </div>

            <div className="settings-account-row">
              <div className="settings-account-avatar" aria-hidden="true">
                {user.avatarUrl ? (
                  <img src={user.avatarUrl} alt="" className="settings-account-avatar-image" />
                ) : (
                  <span>{user.name.slice(0, 1).toUpperCase()}</span>
                )}
              </div>

              <div className="settings-account-copy">
                <strong>{user.name}</strong>
                <span>{user.email}</span>
                <button
                  type="button"
                  className="settings-avatar-button"
                  onClick={() => navigate('/profile')}
                >
                  <SettingsIcon name="camera" /> 프로필 이미지 변경
                </button>
              </div>
            </div>

            <label className="settings-field">
              <span>닉네임</span>
              <span className="settings-input-wrap"><SettingsIcon name="user" /><input type="text" value={displayName} onChange={(event) => setDisplayName(event.target.value)} placeholder="닉네임을 입력해주세요" /></span>
            </label>

            <label className="settings-field">
              <span>이메일</span>
              <span className="settings-input-wrap"><SettingsIcon name="mail" /><input type="email" value={user.email} disabled /></span>
            </label>
          </article>

          <article className="settings-card">
            <div className="settings-section-head">
              <span className="settings-section-icon"><SettingsIcon name="bell" /></span>
              <div><strong>알림 설정</strong><span>받고 싶은 반응만 골라서 켤 수 있어요.</span></div>
            </div>

            <div className="settings-toggle-list">
              {NOTIFICATION_SETTING_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="settings-toggle-card"
                  onClick={() => handleToggle(item.key)}
                >
                  <span className="settings-row-icon"><SettingsIcon name={item.icon} /></span>
                  <div className="settings-toggle-copy">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <span className={`settings-switch${draftSettings[item.key] ? ' is-on' : ''}`}>
                    <span />
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="settings-card">
            <div className="settings-section-head">
              <span className="settings-section-icon"><SettingsIcon name="lock" /></span>
              <div><strong>공개 범위</strong><span>프로필과 활동 공개 범위를 정할 수 있어요.</span></div>
            </div>

            <div className="settings-toggle-list">
              {PRIVACY_SETTING_ITEMS.map((item) => (
                <button
                  key={item.key}
                  type="button"
                  className="settings-toggle-card"
                  onClick={() => handleToggle(item.key)}
                >
                  <span className="settings-row-icon"><SettingsIcon name={item.icon} /></span>
                  <div className="settings-toggle-copy">
                    <strong>{item.title}</strong>
                    <span>{item.description}</span>
                  </div>
                  <span className={`settings-switch${draftSettings[item.key] ? ' is-on' : ''}`}>
                    <span />
                  </span>
                </button>
              ))}
            </div>
          </article>

          <article className="settings-card">
            <div className="settings-section-head">
              <span className="settings-section-icon"><SettingsIcon name="navigation" /></span>
              <div><strong>빠른 이동</strong><span>자주 쓰는 페이지로 바로 이동할 수 있어요.</span></div>
            </div>

            <div className="settings-shortcut-grid">
              <button
                type="button"
                className="settings-shortcut-card"
                onClick={() => navigate('/messages')}
              >
                <span className="settings-row-icon"><SettingsIcon name="message" /></span>
                <span className="settings-shortcut-copy"><strong>메시지함</strong><span>친구와 그룹 채팅을 확인하고 새 대화를 시작할 수 있어요.</span></span>
                <SettingsIcon name="chevron" />
              </button>
              <button
                type="button"
                className="settings-shortcut-card"
                onClick={() => navigate('/collab')}
              >
                <span className="settings-row-icon"><SettingsIcon name="folder" /></span>
                <span className="settings-shortcut-copy"><strong>협업 프로젝트</strong><span>진행 중인 협업방과 최근 코멘트를 한 번에 확인할 수 있어요.</span></span>
                <SettingsIcon name="chevron" />
              </button>
            </div>
          </article>
        </section>

        {isLoading ? <p className="settings-feedback">설정을 불러오는 중...</p> : null}
        {feedbackMessage ? <p className="settings-feedback">{feedbackMessage}</p> : null}
      </main>
    </div>
  );
}
