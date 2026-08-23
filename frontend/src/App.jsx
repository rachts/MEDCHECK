import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MedicineProvider } from './context/MedicineContext';
import { Landing } from './pages/Landing';
import { AppInterface } from './pages/AppInterface';
import { DrugExplorer } from './pages/DrugExplorer';
import { Auth } from './pages/Auth';
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
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </Router>
      </MedicineProvider>
    </ErrorBoundary>
  );
}

export default App;
