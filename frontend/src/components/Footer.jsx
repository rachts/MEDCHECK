import React from 'react';
import { Link } from 'react-router-dom';
import { ShieldCrossIcon } from '../pages/landing-icons';

export function Footer() {
  return (
    <footer className="w-full mt-auto py-10 px-4 sm:px-8 md:px-12 bg-[#f0ede1] text-[#2d2b26] border-t border-[#b7b09d] rounded-none shadow-none">
      <div className="max-w-[1400px] mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
        {/* Brand with Newsreader wordmark */}
        <div className="flex items-center gap-2.5">
          <span
            className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0"
            aria-hidden="true"
          >
            <ShieldCrossIcon size={15} />
          </span>
          <span className="font-newsreader text-[20px] font-semibold text-[#1a1a18] tracking-[0.02em] leading-none">
            MEDCHECK
          </span>
          <span className="font-ibm-mono text-[10px] font-medium uppercase tracking-[0.08em] py-0.5 px-1.5 bg-[#f8f6f0] text-[#57534a] border border-[#b7b09d]">
            v2.0
          </span>
        </div>

        {/* Center Clinical Copy */}
        <div className="text-center max-w-lg text-xs leading-relaxed text-[#57534a] font-ibm-serif">
          © {new Date().getFullYear()} MEDCHECK. Built on OpenFDA drug label data &amp; curated pharmacological rules.
          <p className="mt-1 font-ibm-serif italic text-[#57534a] text-xs">
            Evidence-cited clinical safety intelligence.
          </p>
        </div>

        {/* Navigation Links */}
        <div className="flex gap-5 font-ibm-mono text-[11px] font-medium uppercase tracking-[0.08em] text-[#1a1a18]">
          <Link
            to="/app"
            className="hover:text-[#8b2500] hover:underline underline-offset-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
          >
            Dashboard
          </Link>
          <Link
            to="/explorer"
            className="hover:text-[#8b2500] hover:underline underline-offset-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
          >
            Explorer
          </Link>
          <Link
            to="/auth"
            className="hover:text-[#8b2500] hover:underline underline-offset-4 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
          >
            Account
          </Link>
        </div>
      </div>
    </footer>
  );
}
export default Footer;
