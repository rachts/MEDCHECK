import React from 'react';
import { CheckCircle2, ShieldCheck, AlertTriangle } from 'lucide-react';

/**
 * Shown when the analysis found no drug-drug interactions.
 *
 * `limitedDataWarnings` comes from CheckResponse.limited_data_warnings and is the
 * reason this component cannot render an unqualified all-clear. A "safe" verdict
 * built on a medicine with no usable FDA label means "nothing was found to
 * compare", not "nothing exists" -- so when warnings are present the headline
 * claim is downgraded from VERIFIED CLEAN PROFILE to a partial result and the
 * specific gaps are listed. Presenting the two identically would be the most
 * dangerous failure mode this screen has.
 *
 * @param {object} props
 * @param {number} [props.medicinesCount=2]
 *   How many medicines were compared, used only in the copy.
 * @param {string[]} [props.limitedDataWarnings=[]]
 *   `CheckResponse.limited_data_warnings`. Optional on the backend model, hence
 *   the default: a missing field must degrade to "no known gaps", never to
 *   `undefined.length`.
 */
export function SafeState({ medicinesCount = 2, limitedDataWarnings = [] }) {
  const isPartial = limitedDataWarnings.length > 0;

  const accentColor = isPartial ? 'var(--severity-moderate)' : 'var(--severity-low)';

  return (
    <section
      style={{ borderLeftColor: accentColor, borderLeftWidth: '3px' }}
      className="card flex flex-col gap-3"
    >
      <div className="flex items-center gap-2.5">
        <div
          className={`w-8 h-8 rounded-[6px] flex items-center justify-center border ${
            isPartial
              ? 'bg-[rgba(217,119,6,0.08)] text-[var(--severity-moderate)] border-[rgba(217,119,6,0.2)]'
              : 'bg-[rgba(5,150,105,0.08)] text-[var(--severity-low)] border-[rgba(5,150,105,0.2)]'
          }`}
        >
          {isPartial ? (
            <AlertTriangle className="w-4 h-4" />
          ) : (
            <CheckCircle2 className="w-4 h-4 text-[var(--severity-low)]" />
          )}
        </div>
        <div>
          <div className={`badge ${isPartial ? 'badge-moderate' : 'badge-low'}`}>
            {isPartial ? 'NO INTERACTIONS FOUND — PARTIAL DATA' : 'VERIFIED CLEAN PROFILE'}
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight mt-0.5">
            {isPartial
              ? 'No interactions found, but this scan is incomplete.'
              : 'Great news! Your medicines play well together.'}
          </h3>
        </div>
      </div>

      <p className="text-base text-[var(--text-secondary)] leading-relaxed">
        {isPartial ? (
          <>
            No known adverse drug-drug interactions were detected across your{' '}
            {medicinesCount} selected medicines — but at least one of them had
            incomplete label data, so an interaction could exist without being
            visible to this analysis.
          </>
        ) : (
          <>
            No known adverse drug-drug interactions or severe kinetic conflicts were
            detected across your {medicinesCount} selected medicines in our clinical
            database.
          </>
        )}
      </p>

      {isPartial && (
        <ul className="space-y-1.5 text-sm text-[var(--text-secondary)]">
          {limitedDataWarnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <AlertTriangle
                className="w-3.5 h-3.5 mt-1 shrink-0 text-[var(--severity-moderate)]"
                aria-hidden="true"
              />
              <span className="leading-relaxed">{warning}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2 border-t border-[var(--border-default)] flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <ShieldCheck
          className="w-3.5 h-3.5 text-[var(--severity-low)] shrink-0"
          aria-hidden="true"
        />
        <span>
          {isPartial
            ? 'Confirm any medicine listed above with your pharmacist or prescriber before relying on this result.'
            : 'Always follow prescribing directions. Even non-interacting medicines should be taken with proper meal intervals.'}
        </span>
      </div>
    </section>
  );
}
