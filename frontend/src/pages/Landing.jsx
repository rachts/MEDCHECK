import React from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { useMedicine } from '../context/MedicineContext';
import { 
  ShieldCheck, 
  Sparkles, 
  ArrowRight, 
  Search, 
  Activity, 
  Flame, 
  Lock,
  AlertTriangle
} from 'lucide-react';

export function Landing() {
  const { loadPreset, demoPresets } = useMedicine();
  const navigate = useNavigate();

  const handleLaunchNarrativeDemo = () => {
    const preset = demoPresets.find(p => p.id === 'sarah-demo') || demoPresets[0];
    loadPreset(preset);
    navigate('/app');
  };

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Navbar />

      {/* HERO SECTION: Editorial Authority with Cormorant Garamond */}
      <section className="pt-24 sm:pt-28 pb-12 px-4 sm:px-8 max-w-5xl mx-auto flex flex-col items-center text-center">
        {/* Stat Pill Badge */}
        <div className="badge badge-high mb-4 px-3.5 py-1.5 bg-[var(--alert-danger-bg)] border border-[var(--alert-danger-border)] text-[var(--alert-danger-text)] rounded-full flex items-center gap-2 shadow-sm">
          <AlertTriangle className="w-3.5 h-3.5 text-[var(--severity-high)]" />
          <span className="font-semibold text-xs sm:text-sm">1.3 Million Preventable Hospitalizations Annually</span>
        </div>

        {/* Serif Headline (Cormorant Garamond) */}
        <h1 className="text-display max-w-3xl text-[var(--text-primary)] mb-5 font-serif font-bold tracking-tight">
          Know Your Medicine.{' '}
          <span className="italic font-normal underline decoration-[var(--border-hover)]">
            Protect Your Body.
          </span>
        </h1>

        {/* Subtitle with strong, unambiguous contrast and comfortable reading line-height */}
        <p className="landing-subtitle max-w-2xl text-base sm:text-lg md:text-xl font-normal leading-relaxed mb-8">
          A clinical intelligence platform analyzing drug-drug interactions, side effect amplification, food & alcohol administration schedules, and the proprietary <strong className="text-[var(--text-primary)] font-bold font-serif text-[18px] sm:text-[20px]">Stomach Guardian™</strong> mucosal stress score.
        </p>

        {/* CTA Button Group */}
        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center max-w-md mb-12">
          <Link
            to="/app"
            className="btn-primary w-full sm:w-auto px-7 py-3 text-sm sm:text-base font-bold shadow-sm"
          >
            <span>Analyze My Medicines</span>
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            to="/explorer"
            className="btn-secondary w-full sm:w-auto px-6 py-3 text-sm sm:text-base font-semibold"
          >
            <Search className="w-4 h-4 text-[var(--text-muted)]" />
            <span>Search a Drug First</span>
          </Link>
        </div>

        {/* Trust Bar */}
        <div className="w-full grid grid-cols-2 md:grid-cols-4 gap-3 border-y border-[var(--border-default)] py-4 text-left">
          <div className="flex items-center gap-2.5 p-3 bg-[var(--bg-surface)] rounded-[8px] border border-[var(--border-default)] shadow-sm">
            <div className="w-7 h-7 rounded-[4px] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
              <ShieldCheck className="w-4 h-4" />
            </div>
            <div>
              <div className="font-serif text-[15px] font-bold text-[var(--text-primary)] leading-tight">OpenFDA Verified</div>
              <div className="text-xs text-[var(--text-muted)] font-sans">Official FDA labels</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 bg-[var(--bg-surface)] rounded-[8px] border border-[var(--border-default)] shadow-sm">
            <div className="w-7 h-7 rounded-[4px] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
              <Activity className="w-4 h-4" />
            </div>
            <div>
              <div className="font-serif text-[15px] font-bold text-[var(--text-primary)] leading-tight">Live FDA Lookup</div>
              <div className="text-xs text-[var(--text-muted)] font-sans">Curated core + OpenFDA labels</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 bg-[var(--bg-surface)] rounded-[8px] border border-[var(--border-default)] shadow-sm">
            <div className="w-7 h-7 rounded-[4px] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--severity-moderate)] shrink-0">
              <Flame className="w-4 h-4" />
            </div>
            <div>
              <div className="font-serif text-[15px] font-bold text-[var(--text-primary)] leading-tight">Stomach Guardian</div>
              <div className="text-xs text-[var(--text-muted)] font-sans">Mucosal risk scoring</div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 p-3 bg-[var(--bg-surface)] rounded-[8px] border border-[var(--border-default)] shadow-sm">
            <div className="w-7 h-7 rounded-[4px] bg-[var(--bg-elevated)] flex items-center justify-center text-[var(--severity-low)] shrink-0">
              <Lock className="w-4 h-4" />
            </div>
            <div>
              <div className="font-serif text-[15px] font-bold text-[var(--text-primary)] leading-tight">No Signup Required</div>
              <div className="text-xs text-[var(--text-muted)] font-sans">Anonymous guest sessions</div>
            </div>
          </div>
        </div>
      </section>

      {/* 3 CORE PILLARS: Clinical Authority Cards */}
      <section className="py-10 px-4 sm:px-8 max-w-5xl mx-auto w-full">
        <div className="text-center mb-8">
          <h2 className="text-h1 text-[var(--text-primary)] mb-2">
            Comprehensive Clinical Intelligence
          </h2>
          <p className="text-body text-[var(--text-secondary)] max-w-lg mx-auto">
            Clear, actionable medicine safety designed for patient understanding and clinical scrutiny.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Pillar 1 */}
          <div className="card flex flex-col gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)] flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-[20px] font-bold text-[var(--text-primary)]">
              Interaction Topology Matrix
            </h3>
            <p className="text-body text-[var(--text-secondary)] leading-relaxed">
              Interactive node network graph connects your medications, surfacing pharmacokinetic conflicts and clinical severity hierarchies.
            </p>
          </div>

          {/* Pillar 2 */}
          <div className="card flex flex-col gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[var(--alert-danger-bg)] text-[var(--severity-high)] border border-[var(--alert-danger-border)] flex items-center justify-center">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-[20px] font-bold text-[var(--text-primary)]">
              Side Effect Amplification
            </h3>
            <p className="text-body text-[var(--text-secondary)] leading-relaxed">
              Categorizes side effects by true clinical frequency (&gt;10%, 1-10%, &lt;0.1%) and flags when multiple drugs compound the exact same adverse risk.
            </p>
          </div>

          {/* Pillar 3 */}
          <div className="card flex flex-col gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[var(--alert-success-bg)] text-[var(--severity-low)] border border-[var(--alert-success-border)] flex items-center justify-center">
              <Flame className="w-5 h-5" />
            </div>
            <h3 className="font-serif text-[20px] font-bold text-[var(--text-primary)]">
              Food & Stomach Guardian™
            </h3>
            <p className="text-body text-[var(--text-secondary)] leading-relaxed">
              GI upset is the #1 reason patients discontinue medications. Stomach Guardian rates ulcer load and builds an actionable 24-hour meal schedule.
            </p>
          </div>
        </div>
      </section>

      {/* NARRATIVE DEMO MODE SHOWCASE: Mrs. Sharma Scenario */}
      <section className="py-8 px-4 sm:px-8 max-w-5xl mx-auto w-full mb-6">
        <div 
          style={{ borderLeftColor: 'var(--severity-high)', borderLeftWidth: '4px' }}
          className="card flex flex-col md:flex-row items-center justify-between gap-6"
        >
          <div className="flex-1 space-y-2.5 text-left">
            <div className="badge badge-info">
              <Sparkles className="w-3.5 h-3.5" />
              <span>Interactive Narrative Demo</span>
            </div>

            <h3 className="font-serif text-[26px] font-bold text-[var(--text-primary)] tracking-tight">
              The "Mrs. Sharma" Clinical Case
            </h3>

            <p className="text-body text-[var(--text-secondary)] leading-relaxed">
              Mrs. Sharma takes <strong>Warfarin</strong> for her heart, <strong>Aspirin</strong> as an antiplatelet, and was recommended <strong>Ibuprofen</strong> for knee pain. Let's see what MEDCHECK finds.
            </p>

            <div className="flex flex-wrap gap-1.5 pt-1">
              <span className="tag font-serif text-[13px] font-bold">Warfarin (Rx)</span>
              <span className="tag font-serif text-[13px] font-bold">Aspirin (OTC)</span>
              <span className="tag font-serif text-[13px] font-bold">Ibuprofen (OTC)</span>
            </div>

            <p className="text-xs text-[var(--severity-high)] font-semibold font-sans pt-0.5">
              Result: Critical Bleeding Synergy + 100/100 High Stomach Guardian Risk.
            </p>
          </div>

          <div className="shrink-0 flex flex-col items-center gap-2">
            <button
              onClick={handleLaunchNarrativeDemo}
              className="btn-primary w-full sm:w-auto"
            >
              Run Mrs. Sharma Scenario →
            </button>
            <span className="text-xs text-[var(--text-muted)] font-sans">Instant one-click demo</span>
          </div>
        </div>
      </section>

      {/* Disclaimer */}
      <div className="px-4 py-4 flex justify-center">
        <Disclaimer />
      </div>

      <Footer />
    </div>
  );
}
