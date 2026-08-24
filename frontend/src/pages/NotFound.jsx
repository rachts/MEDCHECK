import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Compass, Home, Search, Activity } from 'lucide-react';

/**
 * Catch-all route.
 *
 * Replaces `<Route path="*" element={<Navigate to="/" replace />} />`, which
 * bounced every unknown URL to the landing page with no explanation. That is
 * indistinguishable from the app being broken: a mistyped or stale deep link
 * (/App, /explore, an old bookmark) silently dropped the user on the marketing
 * page, and `replace` also erased the bad URL from history so they could not see
 * what had gone wrong or correct it.
 */
export function NotFound() {
  const location = useLocation();

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-16 px-4 sm:px-8 max-w-2xl mx-auto w-full flex flex-col items-center text-center justify-center">
        <div className="w-12 h-12 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-primary)] flex items-center justify-center mb-5">
          <Compass className="w-6 h-6" aria-hidden="true" />
        </div>

        <p className="metric text-sm text-[var(--text-muted)] mb-2">404</p>

        <h1 className="font-serif text-[32px] sm:text-[40px] font-bold tracking-tight text-[var(--text-primary)] mb-3 leading-tight">
          This page doesn't exist
        </h1>

        <p className="text-body text-[var(--text-secondary)] leading-relaxed mb-2 max-w-md">
          No MEDCHECK page is registered at this address. It may have been mistyped,
          or the link you followed may be out of date.
        </p>

        {/* Echoing the attempted path makes a typo self-evident. React escapes it,
            so a crafted path renders as inert text rather than markup. */}
        <p className="text-xs text-[var(--text-muted)] font-sans mb-8 break-all">
          Requested: <code className="metric">{location.pathname}</code>
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center max-w-md">
          <Link to="/" className="btn-primary w-full sm:w-auto px-6 py-3 text-sm font-bold">
            <Home className="w-4 h-4" aria-hidden="true" />
            <span>Back to Home</span>
          </Link>

          <Link to="/app" className="btn-secondary w-full sm:w-auto px-6 py-3 text-sm font-semibold">
            <Activity className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
            <span>Analyze Medicines</span>
          </Link>

          <Link to="/explorer" className="btn-secondary w-full sm:w-auto px-6 py-3 text-sm font-semibold">
            <Search className="w-4 h-4 text-[var(--text-muted)]" aria-hidden="true" />
            <span>Drug Explorer</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default NotFound;
