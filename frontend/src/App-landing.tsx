import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { SimulatorPage } from './pages/SimulatorPage';

export function AppLanding() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Navigate to="/simulator" replace />} />
        <Route path="/simulator" element={<SimulatorPage />} />
      </Routes>
    </BrowserRouter>
  );
}
