import React from 'react';
import { WarningIcon, RefreshIcon } from '../pages/landing-icons';

/**
 * Failure card shown in place of an analysis result.
 *
 * @param {object} props
 * @param {string | null | undefined} props.error
 * @param {() => void} [props.onRetry]
 */
export function ErrorState({ error, onRetry }) {
  return (
    <section
      className="ed-notice-crit p-5 flex flex-col gap-3"
      role="alert"
    >
      <div className="flex items-start gap-2.5">
        <div className="w-8 h-8 bg-[#f8f6f0] border border-[#8b2500] flex items-center justify-center shrink-0 text-[#8b2500]">
          <WarningIcon size={16} />
        </div>
        <div className="flex-1">
          <span className="ed-tag ed-tag-crit font-semibold">
            ANALYSIS PAUSED
          </span>
          <h3 className="text-[18px] font-semibold text-[#1a1a18] font-newsreader mt-1.5 mb-0.5">
            Unable to Complete Safety Check
          </h3>
          <p className="text-sm text-[#2d2b26] font-ibm-serif leading-relaxed">
            {error || 'Something went wrong while analyzing medicines. Please verify the medicine names and retry.'}
          </p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-2 border-t border-[#d5cfc0] flex justify-end">
          <button
            type="button"
            onClick={onRetry}
            className="ed-btn-ink"
          >
            <RefreshIcon size={14} />
            <span>Try Again</span>
          </button>
        </div>
      )}
    </section>
  );
}
export default ErrorState;
