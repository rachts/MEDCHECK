import React from 'react';
import { Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { ArrowRight, ShieldCheck, Database, Sparkles, Pill, AlertTriangle, CheckCircle2 } from 'lucide-react';

export function Landing() {
  return (
    <div className="min-h-screen flex flex-col bg-surface text-on-surface antialiased">
      <Navbar />

      <main className="flex-grow pt-20">
        {/* Hero Section */}
        <section className="relative min-h-[85vh] flex items-center justify-center overflow-hidden bg-gradient-to-b from-primary-container to-sage-gradient-stop px-4 sm:px-8 md:px-16 py-16">
          {/* Decorative Ambient Orbs */}
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-secondary-fixed/10 rounded-full blur-[120px] animate-pulse-slow" />
            <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-primary-fixed/10 rounded-full blur-[120px]" />
          </div>

          <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center">
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-secondary-fixed/15 border border-secondary-fixed/30 text-secondary-fixed text-xs sm:text-sm font-semibold uppercase tracking-wider mb-6">
              <Sparkles className="w-4 h-4" />
              Next-Generation Medication Safety
            </div>

            <h1 className="font-headline text-4xl sm:text-6xl md:text-7xl font-bold text-surface-bright mb-6 text-glow leading-[1.15]">
              Know <span className="underline decoration-secondary-fixed/60 underline-offset-8">Before You</span> Take
            </h1>

            <p className="font-body text-base sm:text-xl text-surface-container-highest max-w-2xl mb-10 leading-relaxed">
              Check your medicines for potential interactions, contraindications, and clinical warnings before they become a problem.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 w-full sm:w-auto">
              <Link
                to="/app"
                className="font-body text-base font-semibold bg-secondary-fixed text-deep-olive px-8 py-4 rounded-full shadow-button-glow hover:scale-105 hover:bg-secondary-fixed-dim transition-all flex items-center justify-center gap-2"
              >
                <span>Check Your Medicines</span>
                <ArrowRight className="w-4 h-4" />
              </Link>

              <a
                href="#how-it-works"
                className="font-body text-base font-medium glass-panel text-surface-bright px-8 py-4 rounded-full hover:bg-white/15 transition-all flex items-center justify-center"
              >
                How It Works
              </a>
            </div>

            {/* Quick trust metrics */}
            <div className="grid grid-cols-3 gap-6 sm:gap-12 mt-16 pt-8 border-t border-white/15 text-white/80 w-full max-w-xl">
              <div>
                <div className="font-headline text-2xl sm:text-3xl font-bold text-secondary-fixed">100%</div>
                <div className="text-xs text-tertiary-fixed-dim">OpenFDA Backed</div>
              </div>
              <div>
                <div className="font-headline text-2xl sm:text-3xl font-bold text-secondary-fixed">Pairwise</div>
                <div className="text-xs text-tertiary-fixed-dim">Combinatorial Check</div>
              </div>
              <div>
                <div className="font-headline text-2xl sm:text-3xl font-bold text-secondary-fixed">&lt; 1 sec</div>
                <div className="text-xs text-tertiary-fixed-dim">Cached Response</div>
              </div>
            </div>
          </div>
        </section>

        {/* How It Works Section */}
        <section id="how-it-works" className="py-24 px-4 sm:px-8 md:px-16 bg-[#232F16]">
          <div className="max-w-5xl mx-auto">
            <div className="text-center mb-16">
              <span className="text-xs font-semibold text-secondary-fixed uppercase tracking-wider">
                Transparent 3-Step Process
              </span>
              <h2 className="font-headline text-3xl sm:text-5xl font-bold text-primary-fixed mt-2">
                How MedCheck Works
              </h2>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {/* Step 01 */}
              <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group hover:border-secondary-fixed/40 transition-all">
                <div className="absolute top-4 right-4 font-headline text-3xl font-bold text-secondary-fixed/20 group-hover:text-secondary-fixed/40 transition-colors">
                  01
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary-fixed/15 flex items-center justify-center text-secondary-fixed mb-6">
                  <Pill className="w-6 h-6" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-white mb-2">
                  Add Medicines
                </h3>
                <p className="font-body text-sm text-tertiary-fixed-dim/80 leading-relaxed">
                  Enter generic or brand names into your Medicine Basket. Add multiple prescriptions or supplements seamlessly.
                </p>
              </div>

              {/* Step 02 */}
              <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group hover:border-secondary-fixed/40 transition-all">
                <div className="absolute top-4 right-4 font-headline text-3xl font-bold text-secondary-fixed/20 group-hover:text-secondary-fixed/40 transition-colors">
                  02
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary-fixed/15 flex items-center justify-center text-secondary-fixed mb-6">
                  <Database className="w-6 h-6" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-white mb-2">
                  We Analyze
                </h3>
                <p className="font-body text-sm text-tertiary-fixed-dim/80 leading-relaxed">
                  Our system evaluates all pairwise drug combinations against live OpenFDA labels, warnings, and clinical pharmacology data.
                </p>
              </div>

              {/* Step 03 */}
              <div className="glass-panel p-8 rounded-2xl relative overflow-hidden group hover:border-secondary-fixed/40 transition-all">
                <div className="absolute top-4 right-4 font-headline text-3xl font-bold text-secondary-fixed/20 group-hover:text-secondary-fixed/40 transition-colors">
                  03
                </div>
                <div className="w-12 h-12 rounded-xl bg-secondary-fixed/15 flex items-center justify-center text-secondary-fixed mb-6">
                  <AlertTriangle className="w-6 h-6" />
                </div>
                <h3 className="font-headline text-xl font-semibold text-white mb-2">
                  Understand Risks
                </h3>
                <p className="font-body text-sm text-tertiary-fixed-dim/80 leading-relaxed">
                  Receive clear, color-coded severity breakdowns (High, Moderate, Low) with plain-language explanations.
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Clinical Transparency & Safety Section */}
        <section className="py-20 px-4 sm:px-8 md:px-16 bg-deep-olive">
          <div className="max-w-4xl mx-auto flex flex-col items-center text-center gap-6">
            <ShieldCheck className="w-12 h-12 text-secondary-fixed" />
            <h2 className="font-headline text-3xl sm:text-4xl font-bold text-white">
              Built for Safety, Accuracy, and Transparency
            </h2>
            <p className="font-body text-base text-tertiary-fixed-dim/90 max-w-2xl leading-relaxed">
              MedCheck bridges traditional pharmacological databases with modern AI parsing, transforming complex clinical warning labels into accessible insights you can discuss with your doctor.
            </p>

            <Link
              to="/app"
              className="mt-4 font-body text-base font-semibold bg-secondary-fixed text-deep-olive px-8 py-4 rounded-full shadow-button-glow hover:bg-secondary-fixed-dim transition-all inline-flex items-center gap-2"
            >
              <span>Launch Medicine Basket</span>
              <ArrowRight className="w-4 h-4" />
            </Link>

            <div className="mt-8 w-full">
              <Disclaimer />
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  );
}
