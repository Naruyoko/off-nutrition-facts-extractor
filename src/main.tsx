import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { ThemeProvider } from './context/ThemeContext';
import { TaxonomyProvider } from './context/TaxonomyContext';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ThemeProvider>
      <TaxonomyProvider>
        <App />
      </TaxonomyProvider>
    </ThemeProvider>
  </StrictMode>,
);
