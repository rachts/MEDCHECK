import React, { useState, useCallback } from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { MedicineBasket } from '../components/MedicineBasket';
import { InteractionNetworkGraph } from '../components/InteractionNetworkGraph';
import { InteractionCard } from '../components/InteractionCard';
import { MedicineProfilePanel } from '../components/MedicineProfilePanel';
import { SideEffectRadar } from '../components/SideEffectRadar';
import { FoodConflictTimeline } from '../components/FoodConflictTimeline';
import { StomachGuardianModal } from '../components/StomachGuardianModal';
import { DoctorReportModal } from '../components/DoctorReportModal';
import { SafeState } from '../components/SafeState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { useMedicine } from '../context/MedicineContext';
import {
  Activity,
  Pill,
  ShieldAlert,
  Sparkles,
  Layers,
  FileText,
  Home,
  Search,
  User,
  ArrowRight,
  ShieldCheck,
  AlertTriangle
} from 'lucide-react';
import { Link } from 'react-router-dom';

export function AppInterface() {
  const { 
    medicines, 
    results, 
    loading, 
    loadingStage,
    error, 
    checkSafety,
    setDoctorReportOpen,
    selectedMedicineName,
    selectMedicine
  } = useMedicine();

  // Mobile active bottom navigation tab: 'basket' | 'matrix' | 'profile' | 'reports'
  const [mobileTab, setMobileTab] = useState('basket');

  const interactions = results?.interactions || [];
  const isSafe = results?.safe;

  // The backend populates limited_data_warnings whenever a medicine in the basket
  // had no usable FDA label and fell back to a generic profile. That caveat has to
  // reach the user: an analysis built on missing label data can return "safe"
  // simply because there was nothing to compare, and silently discarding the
  // warning turns an incomplete scan into an unqualified all-clear.
  const limitedDataWarnings = results?.limited_data_warnings || [];

  // Stable identity for the memoised MedicineProfilePanel. Passing
  // `onCloseMobile={() => setMobileTab('matrix')}` inline created a new function on
  // every render of this page -- including every keystroke in the medicine input --
  // which defeats React.memo entirely: the prop compares unequal every time.
  const closeMobileProfile = useCallback(() => setMobileTab('matrix'), []);

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Navbar />

      {/* Floating Modals */}
      <StomachGuardianModal />
      <DoctorReportModal />

      {/* MOBILE BOTTOM NAVIGATION (< 768px) */}
      <nav className="md:hidden bottom-nav" aria-label="Analysis sections">
        <button
          onClick={() => setMobileTab('basket')}
          aria-current={mobileTab === 'basket' ? 'true' : undefined}
          className={`bottom-nav-item ${mobileTab === 'basket' ? 'active' : ''}`}
        >
          <Pill className="w-5 h-5" aria-hidden="true" />
          <span>Basket ({medicines.length})</span>
        </button>

        <button
          onClick={() => setMobileTab('matrix')}
          aria-current={mobileTab === 'matrix' ? 'true' : undefined}
          className={`bottom-nav-item ${mobileTab === 'matrix' ? 'active' : ''}`}
        >
          <Activity className="w-5 h-5" aria-hidden="true" />
          <span>Matrix</span>
        </button>

        <button
          onClick={() => setMobileTab('profile')}
          aria-current={mobileTab === 'profile' ? 'true' : undefined}
          className={`bottom-nav-item ${mobileTab === 'profile' ? 'active' : ''}`}
        >
          <Layers className="w-5 h-5" aria-hidden="true" />
          <span>Profile</span>
        </button>

        <button
          onClick={() => setDoctorReportOpen(true)}
          disabled={!results}
          title={results ? "Export a clinical summary of this analysis" : "Run an analysis first to generate a report"}
          className="bottom-nav-item disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <FileText className="w-5 h-5" aria-hidden="true" />
          <span>Report</span>
        </button>
      </nav>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 pt-18 pb-24 md:pb-12 px-4 sm:px-6 md:px-8 max-w-[1600px] mx-auto w-full">
        {/* Top Summary Banner */}
        {results && (
          <div className="w-full mb-4 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-3.5 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-3 card-enter">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-[6px] flex items-center justify-center ${
                !isSafe ? 'bg-[rgba(220,38,38,0.08)] text-[var(--severity-high)]' : 'bg-[rgba(5,150,105,0.08)] text-[var(--severity-low)]'
              }`}>
                {!isSafe ? <ShieldAlert className="w-4 h-4" /> : <Sparkles className="w-4 h-4 text-[var(--severity-low)]" />}
              </div>
              <div>
                <h2 className="font-serif text-[18px] font-bold text-[var(--text-primary)] leading-tight">
                  {results.summary || 'Safety scan completed.'}
                </h2>
                <p className="text-xs text-[var(--text-muted)] font-sans">
                  {medicines.length} medications analyzed • {results.analyzed_pairs_count} pair combinations checked
                </p>
              </div>
            </div>

            <button
              onClick={() => setDoctorReportOpen(true)}
              className="btn-secondary text-xs shrink-0 w-full sm:w-auto"
            >
              <FileText className="w-3.5 h-3.5 text-[var(--text-primary)]" />
              <span>Export Doctor's Summary</span>
            </button>
          </div>
        )}

        {/* Incomplete-data caveat. Rendered immediately under the summary so it is
            read together with the verdict it qualifies, and kept outside the
            `results &&` banner above so it is visible whether the scan came back
            safe or unsafe. */}
        {limitedDataWarnings.length > 0 && (
          <div
            className="alert-warning w-full mb-4 flex items-start gap-2.5 card-enter"
            role="status"
          >
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div className="space-y-1">
              <p className="text-sm font-bold leading-tight">
                Incomplete label data — treat this analysis as partial
              </p>
              {limitedDataWarnings.map((warning, idx) => (
                <p key={`${warning}-${idx}`} className="text-xs leading-relaxed">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* DESKTOP / TABLET / MOBILE LAYOUT
            Column spans must be whole numbers: Tailwind generates col-span-1 .. -12
            for a 12-column grid and nothing fractional, so the `lg:col-span-3.5`
            these side panels used to carry produced no CSS at all. Between 1024px
            and 1279px both panels therefore fell back to `grid-column: auto` -- one
            column each, roughly 85px wide -- and only the `xl:` spans repaired the
            layout at 1280px and up. 3 + 6 + 3 fills the row exactly. */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT PANEL: MEDICINE BASKET (280px on desktop) */}
          <div className={`lg:col-span-3 ${
            mobileTab === 'basket' ? 'block' : 'hidden md:block'
          }`}>
            <MedicineBasket />
          </div>

          {/* CENTER PANEL: INTERACTION MATRIX (flex-grow) */}
          <div className={`lg:col-span-6 flex flex-col gap-4 ${
            mobileTab === 'matrix' || mobileTab === 'basket' ? 'block' : 'hidden md:block'
          }`}>
            {loading && <LoadingState />}

            {error && <ErrorState error={error} onRetry={checkSafety} />}

            {!loading && !error && (
              <>
                {/* Visual Network Topology Graph */}
                <InteractionNetworkGraph />

                {/* Side Effect Amplification Warning Radar */}
                <SideEffectRadar />

                {/* 24-Hour Food Schedule Timeline */}
                <FoodConflictTimeline />

                {/* Pairwise Interaction Severity Cards */}
                {results && !isSafe && interactions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between">
                      <h3 className="font-serif text-[20px] font-bold text-[var(--text-primary)]">
                        Identified Drug Interactions ({interactions.length})
                      </h3>
                      <span className="text-xs text-[var(--text-muted)] font-sans">Sorted by clinical severity</span>
                    </div>

                    {interactions.map((interaction, idx) => (
                      <InteractionCard
                        // Drug pair first, index only as a tiebreaker: the pair is
                        // what identifies an interaction, and the backend sorts by
                        // severity, so an index-first key reassigns a card's
                        // expand/collapse state to a different pair whenever the
                        // ordering shifts.
                        key={`${interaction.drug_a}-${interaction.drug_b}-${idx}`}
                        interaction={interaction}
                      />
                    ))}
                  </div>
                )}

                {/* Safe Regimen State */}
                {results && isSafe && medicines.length >= 2 && (
                  <SafeState
                    medicinesCount={medicines.length}
                    limitedDataWarnings={limitedDataWarnings}
                  />
                )}
              </>
            )}
          </div>

          {/* RIGHT PANEL: CONTEXTUAL MEDICINE PROFILE (340px on desktop) */}
          <div className={`lg:col-span-3 ${
            mobileTab === 'profile' ? 'block' : 'hidden lg:block'
          }`}>
            <MedicineProfilePanel onCloseMobile={closeMobileProfile} />
          </div>
        </div>

        {/* MOBILE FULL-SCREEN / SHEET PROFILE OVERLAY (< lg when profile is selected) */}
        {selectedMedicineName && mobileTab === 'profile' && (
          <div className="lg:hidden fixed inset-0 z-50 bg-[var(--bg-base)] overflow-y-auto p-4 flex flex-col gap-4 sheet-enter">
            <MedicineProfilePanel onCloseMobile={closeMobileProfile} />
          </div>
        )}

        {/* Disclaimer Footer */}
        <div className="mt-10 flex justify-center">
          <Disclaimer />
        </div>
      </main>

      <Footer />
    </div>
  );
}
