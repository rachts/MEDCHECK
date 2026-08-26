import React, { createContext, useContext, useState, useCallback, useEffect, useMemo, useRef } from 'react';
import { checkMedicines, getMedicineProfile } from '../lib/api';

const MedicineContext = createContext(null);

/**
 * Generates a collision-resistant id for a basket entry.
 *
 * `Date.now()` alone collides whenever two entries are created inside the same
 * millisecond (loadPreset builds a whole basket in one synchronous pass), and
 * `Math.random().toString(36).substr(2, 9)` adds only ~46 bits from a generator
 * with no collision guarantee. Duplicate ids matter here because they are React
 * keys and the argument to removeMedicine: a collision reconciles two rows as
 * one, and deleting either removes both.
 *
 * crypto.randomUUID is available in every browser this app supports; the counter
 * fallback covers non-secure contexts (plain http on a LAN IP) where the crypto
 * API is unavailable, and is strictly monotonic so it cannot collide either.
 */
let idFallbackCounter = 0;
function createEntryId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = crypto.getRandomValues(new Uint8Array(16));
    return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
  }
  idFallbackCounter += 1;
  return `med-${Date.now()}-${idFallbackCounter}`;
}

export const DEMO_PRESETS = [
  {
    id: 'sarah-demo',
    name: "Sarah's Demo: Anticoagulant + Dual NSAID",
    description: 'Warfarin + Aspirin + Ibuprofen — Compounded stomach bleeding & major ulceration hazard',
    medicines: ['Warfarin', 'Aspirin', 'Ibuprofen'],
    badge: 'Critical Triple Hazard'
  },
  {
    id: 'diabetes-lifestyle',
    name: 'Diabetes & Lifestyle: Metformin + Alcohol',
    description: 'Potentiated lactate inhibition causing life-threatening metabolic lactic acidosis',
    medicines: ['Metformin', 'Alcohol'],
    badge: 'Lactic Acidosis'
  },
  {
    id: 'cardiology-statin',
    name: 'Cardiology: Atorvastatin + Clarithromycin',
    description: 'CYP3A4 blockade elevating blood statin levels and severe rhabdomyolysis risk',
    medicines: ['Atorvastatin', 'Clarithromycin'],
    badge: 'Myopathy Risk'
  },
  {
    id: 'nsaid-interference',
    name: 'Cardioprotection Clash: Aspirin + Ibuprofen',
    description: 'Competitive COX-1 blockade neutralizing Aspirin stroke protection + doubling GI load',
    medicines: ['Aspirin', 'Ibuprofen'],
    badge: 'Efficacy Loss'
  },
  {
    id: 'safe-regimen',
    name: 'Verified Safe: Paracetamol + Amoxicillin',
    description: 'Standard antibiotic and analgesic co-prescription with gentle stomach profile',
    medicines: ['Paracetamol', 'Amoxicillin'],
    badge: 'Safe Co-Prescription'
  },
];

/**
 * Provisional drug type for a demo-preset entry, used only until the backend's
 * authoritative `drug_type` arrives with the analysis response.
 *
 * Keys mirror `backend/services/knowledge_base.py`'s curated entries so the
 * optimistic badge cannot contradict the one the API returns a moment later.
 * Alcohol in particular used to be grouped with potassium and the vitamins as
 * `'supplement'` while the backend classifies it `'substance'` -- so the chip
 * rendered ethanol as a dietary supplement, in the same colour as a multivitamin,
 * in the one preset whose whole point is a life-threatening alcohol interaction.
 */
const PRESET_DRUG_TYPES = {
  aspirin: 'otc',
  ibuprofen: 'otc',
  paracetamol: 'otc',
  acetaminophen: 'otc',
  omeprazole: 'otc',
  aleve: 'otc',
  potassium: 'supplement',
  calcium: 'supplement',
  vitamin: 'supplement',
  alcohol: 'substance',
  ethanol: 'substance',
  caffeine: 'substance',
  nicotine: 'substance',
  tobacco: 'lifestyle_factor',
  smoking: 'lifestyle_factor',
};

/** Everything not listed above is a prescription drug in these presets. */
const DEFAULT_PRESET_DRUG_TYPE = 'prescription';

const WAKE_TIME_KEY = 'medcheck_patient_wake_time';

/**
 * Matches `CheckRequest.patient_wake_time`'s 24-hour branch
 * (`WAKE_TIME_24H_RE` in backend/models.py) -- the exact format
 * `<input type="time">` produces, which is why that control is used rather than a
 * text field. Validating here as well keeps a corrupted localStorage value from
 * being sent and coming back as a 422.
 */
const WAKE_TIME_24H_RE = /^([01][0-9]|2[0-3]):[0-5][0-9]$/;

/** The backend's own fallback, mirrored so the UI shows what it will actually use. */
export const DEFAULT_WAKE_TIME = '07:00';

function readStoredWakeTime() {
  try {
    const saved = localStorage.getItem(WAKE_TIME_KEY);
    return saved && WAKE_TIME_24H_RE.test(saved) ? saved : DEFAULT_WAKE_TIME;
  } catch {
    return DEFAULT_WAKE_TIME;
  }
}

