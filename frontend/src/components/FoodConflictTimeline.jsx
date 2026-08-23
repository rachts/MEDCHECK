import React from 'react';
import { useMedicine } from '../context/MedicineContext';
import { Clock, AlertTriangle } from 'lucide-react';

export function FoodConflictTimeline() {
  const { results } = useMedicine();

  if (!results || (!results.food_conflicts?.length && !results.daily_food_timeline?.length)) {
    return null;
  }

  const conflicts = results.food_conflicts || [];
  const timeline = results.daily_food_timeline || [];

  return (
    <div className="card flex flex-col gap-3.5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-[4px] bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center">
            <Clock className="w-3.5 h-3.5" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-[var(--text-primary)]">
              Food & Timing Schedule
            </h3>
            <p className="text-xs text-[var(--text-muted)]">
              24-hour daily medication & meal cadence
            </p>
          </div>
        </div>

        {conflicts.length > 0 && (
          <div className="badge badge-moderate">
            {conflicts.length} TIMING CONFLICT{conflicts.length > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      {/* Conflict Warnings */}
      {conflicts.map((c, idx) => (
        <div key={idx} className="bg-[rgba(217,119,6,0.06)] border border-[rgba(217,119,6,0.25)] rounded-[6px] p-2.5 flex items-start gap-2">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--severity-moderate)] shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-[var(--text-primary)]">Conflict: {c.medicine_a} ↔ {c.medicine_b}</h4>
            <p className="text-xs text-[var(--text-secondary)] mt-0.5">{c.conflict}</p>
            <p className="text-xs text-[var(--text-primary)] font-semibold mt-1">
              Recommended Fix: {c.recommended_schedule}
            </p>
          </div>
        </div>
      ))}

      {/* 24-Hour Visual Schedule Timeline */}
      {timeline.length > 0 && (
        <div className="flex flex-col gap-1.5 relative pl-3 border-l-2 border-[var(--border-default)] ml-2 mt-1">
          {timeline.map((slot, idx) => {
            const isMeal = slot.action_type === 'meal';
            const isEmpty = slot.action_type === 'med_empty_stomach';
            const isWithFood = slot.action_type === 'med_with_food';
            const isDairy = slot.action_type === 'dairy_restriction';
            const isBedtime = slot.action_type === 'bedtime_med';

            let dotColor = 'var(--text-muted)';
            let tagType = 'tag';

            if (isEmpty) {
              dotColor = 'var(--severity-moderate)';
              tagType = 'tag-warning';
            } else if (isWithFood) {
              dotColor = 'var(--severity-low)';
              tagType = 'tag-success';
            } else if (isDairy) {
              dotColor = '#7C3AED';
              tagType = 'text-[#7C3AED] bg-[#7C3AED]/10 border-[#7C3AED]/20';
            } else if (isBedtime) {
              dotColor = 'var(--severity-info)';
              tagType = 'tag';
            }

            return (
              <div key={idx} className="relative flex items-start gap-2.5 py-1">
                {/* Node dot on timeline */}
                <div 
                  className="absolute -left-[18px] top-2.5 w-2.5 h-2.5 rounded-full border-2 border-[var(--bg-base)]" 
                  style={{ backgroundColor: dotColor }}
                />

                <div className="w-14 shrink-0 text-right metric text-xs text-[var(--text-primary)] font-bold pt-0.5">
                  {slot.time}
                </div>

                <div className="flex-1 p-2 rounded-[6px] bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:border-[var(--border-hover)] transition-colors">
                  <div className="flex items-center justify-between">
                    <span className={`text-sm font-medium ${isMeal ? 'text-[var(--text-secondary)]' : 'text-[var(--text-primary)] font-semibold'}`}>
                      {slot.title}
                    </span>
                    {slot.action_type !== 'meal' && (
                      <span className={`tag ${tagType}`}>
                        {slot.action_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[var(--text-muted)] mt-0.5">
                    {slot.note}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
