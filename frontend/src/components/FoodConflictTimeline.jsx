import React, { useRef } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { ClockIcon, WarningIcon } from '../pages/landing-icons';

function FoodConflictTimelineBase() {
  const { results, patientWakeTime, setPatientWakeTime, checkSafety, loading } = useMedicine();
  const debounceTimerRef = useRef(null);

  if (!results || (!results.food_conflicts?.length && !results.daily_food_timeline?.length)) {
    return null;
  }

  const conflicts = results.food_conflicts || [];
  const timeline = results.daily_food_timeline || [];

  const handleWakeTimeChange = (e) => {
    const next = e.target.value;
    setPatientWakeTime(next);
    if (next) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        checkSafety({ wakeTime: next });
      }, 500);
    }
  };

  return (
    <div id="food-timeline" className="ed-sheet p-5 flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-3 flex-wrap pb-3 border-b border-[#d5cfc0]">
        <div className="flex items-start gap-2.5">
          <div className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0 mt-0.5">
            <ClockIcon size={15} />
          </div>
          <div>
            <h3 className="font-newsreader text-[17px] font-semibold text-[#1a1a18] leading-tight">
              Food &amp; Timing Schedule
            </h3>
            <p className="text-xs text-[#57534a] font-ibm-serif mt-0.5">
              24-hour daily medication &amp; meal cadence
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <label
            htmlFor="patient-wake-time"
            className="font-ibm-mono text-[11px] text-[#57534a] font-medium uppercase tracking-[0.07em]"
          >
            I wake at
          </label>
          <input
            id="patient-wake-time"
            type="time"
            value={patientWakeTime}
            onChange={handleWakeTimeChange}
            disabled={loading}
            className="bg-[#f8f6f0] border border-[#1a1a18] px-2.5 py-1 text-xs font-ibm-mono text-[#1a1a18] outline-none min-h-[32px] disabled:opacity-50"
            aria-label="Your usual wake-up time, used to anchor the medication schedule"
          />

          {conflicts.length > 0 && (
            <span className="ed-tag ed-tag-caut font-semibold">
              {conflicts.length} TIMING CONFLICT{conflicts.length > 1 ? 'S' : ''}
            </span>
          )}
        </div>
      </div>

      {/* Conflict Warnings */}
      {conflicts.map((c, idx) => (
        <div
          key={`${c.medicine_a}-${c.medicine_b}-${c.conflict_type}-${idx}`}
          className="ed-notice-caut p-3 flex items-start gap-2.5 font-ibm-serif"
        >
          <WarningIcon size={15} className="shrink-0 mt-0.5" />
          <div className="flex-1">
            <h4 className="text-sm font-semibold text-[#1a1a18] font-newsreader">
              Conflict: {c.medicine_a} + {c.medicine_b}
            </h4>
            <p className="text-xs text-[#2d2b26] mt-0.5 leading-relaxed">{c.conflict}</p>
            <p className="text-xs text-[#1a1a18] font-semibold mt-1">
              Recommended Fix: {c.recommended_schedule}
            </p>
          </div>
        </div>
      ))}

      {/* 24-Hour Ruled Schedule Ledger */}
      {timeline.length > 0 && (
        <div className="border border-[#b7b09d] bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
          {timeline.map((slot, idx) => {
            const isMeal = slot.action_type === 'meal';
            const isEmpty = slot.action_type === 'med_empty_stomach';
            const isWithFood = slot.action_type === 'med_with_food';
            const isDairy = slot.action_type === 'dairy_restriction';
            const isBedtime = slot.action_type === 'bedtime_med';

            let markerColor = '#57534a';
            let tagCls = '';

            if (isEmpty) {
              markerColor = '#8a5300';
              tagCls = 'ed-tag-caut';
            } else if (isWithFood) {
              markerColor = '#2d4a22';
              tagCls = 'ed-tag-safe';
            } else if (isDairy) {
              markerColor = '#8b2500';
              tagCls = 'ed-tag-crit';
            } else if (isBedtime) {
              markerColor = '#1a1a18';
              tagCls = 'ed-tag-ink';
            }

            return (
              <div
                key={`${slot.time}-${slot.action_type}-${idx}`}
                className="grid grid-cols-[74px_1fr] items-start hover:bg-[#f0ede1] transition-colors"
              >
                <div className="p-3 border-r border-[#d5cfc0] flex items-center justify-end gap-2 h-full bg-[#f0ede1]">
                  <span className="font-ibm-mono text-xs font-medium text-[#1a1a18] tabular-nums">
                    {slot.time}
                  </span>
                  <span
                    className="w-2 h-2 shrink-0"
                    style={{ backgroundColor: markerColor }}
                    aria-hidden="true"
                  />
                </div>

                <div className="p-3">
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <span className={`text-sm font-ibm-serif ${isMeal ? 'text-[#57534a] font-normal' : 'text-[#1a1a18] font-semibold'}`}>
                      {slot.title}
                    </span>
                    {slot.action_type !== 'meal' && (
                      <span className={`ed-tag ${tagCls}`}>
                        {slot.action_type.replace(/_/g, ' ')}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-[#57534a] mt-0.5 font-ibm-serif leading-relaxed">
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

export const FoodConflictTimeline = React.memo(FoodConflictTimelineBase);
export default FoodConflictTimeline;