/**
 * Owns all analysis state: the basket, the last `CheckResponse`, the selected
 * medicine's `MedicineProfileResponse`, and the two modal flags.
 *
 * @param {object} props
 * @param {import('react').ReactNode} props.children
 */
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

  // Anchors the backend's 24-hour administration timeline. Persisted because a
  // patient's wake time is a stable fact about them, not a per-session choice.
  const [patientWakeTime, setPatientWakeTimeState] = useState(readStoredWakeTime);

  const setPatientWakeTime = useCallback((value) => {
    // An invalid value is stored as the default rather than rejected outright:
    // `<input type="time">` legitimately reports '' while the user is mid-edit,
    // and treating that as "no preference" is better than freezing the control.
    const next = value && WAKE_TIME_24H_RE.test(value) ? value : DEFAULT_WAKE_TIME;
    setPatientWakeTimeState(next);
    try {
      localStorage.setItem(WAKE_TIME_KEY, next);
    } catch (e) {
      console.warn('Wake time save error:', e);
    }
  }, []);
  
  // Right-Panel Intelligence Profile State
  const [selectedMedicineName, setSelectedMedicineName] = useState('Ibuprofen');
  const [selectedProfile, setSelectedProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  // Distinguishing "the profile fetch failed" from "the profile says this drug is
  // gentle" is not cosmetic. Without this flag MedicineProfilePanel has only
  // `selectedProfile === null` to go on, and it filled that gap with an invented
  // gentle profile -- presenting a network failure as a clinical all-clear.
  const [profileError, setProfileError] = useState(null);
  // Guards against out-of-order responses: clicking through three basket chips can
  // resolve the first request last, repainting the panel with a profile for a
  // medicine the user is no longer looking at.
  const profileRequestRef = useRef(0);

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
    const requestId = profileRequestRef.current + 1;
    profileRequestRef.current = requestId;

    setSelectedMedicineName(cleanName);
    setProfileError(null);

    // If profile already in current analysis results, use it instantly
    if (results && results.profiles && results.profiles[cleanName.toLowerCase()]) {
      setSelectedProfile(results.profiles[cleanName.toLowerCase()]);
      return;
    }

    setProfileLoading(true);
    try {
      const profile = await getMedicineProfile(cleanName);
      if (profileRequestRef.current !== requestId) return;
      setSelectedProfile(profile);
    } catch (e) {
      if (profileRequestRef.current !== requestId) return;
      console.warn('Failed to load profile for', cleanName, e);
      // Clear the previous medicine's profile rather than leaving it on screen:
      // selectedMedicineName has already moved on, so keeping it would attribute
      // one drug's side effects and stomach score to another.
      setSelectedProfile(null);
      setProfileError(
        e?.message
          ? `Could not load the profile for ${cleanName}: ${e.message}`
          : `Could not load the profile for ${cleanName}.`
      );
    } finally {
      if (profileRequestRef.current === requestId) setProfileLoading(false);
    }
  }, [results]);

  // Initial load of default medicine profile.
  // `!profileError` matters: without it a failed fetch leaves selectedProfile null,
  // and any unrelated re-render that changes `results` (and therefore the
  // selectMedicine identity) would silently retry in a tight loop.
  useEffect(() => {
    if (selectedMedicineName && !selectedProfile && !profileError) {
      selectMedicine(selectedMedicineName);
    }
  }, [selectedMedicineName, selectedProfile, profileError, selectMedicine]);

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
      id: createEntryId(),
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
    const newMeds = preset.medicines.map((name) => ({
      id: createEntryId(),
      name,
      drugType: PRESET_DRUG_TYPES[name.toLowerCase()] || DEFAULT_PRESET_DRUG_TYPE,
    }));
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
      const data = await checkMedicines(medNames, patientWakeTime);
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
  }, [medicines, selectedMedicineName, patientWakeTime]);

  // Keep a ref to the current checkSafety so the mount-only effect below can call
  // the latest version without listing it as a dependency (which would re-run the
  // analysis on every basket edit) and without capturing a stale closure over the
  // first render's medicines/results/loading.
  const checkSafetyRef = useRef(checkSafety);
  checkSafetyRef.current = checkSafety;

  // Run the initial analysis exactly once, after mount, if the default basket is
  // populated. The ref guard makes this idempotent under React 18 StrictMode,
  // which intentionally invokes effects twice in development.
  const didRunInitialCheck = useRef(false);
  useEffect(() => {
    if (didRunInitialCheck.current) return;
    if (medicines.length >= 2 && !results && !loading) {
      didRunInitialCheck.current = true;
      checkSafetyRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Memoised so the provider's own re-renders do not, by themselves, invalidate
  // every consumer. React compares the context value by identity: a fresh object
  // literal here meant that any state change anywhere in this provider re-rendered
  // the Navbar, the basket, the interaction graph, the side-effect radar, the food
  // timeline, both modals and the profile panel -- and it also made React.memo on
  // those components inert, since a changed context value bypasses memo entirely.
  //
  // Every entry is either useState state or a useCallback, so the dependency list
  // below is exactly the set of values whose identity can change.
  const value = useMemo(() => ({
    medicines,
    results,
    loading,
    loadingStage,
    error,
    inputError,
    isDemoMode,
    patientWakeTime,
    setPatientWakeTime,
    selectedMedicineName,
    selectedProfile,
    profileLoading,
    profileError,
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
  }), [
    medicines, results, loading, loadingStage, error, inputError, isDemoMode,
    patientWakeTime, setPatientWakeTime,
    selectedMedicineName, selectedProfile, profileLoading, profileError,
    doctorReportOpen, stomachModalOpen, personalNotes, savePersonalNote,
    selectMedicine, addMedicine, removeMedicine, clearBasket, loadPreset,
    loadScenario, toggleDemoMode, checkSafety,
  ]);

  return <MedicineContext.Provider value={value}>{children}</MedicineContext.Provider>;
}

export function useMedicine() {
  const context = useContext(MedicineContext);
  if (!context) {
    throw new Error('useMedicine must be used within a MedicineProvider');
  }
  return context;
}
