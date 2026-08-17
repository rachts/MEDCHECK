import React from 'react';
import { useMedicine } from '../context/MedicineContext';
import { Sparkles, ArrowUpRight } from 'lucide-react';

export function DemoModeToggle() {
  const { isDemoMode, toggleDemoMode, demoPresets, loadPreset } = useMedicine();

  return (
    <div className="w-full max-w-3xl bg-white/[0.05] border border-white/[0.12] rounded-2xl p-5 backdrop-blur-md flex flex-col gap-3.5 transition-all">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-secondary-fixed" />
          <span className="text-sm font-semibold text-white">
            Demo Presets for Judges & Reviewers
          </span>
        </div>

        <button
          onClick={toggleDemoMode}
          className="text-xs text-secondary-fixed hover:underline"
        >
          {isDemoMode ? 'Hide Presets' : 'Show Quick Presets'}
        </button>
      </div>

      <p className="text-xs text-tertiary-fixed-dim/75 leading-relaxed">
        Click any verified clinical scenario below to instantly populate your Medicine Basket.
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
        {demoPresets.map((preset, index) => (
          <button
            key={index}
            onClick={() => loadPreset(preset)}
            className="text-left p-3 rounded-xl bg-white/[0.04] hover:bg-white/[0.1] border border-white/[0.1] hover:border-secondary-fixed/50 transition-all flex flex-col justify-between group active:scale-[0.98] cursor-pointer"
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-semibold text-white group-hover:text-secondary-fixed transition-colors">
                {preset.name}
              </span>
              <ArrowUpRight className="w-3.5 h-3.5 text-white/40 group-hover:text-secondary-fixed group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <span className="text-[11px] text-tertiary-fixed-dim/70 line-clamp-1">
              {preset.description}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}
