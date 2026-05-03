import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { AppApp } from './App-app';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppApp />
  </StrictMode>,
);
