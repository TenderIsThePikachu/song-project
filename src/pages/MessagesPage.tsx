import { useEffect, useMemo, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import SiteHeader from '../components/layout/SiteHeader';
import { useAuthStore } from '../store/authStore';
import {
  SUGGESTED_FRIENDS,
  type FriendProfile,
  useFriendStore,
} from '../store/friendStore';
import { useMessageStore } from '../store/messageStore';
import './MessagesPage.css';

type MessagesSection = 'messages' | 'friends';


type MessageIconName =
  | 'add-user'
  | 'chevron'
  | 'group'
  | 'mail'
  | 'message'
  | 'music'
  | 'more'
  | 'paperclip'
  | 'phone'
  | 'play'
  | 'search'
  | 'send'
  | 'smile'
  | 'star'
  | 'trash'
  | 'user'
  | 'video';

function MessageIcon({ name, size = 20 }: { name: MessageIconName; size?: number }) {
  const commonProps = {
    fill: 'none',
    stroke: 'currentColor',
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    strokeWidth: 1.8,
  };

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" width={size} height={size} {...commonProps}>
      {name === 'message' ? (
        <>
          <path d="M7 18.5 3.5 21l1-4.4A8 8 0 1 1 7 18.5Z" />
          <path d="M8 10.5h8M8 14h5" />
        </>
      ) : null}
      {name === 'group' ? (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19v-1.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V19" />
          <path d="M15 5.5a3 3 0 0 1 0 5.8M17 13.5a4.5 4.5 0 0 1 3.5 4.3V19" />
        </>
      ) : null}
      {name === 'add-user' ? (
        <>
          <circle cx="9" cy="8" r="3" />
          <path d="M3.5 19v-1.2A4.8 4.8 0 0 1 8.3 13h1.4a4.8 4.8 0 0 1 4.8 4.8V19M18 8v6M15 11h6" />
        </>
      ) : null}
      {name === 'search' ? <circle cx="10.5" cy="10.5" r="6.5" /> : null}
      {name === 'search' ? <path d="m15.5 15.5 4 4" /> : null}
      {name === 'send' ? <path d="m21 3-7.7 18-2.2-8.1L3 9.7 21 3ZM11.1 12.9 16 8" /> : null}
      {name === 'music' ? (
        <>
          <path d="M9 18V6l10-2v12" />
          <ellipse cx="6" cy="18" rx="3" ry="2.3" />
          <ellipse cx="16" cy="16" rx="3" ry="2.3" />
        </>
      ) : null}
      {name === 'phone' ? <path d="M7.2 3.5 10 7.8 8.2 9.6a14 14 0 0 0 6.2 6.2l1.8-1.8 4.3 2.8-.8 3.2c-.2.8-1 1.3-1.8 1.2C9.6 20.3 3.7 14.4 2.8 6.1c-.1-.8.4-1.6 1.2-1.8l3.2-.8Z" /> : null}
      {name === 'video' ? (
        <>
          <rect x="3" y="6" width="13" height="12" rx="3" />
          <path d="m16 10 5-3v10l-5-3" />
        </>
      ) : null}
      {name === 'paperclip' ? <path d="m9 17 7.6-7.6a3 3 0 1 0-4.2-4.2L4.8 12.8a5 5 0 0 0 7.1 7.1l7.2-7.2M8 14l7-7" /> : null}
      {name === 'smile' ? (
        <>
          <circle cx="12" cy="12" r="9" />
          <path d="M8.5 10h.01M15.5 10h.01M8.5 14a4.5 4.5 0 0 0 7 0" />
        </>
      ) : null}
      {name === 'play' ? <path d="m9 7 8 5-8 5V7Z" /> : null}
      {name === 'star' ? <path d="m12 3 2.7 5.5 6.1.9-4.4 4.3 1 6.1-5.4-2.9-5.4 2.9 1-6.1-4.4-4.3 6.1-.9L12 3Z" /> : null}
      {name === 'mail' ? (
        <>
          <rect x="3" y="5" width="18" height="14" rx="3" />
          <path d="m5 8 7 5 7-5" />
        </>
      ) : null}
      {name === 'user' ? (
        <>
          <circle cx="12" cy="8" r="3.5" />
          <path d="M5 20v-1.5A5.5 5.5 0 0 1 10.5 13h3a5.5 5.5 0 0 1 5.5 5.5V20" />
        </>
      ) : null}
      {name === 'trash' ? (
        <>
          <path d="M4 7h16M9 7V4h6v3M7 7l1 13h8l1-13M10 11v5M14 11v5" />
        </>
      ) : null}
      {name === 'more' ? (
        <>
          <circle cx="12" cy="5" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="12" r="1" fill="currentColor" stroke="none" />
          <circle cx="12" cy="19" r="1" fill="currentColor" stroke="none" />
        </>
      ) : null}
      {name === 'chevron' ? <path d="m9 6 6 6-6 6" /> : null}
    </svg>
  );
}

