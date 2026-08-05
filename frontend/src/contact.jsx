import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import ContactUs from './pages/ContactUs';
import './index.css';
import './App.css';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ContactUs />
  </StrictMode>
);
