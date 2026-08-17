import React from 'react';
import { X, Pill } from 'lucide-react';

export function MedicineChip({ medicine, onRemove }) {
  return (
    <div className="group bg-white/10 hover:bg-white/15 border border-white/20 hover:border-white/30 rounded-full pl-3.5 pr-2 py-1.5 flex items-center gap-2 backdrop-blur-md transition-all duration-200 shadow-sm animate-fadeIn">
      <Pill className="w-3.5 h-3.5 text-secondary-fixed opacity-80" />
      <span className="font-body text-sm font-medium text-surface-bright tracking-wide">
        {medicine.name}
      </span>
      <button
        onClick={() => onRemove(medicine.id)}
        aria-label={`Remove ${medicine.name}`}
        className="w-5 h-5 rounded-full flex items-center justify-center text-white/50 hover:text-white hover:bg-white/20 transition-all active:scale-90 ml-1"
      >
        <X className="w-3.5 h-3.5" />
      </button>
    </div>
  );
}
