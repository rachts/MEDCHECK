import React from 'react';
import { AlertTriangle, AlertCircle, Info, ShieldAlert } from 'lucide-react';

const SEVERITY_CONFIG = {
  high: {
    label: 'High Risk Interaction',
    color: '#E07A5F',
    bg: 'rgba(224, 122, 95, 0.12)',
    border: 'rgba(224, 122, 95, 0.4)',
    badgeBg: 'rgba(224, 122, 95, 0.25)',
    icon: AlertTriangle,
    description: 'Requires immediate clinical attention or prescription review.',
  },
  moderate: {
    label: 'Moderate Risk Interaction',
    color: '#E8C547',
    bg: 'rgba(232, 197, 71, 0.12)',
    border: 'rgba(232, 197, 71, 0.4)',
    badgeBg: 'rgba(232, 197, 71, 0.25)',
    icon: AlertCircle,
    description: 'May alter therapeutic efficacy or increase side effect frequency.',
  },
  low: {
    label: 'Low / Minor Interaction',
    color: '#A8D5BA',
    bg: 'rgba(168, 213, 186, 0.12)',
    border: 'rgba(168, 213, 186, 0.4)',
    badgeBg: 'rgba(168, 213, 186, 0.25)',
    icon: Info,
    description: 'Minor clinical significance. Standard monitoring advised.',
  },
};

export function InteractionCard({ interaction }) {
  const { drug_a, drug_b, severity, explanation } = interaction;
  const sevKey = (severity || 'moderate').toLowerCase();
  const config = SEVERITY_CONFIG[sevKey] || SEVERITY_CONFIG.moderate;
  const IconComponent = config.icon;

  const capitalize = (str) =>
    str ? str.charAt(0).toUpperCase() + str.slice(1).toLowerCase() : '';

  return (
    <article
      style={{
        backgroundColor: config.bg,
        borderColor: config.border,
      }}
      className="w-full max-w-3xl backdrop-blur-[20px] border-2 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 shadow-glass transition-all duration-300 animate-fadeIn"
    >
      {/* Header with Severity Badge */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div
          style={{
            backgroundColor: config.badgeBg,
            borderColor: config.color,
            color: config.color,
          }}
          className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-xs font-bold uppercase tracking-wider"
        >
          <IconComponent className="w-3.5 h-3.5" />
          <span>{config.label}</span>
        </div>

        <span className="text-xs text-white/50 font-mono">
          Pairwise Check
        </span>
      </div>

      {/* Drug Names */}
      <div>
        <h3 className="font-headline text-2xl sm:text-3xl font-semibold text-white mb-2">
          {capitalize(drug_a)}{' '}
          <span className="text-secondary-fixed font-normal text-xl">+</span>{' '}
          {capitalize(drug_b)}
        </h3>

        {/* Mechanism Explanation */}
        <p className="font-body text-base text-white/90 leading-relaxed">
          {explanation}
        </p>
      </div>

      {/* Clinical Guidance Footnote */}
      <div className="pt-3 border-t border-white/10 flex items-center gap-2 text-xs text-white/60">
        <ShieldAlert className="w-4 h-4 text-secondary-fixed flex-shrink-0" />
        <span>{config.description} Consult your doctor before adjusting dosages.</span>
      </div>
    </article>
  );
}
