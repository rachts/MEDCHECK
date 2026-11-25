import React, { useState } from 'react';
import {
  FoodIcon,
  AlcoholIcon,
  UserIcon,
  ClockIcon,
  PillIcon,
  DocumentIcon,
  ChevronDownIcon,
  ChevronUpIcon,
  ShieldCrossIcon,
} from '../pages/landing-icons';
import { useMedicine } from '../context/MedicineContext';

/**
 * Renders a single drug-drug interaction finding.
 *
 * @param {object} props
 * @param {import('../types/api').InteractionItem} props.interaction
 */
function InteractionCardBase({ interaction }) {
  const { selectMedicine, setDoctorReportOpen } = useMedicine();
  const [expandedMobile, setExpandedMobile] = useState(false);

  // Neutral / no-op branch for 'none' severity so it can never render as LOW RISK
  if (!interaction || interaction.severity === 'none') {
    return null;
  }

  const isHigh = interaction.severity === 'high';
  const isMod = interaction.severity === 'moderate';

  const sheetClass = isHigh ? 'ed-sheet-crit' : isMod ? 'ed-sheet-caut' : 'ed-sheet-safe';
  const badgeClass = isHigh ? 'ed-tag-crit' : isMod ? 'ed-tag-caut' : 'ed-tag-safe';
  const badgeLabel = isHigh ? 'CRITICAL / HIGH RISK' : isMod ? 'CAUTION / MODERATE RISK' : 'LOW RISK';

  // Build Action Tags with strict word boundary regex
  const actionTags = [];
  const fullText = `${interaction.explanation} ${interaction.stomach_impact || ''} ${interaction.food_consideration || ''} ${interaction.action_guidance || ''}`;

  if (/\balcohol\b/i.test(fullText)) {
    actionTags.push({ label: 'Avoid Alcohol', Icon: AlcoholIcon, cls: 'ed-tag-crit' });
  }
  if (/\b(food|meal|milk)\b/i.test(fullText)) {
    actionTags.push({ label: 'Take With Food', Icon: FoodIcon, cls: 'ed-tag-caut' });
  }
  if (/\b(doctor|consult|physician|prescriber)\b/i.test(fullText) || isHigh) {
    actionTags.push({ label: 'Doctor Consult', Icon: UserIcon, cls: '' });
  }
  if (/\b(hour|hours|spacing|before|after)\b/i.test(fullText)) {
    actionTags.push({ label: 'Dose Spacing', Icon: ClockIcon, cls: '' });
  }

  return (
    <article
      className={`${sheetClass} p-5 flex flex-col gap-3.5`}
      aria-label={`Interaction between ${interaction.drug_a} and ${interaction.drug_b}, severity: ${interaction.severity}`}
    >
      {/* Header: Severity word tag + Drug Pair buttons */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-3 border-b border-[#d5cfc0]">
        <span className={`ed-tag ${badgeClass} font-semibold`}>
          {badgeLabel}
        </span>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => selectMedicine(interaction.drug_a)}
            className="px-2.5 py-1 bg-[#f8f6f0] hover:bg-[#1a1a18] hover:text-[#f8f6f0] border border-[#1a1a18] font-newsreader font-semibold text-[15px] text-[#1a1a18] transition-colors cursor-pointer capitalize"
            aria-label={`View clinical profile for ${interaction.drug_a}`}
          >
            {interaction.drug_a}
          </button>
          <span className="font-ibm-mono text-xs text-[#57534a]">+</span>
          <button
            type="button"
            onClick={() => selectMedicine(interaction.drug_b)}
            className="px-2.5 py-1 bg-[#f8f6f0] hover:bg-[#1a1a18] hover:text-[#f8f6f0] border border-[#1a1a18] font-newsreader font-semibold text-[15px] text-[#1a1a18] transition-colors cursor-pointer capitalize"
            aria-label={`View clinical profile for ${interaction.drug_b}`}
          >
            {interaction.drug_b}
          </button>
        </div>
      </div>

      {/* Body: Explanation */}
      <p className="text-[15px] text-[#1a1a18] font-ibm-serif leading-relaxed">
        {interaction.explanation}
      </p>

      {/* Mechanism Snippet (Collapsible on mobile only) */}
      {interaction.mechanism && (
        <div className="ed-inset p-3.5 text-sm text-[#2d2b26] font-ibm-serif">
          <div className="flex items-center justify-between">
            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
              Biological Mechanism
            </span>
            <button
              type="button"
              onClick={() => setExpandedMobile(!expandedMobile)}
              aria-expanded={expandedMobile}
              aria-label={expandedMobile ? 'Collapse biological mechanism' : 'Expand biological mechanism'}
              className="md:hidden text-[#57534a] hover:text-[#1a1a18] p-1 cursor-pointer"
            >
              {expandedMobile ? <ChevronUpIcon size={14} /> : <ChevronDownIcon size={14} />}
            </button>
          </div>
          <div className={`${expandedMobile ? 'block' : 'hidden md:block'} mt-1.5 leading-relaxed`}>
            <span>{interaction.mechanism}</span>
          </div>
        </div>
      )}

      {/* Evidence Source Metadata Bar */}
      {interaction.evidence_source && (
        <div className="flex items-center gap-2 text-xs text-[#2d2b26] bg-[#ece7d5] border border-[#b7b09d] px-3 py-1.5 font-ibm-serif">
          <ShieldCrossIcon size={14} className="text-[#2d4a22] shrink-0" />
          <span className="truncate">
            <strong className="font-semibold text-[#1a1a18]">Evidence:</strong> {interaction.evidence_source}
          </span>
          {interaction.confidence && (
            <span className="hidden sm:inline font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a]">
              ({interaction.confidence})
            </span>
          )}
        </div>
      )}

      {/* Action Tags Bar */}
      {actionTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {actionTags.map((tag) => {
            const IconComp = tag.Icon;
            return (
              <span key={tag.label} className={`ed-tag ${tag.cls}`}>
                <IconComp size={12} />
                <span>{tag.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#d5cfc0] text-sm text-[#57534a]">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => selectMedicine(interaction.drug_a)}
            className="text-[#1a1a18] hover:text-[#8b2500] hover:underline underline-offset-4 flex items-center gap-1 cursor-pointer transition-colors font-newsreader font-semibold text-[14px]"
          >
            <PillIcon size={13} />
            <span>Profile {interaction.drug_a}</span>
          </button>
          <span className="text-[#b7b09d]">·</span>
          <button
            type="button"
            onClick={() => selectMedicine(interaction.drug_b)}
            className="text-[#1a1a18] hover:text-[#8b2500] hover:underline underline-offset-4 flex items-center gap-1 cursor-pointer transition-colors font-newsreader font-semibold text-[14px]"
          >
            <PillIcon size={13} />
            <span>Profile {interaction.drug_b}</span>
          </button>
        </div>

        <button
          type="button"
          onClick={() => setDoctorReportOpen(true)}
          className="text-[#1a1a18] hover:text-[#8b2500] hover:underline underline-offset-4 flex items-center gap-1.5 cursor-pointer transition-colors font-ibm-mono text-[11px] font-medium uppercase tracking-[0.07em]"
        >
          <DocumentIcon size={13} />
          <span className="hidden sm:inline">Add to Report</span>
        </button>
      </div>
    </article>
  );
}

export const InteractionCard = React.memo(InteractionCardBase);
export default InteractionCard;
