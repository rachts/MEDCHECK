import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

/**
 * Failure card shown in place of an analysis result.
 *
 * @param {object} props
 * @param {string | null | undefined} props.error
 *   Human-readable failure message from `MedicineContext.error`. Already
 *   normalised to a string by `lib/api.ts`, so this component never has to deal
 *   with an Error instance or an unknown thrown value.
 * @param {() => void} [props.onRetry]
 *   Re-runs the safety check. When omitted the retry button is still rendered but
 *   inert, so callers that cannot retry should pass a handler that clears state.
 */
export function ErrorState({ error, onRetry }) {
  return (
    <section 
      style={{ borderLeftColor: 'var(--severity-high)', borderLeftWidth: '3px' }}
      className="card flex flex-col gap-3"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 rounded-[6px] bg-[rgba(220,38,38,0.08)] border border-[rgba(220,38,38,0.2)] flex items-center justify-center shrink-0 text-[var(--severity-high)]">
          <AlertCircle className="w-4 h-4" />
        </div>
        <div className="flex-1">
          <div className="badge badge-high">
            ANALYSIS PAUSED
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] mt-0.5 mb-0.5">
            Unable to Complete Safety Check
          </h3>
          <p className="text-sm text-[var(--text-secondary)] leading-relaxed">
            {error || 'Something went wrong while analyzing medicines. Please verify the medicine names and retry.'}
          </p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-1 flex justify-end">
          <button
            onClick={onRetry}
            className="btn-primary"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </section>
  );
}
