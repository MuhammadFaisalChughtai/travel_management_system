import { Navigate, Outlet } from 'react-router-dom';
import { useAuthStore } from '../store/authStore';

export function AuthRoute() {
  const { isAuthenticated, user } = useAuthStore();

  if (isAuthenticated) {
    if (user?.role === 'SUPER_ADMIN') {
      return <Navigate to="/super-admin/dashboard" replace />;
    }
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
