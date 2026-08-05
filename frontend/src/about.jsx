import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import AboutUs from './pages/AboutUs';
import './index.css';
import './App.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AboutUs />
  </StrictMode>
);
