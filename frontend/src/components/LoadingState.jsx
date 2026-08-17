import React from 'react';
import { Loader2, Sparkles, Shield } from 'lucide-react';

export function LoadingState() {
  return (
    <section className="w-full max-w-3xl bg-white/[0.08] backdrop-blur-[20px] border border-white/[0.15] rounded-2xl p-8 flex flex-col items-center justify-center gap-6 shadow-glass animate-fadeIn relative overflow-hidden">
      {/* Shimmer sweep effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/5 to-transparent animate-shimmer pointer-events-none" />

      <div className="relative flex items-center justify-center">
        <div className="w-16 h-16 rounded-full bg-secondary-fixed/15 border border-secondary-fixed/40 flex items-center justify-center animate-pulse-slow">
          <Shield className="w-8 h-8 text-secondary-fixed" />
        </div>
        <Loader2 className="w-20 h-20 text-secondary-fixed/60 animate-spin absolute" />
      </div>

      <div className="text-center space-y-2 relative z-10">
        <div className="inline-flex items-center gap-2 text-xs font-semibold text-secondary-fixed uppercase tracking-wider">
          <Sparkles className="w-3.5 h-3.5" />
          Cross-Referencing OpenFDA & Pharmacology Cache
        </div>
        <h3 className="font-headline text-2xl font-semibold text-white">
          Analyzing your medicines...
        </h3>
        <p className="text-sm text-tertiary-fixed-dim/80 max-w-md">
          Evaluating pairwise molecular kinetics, contraindications, and potential adverse interactions.
        </p>
      </div>

      {/* Skeleton placeholders */}
      <div className="w-full space-y-3 pt-4 border-t border-white/10">
        <div className="h-4 bg-white/10 rounded-full w-3/4 animate-pulse" />
        <div className="h-4 bg-white/10 rounded-full w-5/6 animate-pulse" />
        <div className="h-4 bg-white/5 rounded-full w-1/2 animate-pulse" />
      </div>
    </section>
  );
}
