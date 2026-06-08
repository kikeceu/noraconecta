import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { AdminRole } from '../../types/admin';

interface ProtectedRouteProps {
  requiredRole?: AdminRole;
  loginPath?: string;
  fallbackPath?: string;
}

export function ProtectedRoute({
  requiredRole,
  loginPath = '/login',
  fallbackPath = '/',
}: ProtectedRouteProps) {
  const { isAuthenticated, admin, isLoading } = useAuth();

  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-gray-300 border-t-green-700" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return <Navigate to={loginPath} replace />;
  }

  if (requiredRole && admin?.role !== requiredRole) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
