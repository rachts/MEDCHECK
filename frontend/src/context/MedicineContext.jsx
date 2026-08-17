import React, { createContext, useContext, useState, useCallback } from 'react';
import { checkMedicines } from '../lib/api';

const MedicineContext = createContext(null);

export const DEMO_PRESETS = [
  {
    name: 'High Risk (Warfarin + Aspirin)',
    description: 'Severe anticoagulant & antiplatelet bleeding hazard',
    medicines: ['Warfarin', 'Aspirin'],
    expectedSeverity: 'high',
  },
  {
    name: 'Moderate Risk (Aspirin + Ibuprofen)',
    description: 'Competitive cardioprotective inhibition & GI irritation',
    medicines: ['Aspirin', 'Ibuprofen'],
    expectedSeverity: 'moderate',
  },
  {
    name: 'Safe Combination (Paracetamol + Amoxicillin)',
    description: 'Standard antibiotic & analgesic without direct kinetic conflict',
    medicines: ['Paracetamol', 'Amoxicillin'],
    expectedSeverity: 'safe',
  },
  {
    name: 'Triple Regimen (Warfarin + Aspirin + Ibuprofen)',
    description: 'Multi-drug cumulative NSAID & blood thinner risk',
    medicines: ['Warfarin', 'Aspirin', 'Ibuprofen'],
    expectedSeverity: 'high',
  },
];

export function MedicineProvider({ children }) {
  const [medicines, setMedicines] = useState([
    { id: '1', name: 'Paracetamol' },
    { id: '2', name: 'Ibuprofen' },
  ]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(false);
  const [inputError, setInputError] = useState(null);

  const addMedicine = useCallback((rawName) => {
    setInputError(null);
    setError(null);
    if (!rawName || !rawName.trim()) {
      setInputError('Please enter a medicine name.');
      return false;
    }

    const trimmed = rawName.trim();
    const normalized = trimmed.toLowerCase();

    const exists = medicines.some((m) => m.name.toLowerCase() === normalized);
    if (exists) {
      setInputError(`"${trimmed}" is already in your medicine basket.`);
      return false;
    }

    const newMed = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      name: trimmed.charAt(0).toUpperCase() + trimmed.slice(1),
    };

    setMedicines((prev) => [...prev, newMed]);
    setResults(null); // Clear previous results when basket changes
    return true;
  }, [medicines]);

  const removeMedicine = useCallback((id) => {
    setMedicines((prev) => prev.filter((m) => m.id !== id));
    setResults(null);
    setError(null);
    setInputError(null);
  }, []);

  const clearBasket = useCallback(() => {
    setMedicines([]);
    setResults(null);
    setError(null);
    setInputError(null);
  }, []);

  const loadPreset = useCallback((preset) => {
    const newMeds = preset.medicines.map((name, index) => ({
      id: `demo-${index}-${Date.now()}`,
      name,
    }));
    setMedicines(newMeds);
    setResults(null);
    setError(null);
    setInputError(null);
  }, []);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => !prev);
  }, []);

  const checkSafety = useCallback(async () => {
    if (medicines.length < 2) {
      setError('Please add at least two medicines to check for potential interactions.');
      return;
    }

    setLoading(true);
    setError(null);
    setInputError(null);

    try {
      const medNames = medicines.map((m) => m.name);
      const data = await checkMedicines(medNames);
      setResults(data);
    } catch (err) {
      setError(err.message || 'An error occurred while analyzing medicines.');
      setResults(null);
    } finally {
      setLoading(false);
    }
  }, [medicines]);

  const value = {
    medicines,
    results,
    loading,
    error,
    inputError,
    isDemoMode,
    addMedicine,
    removeMedicine,
    clearBasket,
    loadPreset,
    toggleDemoMode,
    checkSafety,
    canCheck: medicines.length >= 2,
    demoPresets: DEMO_PRESETS,
  };

  return <MedicineContext.Provider value={value}>{children}</MedicineContext.Provider>;
}

export function useMedicine() {
  const context = useContext(MedicineContext);
  if (!context) {
    throw new Error('useMedicine must be used within a MedicineProvider');
  }
  return context;
}
