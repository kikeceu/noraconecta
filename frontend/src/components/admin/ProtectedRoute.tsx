import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import type { AdminRole } from '../../types/admin';

interface ProtectedRouteProps {
  requiredRole?: AdminRole;
}

export function ProtectedRoute({ requiredRole }: ProtectedRouteProps) {
  const { isAuthenticated, admin } = useAuth();

  if (!isAuthenticated) {
    return <Navigate to="/admin/login" replace />;
  }

  if (requiredRole && admin?.role !== requiredRole) {
    return <Navigate to="/admin" replace />;
  }

  return <Outlet />;
}
