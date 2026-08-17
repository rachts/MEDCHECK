import { useMedicine } from '../context/MedicineContext';

export function useDrugCheck() {
  const {
    results,
    loading,
    error,
    checkSafety,
    canCheck,
    isDemoMode,
    toggleDemoMode,
    loadPreset,
    demoPresets,
  } = useMedicine();

  return {
    results,
    loading,
    error,
    checkSafety,
    canCheck,
    isDemoMode,
    toggleDemoMode,
    loadPreset,
    demoPresets,
    hasResults: results !== null,
    isSafe: results ? results.safe : false,
    interactions: results ? results.interactions : [],
  };
}
