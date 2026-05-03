import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SimulatorPage } from './pages/SimulatorPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { AuthProvider } from './context/AuthContext';
import { AdminLayout } from './components/admin/AdminLayout';
import { ProtectedRoute } from './components/admin/ProtectedRoute';
import { LoginPage } from './pages/admin/LoginPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { ProfessionalsPage } from './pages/admin/ProfessionalsPage';
import { ProfessionalDetailPage } from './pages/admin/ProfessionalDetailPage';
import { UsersPage } from './pages/admin/UsersPage';
import { OrdersPage } from './pages/admin/OrdersPage';
import { EscalationsPage } from './pages/admin/EscalationsPage';
import { ZonesPage } from './pages/admin/ZonesPage';
import { CategoriesPage } from './pages/admin/CategoriesPage';
import { PlansPage } from './pages/admin/PlansPage';
import { SettingsPage } from './pages/admin/SettingsPage';

export function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Public routes */}
          <Route path="/" element={<Navigate to="/simulator" replace />} />
          <Route path="/simulator" element={<SimulatorPage />} />
          <Route path="/verify/:token" element={<OnboardingPage />} />

          {/* Admin login (public) */}
          <Route path="/admin/login" element={<LoginPage />} />

          {/* Admin protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<DashboardPage />} />
              <Route path="/admin/professionals" element={<ProfessionalsPage />} />
              <Route
                path="/admin/professionals/:id"
                element={<ProfessionalDetailPage />}
              />
              <Route path="/admin/users" element={<UsersPage />} />
              <Route path="/admin/orders" element={<OrdersPage />} />
              <Route path="/admin/escalations" element={<EscalationsPage />} />
              <Route path="/admin/zones" element={<ZonesPage />} />
              <Route path="/admin/categories" element={<CategoriesPage />} />
              <Route path="/admin/plans" element={<PlansPage />} />

              {/* SUPERADMIN only */}
              <Route element={<ProtectedRoute requiredRole="SUPERADMIN" />}>
                <Route path="/admin/settings" element={<SettingsPage />} />
              </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
