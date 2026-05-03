import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SimulatorPage } from './pages/SimulatorPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { ErrorScreen } from './pages/onboarding/components/ErrorScreen';
import { ProfessionalPanelPage } from './pages/panel/ProfessionalPanelPage';
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
import { resolveHostContext, type HostContext } from './lib/host';
import type { ReactNode } from 'react';

function renderAdminRoutes(context: HostContext): ReactNode {
  const loginPath = context === 'admin' ? '/login' : '/admin/login';
  const fallbackPath = context === 'admin' ? '/' : '/admin';

  const content = (
    <>
      {context === 'admin' && (
        <Route path="/" element={<Navigate to="/login" replace />} />
      )}
      <Route path="login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute loginPath={loginPath} fallbackPath={fallbackPath} />
        }
      >
        <Route element={<AdminLayout />}>
          <Route index element={<DashboardPage />} />
          <Route path="professionals" element={<ProfessionalsPage />} />
          <Route
            path="professionals/:id"
            element={<ProfessionalDetailPage />}
          />
          <Route path="users" element={<UsersPage />} />
          <Route path="orders" element={<OrdersPage />} />
          <Route path="escalations" element={<EscalationsPage />} />
          <Route path="zones" element={<ZonesPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="plans" element={<PlansPage />} />
          <Route
            element={
              <ProtectedRoute
                requiredRole="SUPERADMIN"
                loginPath={loginPath}
                fallbackPath={fallbackPath}
              />
            }
          >
            <Route path="settings" element={<SettingsPage />} />
          </Route>
        </Route>
      </Route>
    </>
  );

  if (context === 'all') {
    return <Route path="admin">{content}</Route>;
  }

  return content;
}

const landingRoutes = (
  <>
    <Route path="/" element={<Navigate to="/simulator" replace />} />
    <Route path="/simulator" element={<SimulatorPage />} />
  </>
);

function renderAppRoutes(context: HostContext): ReactNode {
  return (
    <>
      {context === 'app' && (
        <Route path="/" element={<ErrorScreen variant="missing" />} />
      )}
      <Route path="/verify/:token" element={<OnboardingPage />} />
      <Route path="/panel/:sessionToken" element={<ProfessionalPanelPage />} />
    </>
  );
}

export function App() {
  const context = resolveHostContext();

  const showLanding = context === 'all' || context === 'landing';
  const showApp = context === 'all' || context === 'app';
  const showAdmin = context === 'all' || context === 'admin';

  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {showLanding && landingRoutes}
          {showApp && renderAppRoutes(context)}
          {showAdmin && renderAdminRoutes(context)}
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
