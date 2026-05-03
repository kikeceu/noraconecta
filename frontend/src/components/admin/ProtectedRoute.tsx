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
  loginPath = '/admin/login',
  fallbackPath = '/admin',
}: ProtectedRouteProps) {
  const { isAuthenticated, admin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to={loginPath} replace />;
  }

  if (requiredRole && admin?.role !== requiredRole) {
    return <Navigate to={fallbackPath} replace />;
  }

  return <Outlet />;
}
