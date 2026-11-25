import React from 'react';
import { WarningIcon } from '../pages/landing-icons';

export function Disclaimer() {
  return (
    <div className="w-full max-w-3xl p-5 text-center flex flex-col items-center gap-2 border border-[#b7b09d] border-t-[3px] border-t-[#1a1a18] bg-[#f0ede1] rounded-none shadow-none">
      <div className="inline-flex items-center gap-1.5 font-ibm-mono text-[11px] font-medium uppercase tracking-[0.09em] text-[#8b2500]">
        <WarningIcon size={14} />
        <span>Clinical Safety Disclaimer</span>
      </div>
      <p className="text-xs text-[#2d2b26] max-w-2xl leading-relaxed font-ibm-serif">
        MedCheck provides informational clinical pharmacology data synthesized from openFDA prescribing labels and verified pharmacological rules. It is not a substitute for clinical judgment or individualized medical advice. Always consult your prescribing physician before altering any drug regimen.
      </p>
    </div>
  );
}
export default Disclaimer;
