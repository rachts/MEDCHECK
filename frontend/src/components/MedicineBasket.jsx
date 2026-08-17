import React, { useState } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { MedicineChip } from './MedicineChip';
import { Plus, ArrowRight, Trash2, AlertCircle, Sparkles, Loader2 } from 'lucide-react';

export function MedicineBasket() {
  const [inputValue, setInputValue] = useState('');
  const {
    medicines,
    addMedicine,
    removeMedicine,
    clearBasket,
    checkSafety,
    loading,
    inputError,
    canCheck,
  } = useMedicine();

  const handleAdd = (e) => {
    e?.preventDefault();
    if (!inputValue.trim()) return;
    const success = addMedicine(inputValue);
    if (success) {
      setInputValue('');
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') {
      handleAdd(e);
    }
  };

  return (
    <section className="w-full max-w-3xl bg-white/[0.08] backdrop-blur-[20px] border border-white/[0.15] rounded-3xl p-6 sm:p-10 md:p-12 flex flex-col gap-6 shadow-glass relative overflow-hidden transition-all duration-300">
      {/* Inner Ambient Glow */}
      <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent pointer-events-none rounded-3xl" />

      {/* Header */}
      <div className="text-center relative z-10">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-secondary-fixed/15 border border-secondary-fixed/30 text-secondary-fixed text-xs font-semibold uppercase tracking-wider mb-3">
          <Sparkles className="w-3.5 h-3.5" />
          Interactive Drug Analyzer
        </div>
        <h1 className="font-headline text-3xl sm:text-4xl font-bold text-tertiary-fixed mb-2">
          Your Medicine Basket
        </h1>
        <p className="font-body text-sm sm:text-base text-tertiary-fixed-dim/90 max-w-md mx-auto">
          Add medicines to check for potential interactions, side effect overlap, and clinical warnings.
        </p>
      </div>

      {/* Input Form */}
      <form onSubmit={handleAdd} className="relative z-10 flex flex-col gap-2">
        <div className="relative flex items-center w-full">
          <input
            type="text"
            value={inputValue}
            onChange={(e) => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={loading}
            placeholder="Enter medicine name... (e.g. Warfarin, Aspirin)"
            className="w-full bg-white/[0.06] border border-white/[0.18] focus:border-secondary-fixed/80 rounded-[1.5rem] py-4 pl-5 sm:pl-6 pr-14 font-body text-base sm:text-lg text-white placeholder-tertiary-fixed-dim/50 outline-none transition-all backdrop-blur-sm focus:ring-2 focus:ring-secondary-fixed/20 disabled:opacity-50"
          />
          <button
            type="submit"
            disabled={loading || !inputValue.trim()}
            aria-label="Add Medicine"
            className="absolute right-2.5 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-secondary-fixed text-deep-olive flex items-center justify-center shadow-inner-glow hover:bg-secondary-fixed-dim transition-all active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            <Plus className="w-5 h-5 font-bold" />
          </button>
        </div>

        {/* Input Validation Error */}
        {inputError && (
          <div className="flex items-center gap-1.5 text-xs text-severity-high px-3 mt-1 animate-fadeIn">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            <span>{inputError}</span>
          </div>
        )}
      </form>

      {/* Populated Chips Area */}
      <div className="relative z-10 min-h-[50px] flex flex-col gap-3">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-tertiary-fixed-dim uppercase tracking-wider">
            Selected Medicines ({medicines.length})
          </span>
          {medicines.length > 0 && (
            <button
              onClick={clearBasket}
              disabled={loading}
              className="text-xs text-white/50 hover:text-severity-high flex items-center gap-1 transition-colors"
            >
              <Trash2 className="w-3 h-3" />
              Clear all
            </button>
          )}
        </div>

        {medicines.length === 0 ? (
          <div className="py-6 px-4 rounded-2xl border border-dashed border-white/15 bg-white/[0.02] text-center text-tertiary-fixed-dim/60 text-sm">
            Your basket is empty. Type a medication above or click a demo preset below.
          </div>
        ) : (
          <div className="flex flex-wrap gap-2.5">
            {medicines.map((med) => (
              <MedicineChip key={med.id} medicine={med} onRemove={removeMedicine} />
            ))}
          </div>
        )}
      </div>

      {/* Check Safety CTA Button */}
      <div className="relative z-10 flex flex-col items-center gap-2 pt-2 border-t border-white/10">
        <button
          onClick={checkSafety}
          disabled={!canCheck || loading}
          className={`w-full sm:w-auto min-w-[220px] font-body text-base font-semibold px-8 py-4 rounded-full transition-all duration-200 flex items-center justify-center gap-2.5 ${
            canCheck && !loading
              ? 'bg-secondary-fixed text-deep-olive shadow-button-glow hover:bg-secondary-fixed-dim hover:shadow-[0_0_20px_rgba(196,217,107,0.4)] active:scale-95 cursor-pointer'
              : 'bg-white/10 text-white/40 border border-white/10 cursor-not-allowed'
          }`}
        >
          {loading ? (
            <>
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Analyzing Safety...</span>
            </>
          ) : (
            <>
              <span>Check Safety</span>
              <ArrowRight className="w-4 h-4" />
            </>
          )}
        </button>

        {!canCheck && (
          <p className="text-xs text-tertiary-fixed-dim/70 text-center">
            Add at least 2 medicines to perform pairwise interaction analysis.
          </p>
        )}
      </div>
    </section>
  );
}
