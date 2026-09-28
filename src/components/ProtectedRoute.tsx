import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { Role } from '../types';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: Role[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, rosterUser, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-christ-navy border-t-christ-gold rounded-full animate-spin mb-4" />
        <p className="text-gray-600 font-medium text-sm">Verifying institutional credentials...</p>
      </div>
    );
  }

  if (!user || !rosterUser) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (allowedRoles && !allowedRoles.includes(rosterUser.role)) {
    // Route to user's permitted role landing
    if (rosterUser.role === 'participant') return <Navigate to="/participant" replace />;
    if (rosterUser.role === 'hod' || rosterUser.role === 'coordinator' || rosterUser.role === 'resource_person') return <Navigate to="/hod" replace />;
    if (rosterUser.role === 'admin') return <Navigate to="/admin" replace />;
  }

  return <>{children}</>;
};