function avatarInitial(name: string) {
  return name.trim().slice(0, 1).toUpperCase() || 'M';
}

function avatarTone(value: string) {
  const tones = ['mint', 'blue', 'violet', 'coral'];
  const index = [...value].reduce((sum, character) => sum + character.charCodeAt(0), 0) % tones.length;
  return tones[index];
}

function formatMessageTime(timestamp: number) {
  return new Date(timestamp).toLocaleTimeString('ko-KR', {
    hour: 'numeric',
    minute: '2-digit',
  });
}

function formatRelativeTime(timestamp: number) {
  const date = new Date(timestamp);
  const today = new Date();
  if (
    date.getFullYear() === today.getFullYear() &&
    date.getMonth() === today.getMonth() &&
    date.getDate() === today.getDate()
  ) {
    return date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' });
  }

  return `${date.getMonth() + 1}월 ${date.getDate()}일`;
}

export default function MessagesPage() {
  const navigate = useNavigate();
  const authenticatedUser = useAuthStore((state) => state.user);
  const storedThreads = useMessageStore((state) => state.threads);
  const storedMessagesByThread = useMessageStore((state) => state.messagesByThread);
  const storedInboxStatus = useMessageStore((state) => state.inboxStatus);
  const storedInboxError = useMessageStore((state) => state.inboxError);
  const seedInbox = useMessageStore((state) => state.seedInbox);
  const addFriend = useMessageStore((state) => state.addFriend);
  const removeFriend = useMessageStore((state) => state.removeFriend);
  const createDirectThread = useMessageStore((state) => state.createDirectThread);
  const createGroupThread = useMessageStore((state) => state.createGroupThread);
  const sendMessage = useMessageStore((state) => state.sendMessage);
  const markThreadRead = useMessageStore((state) => state.markThreadRead);
  const storedFriendsByEmail = useFriendStore((state) => state.friendsByEmail);
  const user = authenticatedUser;
  const threads = storedThreads;
  const messagesByThread = storedMessagesByThread;
  const inboxStatus = storedInboxStatus;
  const inboxError = storedInboxError;

  const [activeSection, setActiveSection] = useState<MessagesSection>('messages');
  const [selectedThreadId, setSelectedThreadId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [messageDraft, setMessageDraft] = useState('');
  const [friendNameDraft, setFriendNameDraft] = useState('');
  const [friendEmailDraft, setFriendEmailDraft] = useState('');
  const [friendSearchQuery, setFriendSearchQuery] = useState('');
  const [friendSortOrder, setFriendSortOrder] = useState<'recent' | 'name'>('recent');
  const [groupNameDraft, setGroupNameDraft] = useState('');
  const [selectedGroupMemberEmails, setSelectedGroupMemberEmails] = useState<string[]>([]);
  const [formError, setFormError] = useState('');

  useEffect(() => {
    if (!user) {
      return;
    }

    void seedInbox({
      ownerEmail: user.email,
      ownerName: user.name,
    });
  }, [seedInbox, user]);

  const myFriends = useMemo(() => {
    if (!user) {
      return [];
    }

    return storedFriendsByEmail[user.email] ?? [];
  }, [storedFriendsByEmail, user]);

  const filteredFriends = useMemo(() => {
    const keyword = friendSearchQuery.trim().toLowerCase();
    const nextFriends = keyword
      ? myFriends.filter((friend) => `${friend.name} ${friend.email}`.toLowerCase().includes(keyword))
      : [...myFriends];

    if (friendSortOrder === 'name') {
      nextFriends.sort((left, right) => left.name.localeCompare(right.name, 'ko-KR'));
    }

    return nextFriends;
  }, [friendSearchQuery, friendSortOrder, myFriends]);

  const visibleFriends = filteredFriends;

  const suggestedFriends = useMemo(() => {
    if (!user) {
      return [];
    }

    return SUGGESTED_FRIENDS.filter(
      (friend) =>
        friend.email !== user.email &&
        !myFriends.some((savedFriend) => savedFriend.email === friend.email)
    );
  }, [myFriends, user]);

  const myThreads = useMemo(() => {
    if (!user) {
      return [];
    }

    return [...threads]
      .filter((thread) => thread.ownerEmail === user.email)
      .sort((left, right) => right.lastMessageAt - left.lastMessageAt);
  }, [threads, user]);

  const filteredThreads = useMemo(() => {
    const keyword = searchQuery.trim().toLowerCase();

    if (!keyword) {
      return myThreads;
    }

    return myThreads.filter((thread) => {
      const memberNames = thread.members.map((member) => member.name).join(' ');
      const target = `${thread.title} ${thread.lastPreview} ${memberNames}`.toLowerCase();
      return target.includes(keyword);
    });
  }, [myThreads, searchQuery]);

  const activeThreadId =
    selectedThreadId && filteredThreads.some((thread) => thread.id === selectedThreadId)
      ? selectedThreadId
      : filteredThreads[0]?.id ?? null;
  const activeThread =
    filteredThreads.find((thread) => thread.id === activeThreadId) ?? filteredThreads[0] ?? null;
  const activeMessages = activeThread ? messagesByThread[activeThread.id] ?? [] : [];

  const unreadCountByThread = useMemo(() => {
    if (!user) {
      return {};
    }

    return Object.fromEntries(
      myThreads.map((thread) => [
        thread.id,
        (messagesByThread[thread.id] ?? []).filter(
          (message) => message.authorEmail !== user.email && !message.isRead
        ).length,
      ])
    );
  }, [messagesByThread, myThreads, user]);

  const totalUnreadCount = useMemo(
    () => Object.values(unreadCountByThread).reduce((sum, count) => sum + count, 0),
    [unreadCountByThread]
  );

  useEffect(() => {
    if (!user || !activeThread) {
      return;
    }

    const hasUnreadMessages = (messagesByThread[activeThread.id] ?? []).some(
      (message) => message.authorEmail !== user.email && !message.isRead
    );

    if (!hasUnreadMessages) {
      return;
    }

    void markThreadRead({
      threadId: activeThread.id,
      readerEmail: user.email,
    });
  }, [activeThread, markThreadRead, messagesByThread, user]);

  const handleStartDirectMessage = async (friend: FriendProfile) => {
    if (!user) {
      navigate('/login');
      return;
    }

    const existingThread = myThreads.find(
      (thread) => thread.type === 'direct' && thread.participantEmail === friend.email
    );

    setActiveSection('messages');

    if (existingThread) {
      setSelectedThreadId(existingThread.id);
      return;
    }

    try {
      const threadId = await createDirectThread({
        ownerEmail: user.email,
        ownerName: user.name,
        participantName: friend.name,
        participantEmail: friend.email,
      });
      setSelectedThreadId(threadId);
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '대화를 시작하지 못했습니다.');
    }
  };

  const handleAddFriend = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const nextName = friendNameDraft.trim();
    const nextEmail = friendEmailDraft.trim().toLowerCase();

    if (!nextName || !nextEmail) {
      setFormError('친구 이름과 이메일을 모두 입력해주세요.');
      return;
    }

    try {
      await addFriend({
        ownerEmail: user.email,
        ownerName: user.name,
        friendName: nextName,
        friendEmail: nextEmail,
      });
      setFriendNameDraft('');
      setFriendEmailDraft('');
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '친구를 추가하지 못했습니다.');
    }
  };

  const handleQuickAddFriend = async (friend: FriendProfile) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await addFriend({
        ownerEmail: user.email,
        ownerName: user.name,
        friendName: friend.name,
        friendEmail: friend.email,
      });
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '친구를 추가하지 못했습니다.');
    }
  };

  const handleRemoveFriend = async (friendEmail: string) => {
    if (!user) {
      navigate('/login');
      return;
    }

    try {
      await removeFriend({
        ownerEmail: user.email,
        ownerName: user.name,
        friendEmail,
      });
      setSelectedGroupMemberEmails((current) => current.filter((email) => email !== friendEmail));
      setFormError('');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '친구를 삭제하지 못했습니다.');
    }
  };

  const handleToggleGroupMember = (email: string) => {
    setSelectedGroupMemberEmails((current) =>
      current.includes(email) ? current.filter((item) => item !== email) : [...current, email]
    );
  };

  const handleCreateGroupChat = async () => {
    if (!user) {
      navigate('/login');
      return;
    }

    const title = groupNameDraft.trim();
    if (!title) {
      setFormError('그룹 채팅 이름을 입력해주세요.');
      return;
    }

    const groupMembers = myFriends.filter((friend) => selectedGroupMemberEmails.includes(friend.email));
    if (!groupMembers.length) {
      setFormError('그룹 채팅에 초대할 친구를 1명 이상 선택해주세요.');
      return;
    }

    try {
      const threadId = await createGroupThread({
        ownerEmail: user.email,
        ownerName: user.name,
        title,
        members: groupMembers,
        openingMessage: `${title} 그룹 채팅이 시작되었습니다.`,
      });

      setSelectedThreadId(threadId);
      setGroupNameDraft('');
      setSelectedGroupMemberEmails([]);
      setFormError('');
      setActiveSection('messages');
    } catch (error) {
      setFormError(error instanceof Error ? error.message : '그룹 채팅을 만들지 못했습니다.');
    }
  };

  const handleSendMessage = async () => {
    if (!user || !activeThread) {
      return;
    }

    const content = messageDraft.trim();
    if (!content) {
      return;
    }

    setMessageDraft('');
    try {
      await sendMessage({
        threadId: activeThread.id,
        authorName: user.name,
        authorEmail: user.email,
        content,
      });
    } catch (error) {
      setMessageDraft(content);
      setFormError(error instanceof Error ? error.message : '메시지를 보내지 못했습니다.');
    }
  };

  const handleTextareaKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSendMessage();
    }
  };

  if (!user) {
    return (
      <div className="messages-page">
        <SiteHeader />
        <main className="messages-shell">
          <section className="messages-empty-card">
            <span className="messages-empty-icon"><MessageIcon name="message" size={28} /></span>
            <strong>메시지는 로그인 후 사용할 수 있습니다.</strong>
            <p>로그인하고 음악 친구들과 대화를 이어가세요.</p>
            <button type="button" className="messages-action-button" onClick={() => navigate('/login')}>
              로그인하기
            </button>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="messages-page">
      <SiteHeader />

      <main className={`messages-shell${activeSection === 'friends' ? ' is-friends' : ''}`}>
        <section className="messages-hero">
          <div>
            <span className="messages-kicker">MESSAGES</span>
            <h1>메시지와 친구 관리를 한 곳에서</h1>
            <p>메시지로 소통하고, 협업을 시작하고, 새로운 음악 친구들을 만나보세요.</p>
          </div>
          <button
            type="button"
            className="messages-action-button messages-hero-action"
            onClick={() => setActiveSection('friends')}
          >
            <MessageIcon name="add-user" />
            친구 추가
          </button>
        </section>

        <section className="messages-tabs" aria-label="메시지 화면 구분">
          <button
            type="button"
            className={`messages-tab-button${activeSection === 'messages' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('messages')}
          >
            <MessageIcon name="message" />
            메시지
            <span>{totalUnreadCount}</span>
          </button>
          <button
            type="button"
            className={`messages-tab-button${activeSection === 'friends' ? ' is-active' : ''}`}
            onClick={() => setActiveSection('friends')}
          >
            <MessageIcon name="group" />
            친구
            <span>{myFriends.length}</span>
          </button>
        </section>

        <section className={`messages-layout${activeSection === 'friends' ? ' is-friends' : ''}`}>
          <aside className={`messages-sidebar${activeSection === 'friends' ? ' is-friends' : ''}`}>
            {activeSection === 'messages' ? (
              <>
                <label className="messages-search-field">
                  <MessageIcon name="search" size={19} />
                  <input
                    type="search"
                    value={searchQuery}
                    onChange={(event) => setSearchQuery(event.target.value)}
                    placeholder="이름 또는 메시지 내용을 검색하세요..."
                  />
                </label>

                <div className="messages-thread-list">
                  {filteredThreads.map((thread) => {
                    const unreadCount = unreadCountByThread[thread.id] ?? 0;

                    return (
                      <button
                        key={thread.id}
                        type="button"
                        className={`messages-thread-card${
                          activeThread?.id === thread.id ? ' is-active' : ''
                        }`}
                        onClick={() => setSelectedThreadId(thread.id)}
                      >
                        <span className={`messages-avatar is-${avatarTone(thread.title)}`}>
                          <MessageIcon name="music" size={23} />
                        </span>
                        <span className="messages-thread-copy">
                          <span className="messages-thread-top">
                            <strong>{thread.title}</strong>
                            <time>{formatRelativeTime(thread.lastMessageAt)}</time>
                          </span>
                          <span className="messages-thread-preview">{thread.lastPreview}</span>
                        </span>
                        {unreadCount ? <em>{unreadCount}</em> : null}
                      </button>
                    );
                  })}
                  {!filteredThreads.length ? (
                    <div className="messages-list-empty">검색 결과가 없습니다.</div>
                  ) : null}
                </div>
              </>
            ) : (
              <>
                <section className="messages-section">
                  <div className="messages-section-head">
                    <strong>친구 추가</strong>
                    <span>이름과 이메일로 음악 친구를 등록하세요.</span>
                  </div>

                  <div className="messages-form-grid">
                    <label className="messages-input-field">
                      <MessageIcon name="user" size={18} />
                      <input
                        type="text"
                        value={friendNameDraft}
                        onChange={(event) => setFriendNameDraft(event.target.value)}
                        placeholder="친구 이름을 입력하세요"
                      />
                    </label>
                    <label className="messages-input-field">
                      <MessageIcon name="mail" size={18} />
                      <input
                        type="email"
                        value={friendEmailDraft}
                        onChange={(event) => setFriendEmailDraft(event.target.value)}
                        placeholder="friend@songmaker.dev"
                      />
                    </label>
                    <button
                      type="button"
                      className="messages-action-button"
                      onClick={() => void handleAddFriend()}
                    >
                      <MessageIcon name="add-user" size={18} />
                      친구 추가
                    </button>
                  </div>

                  <strong className="messages-suggested-title">추천 키워드</strong>
                  <div className="messages-suggested-row">
                    {suggestedFriends.map((friend) => (
                      <button
                        key={friend.email}
                        type="button"
                        className="messages-pill-button"
                        onClick={() => void handleQuickAddFriend(friend)}
                      >
                        <span>+</span> {friend.name}
                      </button>
                    ))}
                  </div>
                </section>

                <section className="messages-section">
                  <div className="messages-section-head">
                    <strong>그룹 채팅 만들기</strong>
                    <span>친구를 선택해 새 대화를 시작하세요.</span>
                  </div>

                  <label className="messages-input-field">
                    <MessageIcon name="group" size={18} />
                    <input
                      type="text"
                      value={groupNameDraft}
                      onChange={(event) => setGroupNameDraft(event.target.value)}
                      placeholder="예: Weekend Jam Crew"
                    />
                  </label>

                  <div className="messages-selected-row">
                    {selectedGroupMemberEmails.length ? (
                      selectedGroupMemberEmails.map((email) => {
                        const friend = myFriends.find((item) => item.email === email);
                        return (
                          <span key={email} className="messages-selected-chip">
                            {friend?.name ?? email}
                          </span>
                        );
                      })
                    ) : (
                      <span className="messages-helper-text">
                        오른쪽 친구 목록에서 그룹에 넣을 친구를 선택해주세요.
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    className="messages-action-button is-secondary"
                    onClick={() => void handleCreateGroupChat()}
                  >
                    <MessageIcon name="group" size={18} />
                    그룹 채팅 만들기
                  </button>
                </section>
              </>
            )}

            {inboxStatus === 'loading' ? (
              <p className="messages-feedback">메시지를 불러오는 중입니다..</p>
            ) : null}
            {inboxError ? <p className="messages-feedback is-error">{inboxError}</p> : null}
            {formError ? <p className="messages-feedback is-error">{formError}</p> : null}
          </aside>

          <section className={`messages-panel${activeSection === 'friends' ? ' is-friends' : ''}`}>
            {activeSection === 'messages' ? (
              activeThread ? (
                <>
                  <div className="messages-panel-head">
                    <span className={`messages-avatar is-${avatarTone(activeThread.title)}`}>
                      <MessageIcon name="music" size={23} />
                    </span>
                    <div className="messages-panel-title">
                      <strong>{activeThread.title}</strong>
                      <span>
                        {activeThread.type === 'group'
                          ? `${activeThread.members.length}명 참여 중`
                          : '온라인'}
                      </span>
                      {activeThread.type === 'group' ? (
                        <div className="messages-member-row">
                          {activeThread.members.map((member) => (
                            <span
                              key={`${activeThread.id}-${member.email}`}
                              className="messages-member-chip"
                            >
                              {member.name}
                            </span>
                          ))}
                        </div>
                      ) : null}
                    </div>

                    <div className="messages-panel-actions">
                      <button
                        type="button"
                        className="messages-icon-button is-plain"
                        onClick={() => navigate('/collab')}
                        aria-label="협업 페이지로 이동"
                        title="협업 페이지로 이동"
                      >
                        <MessageIcon name="more" size={19} />
                      </button>
                    </div>
                  </div>

                  <div className="messages-bubble-list">
                    <div className="messages-date-divider"><span>2026년 9월 21일 (월)</span></div>
                    {activeMessages.map((message) => {
                      const isMine = message.authorEmail === user.email;

                      return (
                        <article
                          key={message.id}
                          className={`messages-bubble${isMine ? ' is-mine' : ''}`}
                        >
                          {!isMine ? (
                            <span className={`messages-avatar is-small is-${avatarTone(message.authorName)}`}>
                              <MessageIcon name="music" size={19} />
                            </span>
                          ) : null}
                          <div className="messages-bubble-content">
                            {!isMine ? <strong>{message.authorName}</strong> : null}
                            <p>{message.content}</p>
                            <time>{formatMessageTime(message.createdAt)}</time>
                          </div>
                        </article>
                      );
                    })}
                  </div>

                  <div className="messages-composer">
                    <button type="button" className="messages-compose-icon" aria-label="파일 첨부" title="준비 중" disabled>
                      <MessageIcon name="paperclip" size={20} />
                    </button>
                    <textarea
                      value={messageDraft}
                      onChange={(event) => setMessageDraft(event.target.value)}
                      onKeyDown={handleTextareaKeyDown}
                      placeholder="메시지를 입력하세요..."
                    />
                    <button type="button" className="messages-compose-icon" aria-label="이모티콘" title="준비 중" disabled>
                      <MessageIcon name="smile" size={20} />
                    </button>
                    <button
                      type="button"
                      className="messages-send-button"
                      onClick={() => void handleSendMessage()}
                      aria-label="메시지 보내기"
                    >
                      <MessageIcon name="send" size={21} />
                    </button>
                  </div>
                </>
              ) : (
                <div className="messages-panel-empty">
                  <span className="messages-empty-icon"><MessageIcon name="message" size={28} /></span>
                  <strong>대화를 선택해 주세요.</strong>
                  <span>친구 탭에서 새로운 대화를 시작할 수도 있습니다.</span>
                </div>
              )
            ) : (
              <>
                <div className="messages-panel-head">
                  <span className="messages-panel-heading-icon"><MessageIcon name="group" /></span>
                  <div className="messages-panel-title">
                    <strong>친구 목록</strong>
                    <span>친구와 대화를 시작하거나 그룹 멤버를 선택하세요.</span>
                  </div>
                  <div className="messages-friend-tools">
                    <label className="messages-search-field">
                      <MessageIcon name="search" size={18} />
                      <input
                        type="search"
                        value={friendSearchQuery}
                        onChange={(event) => setFriendSearchQuery(event.target.value)}
                        placeholder="이름 또는 이메일로 검색하세요..."
                      />
                    </label>
                    <select
                      value={friendSortOrder}
                      onChange={(event) => setFriendSortOrder(event.target.value as 'recent' | 'name')}
                      aria-label="친구 정렬"
                    >
                      <option value="recent">최신순</option>
                      <option value="name">이름순</option>
                    </select>
                  </div>
                </div>

                <div className="messages-friends-overview">
                  <article className="messages-overview-card">
                    <span className="messages-stat-icon is-mint"><MessageIcon name="group" /></span>
                    <div><strong>{myFriends.length}</strong><span>친구</span></div>
                  </article>
                  <article className="messages-overview-card">
                    <span className="messages-stat-icon is-blue"><MessageIcon name="group" /></span>
                    <div><strong>{selectedGroupMemberEmails.length}</strong><span>그룹 선택</span></div>
                  </article>
                  <article className="messages-overview-card">
                    <span className="messages-stat-icon is-violet"><MessageIcon name="star" /></span>
                    <div><strong>{suggestedFriends.length}</strong><span>추천 친구</span></div>
                  </article>
                </div>

                <div className="messages-friends-board">
                  {visibleFriends.length ? (
                    visibleFriends.map((friend) => {
                      const isSelected = selectedGroupMemberEmails.includes(friend.email);

                      return (
                        <article
                          key={friend.email}
                          className={`messages-friend-card${isSelected ? ' is-selected' : ''}`}
                        >
                          <span className={`messages-avatar is-${avatarTone(friend.name)}`}>
                            {avatarInitial(friend.name)}
                          </span>
                          <div className="messages-friend-copy">
                            <strong>{friend.name}</strong>
                            <div className="messages-friend-meta">
                              <span>{friend.email}</span>
                            </div>
                          </div>

                          <div className="messages-friend-actions">
                            <button
                              type="button"
                              className="messages-inline-button"
                              onClick={() => void handleStartDirectMessage(friend)}
                            >
                              <MessageIcon name="message" size={17} />
                              메시지
                            </button>
                            <button
                              type="button"
                              className={`messages-inline-button${isSelected ? ' is-selected' : ''}`}
                              onClick={() => handleToggleGroupMember(friend.email)}
                            >
                              <MessageIcon name="group" size={17} />
                              {isSelected ? '그룹 해제' : '그룹 선택'}
                            </button>
                            <button
                              type="button"
                              className="messages-inline-button is-danger"
                              onClick={() => void handleRemoveFriend(friend.email)}
                              aria-label={`${friend.name} 친구 삭제`}
                            >
                              <MessageIcon name="trash" size={17} />
                            </button>
                          </div>
                        </article>
                      );
                    })
                  ) : (
                    <div className="messages-panel-empty">
                      <span className="messages-empty-icon"><MessageIcon name="add-user" size={28} /></span>
                      <strong>아직 등록된 친구가 없습니다.</strong>
                      <span>왼쪽에서 친구를 추가하면 바로 대화를 시작할 수 있습니다.</span>
                    </div>
                  )}
                </div>
                {visibleFriends.length ? (
                  <p className="messages-friends-total">총 {myFriends.length}명의 친구가 있습니다.</p>
                ) : null}
              </>
            )}
          </section>
        </section>
      </main>
    </div>
  );
}
