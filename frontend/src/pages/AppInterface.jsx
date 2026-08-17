import React from 'react';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { MedicineBasket } from '../components/MedicineBasket';
import { InteractionCard } from '../components/InteractionCard';
import { SafeState } from '../components/SafeState';
import { LoadingState } from '../components/LoadingState';
import { ErrorState } from '../components/ErrorState';
import { DemoModeToggle } from '../components/DemoModeToggle';
import { Disclaimer } from '../components/Disclaimer';
import { useMedicine } from '../context/MedicineContext';
import { ShieldAlert, AlertTriangle } from 'lucide-react';

export function AppInterface() {
  const { results, loading, error, checkSafety, medicines } = useMedicine();

  return (
    <div className="min-h-screen flex flex-col antialiased">
      <Navbar />

      <main className="flex-grow pt-28 pb-20 px-4 sm:px-8 md:px-16 flex flex-col items-center justify-start gap-10 max-w-5xl mx-auto w-full">
        {/* Demo Mode Presets Widget */}
        <DemoModeToggle />

        {/* Core Medicine Basket Container */}
        <MedicineBasket />

        {/* Results / Feedback Section */}
        <div className="w-full flex flex-col items-center gap-6">
          {/* 1. Loading State */}
          {loading && <LoadingState />}

          {/* 2. Error State */}
          {!loading && error && (
            <ErrorState error={error} onRetry={checkSafety} />
          )}

          {/* 3. Safe State (No interactions detected) */}
          {!loading && !error && results && results.safe && (
            <SafeState medicinesCount={medicines.length} />
          )}

          {/* 4. Detected Interactions List */}
          {!loading && !error && results && !results.safe && results.interactions.length > 0 && (
            <div className="w-full flex flex-col items-center gap-6">
              <div className="w-full max-w-3xl flex items-center justify-between px-2">
                <div className="flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5 text-severity-high" />
                  <h2 className="font-headline text-2xl font-semibold text-white">
                    {results.interactions.length} Potential Interaction{results.interactions.length > 1 ? 's' : ''} Detected
                  </h2>
                </div>
                <span className="text-xs text-tertiary-fixed-dim bg-white/10 px-3 py-1 rounded-full">
                  Analyzed {results.analyzed_pairs_count || results.interactions.length} Pairwise Combinations
                </span>
              </div>

              {results.interactions.map((interaction, idx) => (
                <InteractionCard key={idx} interaction={interaction} />
              ))}
            </div>
          )}
        </div>

        {/* Medical Safety Disclaimer Notice */}
        <Disclaimer />
      </main>

      <Footer />
    </div>
  );
}
