import React, { useCallback } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  X, 
  Flame, 
  ShieldAlert, 
  ShieldCheck, 
  AlertTriangle, 
  CheckCircle2, 
  Info,
  Pill,
  Utensils
} from 'lucide-react';

export function StomachGuardianModal() {
  const { 
    stomachModalOpen, 
    setStomachModalOpen, 
    results, 
    medicines 
  } = useMedicine();

  // Stable identity: the dismiss hook focuses the dialog when its dependencies
  // change, so an inline arrow here would re-focus the container on every render.
  const closeModal = useCallback(() => setStomachModalOpen(false), [setStomachModalOpen]);
  const dialogRef = useModalDismiss(stomachModalOpen, closeModal);

  if (!stomachModalOpen) return null;

  const giScore = results?.composite_gi_score || 0;
  const giTier = results?.composite_gi_tier || 'gentle';

  // The backend field is composite_gi_contributors (see CheckResponse in
  // backend/models.py). This component previously read results.gi_contributors,
  // which never exists on the payload -- so the per-drug breakdown below always
  // fell through to its "No medications loaded in basket" empty state, even with
  // a full basket and a computed score staring at the user from the hero card.
  const contributors = results?.composite_gi_contributors || [];

  // Regimen-specific mitigations computed by gi_engine.calculate_composite_gi_score:
  // these name the actual drugs in the basket (dual-NSAID compounding, an
  // anticoagulant + NSAID bleeding hazard, alcohol, an existing PPI credit) and are
  // the clinically actionable half of this modal. They were being discarded in
  // favour of the two static tips below, which is exactly backwards -- so they now
  // lead, and the static advice is kept only as general background.
  const recommendations = results?.composite_gi_recommendations || [];

  let scoreColor = 'var(--severity-low)'; // #059669
  let tierLabel = 'Gentle / Minimal Risk';
  if (giScore > 60) {
    scoreColor = 'var(--severity-high)'; // #DC2626
    tierLabel = 'High Gastrointestinal Burden';
  } else if (giScore > 30) {
    scoreColor = 'var(--severity-moderate)'; // #D97706
    tierLabel = 'Moderate Mucosal Irritation Risk';
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 modal-backdrop overflow-y-auto"
      // Clicking the backdrop closes; the guard keeps clicks that bubble up from
      // inside the panel from dismissing it.
      onClick={(e) => {
        if (e.target === e.currentTarget) closeModal();
      }}
    >
      {/* role/aria-modal tell assistive tech that the page behind is inert, and
          aria-labelledby gives the dialog an accessible name -- without it the
          announcement is just "dialog". tabIndex={-1} makes the container
          programmatically focusable so the dismiss hook can move focus inside on
          open without adding a tab stop. */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="stomach-modal-title"
        aria-describedby="stomach-modal-subtitle"
        tabIndex={-1}
        className="card max-w-2xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden shadow-2xl sheet-enter outline-none"
      >
        {/* Top Bar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)] bg-[var(--bg-surface)]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-[4px] bg-[rgba(217,119,6,0.12)] text-[var(--severity-moderate)] flex items-center justify-center">
              <Flame className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2
                id="stomach-modal-title"
                className="font-serif text-[22px] font-bold text-[var(--text-primary)] leading-tight"
              >
                Stomach Guardian™ Score Breakdown
              </h2>
              <p id="stomach-modal-subtitle" className="text-xs text-[var(--text-muted)] font-sans">
                Composite Gastrointestinal &amp; Mucosal Stress Assessment
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={closeModal}
            aria-label="Close Stomach Guardian score breakdown"
            className="p-1.5 rounded-[4px] text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" aria-hidden="true" />
          </button>
        </div>

        {/* Modal Content */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[var(--bg-surface)]">
          {/* Main Score Hero Card */}
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[8px] p-5 flex flex-col sm:flex-row items-center justify-between gap-4">
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Cumulative Stomach Score</span>
              <div className="flex items-baseline gap-1.5 mt-1">
                <span className="metric text-3xl font-bold" style={{ color: scoreColor }}>
                  {giScore}
                </span>
                <span className="text-sm text-[var(--text-muted)]">/ 100</span>
              </div>
              <p className="text-sm font-semibold text-[var(--text-primary)] mt-1">{tierLabel}</p>
            </div>

            <div className="w-full sm:w-1/2 space-y-1.5">
              <div className="flex justify-between text-xs text-[var(--text-muted)] font-bold">
                <span>Gentle (0)</span>
                <span>Moderate (30)</span>
                <span>Critical (60+)</span>
              </div>
              <div className="gi-score-bar">
                <div
                  className="gi-score-fill"
                  style={{ width: `${Math.min(giScore, 100)}%`, backgroundColor: scoreColor }}
                />
              </div>
              <span className="text-xs text-[var(--text-muted)] block text-right">
                Based on COX-1 inhibition & gastric erosion kinetics
              </span>
            </div>
          </div>

          {/* Individual Drug Contributor Breakdown */}
          <div className="space-y-3">
            <h3 className="font-serif text-[18px] font-bold text-[var(--text-primary)] border-b border-[var(--border-default)] pb-1.5">
              Individual Medicine GI Contributions
            </h3>

            {contributors.length === 0 ? (
              <div className="text-xs text-[var(--text-muted)] italic p-3 bg-[var(--bg-elevated)] rounded-[6px]">
                No medications loaded in basket.
              </div>
            ) : (
              <div className="space-y-2">
                {contributors.map((c, idx) => (
                  <div key={`${c.drug}-${idx}`} className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2.5">
                      <div className="w-7 h-7 rounded-[4px] bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)]">
                        <Pill className="w-3.5 h-3.5" aria-hidden="true" />
                      </div>
                      <div>
                        <span className="font-serif font-bold text-[16px] text-[var(--text-primary)]">{c.drug}</span>
                        <span className="text-xs text-[var(--text-muted)] block font-sans capitalize">{c.mechanism_short || 'Mucosal stress'}</span>
                      </div>
                    </div>

                    <div className="flex items-center gap-3">
                      <div className="text-right">
                        {/* The PPI gastro-protection credit is a negative score_impact,
                            so the sign has to come from the value -- a hardcoded "+"
                            renders it as "+-20 pts". */}
                        <span className="metric text-sm text-[var(--text-primary)] block">
                          {c.score_impact > 0 ? '+' : ''}{c.score_impact} pts
                        </span>
                        <span className={`tag ${
                          c.tier === 'high' ? 'tag-danger' : c.tier === 'moderate' ? 'tag-warning' : 'tag-success'
                        }`}>
                          {c.tier}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Clinical Mitigations & Best Practices */}
          <div className="space-y-3 pt-2">
            <h3 className="font-serif text-[18px] font-bold text-[var(--text-primary)] border-b border-[var(--border-default)] pb-1.5 flex items-center gap-1.5">
              <Utensils className="w-4 h-4 text-[var(--text-primary)]" aria-hidden="true" />
              <span>Evidence-Based Stomach Protection Strategies</span>
            </h3>

            {recommendations.length > 0 && (
              <div className="space-y-2">
                <span className="text-xs text-[var(--text-muted)] uppercase font-bold block">
                  For your current basket
                </span>
                <ul className="space-y-1.5">
                  {recommendations.map((rec, idx) => {
                    // gi_engine flags the anticoagulant + NSAID combination as the one
                    // recommendation that warrants escalation rather than adherence
                    // advice; surfacing it in the same neutral grey as "stay hydrated"
                    // would bury it.
                    const isCritical = rec.toLowerCase().startsWith('critical');
                    return (
                      <li
                        key={`${idx}-${rec.slice(0, 40)}`}
                        className={`p-2.5 rounded-[6px] text-sm leading-relaxed flex items-start gap-2 border ${
                          isCritical
                            ? 'alert-danger font-semibold'
                            : 'bg-[var(--bg-elevated)] border-[var(--border-default)] text-[var(--text-secondary)]'
                        }`}
                      >
                        {isCritical ? (
                          <ShieldAlert className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
                        ) : (
                          <Info
                            className="w-4 h-4 mt-0.5 shrink-0 text-[var(--text-muted)]"
                            aria-hidden="true"
                          />
                        )}
                        <span>{rec}</span>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}

            <span className="text-xs text-[var(--text-muted)] uppercase font-bold block pt-1">
              General guidance
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--severity-low)]" aria-hidden="true" />
                  <span>Meal Administration</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  Take NSAIDs (Ibuprofen, Aspirin) during or immediately following meals to buffer stomach acid.
                </p>
              </div>

              <div className="p-3 bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] text-xs space-y-1">
                <div className="flex items-center gap-1.5 font-bold text-[var(--text-primary)]">
                  <CheckCircle2 className="w-3.5 h-3.5 text-[var(--severity-low)]" aria-hidden="true" />
                  <span>PPI / H2 Co-therapy</span>
                </div>
                <p className="text-xs text-[var(--text-secondary)]">
                  If dual NSAIDs or blood thinners are required, doctors frequently co-prescribe Omeprazole or Famotidine.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
