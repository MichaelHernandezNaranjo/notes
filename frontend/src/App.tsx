import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AppLayout } from './app/AppLayout';
import { useAuth } from './features/auth/AuthContext';
import { rememberReturnTo } from './features/auth/returnTo';
import { PublicSharePage } from './features/sharing/PublicSharePage';
import { LoginPage } from './pages/LoginPage';
import { LegalPage } from './pages/LegalPage';
import { GoogleCallbackPage } from './pages/GoogleCallbackPage';
import { SettingsPage } from './features/settings/SettingsPage';
import { AdminPage } from './features/admin/AdminPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const location = useLocation();
  if (!user) {
    // Keep the destination (e.g. a shared note link) so it opens right after signing in.
    rememberReturnTo(location.pathname + location.search);
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
}

/** Only super admins reach the panel (the API enforces it as well; this just avoids a dead screen). */
function AdminRoute({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  if (!user?.isSuperAdmin) return <Navigate to="/notes" replace />;
  return <>{children}</>;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/terms" element={<LegalPage kind="terms" />} />
      <Route path="/privacy" element={<LegalPage kind="privacy" />} />
      <Route path="/auth/google/callback" element={<GoogleCallbackPage />} />
      {/* Anonymous, read-only viewer for public share links. */}
      <Route path="/s/:token" element={<PublicSharePage />} />
      <Route path="/s/:token/:nodeId" element={<PublicSharePage />} />

      <Route
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route path="/" element={<Navigate to="/notes" replace />} />
        <Route path="/notes" element={null} />
        <Route path="/notes/:nodeId" element={null} />
        <Route path="/settings" element={<SettingsPage />} />
        <Route path="/admin" element={<AdminRoute><AdminPage /></AdminRoute>} />
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}
