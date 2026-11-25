import React from 'react';
import { useMedicine } from '../context/MedicineContext';
import { WarningIcon } from '../pages/landing-icons';

function SideEffectRadarBase() {
  const { results } = useMedicine();

  if (!results || !results.aggregated_side_effects || results.aggregated_side_effects.length === 0) {
    return null;
  }

  return (
    <div
      className="ed-sheet-crit p-5 flex flex-col gap-3.5"
      role="alert"
    >
      {/* Header */}
      <div className="flex items-start justify-between flex-wrap gap-2 pb-3 border-b border-[#d5cfc0]">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 border border-[#8b2500] bg-[#f3e9e4] text-[#8b2500] flex items-center justify-center shrink-0 mt-0.5">
            <WarningIcon size={15} />
          </div>
          <div>
            <h3 className="font-newsreader text-[17px] font-semibold text-[#8b2500] leading-tight">
              Side Effect Amplification Alert
            </h3>
            <p className="text-xs text-[#57534a] font-ibm-serif mt-0.5">
              Multiple medications in your basket compound the same adverse risk
            </p>
          </div>
        </div>

        <span className="ed-tag ed-tag-crit font-semibold">
          {results.aggregated_side_effects.length} COMPOUNDED RISK{results.aggregated_side_effects.length > 1 ? 'S' : ''}
        </span>
      </div>

      {/* Amplified Items Ledger */}
      <div className="flex flex-col gap-2">
        {results.aggregated_side_effects.map((item, idx) => (
          <div
            key={`${item.effect}-${idx}`}
            className="ed-inset p-3.5 flex flex-col gap-1.5 font-ibm-serif"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="font-newsreader font-semibold text-[15px] text-[#1a1a18]">{item.effect}</span>
                <span className="ed-tag ed-tag-crit">
                  {item.severity}
                </span>
              </div>

              <div className="font-ibm-mono text-[11px] uppercase tracking-[0.05em] text-[#57534a]">
                Sources: <span className="text-[#1a1a18] font-medium">{item.sources.join(' + ')}</span>
              </div>
            </div>

            <p className="text-xs text-[#2d2b26] leading-relaxed">
              {item.clinical_note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

export const SideEffectRadar = React.memo(SideEffectRadarBase);
export default SideEffectRadar;
