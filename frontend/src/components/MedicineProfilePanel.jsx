import React, { useState } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { IndiaBanNotice } from './IndiaBanNotice';
import {
  PillIcon,
  ShieldCrossIcon,
  ShieldIcon,
  WarningIcon,
  InfoIcon,
  FoodIcon,
  ClockIcon,
  CloseIcon,
  ExternalLinkIcon,
} from '../pages/landing-icons';

/**
 * Detailed clinical intelligence slide-out or side panel for a single medicine.
 */
function MedicineProfilePanelBase({ onCloseMobile }) {
  const {
    selectedMedicineName,
    selectedProfile,
    profileLoading,
    profileError,
    personalNotes,
    savePersonalNote,
  } = useMedicine();

  const [activeTab, setActiveTab] = useState('overview');
  const [showAllSideEffects, setShowAllSideEffects] = useState(false);
  const [reportedMissing, setReportedMissing] = useState(false);

  if (!selectedMedicineName) {
    return (
      <div className="ed-sheet p-6 flex flex-col items-center justify-center text-center min-h-[320px]">
        <div className="w-11 h-11 bg-[#f8f6f0] border border-[#b7b09d] flex items-center justify-center text-[#57534a] mb-3">
          <PillIcon size={20} />
        </div>
        <h3 className="font-newsreader text-[20px] font-semibold text-[#1a1a18] mb-1">
          Contextual Profile
        </h3>
        <p className="text-sm text-[#57534a] max-w-xs font-ibm-serif leading-relaxed">
          Select any medicine in your basket or interaction graph to inspect side effects, food rules, and stomach impact.
        </p>
      </div>
    );
  }

  if (profileLoading) {
    return (
      <div
        className="ed-sheet p-6 flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <p className="font-ibm-mono text-xs uppercase tracking-[0.09em] text-[#8b2500] font-medium">
          READING THE PROFILE
        </p>
        <p className="font-ibm-serif text-xs text-[#57534a] leading-relaxed">
          Loading monograph data for {selectedMedicineName}.
        </p>
      </div>
    );
  }

  if (profileError || !selectedProfile) {
    return (
      <div className="ed-sheet-caut p-5 flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2 border-b border-[#d5cfc0] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-[#f4eee0] border border-[#8a5300] text-[#8a5300] flex items-center justify-center shrink-0">
              <InfoIcon size={18} />
            </div>
            <div>
              <h2 className="font-newsreader text-[22px] font-semibold text-[#1a1a18] leading-tight">
                {selectedMedicineName}
              </h2>
              <p className="font-ibm-mono text-[11px] uppercase tracking-[0.06em] text-[#57534a] mt-0.5">
                Profile unavailable
              </p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              type="button"
              onClick={onCloseMobile}
              aria-label="Close medicine profile"
              className="lg:hidden p-1.5 bg-[#f8f6f0] border border-[#b7b09d] hover:border-[#1a1a18] text-[#57534a] hover:text-[#1a1a18] transition-colors cursor-pointer"
            >
              <CloseIcon size={15} />
            </button>
          )}
        </div>

        <div className="ed-notice-caut p-3 flex items-start gap-2.5 font-ibm-serif" role="alert">
          <WarningIcon size={15} className="mt-0.5 shrink-0" />
          <div className="space-y-1">
            <p className="text-sm font-semibold leading-tight text-[#1a1a18]">
              No pharmacology data loaded for this medicine
            </p>
            <p className="text-xs leading-relaxed">
              {profileError || 'The profile request did not complete.'}
            </p>
            <p className="text-xs leading-relaxed">
              If this is an unfamiliar brand name, try searching for the active ingredient directly.
            </p>
          </div>
        </div>

        <div className="text-xs text-[#57534a] flex items-center justify-between pt-2 border-t border-[#d5cfc0] font-ibm-serif">
          <span className="font-ibm-mono text-[11px] uppercase tracking-[0.06em]">Database status</span>
          {reportedMissing ? (
            <span className="font-ibm-mono text-[11px] uppercase tracking-[0.06em] text-[#2d4a22] font-semibold">
              Flagged for review
            </span>
          ) : (
            <button
              type="button"
              onClick={() => setReportedMissing(true)}
              className="text-[#8b2500] hover:underline underline-offset-4 cursor-pointer font-ibm-mono text-[11px] uppercase tracking-[0.06em]"
            >
              Report unrecognised medicine
            </button>
          )}
        </div>
      </div>
    );
  }

  const profile = selectedProfile;
  const sideEffects = Array.isArray(profile.side_effects) ? profile.side_effects : [];
  const getEffectName = (se) => (typeof se === 'string' ? se : se?.effect ?? '');
  const isCommonFrequency = (se) => se?.frequency === 'very_common' || se?.frequency === 'common';
  const isRareOrSevere = (se) => se?.frequency === 'rare' || se?.severity === 'severe';

  const commonSideEffects = [];
  const commonSeen = new Set();
  for (const se of sideEffects) {
    if (!isCommonFrequency(se)) continue;
    const name = getEffectName(se);
    if (!name) continue;
    commonSideEffects.push(name);
    commonSeen.add(name);
  }

  const rareSideEffects = [];
  for (const se of sideEffects) {
    if (isCommonFrequency(se)) continue;
    const name = getEffectName(se);
    if (!name) continue;
    if (isRareOrSevere(se)) {
      if (!commonSeen.has(name)) {
        rareSideEffects.push(name);
      }
    } else {
      commonSideEffects.push(name);
      commonSeen.add(name);
    }
  }
  const foodInteractions = profile.food_interactions || [];
  const lifestyleWarnings = profile.lifestyle_warnings || [];
  const giProfile = profile.gi_profile;

  const currentNote = personalNotes[selectedMedicineName.toLowerCase()] || '';
  const giTier = giProfile?.risk_tier || 'moderate';
  const giTierColor =
    giTier === 'high'
      ? 'text-[#8b2500]'
      : giTier === 'moderate'
      ? 'text-[#8a5300]'
      : 'text-[#2d4a22]';

  return (
    <div className="ed-sheet p-5 flex flex-col gap-4" role="region" aria-label={`Clinical profile for ${profile.name}`}>
      {/* Panel Header */}
      <div className="flex items-start justify-between gap-2.5 border-b border-[#b7b09d] pb-3.5">
        <div className="flex items-start gap-2.5 min-w-0">
          <div className={`w-9 h-9 flex items-center justify-center border shrink-0 mt-0.5 ${
            profile.drug_type === 'prescription'
              ? 'bg-[#ece7d5] text-[#1a1a18] border-[#1a1a18]'
              : 'bg-[#f8f6f0] text-[#1a1a18] border-[#b7b09d]'
          }`}>
            <PillIcon size={17} />
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <h2 className="font-newsreader text-[22px] font-semibold text-[#1a1a18] leading-tight">
                {profile.name}
              </h2>
              <span className="ed-tag">
                {profile.drug_type?.toUpperCase() || 'MEDICINE'}
              </span>
              {profile.is_fdc && (
                <span
                  className="ed-tag ed-tag-caut cursor-help"
                  title={profile.fdc_warning || 'Combination product; analysis covers primary ingredient only.'}
                >
                  FDC PRODUCT
                </span>
              )}
            </div>

            <p className="text-xs text-[#57534a] mt-1 font-ibm-serif">
              Active: <strong className="text-[#1a1a18] capitalize">{profile.generic_name}</strong>
              {profile.brand_names?.length > 0 && (
                <span className="hidden sm:inline"> · Brands: {profile.brand_names.slice(0, 3).join(', ')}</span>
              )}
            </p>

            {profile.is_fdc && (
              <p className="text-xs text-[#8a5300] font-medium mt-1 leading-snug font-ibm-serif">
                {profile.fdc_warning || 'Combination product. Safety analysis covers the primary active compound only.'}
              </p>
            )}
          </div>
        </div>

        {onCloseMobile && (
          <button
            type="button"
            onClick={onCloseMobile}
            aria-label="Close medicine profile"
            className="lg:hidden p-1.5 bg-[#f8f6f0] border border-[#b7b09d] hover:border-[#1a1a18] text-[#57534a] hover:text-[#1a1a18] transition-colors cursor-pointer shrink-0"
          >
            <CloseIcon size={15} />
          </button>
        )}
      </div>

      {/* India CDSCO Regulatory Notice */}
      {profile.india_ban?.matched && <IndiaBanNotice info={profile.india_ban} />}

      {/* Black Box Warning Banner */}
      {profile.black_box_warning && (
        <div
          className="ed-notice-crit p-3.5 flex flex-col sm:flex-row items-start justify-between gap-3 font-ibm-serif"
          role="alert"
        >
          <div className="flex items-start gap-2.5">
            <div className="w-7 h-7 bg-[#f8f6f0] border border-[#8b2500] text-[#8b2500] flex items-center justify-center shrink-0 mt-0.5">
              <WarningIcon size={15} />
            </div>
            <div>
              <span className="font-ibm-mono text-[10px] font-semibold text-[#8b2500] uppercase tracking-[0.07em] block">
                FDA Black Box Warning (Highest Safety Escalation)
              </span>
              <p className="text-xs text-[#1a1a18] mt-1 leading-relaxed">
                {profile.black_box_warning}
              </p>
            </div>
          </div>

          {profile.fda_label_url && (
            <a
              href={profile.fda_label_url}
              target="_blank"
              rel="noopener noreferrer"
              className="ed-btn-outline text-[10px] py-1.5 px-2.5 shrink-0 self-end sm:self-start"
            >
              <span>FDA Label</span>
              <ExternalLinkIcon size={12} />
            </a>
          )}
        </div>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Medicine profile sections"
        className="flex flex-wrap bg-[#ece7d5] p-1 border border-[#b7b09d] gap-1"
      >
        {[
          { id: 'overview', label: 'Overview' },
          { id: 'side-effects', label: `Side Effects (${sideEffects.length})` },
          { id: 'food', label: `Food & Alcohol (${foodInteractions.length})` },
          { id: 'stomach', label: 'Stomach Health' },
          { id: 'notes', label: 'My Notes' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            aria-controls={`panel-${tab.id}`}
            id={`tab-${tab.id}`}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center justify-center px-2.5 py-1.5 font-ibm-mono text-[10px] font-medium uppercase tracking-[0.06em] whitespace-nowrap min-h-[34px] transition-colors cursor-pointer border ${
              activeTab === tab.id
                ? 'bg-[#1a1a18] text-[#f8f6f0] border-[#1a1a18]'
                : 'bg-transparent border-transparent text-[#2d2b26] hover:bg-[#f0ede1] hover:border-[#b7b09d]'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Panels */}
      <div className="space-y-4 font-ibm-serif">
        {/* 1. OVERVIEW TAB */}
        {activeTab === 'overview' && (
          <div id="panel-overview" role="tabpanel" aria-labelledby="tab-overview" className="space-y-3.5">
            <div>
              <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em] mb-1.5">
                Indications &amp; Clinical Use
              </span>
              <p className="text-sm text-[#2d2b26] ed-inset p-3 leading-relaxed">
                {profile.description || 'Clinical overview not available for this medicine.'}
              </p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="ed-inset p-2.5">
                <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
                  Pharmacological Class
                </span>
                <span className="text-sm font-semibold text-[#1a1a18] font-newsreader">
                  {profile.category || 'General Pharmacology'}
                </span>
              </div>

              <div className="ed-inset p-2.5">
                <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
                  Regulatory Type
                </span>
                <span className="text-sm font-semibold text-[#1a1a18] font-newsreader capitalize">
                  {profile.drug_type || 'OTC / Regulated'}
                </span>
              </div>

              <div className="ed-inset p-2.5">
                <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
                  Metabolic Pathway
                </span>
                <span className="text-sm font-semibold text-[#1a1a18] font-newsreader">
                  {profile.metabolism_summary || 'Hepatic / Renal Clearance'}
                </span>
              </div>

              <div className="ed-inset p-2.5">
                <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
                  Food &amp; Lifestyle Cadence
                </span>
                <span className="text-sm font-semibold text-[#1a1a18] font-newsreader">
                  {foodInteractions.length} active rules
                </span>
              </div>
            </div>

            {profile.brand_names && profile.brand_names.length > 0 && (
              <div>
                <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em] mb-1.5">
                  Common Brand Names
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {profile.brand_names.map((b, idx) => (
                    <span key={`${b}-${idx}`} className="ed-tag capitalize">
                      {b}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 2. SIDE EFFECTS TAB */}
        {activeTab === 'side-effects' && (
          <div id="panel-side-effects" role="tabpanel" aria-labelledby="tab-side-effects" className="space-y-3.5">
            <div>
              <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em] mb-1.5">
                Common Reported Side Effects ({commonSideEffects.length})
              </span>
              <div className="flex flex-wrap gap-1.5">
                {(showAllSideEffects ? commonSideEffects : commonSideEffects.slice(0, 10)).map((se, idx) => (
                  <span key={`${se}-${idx}`} className="ed-tag">
                    {se}
                  </span>
                ))}
              </div>
              {commonSideEffects.length > 10 && (
                <button
                  type="button"
                  onClick={() => setShowAllSideEffects(!showAllSideEffects)}
                  className="font-ibm-mono text-[11px] uppercase tracking-[0.06em] text-[#8b2500] font-medium mt-2.5 hover:underline underline-offset-4 cursor-pointer block"
                >
                  {showAllSideEffects ? 'Show Less' : `+ ${commonSideEffects.length - 10} more side effects`}
                </button>
              )}
            </div>

            {rareSideEffects.length > 0 && (
              <div className="pt-3 border-t border-[#d5cfc0]">
                <span className="font-ibm-mono text-[10px] text-[#8b2500] uppercase font-semibold tracking-[0.07em] mb-1.5 flex items-center gap-1.5">
                  <WarningIcon size={13} />
                  <span>Rare but Severe Adverse Events</span>
                </span>
                <div className="flex flex-wrap gap-1.5">
                  {rareSideEffects.map((re, idx) => (
                    <span key={`${re}-${idx}`} className="ed-tag ed-tag-crit">
                      {re}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {commonSideEffects.length === 0 && rareSideEffects.length === 0 && (
              <p className="text-xs text-[#2d2b26] ed-inset p-3 leading-relaxed">
                No acute side effect profile indexed for this medication.
              </p>
            )}
          </div>
        )}

        {/* 3. FOOD & ALCOHOL TAB */}
        {activeTab === 'food' && (
          <div id="panel-food" role="tabpanel" aria-labelledby="tab-food" className="space-y-3">
            {profile.alcohol_warning && (
              <div className={`p-3 flex items-start gap-2.5 ${
                profile.alcohol_severity === 'high' ? 'ed-notice-crit' : 'ed-notice-caut'
              }`}>
                <WarningIcon size={15} className="shrink-0 mt-0.5" />
                <div>
                  <span className="font-ibm-mono text-[10px] font-semibold uppercase tracking-[0.07em] block">
                    Alcohol Interaction Warning
                  </span>
                  <p className="text-xs mt-1 leading-relaxed text-[#1a1a18]">{profile.alcohol_warning}</p>
                </div>
              </div>
            )}

            {foodInteractions.length === 0 && lifestyleWarnings.length === 0 && (
              <p className="text-xs text-[#2d2b26] ed-inset p-3 leading-relaxed">
                No specific food restrictions documented. Standard water administration recommended.
              </p>
            )}

            {foodInteractions.map((fi, idx) => (
              <div key={`${fi.type || fi.title}-${idx}`} className="ed-inset p-3 flex items-start gap-2.5">
                <div className={`w-7 h-7 border flex items-center justify-center shrink-0 ${
                  fi.severity === 'high'
                    ? 'bg-[#f3e9e4] text-[#8b2500] border-[#8b2500]'
                    : 'bg-[#f0ede1] text-[#1a1a18] border-[#b7b09d]'
                }`}>
                  <FoodIcon size={14} />
                </div>
                <div>
                  <span className="text-sm font-semibold text-[#1a1a18] font-newsreader">{fi.food || fi.title}</span>
                  <p className="text-xs text-[#2d2b26] mt-0.5 leading-relaxed">{fi.effect || fi.description}</p>
                  {fi.recommendation && (
                    <p className="text-xs text-[#1a1a18] font-semibold mt-1">
                      Advice: {fi.recommendation}
                    </p>
                  )}
                </div>
              </div>
            ))}

            {lifestyleWarnings.map((lw, idx) => (
              <div key={`${lw}-${idx}`} className="ed-inset p-2.5 flex items-center gap-2">
                <ClockIcon size={14} className="text-[#57534a] shrink-0" />
                <span className="text-xs text-[#2d2b26]">{lw}</span>
              </div>
            ))}
          </div>
        )}

        {/* 4. STOMACH HEALTH TAB */}
        {activeTab === 'stomach' && (
          <div id="panel-stomach" role="tabpanel" aria-labelledby="tab-stomach" className="space-y-3">
            <div className="ed-inset p-3.5 flex items-center justify-between gap-3">
              <div>
                <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em]">
                  Individual GI Irritation Risk
                </span>
                <span className={`font-newsreader text-2xl font-semibold ${giTierColor}`}>
                  {giTier.toUpperCase()}
                </span>
              </div>

              <div className="w-10 h-10 bg-[#f0ede1] border border-[#b7b09d] flex items-center justify-center text-[#8a5300]" aria-hidden="true">
                <ShieldIcon size={18} />
              </div>
            </div>

            <div className="ed-inset p-3">
              <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block mb-1">
                Gastric Erosion Mechanism
              </span>
              <p className="text-xs text-[#2d2b26] leading-relaxed">
                {giProfile?.mechanism || 'No severe direct gastric mucosal erosion reported for this active ingredient.'}
              </p>
            </div>

            <div className="ed-inset p-3">
              <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block mb-1">
                Bleeding Risk Escalation
              </span>
              <p className="text-xs text-[#2d2b26] leading-relaxed">
                {giProfile?.bleeding_risk || 'Standard baseline bleeding hazard.'}
              </p>
            </div>

            {giProfile?.recommendations && giProfile.recommendations.length > 0 && (
              <div>
                <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em] mb-1.5">
                  Protective Strategies
                </span>
                <div className="space-y-1.5">
                  {giProfile.recommendations.map((rec, idx) => (
                    <div key={`${rec.slice(0, 40)}-${idx}`} className="flex items-start gap-2 text-xs text-[#2d2b26] ed-inset p-2.5">
                      <ShieldCrossIcon size={14} className="text-[#2d4a22] mt-0.5 shrink-0" />
                      <span className="leading-relaxed">{rec}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* 5. NOTES TAB */}
        {activeTab === 'notes' && (
          <div id="panel-notes" role="tabpanel" aria-labelledby="tab-notes" className="space-y-3">
            <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em]">
              Personal Administration Notes
            </span>
            <p className="text-xs text-[#2d2b26] leading-relaxed">
              Record dosage instructions, prescriber notes, or personal reactions. Automatically exported into the Doctor&apos;s Clinical Brief.
            </p>
            <textarea
              rows={4}
              value={currentNote}
              onChange={(e) => savePersonalNote(selectedMedicineName, e.target.value)}
              placeholder="e.g. Prescribed by Dr. Patel; take with breakfast. Caused mild drowsiness on day 1."
              className="w-full bg-[#f8f6f0] border border-[#1a1a18] p-3 text-sm text-[#1a1a18] placeholder-[#57534a] outline-none resize-none font-ibm-serif"
            />
            <div className="flex items-center justify-between font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a]">
              <span>Saved locally in browser session</span>
              <span>{currentNote.length} characters</span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export const MedicineProfilePanel = React.memo(MedicineProfilePanelBase);
export default MedicineProfilePanel;
