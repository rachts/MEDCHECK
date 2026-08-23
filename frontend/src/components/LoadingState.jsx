import React from 'react';
import { Shield } from 'lucide-react';
import { useMedicine } from '../context/MedicineContext';

export function LoadingState() {
  const { loadingStage } = useMedicine();

  return (
    <section className="card flex flex-col items-center justify-center gap-4 text-center py-8">
      <div className="w-10 h-10 rounded-[6px] bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center animate-pulse">
        <Shield className="w-5 h-5" />
      </div>

      <div className="space-y-1 max-w-sm">
        <div className="badge badge-info">
          CLINICAL SCAN IN PROGRESS
        </div>
        <h3 className="text-lg font-bold text-[var(--text-primary)] tracking-tight">
          {loadingStage || 'Analyzing Drug Interactions...'}
        </h3>
        <p className="text-xs text-[var(--text-muted)]">
          Evaluating pairwise kinetics, Stomach Guardian score, and 24-hour food schedule.
        </p>
      </div>

      {/* Progress Bar Animation */}
      <div className="w-full max-w-xs h-1.5 bg-[var(--bg-elevated)] rounded-full overflow-hidden border border-[var(--border-default)]">
        <div className="h-full bg-[var(--accent)] rounded-full animate-pulse w-3/4" />
      </div>
    </section>
  );
}
