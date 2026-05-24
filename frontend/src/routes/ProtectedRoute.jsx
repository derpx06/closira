import React from 'react';
import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';

const ProtectedRoute = ({ allowedRoles = [], redirectTo = '/auth/login', unauthorizedTo = '/unauthorized' }) => {
  const { user, isAuthenticated, isLoading, canAccess } = useAuth();
  const location = useLocation();

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <div className="inline-flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3 shadow-sm">
          <div className="animate-spin rounded-full h-5 w-5 border-2 border-primary border-t-transparent"></div>
          <span className="text-sm font-semibold text-slate-700">Validating access...</span>
        </div>
      </div>
    );
  }

  // Check if unauthenticated
  if (!isAuthenticated) {
    return <Navigate to={redirectTo} replace state={{ from: location }} />;
  }

  // Check optional role gates
  if (allowedRoles.length > 0 && !canAccess(allowedRoles)) {
    return <Navigate to={unauthorizedTo} replace state={{ from: location, role: user?.role }} />;
  }

  // Render child routes
  return <Outlet />;
};

export default ProtectedRoute;
