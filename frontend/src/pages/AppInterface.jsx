import React, { useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
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
  NetworkIcon,
  PillIcon,
  ShieldCrossIcon,
  LayersIcon,
  DocumentIcon,
  WarningIcon,
  ArrowRightIcon,
} from './landing-icons';
import './app-editorial.css';

export function AppInterface() {
  const {
    medicines,
    results,
    resultsStale,
    loading,
    error,
    checkSafety,
    setDoctorReportOpen,
    selectedMedicineName
  } = useMedicine();

  const [mobileTab, setMobileTab] = useState('basket');

  const interactions = (results?.interactions || []).filter((i) => i.severity !== 'none');
  const isSafe = results?.safe;
  const limitedDataWarnings = results?.limited_data_warnings || [];
  const indiaBanAlerts = results?.india_ban_alerts || [];

  const closeMobileProfile = useCallback(() => setMobileTab('matrix'), []);

  return (
    <div className="ed-app min-h-screen flex flex-col bg-[#f8f6f0] text-[#1a1a18]">
      <Navbar />

      {/* Floating Modals */}
      <StomachGuardianModal />
      <DoctorReportModal />

      {/* MOBILE BOTTOM NAVIGATION (< 768px) */}
      <nav className="md:hidden ed-bottom-nav" aria-label="Analysis sections">
        <button
          type="button"
          onClick={() => setMobileTab('basket')}
          aria-current={mobileTab === 'basket' ? 'true' : undefined}
          className={`ed-bottom-nav-item ${mobileTab === 'basket' ? 'active' : ''}`}
        >
          <PillIcon size={18} />
          <span>Basket ({medicines.length})</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('matrix')}
          aria-current={mobileTab === 'matrix' ? 'true' : undefined}
          className={`ed-bottom-nav-item ${mobileTab === 'matrix' ? 'active' : ''}`}
        >
          <NetworkIcon size={18} />
          <span>Matrix</span>
        </button>

        <button
          type="button"
          onClick={() => setMobileTab('profile')}
          aria-current={mobileTab === 'profile' ? 'true' : undefined}
          className={`ed-bottom-nav-item ${mobileTab === 'profile' ? 'active' : ''}`}
        >
          <LayersIcon size={18} />
          <span>Profile</span>
        </button>

        <button
          type="button"
          onClick={() => setDoctorReportOpen(true)}
          disabled={!results}
          title={results ? 'Export a clinical summary of this analysis' : 'Run an analysis first to generate a report'}
          className="ed-bottom-nav-item disabled:opacity-45 disabled:cursor-not-allowed"
        >
          <DocumentIcon size={18} />
          <span>Report</span>
        </button>
      </nav>

      {/* MAIN DASHBOARD CONTENT */}
      <main className="flex-1 pt-24 pb-24 md:pb-12 px-4 sm:px-6 md:px-8 max-w-[1440px] mx-auto w-full">
        {/* Editorial Folio Header */}
        <header className="flex flex-col sm:flex-row sm:items-end justify-between gap-2 pb-4 mb-5 border-b border-[#b7b09d]">
          <div>
            <span className="font-ibm-mono text-[11px] uppercase tracking-[0.09em] text-[#8b2500] font-medium block">
              Clinical Workspace · Safety Dashboard
            </span>
            <h1 className="font-newsreader text-[28px] sm:text-[32px] font-medium text-[#1a1a18] leading-tight mt-0.5">
              Regimen Interaction &amp; Safety Audit
            </h1>
          </div>
          <Link
            to="/explorer"
            className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a18] hover:text-[#8b2500] hover:underline underline-offset-4 inline-flex items-center gap-1.5 self-start sm:self-end"
          >
            <span>Browse Drug Explorer</span>
            <ArrowRightIcon size={13} />
          </Link>
        </header>

        {/* Offline cached results warning */}
        {results?._offline && (
          <div className="ed-notice-caut w-full mb-4 p-3 flex items-center gap-2.5 text-sm font-ibm-serif" role="alert">
            <WarningIcon size={16} className="shrink-0" />
            <span>Offline: showing your last saved analysis. Reconnect and re-run for a fresh check.</span>
          </div>
        )}

        {/* Basket changed stale warning */}
        {results && resultsStale && (
          <div className="ed-notice-caut w-full mb-4 p-3 flex items-center gap-2.5 text-sm font-ibm-serif" role="alert">
            <WarningIcon size={16} className="shrink-0" />
            <span>Basket changed; re-run analysis to update results</span>
          </div>
        )}

        {/* India CDSCO Banned / Halted Medicine Alerts */}
        {indiaBanAlerts.length > 0 && (
          <div
            className="border border-[#8b2500] bg-[#f3e9e4] w-full mb-4 p-4 sm:p-5 flex flex-col gap-2.5 font-ibm-serif"
            style={{ borderRadius: 0, boxShadow: 'none' }}
            role="alert"
            aria-label="India banned or halted medicines alert"
          >
            <div className="flex items-center gap-2 font-ibm-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b2500]">
              <WarningIcon size={14} className="shrink-0" />
              <span>CDSCO · GOVERNMENT OF INDIA REGULATORY ALERT</span>
            </div>
            <div className="space-y-2">
              {indiaBanAlerts.map((alert, idx) => (
                <div key={`${alert.medicine}-${idx}`} className="space-y-0.5">
                  <p className="text-sm font-medium text-[#1a1a18] leading-relaxed">
                    {alert.medicine}: {alert.info.heading}. Please do not use it. Talk to your doctor for a safe alternative.
                  </p>
                  <p className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a]">
                    Official entry: {alert.info.entry_name}
                    {alert.info.notification ? ` · ${alert.info.notification}` : ''}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Top Summary Banner */}
        {results && (
          <div className={`w-full mb-4 p-4 sm:p-5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 ${
            !isSafe ? 'ed-sheet-crit' : 'ed-sheet-safe'
          }`}>
            <div className="flex items-start gap-3">
              <div className={`w-9 h-9 border flex items-center justify-center shrink-0 mt-0.5 ${
                !isSafe
                  ? 'bg-[#f3e9e4] text-[#8b2500] border-[#8b2500]'
                  : 'bg-[#e8eee3] text-[#2d4a22] border-[#2d4a22]'
              }`}>
                {!isSafe ? <WarningIcon size={17} /> : <ShieldCrossIcon size={17} />}
              </div>
              <div>
                <h2 className="font-newsreader text-[20px] font-semibold text-[#1a1a18] leading-tight">
                  {results.summary || 'Safety scan completed.'}
                </h2>
                <div className="flex items-center gap-2 flex-wrap mt-1.5 font-ibm-serif">
                  <p className="font-ibm-mono text-[11px] uppercase tracking-[0.06em] text-[#57534a]">
                    {results.total_medicines_count ?? medicines.length} medications analyzed · {results.analyzed_pairs_count} pair combinations checked
                  </p>
                  {results.analysis_coverage && (
                    <span className={`ed-tag ${
                      results.analysis_coverage === 'full'
                        ? 'ed-tag-safe'
                        : results.analysis_coverage === 'partial'
                        ? 'ed-tag-caut'
                        : ''
                    }`}>
                      Analysis covers {results.verified_medicines_count ?? (medicines.length - limitedDataWarnings.length)} of {results.total_medicines_count ?? medicines.length} medicines
                    </span>
                  )}
                </div>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setDoctorReportOpen(true)}
              className="ed-btn-outline shrink-0 w-full sm:w-auto"
            >
              <DocumentIcon size={14} />
              <span>Export Doctor&apos;s Summary</span>
            </button>
          </div>
        )}

        {limitedDataWarnings.length > 0 && (
          <div
            className="ed-notice-caut w-full mb-5 p-3.5 flex items-start gap-2.5 font-ibm-serif"
            role="status"
          >
            <WarningIcon size={16} className="mt-0.5 shrink-0" />
            <div className="space-y-1">
              <p className="text-sm font-semibold text-[#1a1a18] leading-tight">
                Incomplete label data; treat this analysis as partial
              </p>
              {limitedDataWarnings.map((warning, idx) => (
                <p key={`${warning}-${idx}`} className="text-xs text-[#2d2b26] leading-relaxed">
                  {warning}
                </p>
              ))}
            </div>
          </div>
        )}

        {/* Clinical Grid Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* LEFT PANEL: MEDICINE BASKET (3 cols on desktop) */}
          <div className={`lg:col-span-3 ${
            mobileTab === 'basket' ? 'block' : 'hidden md:block'
          }`}>
            <MedicineBasket onSeeTimeline={() => setMobileTab('matrix')} />
          </div>

          {/* CENTER PANEL: INTERACTION MATRIX (6 cols on desktop) */}
          <div className={`lg:col-span-6 flex flex-col gap-4 ${
            mobileTab === 'matrix' || mobileTab === 'basket' ? 'block' : 'hidden md:block'
          }`}>
            {loading && <LoadingState />}

            {error && <ErrorState error={error} onRetry={checkSafety} />}

            {!loading && !error && (
              <>
                <InteractionNetworkGraph />
                <SideEffectRadar />
                <FoodConflictTimeline />

                {/* Pairwise Interaction Severity Cards */}
                {results && !isSafe && interactions.length > 0 && (
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center justify-between pb-2 border-b border-[#b7b09d]">
                      <h3 className="font-newsreader text-[21px] font-semibold text-[#1a1a18]">
                        Identified Drug Interactions ({interactions.length})
                      </h3>
                      <span className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a]">
                        Sorted by clinical severity
                      </span>
                    </div>

                    {interactions.map((interaction, idx) => (
                      <InteractionCard
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

                {/* Single Medicine Guidance State */}
                {results && medicines.length === 1 && (
                  <div className="ed-sheet p-5 flex flex-col gap-3 font-ibm-serif">
                    <div className="flex items-start gap-2.5 pb-3 border-b border-[#d5cfc0]">
                      <div className="w-8 h-8 flex items-center justify-center bg-[#f8f6f0] text-[#1a1a18] border border-[#1a1a18] shrink-0 mt-0.5">
                        <PillIcon size={16} />
                      </div>
                      <div>
                        <span className="ed-tag">Single Medication Regimen</span>
                        <h3 className="text-[18px] font-semibold text-[#1a1a18] font-newsreader mt-1">
                          {medicines[0].name} Pharmacology Profile
                        </h3>
                      </div>
                    </div>
                    <p className="text-sm text-[#2d2b26] leading-relaxed">
                      Drug-drug interaction analysis requires at least 2 medications to evaluate pairwise contraindications and kinetic clashes.
                      You can explore this medication&apos;s food guidelines, side effect frequencies, and GI safety below, or view its dedicated deep-dive page.
                    </p>
                    <div className="flex items-center gap-2 pt-1 flex-wrap">
                      <Link
                        to={`/medicine/${encodeURIComponent(medicines[0].name)}`}
                        className="ed-btn-outline"
                      >
                        <span>Open Full Clinical Dossier</span>
                        <ArrowRightIcon size={14} />
                      </Link>
                    </div>
                  </div>
                )}

                {/* Incomplete / Partial Analysis State */}
                {results && !isSafe && interactions.length === 0 && medicines.length >= 2 && (
                  <div className="ed-sheet-caut p-5 flex flex-col gap-3 font-ibm-serif">
                    <div className="flex items-start gap-2.5 pb-3 border-b border-[#d5cfc0]">
                      <div className="w-8 h-8 flex items-center justify-center bg-[#f4eee0] text-[#8a5300] border border-[#8a5300] shrink-0 mt-0.5">
                        <WarningIcon size={16} />
                      </div>
                      <div>
                        <span className="ed-tag ed-tag-caut font-semibold">
                          PARTIAL SCAN: CANNOT GUARANTEE SAFETY
                        </span>
                        <h3 className="text-[18px] font-semibold text-[#1a1a18] font-newsreader mt-1">
                          Unverified medicines detected in regimen
                        </h3>
                      </div>
                    </div>
                    <p className="text-sm text-[#2d2b26] leading-relaxed">
                      While no known interactions were detected among verified compounds, your basket contains unverified medicine(s) with limited pharmacological data. Consequently, full regimen safety cannot be certified.
                    </p>
                    {limitedDataWarnings.length > 0 && (
                      <ul className="space-y-1.5 text-xs text-[#2d2b26] bg-[#f4eee0] p-3 border border-[#8a5300]">
                        {limitedDataWarnings.map((warning, idx) => (
                          <li key={idx} className="flex items-start gap-2">
                            <WarningIcon size={14} className="mt-0.5 shrink-0 text-[#8a5300]" />
                            <span>{warning}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </>
            )}
          </div>

          {/* RIGHT PANEL: CONTEXTUAL MEDICINE PROFILE (3 cols on desktop) */}
          <div className="hidden md:block lg:col-span-3">
            <MedicineProfilePanel onCloseMobile={closeMobileProfile} />
          </div>
        </div>

        {/* MOBILE FULL-SCREEN / SHEET PROFILE OVERLAY */}
        {selectedMedicineName && mobileTab === 'profile' && (
          <div className="md:hidden fixed inset-0 z-50 bg-[#f8f6f0] overflow-y-auto p-4 flex flex-col gap-4">
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
export default AppInterface;
