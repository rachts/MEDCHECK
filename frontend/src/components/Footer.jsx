import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCheck } from 'lucide-react';

export function Footer() {
  return (
    <footer className="w-full mt-auto py-6 px-4 sm:px-8 md:px-12 flex flex-col md:flex-row justify-between items-center gap-3 bg-[var(--bg-surface)] border-t border-[var(--border-default)] text-xs text-[var(--text-muted)]">
      <div className="flex items-center gap-2">
        <div className="w-5 h-5 rounded-[4px] bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center font-bold">
          <ShieldCheck className="w-3 h-3" />
        </div>
        <span className="font-semibold text-[var(--text-primary)]">MEDCHECK</span>
        <span className="tag font-bold">
          v2.0
        </span>
      </div>

      <div className="text-center max-w-lg leading-relaxed text-[var(--text-muted)]">
        © {new Date().getFullYear()} MEDCHECK. Powered by OpenFDA Clinical Databases & Pharmacological Rules.
      </div>

      <div className="flex gap-3 text-[var(--text-secondary)] font-medium">
        <Link to="/app" className="hover:text-[var(--text-primary)] transition-colors">
          Dashboard
        </Link>
        <Link to="/explorer" className="hover:text-[var(--text-primary)] transition-colors">
          Explorer
        </Link>
        <Link to="/auth" className="hover:text-[var(--text-primary)] transition-colors">
          Account
        </Link>
      </div>
    </footer>
  );
}
