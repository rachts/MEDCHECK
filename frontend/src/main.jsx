import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);

// Service worker registration.
//
// Production only, and deliberately so: in `vite dev` a worker intercepting
// navigations fights with HMR and can serve a stale module graph, which looks like
// an application bug rather than a caching one.
//
// Registered after `load` so fetching and installing the worker never competes with
// the initial render for bandwidth.
//
// Failure is non-fatal by design -- the app is fully functional without a worker,
// so a rejected registration (unsupported browser, insecure origin, or a host that
// declines to serve /sw.js) is logged and otherwise ignored.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js', { scope: '/' }).catch((err) => {
      console.warn('MEDCHECK service worker registration failed:', err);
    });
  });
}
