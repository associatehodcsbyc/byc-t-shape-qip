import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { LoginPage } from './pages/LoginPage';
import { ParticipantLanding } from './pages/ParticipantLanding';
import { HoDLanding } from './pages/HoDLanding';
import { AdminLanding } from './pages/AdminLanding';

const RootRedirect: React.FC = () => {
  const { user, rosterUser, loading, isParticipant, isHoD, isAdmin } = useAuth();

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
  if (isHoD) return <Navigate to="/hod" replace />;
  if (isAdmin) return <Navigate to="/admin" replace />;

  return <Navigate to="/login" replace />;
};

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
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
              <ProtectedRoute allowedRoles={['hod']}>
                <HoDLanding />
              </ProtectedRoute>
            }
          />

          <Route
            path="/admin"
            element={
              <ProtectedRoute allowedRoles={['admin']}>
                <AdminLanding />
              </ProtectedRoute>
            }
          />

          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
