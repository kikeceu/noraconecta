import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';
import { ErrorScreen } from './pages/onboarding/components/ErrorScreen';
import { ProfessionalPanelPage } from './pages/panel/ProfessionalPanelPage';

export function AppApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<ErrorScreen variant="missing" />} />
        <Route path="/verify/:token" element={<OnboardingPage />} />
        <Route path="/panel/:sessionToken" element={<ProfessionalPanelPage />} />
      </Routes>
    </BrowserRouter>
  );
}
