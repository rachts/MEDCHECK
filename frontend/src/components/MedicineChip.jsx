import React from 'react';
import { X, Pill } from 'lucide-react';
import { useMedicine } from '../context/MedicineContext';

/**
 * One row in the medicine basket.
 *
 * Props are documented with JSDoc rather than `prop-types` deliberately:
 * prop-types is a runtime dependency that only reports violations in the console
 * after a bad render has already happened, whereas these annotations resolve
 * against the real `types/api.ts` interfaces and surface in the editor before the
 * call site is even saved. `tsconfig.json` keeps `checkJs: false` while the
 * component tree is still .jsx, so these are documentation plus IDE
 * IntelliSense, not a build gate.
 *
 * @param {object} props
 * @param {import('../types/api').BasketMedicine} props.medicine
 *   Basket entry to render. `medicine.name` carries the user's display casing, so
 *   every comparison below lowercases it before matching against API payloads.
 * @param {(id: string) => void} props.onRemove
 *   Removes the entry by id. Must be referentially stable (a `useCallback` from
 *   MedicineContext) or the `React.memo` wrapper at the bottom of this file is
 *   defeated.
 */
function MedicineChipBase({ medicine, onRemove }) {
  const { selectedMedicineName, selectMedicine, results } = useMedicine();
  const isSelected = selectedMedicineName?.toLowerCase() === medicine.name.toLowerCase();

  // Badge text and classes for the six `DrugType` values. `Supp` was previously
  // the catch-all for anything that was not OTC or Rx, which grouped a
  // prescription-strength substance like alcohol (classed `'substance'` by the
  // backend) under the same violet tag as a multivitamin. Distinct labels here
  // cost nothing and keep a substance from reading as a dietary supplement.
  const drugBadge = {
    otc: { label: 'OTC', cls: 'tag-success', },
    prescription: { label: 'Rx', cls: 'text-[#0284C7] bg-[#0284C7]/10 border-[#0284C7]/20', },
    supplement: { label: 'Supp', cls: 'text-[#7C3AED] bg-[#7C3AED]/10 border-[#7C3AED]/20', },
    substance: { label: 'Sub', cls: 'text-[#BE185D] bg-[#BE185D]/10 border-[#BE185D]/20', },
    lifestyle_factor: { label: 'Life', cls: 'text-[#B45309] bg-[#B45309]/10 border-[#B45309]/20', },
    unknown: { label: '—', cls: 'text-[#64748B] bg-[#64748B]/10 border-[#64748B]/20', },
  }[medicine.drugType] || { label: '—', cls: 'text-[#64748B] bg-[#64748B]/10 border-[#64748B]/20' };

  // Determine individual medicine risk for left border
  let leftBorderColor = 'var(--severity-low)'; // #059669
  const medProfile = results?.profiles?.[medicine.name.toLowerCase()];
  const giTier = medProfile?.gi_profile?.risk_tier;

  const hasCritical = results?.interactions?.some(
    (i) => (i.drug_a.toLowerCase() === medicine.name.toLowerCase() || i.drug_b.toLowerCase() === medicine.name.toLowerCase()) && i.severity === 'high'
  );
  const hasModerate = results?.interactions?.some(
    (i) => (i.drug_a.toLowerCase() === medicine.name.toLowerCase() || i.drug_b.toLowerCase() === medicine.name.toLowerCase()) && i.severity === 'moderate'
  );

  if (hasCritical || giTier === 'high') {
    leftBorderColor = 'var(--severity-high)'; // #DC2626
  } else if (hasModerate || giTier === 'moderate') {
    leftBorderColor = 'var(--severity-moderate)'; // #D97706
  }

  return (
    <div
      onClick={() => selectMedicine(medicine.name)}
      // The left border carries the per-medicine severity, so it is set here rather
      // than in `.chip`: the colour depends on this render's interaction/GI data,
      // and an inline style is also the only form that survives the
      // `border-[var(--accent)]` utility applied below when the chip is selected.
      style={{ borderLeftColor: leftBorderColor, borderLeftWidth: '3px' }}
      className={`chip ${
        isSelected ? 'border-[var(--accent)] bg-[#E2E8F0]' : ''
      }`}
      title="Click to view contextual intelligence profile"
    >
      {/* The whole chip stays mouse-clickable (above), but the keyboard and
          screen-reader affordance is this real <button> rather than a
          `role="button"` on the wrapper. A wrapper with that role would swallow the
          remove button below it -- ARIA treats a button's children as
          presentational, so the one control that destroys data would have stopped
          being announced. stopPropagation keeps the wrapper's handler from firing a
          second, duplicate profile fetch when the button itself is activated. */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          selectMedicine(medicine.name);
        }}
        aria-pressed={isSelected}
        aria-label={`View clinical profile for ${medicine.name}`}
        className="flex items-center gap-2.5 min-w-0 text-left bg-transparent border-0 p-0 cursor-pointer"
      >
        <div className={`w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0 ${
          isSelected ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
        }`}>
          <Pill className="w-3.5 h-3.5" aria-hidden="true" />
        </div>

        <div className="flex flex-col min-w-0">
          {/* Medicine Name in Serif font for medical authority */}
          <span className="font-serif text-[17px] font-bold text-[var(--text-primary)] leading-snug truncate">
            {medicine.name}
          </span>
          <span className="text-xs text-[var(--text-muted)] capitalize truncate font-sans">
            {medProfile?.generic_name || medicine.name.toLowerCase()}
          </span>
        </div>
      </button>

      <div className="flex items-center gap-2 shrink-0">
        {/* Category Tag in Inter */}
        <span className={`tag font-sans ${drugBadge.cls}`}>
          {drugBadge.label}
        </span>

        {/* Remove Button with 44px hit target padding */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(medicine.id);
          }}
          aria-label={`Remove ${medicine.name} from the basket`}
          className="w-7 h-7 rounded-[4px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" aria-hidden="true" />
        </button>
      </div>
    </div>
  );
}

// Memoised: MedicineBasket owns the search input's local state, so every keystroke
// re-renders the basket and, previously, every chip in it. Both props are stable --
// `medicine` is an entry from the medicines array and `onRemove` is a useCallback --
// so the chips now sit out those renders.
export const MedicineChip = React.memo(MedicineChipBase);
