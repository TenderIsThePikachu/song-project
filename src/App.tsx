import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import ProtectedRoute from './components/auth/ProtectedRoute';

const MainPage = lazy(() => import('./pages/MainPage'));
const Composer = lazy(() =>
  import('./pages/Composer').then((module) => ({ default: module.Composer }))
);
const ProjectLibraryPage = lazy(() => import('./pages/ProjectLibraryPage'));
const AirGuitar = lazy(() => import('./pages/AirGuitar'));
const CollabPage = lazy(() => import('./pages/CollabPage'));
const CollabRoomPage = lazy(() => import('./pages/CollabRoomPage'));
const MessagesPage = lazy(() => import('./pages/MessagesPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const SettingsPage = lazy(() => import('./pages/SettingsPage'));
const ForgotPasswordPage = lazy(() => import('./pages/auth/ForgotPasswordPage'));
const LoginPage = lazy(() => import('./pages/auth/LoginPage'));
const SignupPage = lazy(() => import('./pages/auth/SignupPage'));
const MusicShare = lazy(() => import('./pages/community/MusicShare'));
const MusicShareDetail = lazy(() => import('./pages/community/MusicShareDetail'));
const ShortsPage = lazy(() => import('./pages/community/ShortsPage'));
const PostDetail = lazy(() => import('./pages/community/PostDetail'));
const PostList = lazy(() => import('./pages/community/PostList'));
const PostWrite = lazy(() => import('./pages/community/PostWrite'));
const SessionRecruitPage = lazy(() => import('./pages/community/SessionRecruitPage'));
const SessionRecruitDetailPage = lazy(() => import('./pages/community/SessionRecruitDetailPage'));

function AppFallback() {
  return <div style={{ minHeight: '100vh', background: '#15161a' }} />;
}

function App() {
  return (
    <BrowserRouter>
      <AppErrorBoundary>
        <Suspense fallback={<AppFallback />}>
          <Routes>
            <Route path="/" element={<MainPage />} />
            <Route path="/login" element={<LoginPage />} />
            <Route path="/signup" element={<SignupPage />} />
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/learn" element={<Navigate to="/composer" replace />} />
            <Route path="/composer" element={<Composer />} />
            <Route path="/air-guitar" element={<AirGuitar />} />
            <Route path="/library" element={<ProjectLibraryPage />} />
            <Route path="/community" element={<PostList />} />
            <Route path="/community/music" element={<MusicShare />} />
            <Route path="/community/music/:trackId" element={<MusicShareDetail />} />
            <Route path="/community/shorts" element={<ShortsPage />} />
            <Route path="/community/sessions" element={<SessionRecruitPage />} />
            <Route path="/community/sessions/:postId" element={<SessionRecruitDetailPage />} />
            <Route path="/community/write" element={<PostWrite />} />
            <Route path="/community/:id" element={<PostDetail />} />
            <Route element={<ProtectedRoute />}>
              <Route path="/collab" element={<CollabPage />} />
              <Route path="/collab/:projectId" element={<CollabRoomPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/messages" element={<MessagesPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </AppErrorBoundary>
    </BrowserRouter>
  );
}

export default App;
