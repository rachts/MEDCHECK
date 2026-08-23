import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { checkMedicines, getMedicineProfile } from '../lib/api';

const MedicineContext = createContext(null);

export const DEMO_PRESETS = [
  {
    id: 'sarah-demo',
    name: "Sarah's Demo: Anticoagulant + Dual NSAID",
    description: 'Warfarin + Aspirin + Ibuprofen — Compounded stomach bleeding & major ulceration hazard',
    medicines: ['Warfarin', 'Aspirin', 'Ibuprofen'],
    expectedSeverity: 'high',
    badge: 'Critical Triple Hazard'
  },
  {
    id: 'diabetes-lifestyle',
    name: 'Diabetes & Lifestyle: Metformin + Alcohol',
    description: 'Potentiated lactate inhibition causing life-threatening metabolic lactic acidosis',
    medicines: ['Metformin', 'Alcohol'],
    expectedSeverity: 'high',
    badge: 'Lactic Acidosis'
  },
  {
    id: 'cardiology-statin',
    name: 'Cardiology: Atorvastatin + Clarithromycin',
    description: 'CYP3A4 blockade elevating blood statin levels and severe rhabdomyolysis risk',
    medicines: ['Atorvastatin', 'Clarithromycin'],
    expectedSeverity: 'high',
    badge: 'Myopathy Risk'
  },
  {
    id: 'nsaid-interference',
    name: 'Cardioprotection Clash: Aspirin + Ibuprofen',
    description: 'Competitive COX-1 blockade neutralizing Aspirin stroke protection + doubling GI load',
    medicines: ['Aspirin', 'Ibuprofen'],
    expectedSeverity: 'moderate',
    badge: 'Efficacy Loss'
  },
  {
    id: 'safe-regimen',
    name: 'Verified Safe: Paracetamol + Amoxicillin',
    description: 'Standard antibiotic and analgesic co-prescription with gentle stomach profile',
    medicines: ['Paracetamol', 'Amoxicillin'],
    expectedSeverity: 'safe',
    badge: 'Safe Co-Prescription'
  },
];

