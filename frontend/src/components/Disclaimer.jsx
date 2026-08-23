import React from 'react';
import { ShieldAlert } from 'lucide-react';

export function Disclaimer() {
  return (
    <div className="w-full max-w-3xl card p-4 text-center flex flex-col items-center gap-1.5 shadow-none">
      <div className="badge badge-info">
        <ShieldAlert className="w-3.5 h-3.5" />
        <span>Clinical Safety Disclaimer</span>
      </div>
      <p className="text-xs text-[var(--text-muted)] max-w-2xl leading-relaxed">
        MedCheck provides informational clinical pharmacology data synthesized from openFDA prescribing labels and verified pharmacological rules. It is not a substitute for clinical judgment or individualized medical advice. Always consult your prescribing physician before altering any drug regimen.
      </p>
    </div>
  );
}
