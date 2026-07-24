import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import Page from '../app/page.tsx';
import '../app/globals.css';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <div className="dark font-sans antialiased bg-background min-h-screen">
      <Page />
    </div>
  </StrictMode>,
);
