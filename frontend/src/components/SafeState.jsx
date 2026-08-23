import React from 'react';
import { CheckCircle2, ShieldCheck } from 'lucide-react';

export function SafeState({ medicinesCount = 2 }) {
  return (
    <section 
      style={{ borderLeftColor: 'var(--severity-low)', borderLeftWidth: '3px' }}
      className="card flex flex-col gap-3"
    >
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-[6px] bg-[rgba(5,150,105,0.08)] text-[var(--severity-low)] border border-[rgba(5,150,105,0.2)] flex items-center justify-center">
          <CheckCircle2 className="w-4 h-4 text-[var(--severity-low)]" />
        </div>
        <div>
          <div className="badge badge-low">
            VERIFIED CLEAN PROFILE
          </div>
          <h3 className="text-base font-semibold text-[var(--text-primary)] tracking-tight mt-0.5">
            Great news! Your medicines play well together.
          </h3>
        </div>
      </div>

      <p className="text-base text-[var(--text-secondary)] leading-relaxed">
        No known adverse drug-drug interactions or severe kinetic conflicts were detected across your {medicinesCount} selected medicines in our clinical database.
      </p>

      <div className="pt-2 border-t border-[var(--border-default)] flex items-center gap-2 text-xs text-[var(--text-muted)]">
        <ShieldCheck className="w-3.5 h-3.5 text-[var(--severity-low)] shrink-0" />
        <span>
          Always follow prescribing directions. Even non-interacting medicines should be taken with proper meal intervals.
        </span>
      </div>
    </section>
  );
}
