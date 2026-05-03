import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';

export function AppApp() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/verify/:token" element={<OnboardingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
