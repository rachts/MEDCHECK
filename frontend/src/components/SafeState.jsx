import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export function SafeState({ medicinesCount = 2 }) {
  return (
    <section className="w-full max-w-3xl bg-safe-mint/10 backdrop-blur-[20px] border-2 border-severity-low/40 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 shadow-glass animate-fadeIn">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-severity-low/20 border border-severity-low flex items-center justify-center text-severity-low">
          <CheckCircle2 className="w-6 h-6 text-severity-low" />
        </div>
        <div>
          <span className="text-xs font-bold text-severity-low uppercase tracking-wider">
            Verified Clean Profile
          </span>
          <h3 className="font-headline text-2xl font-semibold text-white">
            No known interactions detected
          </h3>
        </div>
      </div>

      <p className="font-body text-base text-white/85 leading-relaxed">
        No known interaction was detected from the available clinical pharmacology and OpenFDA data for your selected medicines.
      </p>

      <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-white/60">
        <ShieldCheck className="w-4 h-4 text-severity-low flex-shrink-0" />
        <span>
          Always follow physician dosage directions. Even non-interacting medicines should be taken as prescribed.
        </span>
      </div>
    </section>
  );
}
