import React from 'react';
import { AlertCircle, RotateCcw } from 'lucide-react';

export function ErrorState({ error, onRetry }) {
  return (
    <section className="w-full max-w-3xl bg-danger-coral/10 backdrop-blur-[20px] border-2 border-severity-high/40 rounded-2xl p-6 sm:p-8 flex flex-col gap-4 shadow-glass animate-fadeIn">
      <div className="flex items-start gap-3.5">
        <div className="w-10 h-10 rounded-full bg-severity-high/20 border border-severity-high flex items-center justify-center flex-shrink-0 text-severity-high">
          <AlertCircle className="w-5 h-5" />
        </div>
        <div className="flex-grow">
          <h3 className="font-headline text-xl font-semibold text-white mb-1">
            Unable to Complete Safety Check
          </h3>
          <p className="font-body text-sm sm:text-base text-white/80 leading-relaxed">
            {error || 'Something went wrong while checking interactions. Please verify the medicine names and try again.'}
          </p>
        </div>
      </div>

      {onRetry && (
        <div className="pt-2 flex justify-end">
          <button
            onClick={onRetry}
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/10 hover:bg-white/20 text-white text-xs font-semibold uppercase tracking-wider border border-white/20 transition-all active:scale-95 cursor-pointer"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Try Again
          </button>
        </div>
      )}
    </section>
  );
}
