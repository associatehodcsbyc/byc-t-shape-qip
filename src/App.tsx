import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { Footer } from './components/Footer';

// Code-split route pages to optimize cold start and reduce initial bundle size
const LoginPage = lazy(() => import('./pages/LoginPage').then((m) => ({ default: m.LoginPage })));
const ParticipantLanding = lazy(() => import('./pages/ParticipantLanding').then((m) => ({ default: m.ParticipantLanding })));
const HoDLanding = lazy(() => import('./pages/HoDLanding').then((m) => ({ default: m.HoDLanding })));
const AdminLanding = lazy(() => import('./pages/AdminLanding').then((m) => ({ default: m.AdminLanding })));
const ActivityRunnerPage = lazy(() => import('./pages/ActivityRunnerPage').then((m) => ({ default: m.ActivityRunnerPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));

const PageLoader: React.FC = () => (
  <div className="flex-1 flex flex-col items-center justify-center p-12 space-y-3 min-h-[50vh]">
    <div className="w-8 h-8 border-3 border-christ-navy border-t-christ-gold rounded-full animate-spin" />
    <span className="text-xs text-slate-400 font-medium">Loading workspace...</span>
  </div>
);

const AppLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  return (
    <div className="min-h-screen flex flex-col justify-between bg-slate-50">
      <div className="flex-1 flex flex-col">{children}</div>
      <Footer />
    </div>
  );
};

const RootRedirect: React.FC = () => {
  const { user, rosterUser, loading, isParticipant, isHoD, isCoordinator, isResourcePerson, isAdmin } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-christ-navy border-t-christ-gold rounded-full animate-spin mb-4" />
        <p className="text-gray-300 font-medium text-sm">Loading CHRIST QIP Portal...</p>
      </div>
    );
  }

  if (!user || !rosterUser) {
    return <Navigate to="/login" replace />;
  }

  if (isParticipant) return <Navigate to="/participant" replace />;
  if (isHoD || isCoordinator || isResourcePerson) return <Navigate to="/hod" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppLayout>
          <Suspense fallback={<PageLoader />}>
            <Routes>
              <Route path="/" element={<RootRedirect />} />
              <Route path="/login" element={<LoginPage />} />

              <Route
                path="/participant"
                element={
                  <ProtectedRoute allowedRoles={['participant']}>
                    <ParticipantLanding />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/hod"
                element={
                  <ProtectedRoute allowedRoles={['hod', 'coordinator', 'admin', 'resource_person']}>
                    <HoDLanding />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin', 'hod', 'coordinator']}>
                    <AdminLanding />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/activity/:activityId"
                element={
                  <ProtectedRoute allowedRoles={['participant', 'hod', 'coordinator', 'admin', 'resource_person']}>
                    <ActivityRunnerPage />
                  </ProtectedRoute>
                }
              />

              <Route
                path="/analytics"
                element={
                  <ProtectedRoute allowedRoles={['hod', 'coordinator', 'admin', 'resource_person']}>
                    <AnalyticsPage />
                  </ProtectedRoute>
                }
              />

              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </Suspense>
        </AppLayout>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
