import React from 'react';
import { X, Pill } from 'lucide-react';
import { useMedicine } from '../context/MedicineContext';

export function MedicineChip({ medicine, onRemove }) {
  const { selectedMedicineName, selectMedicine, results } = useMedicine();
  const isSelected = selectedMedicineName?.toLowerCase() === medicine.name.toLowerCase();

  const isOTC = medicine.drugType === 'otc';
  const isRx = medicine.drugType === 'prescription';

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
      style={{ borderLeftColor: leftBorderColor, borderLeftWidth: '3px' }}
      className={`chip ${
        isSelected ? 'border-[var(--accent)] bg-[#E2E8F0]' : ''
      }`}
      title="Click to view contextual intelligence profile"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <div className={`w-6 h-6 rounded-[4px] flex items-center justify-center shrink-0 ${
          isSelected ? 'bg-[var(--accent)] text-[var(--text-inverse)]' : 'bg-[var(--bg-elevated)] text-[var(--text-muted)]'
        }`}>
          <Pill className="w-3.5 h-3.5" />
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
      </div>

      <div className="flex items-center gap-2 shrink-0">
        {/* Category Tag in Inter */}
        <span className={`tag font-sans ${
          isOTC ? 'tag-success' : isRx ? 'text-[#0284C7] bg-[#0284C7]/10 border-[#0284C7]/20' : 'text-[#7C3AED] bg-[#7C3AED]/10 border-[#7C3AED]/20'
        }`}>
          {isOTC ? 'OTC' : isRx ? 'Rx' : 'Supp'}
        </span>

        {/* Remove Button with 44px hit target padding */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onRemove(medicine.id);
          }}
          aria-label={`Remove ${medicine.name}`}
          className="w-7 h-7 rounded-[4px] flex items-center justify-center text-[var(--text-muted)] hover:text-[var(--text-primary)] hover:bg-[#E2E8F0] transition-colors cursor-pointer"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
