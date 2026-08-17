import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { MedicineProvider } from './context/MedicineContext';
import { Landing } from './pages/Landing';
import { AppInterface } from './pages/AppInterface';
import { Auth } from './pages/Auth';

export function App() {
  return (
    <MedicineProvider>
      <Router>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/app" element={<AppInterface />} />
          <Route path="/auth" element={<Auth />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </MedicineProvider>
  );
}

export default App;
