import React, { useCallback } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  CloseIcon,
  ShieldIcon,
  WarningIcon,
  CheckIcon,
  InfoIcon,
  PillIcon,
  FoodIcon,
} from '../pages/landing-icons';

export function StomachGuardianModal() {
  const {
    stomachModalOpen,
    setStomachModalOpen,
    results,
  } = useMedicine();

  const closeModal = useCallback(() => setStomachModalOpen(false), [setStomachModalOpen]);
  const dialogRef = useModalDismiss(stomachModalOpen, closeModal);

  if (!stomachModalOpen) return null;

  const giScore = results?.composite_gi_score || 0;
  const giTier = results?.composite_gi_tier || 'gentle';
  const contributors = results?.composite_gi_contributors || [];
  const recommendations = results?.composite_gi_recommendations || [];

  let scoreColor = '#2d4a22';
  let tierLabel = 'Gentle / Minimal Risk';
  if (giTier === 'unknown') {
    scoreColor = '#57534a';
    tierLabel = 'Insufficient data to assess GI risk';
  } else if (giScore > 60) {
    scoreColor = '#8b2500';
    tierLabel = 'High Gastrointestinal Burden';
  } else if (giScore > 30) {
    scoreColor = '#8a5300';
    tierLabel = 'Moderate Stomach Irritation Risk';
  }

  return (
    <div
      className="ed-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1a1a18]/55 overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stomach-modal-title"
        aria-describedby="stomach-modal-subtitle"
        tabIndex={-1}
        className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden outline-none bg-[#f8f6f0] border border-[#1a1a18] border-t-[3px] border-t-[#1a1a18]"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#b7b09d] bg-[#f0ede1]">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 border border-[#1a1a18] bg-[#f8f6f0] text-[#8a5300] flex items-center justify-center shrink-0">
              <ShieldIcon size={18} />
            </div>
            <div>
              <h2
                id="stomach-modal-title"
                className="font-newsreader text-[22px] font-semibold text-[#1a1a18] leading-tight"
              >
                Stomach Guardian Score Breakdown
              </h2>
              <p id="stomach-modal-subtitle" className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] mt-0.5">
                Your stomach stress score, explained
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            aria-label="Close Stomach Guardian score breakdown"
            className="w-8 h-8 border border-[#b7b09d] bg-[#f8f6f0] text-[#1a1a18] hover:border-[#1a1a18] hover:bg-[#ece7d5] flex items-center justify-center transition-colors cursor-pointer shrink-0"
          >
            <CloseIcon size={15} />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#f8f6f0] font-ibm-serif">
          {!results ? (
            <div className="p-8 text-center flex flex-col items-center justify-center space-y-2.5 bg-[#f0ede1] border border-[#b7b09d]">
              <ShieldIcon size={24} className="text-[#57534a]" />
              <h3 className="font-newsreader text-lg font-semibold text-[#1a1a18]">
                Run an analysis to see your score
              </h3>
              <p className="text-xs text-[#57534a] max-w-sm font-ibm-serif leading-relaxed">
                Add medicines to your basket and run a safety analysis to calculate your stomach risk score.
              </p>
            </div>
          ) : (
            <>
              {/* Plain-language score notice */}
              <div className="p-3.5 bg-[#f0ede1] border border-[#b7b09d] text-xs text-[#2d2b26] leading-relaxed flex items-start gap-2.5">
                <InfoIcon size={15} className="text-[#1a1a18] mt-0.5 shrink-0" />
                <p>
                  <strong className="font-semibold text-[#1a1a18]">Our own score:</strong> This 0 to 100 score is MEDCHECK&apos;s own way of adding up stomach stress from how your medicines work (for example, two COX-1 painkillers together, a blood thinner adding bleeding risk, or a stomach protector lowering the risk). It is not a clinical standard or a medical measurement. Use it as a starting point for a talk with your pharmacist, not as a diagnosis.
                </p>
              </div>

              {/* Main Score Hero Card */}
              <div className="bg-[#f0ede1] border border-[#b7b09d] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
                <div>
                  <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.08em]">
                    Cumulative Stomach Score
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-1">
                    {giTier === 'unknown' ? (
                      <span className="font-newsreader text-3xl font-semibold text-[#57534a]">
                        --
                      </span>
                    ) : (
                      <>
                        <span className="font-newsreader text-3xl font-semibold tabular-nums" style={{ color: scoreColor }}>
                          {giScore}
                        </span>
                        <span className="font-ibm-mono text-xs text-[#57534a]">/ 100</span>
                      </>
                    )}
                  </div>
                  <p className="text-sm font-semibold text-[#1a1a18] mt-1">{tierLabel}</p>
                </div>

                <div className="w-full sm:w-1/2 space-y-1.5">
                  <div className="flex justify-between font-ibm-mono text-[10px] uppercase tracking-[0.05em] text-[#57534a]">
                    <span>Gentle (0)</span>
                    <span>Moderate (30)</span>
                    <span>Critical (60+)</span>
                  </div>
                  <div className="h-2 bg-[#ece7d5] border border-[#b7b09d] overflow-hidden">
                    <div
                      className="h-full"
                      style={{ width: `${Math.min(giScore, 100)}%`, backgroundColor: scoreColor }}
                    />
                  </div>
                  <span className="font-ibm-mono text-[10px] text-[#57534a] block text-right">
                    Based on COX-1 inhibition &amp; gastric erosion kinetics
                  </span>
                </div>
              </div>

              {/* Individual Drug Contributor Breakdown */}
              <div className="space-y-3">
                <h3 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] border-b border-[#b7b09d] pb-1.5">
                  Individual Medicine GI Contributions
                </h3>

                {contributors.length === 0 ? (
                  <div className="text-xs text-[#57534a] italic p-3 bg-[#f0ede1] border border-[#d5cfc0]">
                    No medications loaded in basket.
                  </div>
                ) : (
                  <div className="border border-[#b7b09d] bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
                    {contributors.map((c, idx) => (
                      <div key={`${c.drug}-${idx}`} className="p-3.5 flex items-center justify-between gap-3">
                        <div className="flex items-center gap-2.5">
                          <div className="w-7 h-7 bg-[#f0ede1] border border-[#b7b09d] flex items-center justify-center text-[#1a1a18] shrink-0">
                            <PillIcon size={14} />
                          </div>
                          <div>
                            <span className="font-newsreader font-semibold text-[16px] text-[#1a1a18]">{c.drug}</span>
                            <span className="text-xs text-[#57534a] block capitalize">{c.mechanism_short || 'Stomach stress'}</span>
                          </div>
                        </div>

                        <div className="text-right shrink-0">
                          <span className="font-ibm-mono text-xs text-[#1a1a18] block font-medium mb-1">
                            {c.score_impact > 0 ? '+' : ''}{c.score_impact} pts
                          </span>
                          <span className={`ed-tag ${
                            c.tier === 'high' ? 'ed-tag-crit' : c.tier === 'moderate' ? 'ed-tag-caut' : 'ed-tag-safe'
                          }`}>
                            {c.tier}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Clinical Mitigations & Best Practices */}
              <div className="space-y-3 pt-1">
                <h3 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] border-b border-[#b7b09d] pb-1.5 flex items-center gap-2">
                  <FoodIcon size={16} className="text-[#1a1a18]" />
                  <span>Evidence-Based Stomach Protection Strategies</span>
                </h3>

                {recommendations.length > 0 && (
                  <div className="space-y-2">
                    <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase font-medium tracking-[0.07em] block">
                      For your current basket
                    </span>
                    <ul className="space-y-1.5">
                      {recommendations.map((rec, idx) => {
                        const isCritical = rec.toLowerCase().startsWith('critical');
                        return (
                          <li
                            key={`${idx}-${rec.slice(0, 40)}`}
                            className={`p-3 text-xs leading-relaxed flex items-start gap-2.5 ${
                              isCritical
                                ? 'ed-notice-crit font-semibold'
                                : 'bg-[#f0ede1] border border-[#d5cfc0] text-[#2d2b26]'
                            }`}
                          >
                            {isCritical ? (
                              <WarningIcon size={15} className="mt-0.5 shrink-0" />
                            ) : (
                              <InfoIcon size={15} className="mt-0.5 shrink-0 text-[#57534a]" />
                            )}
                            <span>{rec}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                )}

                <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase font-medium tracking-[0.07em] block pt-1">
                  General guidance
                </span>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <div className="p-3.5 bg-[#f0ede1] border border-[#b7b09d] text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-[#1a1a18] font-newsreader text-sm">
                      <CheckIcon size={14} className="text-[#2d4a22]" />
                      <span>Meal Administration</span>
                    </div>
                    <p className="text-xs text-[#2d2b26] leading-relaxed">
                      Take NSAIDs (Ibuprofen, Aspirin) during or immediately following meals to buffer stomach acid.
                    </p>
                  </div>

                  <div className="p-3.5 bg-[#f0ede1] border border-[#b7b09d] text-xs space-y-1.5">
                    <div className="flex items-center gap-1.5 font-semibold text-[#1a1a18] font-newsreader text-sm">
                      <CheckIcon size={14} className="text-[#2d4a22]" />
                      <span>PPI / H2 Co-therapy</span>
                    </div>
                    <p className="text-xs text-[#2d2b26] leading-relaxed">
                      If dual NSAIDs or blood thinners are required, doctors frequently co-prescribe Omeprazole or Famotidine.
                    </p>
                  </div>
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
export default StomachGuardianModal;
