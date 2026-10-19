export interface Post {
  id: string;
  title: string;
  content: string;
  authorId: string;
  authorEmail?: string;
  authorName: string;
  createdAt: number;
  likeCount: number;
  category?: string;
  commentCount?: number;
  viewCount?: number;
  isHot?: boolean;
  tags?: string[];
}

export interface CommunityTrack {
  id: string;
  title: string;
  progression: string;
  mood: string;
  palette: string;
}

export interface Comment {
  id: string;
  postId: string;
  content: string;
  authorName: string;
  authorEmail?: string;
  createdAt: number;
  likeCount?: number;
  parentId?: string | null;
}
