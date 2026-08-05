import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import PrivacyPolicy from './pages/PrivacyPolicy';
import './index.css';
import './App.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <PrivacyPolicy />
  </StrictMode>
);
