import React, { useState } from 'react';
import { 
  Utensils, 
  Wine,
  UserCheck,
  Clock,
  Pill,
  FileText,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { useMedicine } from '../context/MedicineContext';

export function InteractionCard({ interaction }) {
  const { selectMedicine, setDoctorReportOpen } = useMedicine();
  const [expandedMobile, setExpandedMobile] = useState(false);

  const isHigh = interaction.severity === 'high';
  const isMod = interaction.severity === 'moderate';

  const badgeClass = isHigh ? 'badge-high' : isMod ? 'badge-moderate' : 'badge-low';
  const badgeLabel = isHigh ? 'CRITICAL RISK' : isMod ? 'MODERATE CAUTION' : 'LOW RISK';

  // Build Action Tags
  const actionTags = [];
  const fullText = `${interaction.explanation} ${interaction.stomach_impact || ''} ${interaction.food_consideration || ''} ${interaction.action_guidance || ''}`.toLowerCase();

  if (fullText.includes('alcohol')) {
    actionTags.push({ label: 'Avoid Alcohol', icon: Wine, type: 'tag-danger' });
  }
  if (fullText.includes('food') || fullText.includes('meal')) {
    actionTags.push({ label: 'Take With Food', icon: Utensils, type: 'tag-warning' });
  }
  if (fullText.includes('doctor') || fullText.includes('consult') || isHigh) {
    actionTags.push({ label: 'Doctor Consult', icon: UserCheck, type: 'tag' });
  }
  if (fullText.includes('hour') || fullText.includes('spacing') || fullText.includes('before') || fullText.includes('after')) {
    actionTags.push({ label: 'Dose Spacing', icon: Clock, type: 'tag' });
  }

  return (
    <div className={`card card-enter flex flex-col gap-3.5 ${
      isHigh ? 'border-l-4 border-l-[var(--severity-high)]' : isMod ? 'border-l-4 border-l-[var(--severity-moderate)]' : 'border-l-4 border-l-[var(--severity-low)]'
    }`}>
      {/* Header: Dot + Uppercase Severity Label + Drug Pair Tags */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {/* Severity Badge */}
        <div className={`badge ${badgeClass}`}>
          {badgeLabel}
        </div>

        {/* Drug Pair Buttons with Serif typography */}
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => selectMedicine(interaction.drug_a)}
            className="px-2.5 py-1 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] border border-[var(--border-default)] font-serif font-bold text-[15px] text-[var(--text-primary)] transition-colors cursor-pointer capitalize"
          >
            {interaction.drug_a}
          </button>
          <span className="text-[var(--text-muted)] text-xs font-bold font-sans">↔</span>
          <button
            onClick={() => selectMedicine(interaction.drug_b)}
            className="px-2.5 py-1 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] border border-[var(--border-default)] font-serif font-bold text-[15px] text-[var(--text-primary)] transition-colors cursor-pointer capitalize"
          >
            {interaction.drug_b}
          </button>
        </div>
      </div>

      {/* Body: Explanation */}
      <p className="text-body text-[var(--text-primary)] font-normal">
        {interaction.explanation}
      </p>

      {/* Mechanism Snippet (Collapsible on mobile) */}
      {interaction.mechanism && (
        <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-3 text-sm text-[var(--text-secondary)]">
          <div 
            onClick={() => setExpandedMobile(!expandedMobile)}
            className="flex items-center justify-between cursor-pointer md:cursor-default"
          >
            <span className="text-label text-[var(--text-muted)] block">
              Biological Mechanism
            </span>
            <span className="md:hidden text-xs text-[var(--text-muted)]">
              {expandedMobile ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </span>
          </div>
          <div className={`${expandedMobile ? 'block' : 'hidden md:block'} mt-1`}>
            <span>{interaction.mechanism}</span>
          </div>
        </div>
      )}

      {/* Action Tags Bar */}
      {actionTags.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
          {actionTags.map((tag, idx) => {
            const Icon = tag.icon;
            return (
              <span key={idx} className={`tag ${tag.type}`}>
                <Icon className="w-3 h-3" />
                <span>{tag.label}</span>
              </span>
            );
          })}
        </div>
      )}

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-2 border-t border-[var(--border-default)] text-sm text-[var(--text-muted)]">
        <div className="flex items-center gap-2">
          <button
            onClick={() => selectMedicine(interaction.drug_a)}
            className="hover:text-[var(--accent)] flex items-center gap-1 cursor-pointer transition-colors font-serif font-semibold text-[14px]"
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Profile {interaction.drug_a}</span>
          </button>
          <span>•</span>
          <button
            onClick={() => selectMedicine(interaction.drug_b)}
            className="hover:text-[var(--accent)] flex items-center gap-1 cursor-pointer transition-colors font-serif font-semibold text-[14px]"
          >
            <Pill className="w-3.5 h-3.5" />
            <span>Profile {interaction.drug_b}</span>
          </button>
        </div>

        <button
          onClick={() => setDoctorReportOpen(true)}
          className="hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer transition-colors font-sans text-xs font-semibold"
        >
          <FileText className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add to Report</span>
        </button>
      </div>
    </div>
  );
}
