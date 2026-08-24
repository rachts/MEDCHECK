import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { MedicineProvider } from './context/MedicineContext';
import { Landing } from './pages/Landing';
import { AppInterface } from './pages/AppInterface';
import { DrugExplorer } from './pages/DrugExplorer';
import { Auth } from './pages/Auth';
import { NotFound } from './pages/NotFound';
import { ErrorBoundary } from './components/ErrorBoundary';

export function App() {
  return (
    <ErrorBoundary>
      <MedicineProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Landing />} />
            <Route path="/app" element={<AppInterface />} />
            <Route path="/explorer" element={<DrugExplorer />} />
            <Route path="/auth" element={<Auth />} />
            {/* An unknown path renders a 404 rather than redirecting to "/": a
                silent bounce to the landing page is indistinguishable from a
                broken app and hides the URL that was actually wrong. */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </Router>
      </MedicineProvider>
    </ErrorBoundary>
  );
}

export default App;
