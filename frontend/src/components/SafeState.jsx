import React from 'react';
import { CheckIcon, ShieldCrossIcon, WarningIcon } from '../pages/landing-icons';

/**
 * Shown when the analysis found no drug-drug interactions.
 *
 * @param {object} props
 * @param {number} [props.medicinesCount=2]
 * @param {string[]} [props.limitedDataWarnings=[]]
 */
export function SafeState({ medicinesCount = 2, limitedDataWarnings = [] }) {
  const isPartial = limitedDataWarnings.length > 0;

  return (
    <section
      className={`${isPartial ? 'ed-sheet-caut' : 'ed-sheet-safe'} p-5 flex flex-col gap-3`}
    >
      <div className="flex items-start gap-2.5 pb-3 border-b border-[#d5cfc0]">
        <div
          className={`w-8 h-8 flex items-center justify-center border shrink-0 mt-0.5 ${
            isPartial
              ? 'bg-[#f4eee0] text-[#8a5300] border-[#8a5300]'
              : 'bg-[#e8eee3] text-[#2d4a22] border-[#2d4a22]'
          }`}
        >
          {isPartial ? <WarningIcon size={16} /> : <CheckIcon size={16} />}
        </div>
        <div>
          <span className={`ed-tag ${isPartial ? 'ed-tag-caut' : 'ed-tag-safe'} font-semibold`}>
            {isPartial ? 'NO INTERACTIONS FOUND; PARTIAL DATA' : 'VERIFIED CLEAN PROFILE'}
          </span>
          <h3 className="text-[18px] font-semibold text-[#1a1a18] font-newsreader leading-snug mt-1">
            {isPartial
              ? 'No interactions found, but this scan is incomplete.'
              : 'No pairwise conflicts identified across your regimen.'}
          </h3>
        </div>
      </div>

      <p className="text-sm text-[#2d2b26] font-ibm-serif leading-relaxed">
        {isPartial ? (
          <>
            No known adverse drug-drug interactions were detected across your{' '}
            {medicinesCount} selected medicines, but at least one of them had
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
        <ul className="space-y-1.5 text-xs text-[#2d2b26] font-ibm-serif bg-[#f4eee0] border border-[#8a5300] p-3">
          {limitedDataWarnings.map((warning) => (
            <li key={warning} className="flex items-start gap-2">
              <WarningIcon
                size={14}
                className="mt-0.5 shrink-0 text-[#8a5300]"
              />
              <span className="leading-relaxed">{warning}</span>
            </li>
          ))}
        </ul>
      )}

      <div className="pt-2.5 border-t border-[#d5cfc0] flex items-center gap-2 text-xs text-[#57534a] font-ibm-serif">
        <ShieldCrossIcon
          size={14}
          className="text-[#2d4a22] shrink-0"
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
export default SafeState;
