import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { readInitialTheme } from './hooks/useTheme';
import 'highlight.js/styles/github-dark.css';
import './index.css';

// Apply theme before first paint to avoid a flash of the wrong theme.
document.documentElement.dataset.theme = readInitialTheme();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
