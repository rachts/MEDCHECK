import React from 'react';
import { ShieldCheck } from 'lucide-react';

export function Disclaimer() {
  return (
    <div className="w-full max-w-3xl bg-white/[0.03] border border-white/[0.08] rounded-2xl p-5 backdrop-blur-sm text-center flex flex-col items-center gap-2">
      <div className="inline-flex items-center gap-1.5 text-xs font-semibold text-secondary-fixed uppercase tracking-wider">
        <ShieldCheck className="w-4 h-4 text-secondary-fixed" />
        Official Medical Disclaimer
      </div>
      <p className="font-body text-xs sm:text-sm text-tertiary-fixed-dim/80 max-w-2xl leading-relaxed">
        MedCheck provides informational guidance based on available drug data. It is not a substitute for professional medical advice. Always consult a qualified healthcare professional for medical decisions.
      </p>
    </div>
  );
}
