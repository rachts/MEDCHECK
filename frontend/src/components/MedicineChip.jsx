import React from 'react';
import { CloseIcon, PillIcon } from '../pages/landing-icons';
import { useMedicine } from '../context/MedicineContext';

/**
 * One row in the medicine basket.
 *
 * @param {object} props
 * @param {import('../types/api').BasketMedicine} props.medicine
 * @param {(id: string) => void} props.onRemove
 */
function MedicineChipBase({ medicine, onRemove }) {
  const { selectedMedicineName, selectMedicine, results } = useMedicine();
  const isSelected = selectedMedicineName?.toLowerCase() === medicine.name.toLowerCase();

  const drugBadge = {
    otc: { label: 'OTC', cls: 'ed-tag-safe' },
    prescription: { label: 'Rx', cls: 'ed-tag-ink' },
    supplement: { label: 'Supp', cls: 'ed-tag-olive' },
    substance: { label: 'Sub', cls: 'ed-tag-crit' },
    lifestyle_factor: { label: 'Life', cls: 'ed-tag-caut' },
    unknown: { label: '--', cls: '' },
  }[medicine.drugType] || { label: '--', cls: '' };

  const medProfile = results?.profiles?.[medicine.name.toLowerCase()];
  const giTier = medProfile?.gi_profile?.risk_tier;

  const hasCritical = results?.interactions?.some(
    (i) => (i.drug_a.toLowerCase() === medicine.name.toLowerCase() || i.drug_b.toLowerCase() === medicine.name.toLowerCase()) && i.severity === 'high'
  );
  const hasModerate = results?.interactions?.some(
    (i) => (i.drug_a.toLowerCase() === medicine.name.toLowerCase() || i.drug_b.toLowerCase() === medicine.name.toLowerCase()) && i.severity === 'moderate'
  );

  // Risk markers use top 3px border + full border, never left stripes
  let topBorderColor = '#1a1a18';
  let riskWord = null;
  let riskTextColor = 'text-[#57534a]';

  if (results) {
    if (hasCritical || giTier === 'high') {
      topBorderColor = '#8b2500';
      riskWord = 'CRITICAL';
      riskTextColor = 'text-[#8b2500]';
    } else if (hasModerate || giTier === 'moderate') {
      topBorderColor = '#8a5300';
      riskWord = 'CAUTION';
      riskTextColor = 'text-[#8a5300]';
    } else {
      topBorderColor = '#2d4a22';
      riskWord = 'SAFE';
      riskTextColor = 'text-[#2d4a22]';
    }
  }

  return (
    <div
      onClick={() => selectMedicine(medicine.name)}
      style={{ borderTopColor: topBorderColor, borderTopWidth: '3px' }}
      className={`flex items-center justify-between px-3.5 py-3 border transition-colors cursor-pointer min-h-[52px] ${
        isSelected
          ? 'border-[#1a1a18] bg-[#ece7d5]'
          : 'border-[#b7b09d] bg-[#f8f6f0] hover:bg-[#f0ede1]'
      }`}
      title="Click to view contextual intelligence profile"
    >
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
        <div className={`w-6 h-6 border flex items-center justify-center shrink-0 ${
          isSelected
            ? 'bg-[#1a1a18] text-[#f8f6f0] border-[#1a1a18]'
            : 'bg-[#f0ede1] text-[#1a1a18] border-[#b7b09d]'
        }`}>
          <PillIcon size={13} />
        </div>

        <div className="flex flex-col min-w-0">
          <span className="font-newsreader text-[17px] font-semibold text-[#1a1a18] leading-snug truncate">
            {medicine.name}
          </span>
          <span className="text-xs text-[#57534a] capitalize truncate font-ibm-serif">
            {medProfile?.generic_name || medicine.name.toLowerCase()}
            {riskWord && (
              <span className={`ml-1.5 font-ibm-mono text-[10px] uppercase tracking-[0.06em] font-semibold ${riskTextColor}`}>
                · {riskWord}
              </span>
            )}
          </span>
          {medProfile?.is_fdc && (
            <span
              className="text-[11px] text-[#8a5300] font-medium font-ibm-serif leading-tight mt-0.5"
              title={medProfile?.fdc_warning || 'Combination product; analysis covers primary ingredient only.'}
            >
              Combination product; covers primary ingredient only
            </span>
          )}
        </div>
      </button>

      <div className="flex items-center gap-1.5 shrink-0">
        {medProfile?.is_fdc && (
          <span
            className="ed-tag ed-tag-caut cursor-help"
            title={medProfile?.fdc_warning || 'Combination product; analysis covers primary ingredient only.'}
          >
            FDC
          </span>
        )}

        {/* Category Tag */}
        <span className={`ed-tag ${drugBadge.cls}`}>
          {drugBadge.label}
        </span>

        {/* Remove Button */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(medicine.id);
          }}
          aria-label={`Remove ${medicine.name} from the basket`}
          className="w-7 h-7 flex items-center justify-center text-[#57534a] hover:text-[#8b2500] hover:bg-[#f0ede1] border border-transparent hover:border-[#b7b09d] transition-colors cursor-pointer"
        >
          <CloseIcon size={13} />
        </button>
      </div>
    </div>
  );
}

export const MedicineChip = React.memo(MedicineChipBase);
export default MedicineChip;
