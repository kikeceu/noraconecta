import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { ErrorScreen } from './pages/onboarding/components/ErrorScreen';
import { ProfessionalPanelPage } from './pages/panel/ProfessionalPanelPage';
import { PlanesPage } from './pages/app/PlanesPage';
import { ProfessionalPublicPage } from './pages/public/ProfessionalPublicPage';

export function AppApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ErrorScreen variant="missing" />} />
        <Route path="/verify/:token" element={<OnboardingPage />} />
        <Route path="/panel/:sessionToken" element={<ProfessionalPanelPage />} />
        <Route path="/planes" element={<PlanesPage />} />
        <Route path="/pro/:id" element={<ProfessionalPublicPage />} />
      </Routes>
    </BrowserRouter>
  );
}
