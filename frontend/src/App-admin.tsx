import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import { AdminLayout } from './components/admin/AdminLayout';
import { ProtectedRoute } from './components/admin/ProtectedRoute';
import { LoginPage } from './pages/admin/LoginPage';
import { DashboardPage } from './pages/admin/DashboardPage';
import { DemandPage } from './pages/admin/DemandPage';
import { ProfessionalsPage } from './pages/admin/ProfessionalsPage';
import { ProfessionalDetailPage } from './pages/admin/ProfessionalDetailPage';
import { ProfessionalEditPage } from './pages/admin/ProfessionalEditPage';
import { UsersPage } from './pages/admin/UsersPage';
import { OrdersPage } from './pages/admin/OrdersPage';
import { EscalationsPage } from './pages/admin/EscalationsPage';
import { ZonesPage } from './pages/admin/ZonesPage';
import { CategoriesPage } from './pages/admin/CategoriesPage';
import { PlansPage } from './pages/admin/PlansPage';
import { SettingsPage } from './pages/admin/SettingsPage';
import { PromotionsPage } from './pages/admin/PromotionsPage';
import { PromptsPage } from './pages/admin/PromptsPage';
import { LLMCostsPage } from './pages/admin/LLMCostsPage';
import { WhatsAppCostsPage } from './pages/admin/WhatsAppCostsPage';

export function AppAdmin() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          {/* Admin login (public) */}
          <Route path="/login" element={<LoginPage />} />

          {/* Admin protected routes */}
          <Route element={<ProtectedRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/" element={<DashboardPage />} />
              <Route path="/demand" element={<DemandPage />} />
              <Route path="/professionals" element={<ProfessionalsPage />} />
              <Route
                path="/professionals/:id"
                element={<ProfessionalDetailPage />}
              />
              <Route path="/users" element={<UsersPage />} />
              <Route path="/orders" element={<OrdersPage />} />
              <Route path="/escalations" element={<EscalationsPage />} />
              <Route path="/zones" element={<ZonesPage />} />
              <Route path="/categories" element={<CategoriesPage />} />
              <Route path="/plans" element={<PlansPage />} />

              {/* SUPERADMIN only */}
              <Route element={<ProtectedRoute requiredRole="SUPERADMIN" />}>
                <Route path="/professionals/:id/edit" element={<ProfessionalEditPage />} />
                <Route path="/promotions" element={<PromotionsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/prompts" element={<PromptsPage />} />
                    <Route path="/llm-costs" element={<LLMCostsPage />} />
                    <Route path="/whatsapp-costs" element={<WhatsAppCostsPage />} />
                  </Route>
            </Route>
          </Route>
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}
