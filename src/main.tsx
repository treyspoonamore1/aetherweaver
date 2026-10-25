import '@fontsource/cinzel/600.css';
import '@fontsource/cinzel/700.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/500.css';
import '@fontsource/inter/600.css';
import '@fontsource/inter/700.css';
import '@fontsource/jetbrains-mono/500.css';
import './index.css';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import { installRunHook } from './app/testHook';
import { loadKeyboardLayout } from './input/keyLabel';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');

void loadKeyboardLayout();
installRunHook();
createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
