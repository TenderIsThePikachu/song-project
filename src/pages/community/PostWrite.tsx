import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import SiteHeader from '../../components/layout/SiteHeader';
import { DUMMY_POSTS } from '../../dummy/mockData';
import { useAuthStore } from '../../store/authStore';
import { useCommunityStore } from '../../store/communityStore';
import './PostWrite.css';

const TITLE_LIMIT = 120;
const CONTENT_LIMIT = 2000;

const CATEGORY_OPTIONS = ['일반', '질문', '정보'];
const TOOLBAR_ITEMS = ['B', 'I', 'U', '•', '1.', '#'];
const POPULAR_TAGS = ['작곡', '미디', '피아노', '질문', '작곡도구', '배경음악', 'AI작곡', '플러그인'];
const POPULAR_IMAGES = [
  '/landing-assets/shared-fallback-film.jpg',
  '/landing-assets/shared-fallback-groove.jpg',
  '/landing-assets/shared-fallback-dream.jpg',
];

type AttachmentPreview = {
  id: string;
  file: File;
  url: string;
};

function getPreviewTags(tagInput: string) {
  return tagInput
    .split(/[,\s]+/)
    .map((tag) => tag.replace(/^#/, '').trim())
    .filter(Boolean)
    .slice(0, 10);
}

export default function PostWrite() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const user = useAuthStore((state) => state.user);
  const posts = useCommunityStore((state) => state.posts);
  const bootstrapStatus = useCommunityStore((state) => state.bootstrapStatus);
  const seedCommunity = useCommunityStore((state) => state.seedCommunity);
  const createPost = useCommunityStore((state) => state.createPost);
  const updatePost = useCommunityStore((state) => state.updatePost);
  const editPostId = searchParams.get('edit');
  const isPreviewMode = searchParams.get('preview') === '1';
  const editingPost = editPostId ? posts.find((post) => post.id === editPostId) ?? null : null;
  const [category, setCategory] = useState(() => editingPost?.category ?? '일반');
  const [title, setTitle] = useState(() => editingPost?.title ?? '');
  const [content, setContent] = useState(() => editingPost?.content ?? '');
  const [tagInput, setTagInput] = useState(() => (editingPost?.tags ?? []).join(', '));
  const [attachments, setAttachments] = useState<AttachmentPreview[]>([]);

  const previewTags = getPreviewTags(tagInput);
  const popularPosts = [...(posts.length ? posts : DUMMY_POSTS)]
    .sort((a, b) => (b.viewCount ?? 0) - (a.viewCount ?? 0))
    .slice(0, 3);
  const isReadyToSubmit = Boolean(title.trim() && content.trim());

  useEffect(() => {
    void seedCommunity().catch((error) => {
      console.error(error);
    });
  }, [seedCommunity]);

  useEffect(() => {
    if (!user && !isPreviewMode) {
      navigate('/login', { replace: true });
    }
  }, [isPreviewMode, navigate, user]);

  const handleAttachmentChange = (event: ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = Array.from(event.target.files ?? []).slice(0, Math.max(0, 10 - attachments.length));
    event.target.value = '';
    if (!selectedFiles.length) return;

    setAttachments((current) => [
      ...current,
      ...selectedFiles.map((file) => ({
        id: `${file.name}-${file.lastModified}-${crypto.randomUUID()}`,
        file,
        url: URL.createObjectURL(file),
      })),
    ]);
  };

  const removeAttachment = (attachmentId: string) => {
    setAttachments((current) => {
      const target = current.find((attachment) => attachment.id === attachmentId);
      if (target) URL.revokeObjectURL(target.url);
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
  };

  const removeTag = (tagToRemove: string) => {
    setTagInput(previewTags.filter((tag) => tag !== tagToRemove).join(', '));
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!user) {
      navigate('/login');
      return;
    }

    const trimmedTitle = title.trim();
    const trimmedContent = content.trim();
    const tags = getPreviewTags(tagInput);

    if (!trimmedTitle || !trimmedContent) {
      return;
    }

    if (editingPost) {
      await updatePost({
        postId: editingPost.id,
        title: trimmedTitle,
        content: trimmedContent,
        category,
        tags,
        userEmail: user.email,
      });
      navigate(`/community/${editingPost.id}`);
      return;
    }

    const createdPostId = await createPost({
      title: trimmedTitle,
      content: trimmedContent,
      category,
      tags,
      authorName: user.name,
      authorEmail: user.email,
    });

    navigate(`/community/${createdPostId}`);
  };

  if (
    editPostId &&
    (bootstrapStatus === 'idle' || bootstrapStatus === 'loading') &&
    !editingPost
  ) {
    return (
      <div className="community-write-page">
        <SiteHeader activeSection="community" />
        <main className="community-write-shell">
          <section className="community-write-hero-card">
            <div className="community-write-hero-copy">
              <div className="community-write-hero-badges">
                <span className="community-write-eyebrow">LOADING</span>
              </div>
              <h1 className="community-write-title">게시글을 불러오는 중입니다</h1>
              <p className="community-write-description">
                수정할 게시글 정보를 서버에서 가져오고 있습니다.
              </p>
            </div>
          </section>
        </main>
      </div>
    );
  }

  return (
    <div className="community-write-page">
      <SiteHeader activeSection="community" />

      <main className="community-write-shell">
        <section className="community-write-intro">
          <div className="community-write-intro-copy">
            <span className="community-write-intro-label">
              <i aria-hidden="true" />
              COMMUNITY EDITOR
            </span>
            <h1>
              작업 맥락과 고민을
              <br />
              <em>읽기 쉬운 글</em>로 정리해보세요
            </h1>
            <p>
              질문, 장비 추천, 작곡 아이디어처럼 맥락이 중요한 글일수록
              <br />
              제목과 본문 구조가 또렷할수록 반응이 좋아집니다.
            </p>
            <button type="button" onClick={() => navigate('/community')}>
              <span aria-hidden="true">←</span>
              게시판으로 돌아가기
            </button>
          </div>
          <div className="community-write-intro-topics" aria-label="작성 가능한 게시글 유형">
            <span>일반 이야기</span>
            <span>궁금한 질문</span>
            <span>유용한 정보</span>
          </div>
        </section>

        <form className="community-write-layout" onSubmit={handleSubmit}>
          <section className="community-write-main-card">
            <div className="community-write-category-tabs" role="tablist" aria-label="카테고리 선택">
              {CATEGORY_OPTIONS.map((option) => (
                <button
                  key={option}
                  type="button"
                  className={category === option ? 'is-active' : ''}
                  onClick={() => setCategory(option)}
                >
                  {option}
                </button>
              ))}
            </div>

            <div className="community-write-form-body">
              <label className="community-write-field community-write-field--title">
                <span className="community-write-label">제목</span>
                <div className="community-write-title-wrap">
                  <input
                    type="text"
                    value={title}
                    onChange={(event) => setTitle(event.target.value.slice(0, TITLE_LIMIT))}
                    placeholder="제목을 입력해 주세요."
                  />
                  <span className="community-write-counter">{title.length}/{TITLE_LIMIT}</span>
                </div>
              </label>

              <div className="community-write-content-field">
                <span className="community-write-label">내용</span>
                <section className="community-write-editor">
                  <div className="community-write-toolbar">
                    {TOOLBAR_ITEMS.map((item) => (
                      <button key={item} type="button" aria-label={`서식 ${item}`}>
                        {item}
                      </button>
                    ))}
                    <span className="community-write-toolbar-divider" />
                    <button type="button" aria-label="링크 첨부">⌁</button>
                    <button type="button" aria-label="이미지 첨부">▧</button>
                    <button type="button" aria-label="더보기">•••</button>
                  </div>

                  <label className="community-write-editor-body" aria-label="게시글 내용 입력">
                    <textarea
                      value={content}
                      onChange={(event) => setContent(event.target.value.slice(0, CONTENT_LIMIT))}
                      placeholder="내용을 입력해 주세요."
                    />
                    <span className="community-write-editor-count">{content.length}/{CONTENT_LIMIT}</span>
                  </label>
                </section>
              </div>

              <section className="community-write-attachments" aria-label="미디어 첨부">
                <label className="community-write-upload-dropzone">
                  <span className="community-write-upload-icon" aria-hidden="true">▧</span>
                  <span>
                    <strong>이미지 또는 파일을 선택해서 올려주세요.</strong>
                    <small>이미지, 동영상 등 다양한 파일을 첨부할 수 있습니다. (최대 10개)</small>
                  </span>
                  <input type="file" accept="image/*,video/*" multiple onChange={handleAttachmentChange} />
                </label>

                {attachments.length ? (
                  <div className="community-write-attachment-list">
                    {attachments.map((attachment) => (
                      <figure key={attachment.id} className="community-write-attachment-preview">
                        {attachment.file.type.startsWith('video/') ? (
                          <video src={attachment.url} muted />
                        ) : (
                          <img src={attachment.url} alt={attachment.file.name} />
                        )}
                        <button
                          type="button"
                          onClick={() => removeAttachment(attachment.id)}
                          aria-label={`${attachment.file.name} 삭제`}
                        >
                          ×
                        </button>
                      </figure>
                    ))}
                    {attachments.length < 10 ? (
                      <label className="community-write-attachment-add" aria-label="파일 추가">
                        <span>+</span>
                        <input type="file" accept="image/*,video/*" multiple onChange={handleAttachmentChange} />
                      </label>
                    ) : null}
                  </div>
                ) : null}
              </section>

              <label className="community-write-tag-field" aria-label="태그 입력">
                <span className="community-write-label">태그</span>
                <div className="community-write-tag-input-wrap">
                  <input
                    type="text"
                    value={tagInput}
                    onChange={(event) => setTagInput(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') event.preventDefault();
                    }}
                    placeholder="태그를 입력하고 Enter를 눌러 추가하세요. (예: 작곡, 피아노, 질문)"
                  />
                  <span>{previewTags.length}/10</span>
                </div>
                {previewTags.length ? (
                  <span className="community-write-tag-list">
                    {previewTags.map((tag) => (
                      <button key={tag} type="button" onClick={() => removeTag(tag)}>
                        #{tag}<span aria-hidden="true">×</span>
                      </button>
                    ))}
                  </span>
                ) : null}
              </label>
            </div>

            <div className="community-write-actions">
              <button
                type="button"
                className="community-write-cancel-button"
                onClick={() => navigate('/community')}
              >
                취소
              </button>
              <button
                type="submit"
                className="community-write-submit-button"
                disabled={!isReadyToSubmit}
              >
                {editingPost ? '게시글 수정' : '게시글 등록'}
              </button>
            </div>
          </section>

          <aside className="community-write-side-column">
            <section className="community-write-side-card community-write-popular-posts">
              <header>
                <strong>인기 글</strong>
                <button type="button" onClick={() => navigate('/community')}>더보기 ›</button>
              </header>
              <div>
                {popularPosts.map((post, index) => (
                  <button key={post.id} type="button" onClick={() => navigate(`/community/${post.id}`)}>
                    <i style={{ backgroundImage: `url(${POPULAR_IMAGES[index]})` }} />
                    <span>
                      <strong>{post.title}</strong>
                      <small>{post.authorName} · 조회 {(post.viewCount ?? 0).toLocaleString('ko-KR')} · 댓글 {post.commentCount ?? 0}</small>
                    </span>
                  </button>
                ))}
              </div>
            </section>

            <section className="community-write-side-card community-write-popular-tags">
              <header><strong>인기 태그</strong></header>
              <div>
                {POPULAR_TAGS.map((tag) => (
                  <button key={tag} type="button" onClick={() => setTagInput((current) => current ? `${current}, ${tag}` : tag)}>
                    #{tag}
                  </button>
                ))}
              </div>
            </section>
          </aside>
        </form>
      </main>
    </div>
  );
}
