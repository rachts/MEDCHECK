import React from 'react';
import { ShieldCrossIcon } from '../pages/landing-icons';
import { useMedicine } from '../context/MedicineContext';

export function LoadingState() {
  const { loadingStage } = useMedicine();

  return (
    <section
      className="ed-sheet p-6 flex flex-col gap-3"
      role="status"
      aria-live="polite"
    >
      <div className="flex items-center justify-between gap-3 pb-3 border-b border-[#d5cfc0]">
        <div className="inline-flex items-center gap-2 font-ibm-mono text-xs uppercase tracking-[0.09em] text-[#8b2500] font-medium">
          <ShieldCrossIcon size={15} />
          <span>CLINICAL SCAN IN PROGRESS</span>
        </div>
        <span className="ed-tag ed-tag-ink">CHECKING THE LABELS</span>
      </div>

      <p className="font-newsreader text-lg font-medium text-[#1a1a18]">
        {loadingStage || 'Evaluating medication safety...'}
      </p>

      <p className="text-xs text-[#57534a] font-ibm-serif leading-relaxed">
        Running the clinical safety rules, stomach stress checks, and 24-hour food timing.
      </p>
    </section>
  );
}
export default LoadingState;
