import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SimulatorPage } from './pages/SimulatorPage';
import { OnboardingPage } from './pages/onboarding/OnboardingPage';

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/simulator" replace />} />
        <Route path="/simulator" element={<SimulatorPage />} />
        <Route path="/verify/:token" element={<OnboardingPage />} />
      </Routes>
    </BrowserRouter>
  );
}