export function MedicineProvider({ children }) {
  const [medicines, setMedicines] = useState([
    { id: '1', name: 'Warfarin', drugType: 'prescription' },
    { id: '2', name: 'Aspirin', drugType: 'otc' },
    { id: '3', name: 'Ibuprofen', drugType: 'otc' },
  ]);
  const [results, setResults] = useState(null);
  const [loading, setLoading] = useState(false);
  const [loadingStage, setLoadingStage] = useState('');
  const [error, setError] = useState(null);
  const [inputError, setInputError] = useState(null);
  const [isDemoMode, setIsDemoMode] = useState(true);
  
  // Right-Panel Intelligence Profile State
  const [selectedMedicineName, setSelectedMedicineName] = useState('Ibuprofen');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);

  // Modals & Tools
  const [doctorReportOpen, setDoctorReportOpen] = useState(false);
  const [stomachModalOpen, setStomachModalOpen] = useState(false);

  // Personal Notes persisted in localStorage
  const [personalNotes, setPersonalNotes] = useState(() => {
    try {
      const saved = localStorage.getItem('medcheck_personal_notes');
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const savePersonalNote = useCallback((medName, noteText) => {
    setPersonalNotes((prev) => {
      const updated = { ...prev, [medName.toLowerCase()]: noteText };
      try {
        localStorage.setItem('medcheck_personal_notes', JSON.stringify(updated));
      } catch (e) {
        console.warn('Note save error:', e);
      }
      return updated;
    });
  }, []);

  // Fetch individual profile whenever selected medicine changes
  const selectMedicine = useCallback(async (medicineName) => {
    if (!medicineName) return;
    const cleanName = medicineName.trim();
    setSelectedMedicineName(cleanName);

    // If profile already in current analysis results, use it instantly
    if (results && results.profiles && results.profiles[cleanName.toLowerCase()]) {
      setSelectedProfile(results.profiles[cleanName.toLowerCase()]);
      return;
    }

    setProfileLoading(true);
    try {
      const profile = await getMedicineProfile(cleanName);
      setSelectedProfile(profile);
    } catch (e) {
      console.warn('Failed to load profile for', cleanName, e);
    } finally {
      setProfileLoading(false);
    }
  }, [results]);

  // Initial load of default medicine profile
  useEffect(() => {
    if (selectedMedicineName && !selectedProfile) {
      selectMedicine(selectedMedicineName);
    }
  }, [selectedMedicineName, selectedProfile, selectMedicine]);

  const addMedicine = useCallback((rawName, drugType = 'otc') => {
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
      drugType: drugType || 'otc',
    };

    setMedicines((prev) => [...prev, newMed]);
    selectMedicine(newMed.name);
    return true;
  }, [medicines, selectMedicine]);

  const removeMedicine = useCallback((id) => {
    setMedicines((prev) => {
      const remaining = prev.filter((m) => m.id !== id);
      if (remaining.length > 0) {
        selectMedicine(remaining[0].name);
      } else {
        setSelectedProfile(null);
      }
      return remaining;
    });
    setResults(null);
    setError(null);
    setInputError(null);
  }, [selectMedicine]);

  const clearBasket = useCallback(() => {
    setMedicines([]);
    setResults(null);
    setSelectedProfile(null);
    setError(null);
    setInputError(null);
  }, []);

  const loadPreset = useCallback((preset) => {
    const newMeds = preset.medicines.map((name, index) => {
      let type = 'prescription';
      const lower = name.toLowerCase();
      if (['aspirin', 'ibuprofen', 'paracetamol', 'acetaminophen', 'omeprazole', 'aleve'].includes(lower)) {
        type = 'otc';
      } else if (['alcohol', 'potassium', 'calcium', 'vitamin'].includes(lower)) {
        type = 'supplement';
      }
      return {
        id: `demo-${index}-${Date.now()}`,
        name,
        drugType: type,
      };
    });
    setMedicines(newMeds);
    setResults(null);
    setError(null);
    setInputError(null);
    if (newMeds.length > 0) {
      selectMedicine(newMeds[0].name);
    }
  }, [selectMedicine]);

  const loadScenario = useCallback((scenarioKey) => {
    const presetMap = {
      highRisk: DEMO_PRESETS[0],
      moderateRisk: DEMO_PRESETS[3],
      safe: DEMO_PRESETS[4],
    };
    const target = presetMap[scenarioKey] || DEMO_PRESETS[0];
    loadPreset(target);
  }, [loadPreset]);

  const toggleDemoMode = useCallback(() => {
    setIsDemoMode((prev) => !prev);
  }, []);

  const checkSafety = useCallback(async () => {
    if (medicines.length < 1) {
      setError('Please add at least one medicine to begin analysis.');
      return;
    }

    setLoading(true);
    setError(null);
    setInputError(null);

    // Staged progress scanner
    setLoadingStage('Indexing medicine pharmacology...');
    const t1 = setTimeout(() => setLoadingStage('Evaluating pairwise interaction matrix...'), 350);
    const t2 = setTimeout(() => setLoadingStage('Calculating Stomach Guardian GI score...'), 700);
    const t3 = setTimeout(() => setLoadingStage('Generating 24-hour food & dose timeline...'), 1050);

    try {
      const medNames = medicines.map((m) => m.name);
      const data = await checkMedicines(medNames);
      setResults(data);
      if (selectedMedicineName && data.profiles && data.profiles[selectedMedicineName.toLowerCase()]) {
        setSelectedProfile(data.profiles[selectedMedicineName.toLowerCase()]);
      } else if (medNames.length > 0 && data.profiles && data.profiles[medNames[0].toLowerCase()]) {
        setSelectedProfile(data.profiles[medNames[0].toLowerCase()]);
      }
    } catch (err) {
      setError(err.message || 'An error occurred while analyzing medicines.');
      setResults(null);
    } finally {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
      setLoading(false);
      setLoadingStage('');
    }
  }, [medicines, selectedMedicineName]);

  // Run initial analysis if medicines are populated
  useEffect(() => {
    if (medicines.length >= 2 && !results && !loading) {
      checkSafety();
    }
  }, []); // Run on mount

  const value = {
    medicines,
    results,
    loading,
    loadingStage,
    error,
    inputError,
    isDemoMode,
    selectedMedicineName,
    selectedProfile,
    profileLoading,
    doctorReportOpen,
    setDoctorReportOpen,
    stomachModalOpen,
    setStomachModalOpen,
    personalNotes,
    savePersonalNote,
    selectMedicine,
    addMedicine,
    removeMedicine,
    clearBasket,
    loadPreset,
    loadScenario,
    toggleDemoMode,
    checkSafety,
    canCheck: medicines.length >= 1,
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
