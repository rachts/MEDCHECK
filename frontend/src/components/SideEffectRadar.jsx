import React from 'react';
import { useMedicine } from '../context/MedicineContext';
import { AlertTriangle } from 'lucide-react';

export function SideEffectRadar() {
  const { results } = useMedicine();

  if (!results || !results.aggregated_side_effects || results.aggregated_side_effects.length === 0) {
    return null;
  }

  return (
    <div 
      style={{ borderLeftColor: 'var(--severity-high)', borderLeftWidth: '3px' }}
      className="card flex flex-col gap-3"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[4px] bg-[rgba(220,38,38,0.08)] text-[var(--severity-high)] flex items-center justify-center">
            <AlertTriangle className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--severity-high)]">
              Side Effect Amplification Alert
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              Multiple medications in your basket compound the same adverse risk
            </p>
          </div>
        </div>

        <div className="badge badge-high">
          {results.aggregated_side_effects.length} COMPOUNDED RISK{results.aggregated_side_effects.length > 1 ? 'S' : ''}
        </div>
      </div>

      {/* Amplified Items Grid */}
      <div className="grid grid-cols-1 gap-1.5 mt-0.5">
        {results.aggregated_side_effects.map((item, idx) => (
          <div 
            key={idx} 
            className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5 flex flex-col gap-1"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-[var(--text-primary)]">{item.effect}</span>
                <span className="tag tag-danger">
                  {item.severity}
                </span>
              </div>

              <div className="text-xs text-[var(--text-muted)]">
                Sources: <span className="text-[var(--text-primary)] font-semibold">{item.sources.join(' + ')}</span>
              </div>
            </div>

            <p className="text-xs text-[var(--text-secondary)] leading-relaxed mt-0.5">
              {item.clinical_note}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
