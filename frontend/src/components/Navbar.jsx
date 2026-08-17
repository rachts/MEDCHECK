import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMedicine } from '../context/MedicineContext';
import { Sparkles, ShieldCheck, User } from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const { isDemoMode, toggleDemoMode } = useMedicine();

  const isActive = (path) => location.pathname === path;

  return (
    <header className="fixed top-0 w-full z-50 flex justify-between items-center px-4 sm:px-8 md:px-16 h-20 bg-glass-fill backdrop-blur-xl border-b border-glass-border shadow-sm">
      <Link to="/" className="flex items-center gap-3 group">
        <div className="w-10 h-10 rounded-full bg-secondary-fixed text-deep-olive flex items-center justify-center font-bold text-xl shadow-inner-glow group-hover:scale-105 transition-transform">
          <ShieldCheck className="w-5 h-5 text-deep-olive" />
        </div>
        <span className="font-headline text-2xl sm:text-3xl font-bold tracking-tight text-primary-fixed">
          MedCheck
        </span>
      </Link>

      <nav className="flex items-center gap-2 sm:gap-4">
        <Link
          to="/"
          className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            isActive('/')
              ? 'bg-white/15 text-secondary-fixed border border-white/20'
              : 'text-surface-bright/80 hover:text-surface-bright hover:bg-white/10'
          }`}
        >
          Home
        </Link>

        <Link
          to="/app"
          className={`px-3 sm:px-4 py-2 rounded-full text-sm font-medium transition-colors ${
            isActive('/app')
              ? 'bg-secondary-fixed text-deep-olive font-semibold shadow-inner-glow'
              : 'text-surface-bright/80 hover:text-surface-bright hover:bg-white/10'
          }`}
        >
          Safety Checker
        </Link>

        {/* Demo Mode Badge / Toggle */}
        <button
          onClick={toggleDemoMode}
          aria-label="Toggle Demo Mode"
          className={`hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold uppercase tracking-wider transition-all border ${
            isDemoMode
              ? 'bg-secondary-fixed/25 text-secondary-fixed border-secondary-fixed shadow-[0_0_12px_rgba(196,217,107,0.3)]'
              : 'bg-white/5 text-white/60 border-white/15 hover:bg-white/10 hover:text-white'
          }`}
        >
          <Sparkles className="w-3.5 h-3.5" />
          {isDemoMode ? 'Demo Active' : 'Demo Mode'}
        </button>

        <Link
          to="/auth"
          className={`p-2 rounded-full text-primary-fixed hover:bg-white/10 transition-colors ${
            isActive('/auth') ? 'bg-white/15' : ''
          }`}
          aria-label="Account / Sign In"
        >
          <User className="w-5 h-5 text-tertiary-fixed" />
        </Link>
      </nav>
    </header>
  );
}
