import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppLanding } from './App-landing';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppLanding />
  </StrictMode>,
);
