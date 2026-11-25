import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import {
  CompassIcon,
  HomeIcon,
  PulseIcon,
  SearchIcon,
} from './landing-icons';
import './app-editorial.css';

/**
 * Catch-all route.
 */
export function NotFound() {
  const location = useLocation();

  return (
    <div className="ed-app min-h-screen flex flex-col bg-[#f8f6f0] text-[#1a1a18]">
      <Navbar />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-8 max-w-3xl mx-auto w-full flex flex-col items-center text-center justify-center font-ibm-serif">
        <div className="w-12 h-12 bg-[#f0ede1] border border-[#1a1a18] text-[#8b2500] flex items-center justify-center mb-5">
          <CompassIcon size={22} />
        </div>

        <p className="font-ibm-mono text-xs uppercase tracking-[0.14em] text-[#8b2500] font-semibold mb-2">
          404
        </p>

        <h1 className="font-newsreader text-[36px] sm:text-[44px] font-medium tracking-[-0.015em] text-[#1a1a18] mb-3 leading-[1.1]">
          This page doesn&apos;t exist
        </h1>

        <p className="font-ibm-serif text-[15px] text-[#2d2b26] leading-relaxed mb-4 max-w-md">
          No MEDCHECK page is registered at this address. It may have been mistyped,
          or the link you followed may be out of date.
        </p>

        <p className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] mb-8 break-all flex items-center justify-center gap-2 flex-wrap">
          <span>Requested:</span>
          <code className="font-ibm-mono text-xs normal-case tracking-[0.02em] bg-[#f0ede1] border border-[#b7b09d] px-2.5 py-0.5 text-[#1a1a18]">
            {location.pathname}
          </code>
        </p>

        <div className="flex flex-col sm:flex-row items-center gap-3 w-full justify-center">
          <Link
            to="/"
            className="ed-btn-ink w-full sm:w-auto px-6 py-3 min-h-[44px] whitespace-nowrap"
          >
            <HomeIcon size={15} />
            <span>Back to Home</span>
          </Link>

          <Link
            to="/app"
            className="ed-btn-outline w-full sm:w-auto px-5 py-3 min-h-[44px] whitespace-nowrap"
          >
            <PulseIcon size={15} />
            <span>Analyze Medicines</span>
          </Link>

          <Link
            to="/explorer"
            className="ed-btn-outline w-full sm:w-auto px-5 py-3 min-h-[44px] whitespace-nowrap"
          >
            <SearchIcon size={15} />
            <span>Drug Explorer</span>
          </Link>
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default NotFound;
