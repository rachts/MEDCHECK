import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMedicine } from '../context/MedicineContext';
import {
  ShieldCrossIcon,
  BookIcon,
  SearchIcon,
  MessageIcon,
  DocumentIcon,
  UserIcon,
  ChevronDownIcon,
  MenuIcon,
  CloseIcon,
} from '../pages/landing-icons';

export function Navbar() {
  const location = useLocation();
  const {
    demoPresets,
    loadPreset,
    setDoctorReportOpen,
    results
  } = useMedicine();

  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const presetsRef = useRef(null);

  const isActive = (path) => location.pathname === path;

  // Gate the Doctor Report trigger if no analysis has been run yet
  const canOpenDoctorReport = Boolean(results);
  const doctorReportHint = canOpenDoctorReport
    ? 'Export a clinical summary of this analysis'
    : 'Run an analysis first to generate a report';

  // Click outside to close preset dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (presetsRef.current && !presetsRef.current.contains(e.target)) {
        setShowPresetsMenu(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Close overlays whenever the route changes
  useEffect(() => {
    setMobileMenuOpen(false);
    setShowPresetsMenu(false);
  }, [location.pathname]);

  return (
    <header className="fixed top-0 left-0 right-0 w-full z-40 flex justify-between items-center px-4 sm:px-8 md:px-12 h-20 bg-[#f8f6f0] border-b border-[#b7b09d] rounded-none shadow-none">
      {/* Editorial Brand Mark */}
      <Link
        to="/"
        className="flex items-center gap-2.5 text-[#1a1a18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
      >
        <span
          className="w-8 h-8 border border-[#1a1a18] bg-[#f0ede1] text-[#1a1a18] flex items-center justify-center shrink-0"
          aria-hidden="true"
        >
          <ShieldCrossIcon size={18} />
        </span>
        <div className="flex items-center gap-2">
          <span className="font-newsreader text-[22px] font-semibold tracking-[0.02em] text-[#1a1a18] leading-none">
            MEDCHECK
          </span>
          <span className="font-ibm-mono text-[10px] font-medium uppercase tracking-[0.08em] py-0.5 px-1.5 border border-[#b7b09d] bg-[#f0ede1] text-[#57534a]">
            PRO
          </span>
        </div>
      </Link>

      {/* Center Nav Links (Desktop & Tablet) */}
      <nav aria-label="Primary" className="hidden md:flex items-center gap-1.5 lg:gap-2.5">
        <Link
          to="/"
          aria-current={isActive('/') ? 'page' : undefined}
          className={`px-2.5 lg:px-3 py-1.5 font-ibm-mono text-[11px] uppercase tracking-[0.08em] font-medium transition-colors min-h-[36px] flex items-center border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2 ${
            isActive('/')
              ? 'bg-[#ece7d5] text-[#1a1a18] border-[#1a1a18]'
              : 'border-transparent text-[#2d2b26] hover:text-[#1a1a18] hover:border-[#b7b09d] hover:bg-[#f0ede1]'
          }`}
        >
          Home
        </Link>

        <Link
          to="/app"
          aria-current={isActive('/app') ? 'page' : undefined}
          className={`px-2.5 lg:px-3.5 py-1.5 font-ibm-mono text-[11px] uppercase tracking-[0.08em] font-medium transition-colors min-h-[36px] flex items-center border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2 ${
            isActive('/app')
              ? 'bg-[#1a1a18] text-[#f8f6f0] border-[#1a1a18]'
              : 'border-[#b7b09d] bg-[#f8f6f0] text-[#1a1a18] hover:bg-[#f0ede1] hover:border-[#1a1a18]'
          }`}
        >
          Safety Dashboard
        </Link>

        <Link
          to="/explorer"
          aria-current={isActive('/explorer') ? 'page' : undefined}
          className={`px-2.5 lg:px-3 py-1.5 font-ibm-mono text-[11px] uppercase tracking-[0.08em] font-medium transition-colors flex items-center gap-1.5 min-h-[36px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2 ${
            isActive('/explorer')
              ? 'bg-[#1a1a18] text-[#f8f6f0] border-[#1a1a18]'
              : 'border-transparent text-[#2d2b26] hover:text-[#1a1a18] hover:border-[#b7b09d] hover:bg-[#f0ede1]'
          }`}
        >
          <SearchIcon size={14} />
          <span>Drug Explorer</span>
        </Link>

        <Link
          to="/assistant"
          aria-current={isActive('/assistant') ? 'page' : undefined}
          className={`px-2.5 lg:px-3 py-1.5 font-ibm-mono text-[11px] uppercase tracking-[0.08em] font-medium transition-colors flex items-center gap-1.5 min-h-[36px] border focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2 ${
            isActive('/assistant')
              ? 'bg-[#1a1a18] text-[#f8f6f0] border-[#1a1a18]'
              : 'border-transparent text-[#2d2b26] hover:text-[#1a1a18] hover:border-[#b7b09d] hover:bg-[#f0ede1]'
          }`}
        >
          <MessageIcon size={14} />
          <span>Assistant</span>
        </Link>

        {/* Doctor's Report Trigger */}
        <button
          type="button"
          onClick={() => setDoctorReportOpen(true)}
          disabled={!canOpenDoctorReport}
          title={doctorReportHint}
          aria-label={doctorReportHint}
          className="flex items-center gap-1.5 px-3 py-1.5 font-ibm-mono text-[11px] uppercase tracking-[0.08em] font-medium text-[#1a1a18] bg-[#f8f6f0] hover:bg-[#f0ede1] border border-[#b7b09d] hover:border-[#1a1a18] transition-colors cursor-pointer min-h-[36px] disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:bg-[#f8f6f0] disabled:hover:border-[#b7b09d] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
        >
          <DocumentIcon size={14} />
          <span>Doctor Report</span>
        </button>

        {/* Clinical Scenario Quick-Launcher */}
        <div className="relative" ref={presetsRef}>
          <button
            type="button"
            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
            aria-expanded={showPresetsMenu}
            aria-haspopup="menu"
            aria-controls="navbar-scenarios-menu"
            className="flex items-center gap-1.5 px-3 py-1.5 font-ibm-mono text-[11px] uppercase tracking-[0.08em] font-medium bg-[#f0ede1] hover:bg-[#ece7d5] text-[#1a1a18] border border-[#b7b09d] hover:border-[#1a1a18] transition-colors cursor-pointer min-h-[36px] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
          >
            <BookIcon size={14} className="text-[#8b2500]" />
            <span>Scenarios</span>
            <ChevronDownIcon size={13} className="text-[#57534a]" />
          </button>

          {showPresetsMenu && (
            <div
              id="navbar-scenarios-menu"
              role="menu"
              aria-label="Preloaded clinical cases"
              className="absolute right-0 top-full mt-1.5 w-80 bg-[#f8f6f0] border border-[#1a1a18] border-t-[3px] border-t-[#1a1a18] z-50 flex flex-col rounded-none shadow-none"
            >
              <div className="px-3 py-2 bg-[#ece7d5] font-ibm-mono text-[11px] font-medium text-[#1a1a18] uppercase tracking-[0.08em] border-b border-[#b7b09d]">
                Preloaded Clinical Cases
              </div>
              {demoPresets.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    loadPreset(preset);
                    setShowPresetsMenu(false);
                  }}
                  className="text-left p-3 border-b border-[#d5cfc0] last:border-b-0 hover:bg-[#f0ede1] transition-colors flex flex-col gap-1 cursor-pointer group focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-[-2px]"
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className="font-newsreader text-[15px] font-semibold text-[#1a1a18] group-hover:text-[#8b2500] leading-snug">
                      {preset.name}
                    </span>
                    <span className="shrink-0 font-ibm-mono text-[10px] uppercase tracking-[0.06em] px-1.5 py-0.5 border border-[#b7b09d] bg-[#f0ede1] text-[#2d2b26]">
                      {preset.badge}
                    </span>
                  </div>
                  <span className="font-ibm-serif text-xs text-[#57534a] line-clamp-2 leading-relaxed">
                    {preset.description.replace(/\s*\u2014\s*/g, '; ')}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* User Account / Profile */}
        <Link
          to="/auth"
          aria-label="Account Settings"
          className="w-9 h-9 bg-[#f0ede1] hover:bg-[#ece7d5] border border-[#b7b09d] hover:border-[#1a1a18] flex items-center justify-center text-[#2d2b26] hover:text-[#1a1a18] transition-colors ml-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
        >
          <UserIcon size={16} />
        </Link>
      </nav>

      {/* Mobile Actions (< md) */}
      <div className="flex md:hidden items-center gap-1.5">
        <button
          type="button"
          onClick={() => setDoctorReportOpen(true)}
          disabled={!canOpenDoctorReport}
          aria-label={doctorReportHint}
          title={doctorReportHint}
          className="w-9 h-9 bg-[#f0ede1] border border-[#b7b09d] flex items-center justify-center text-[#1a1a18] disabled:opacity-45 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
        >
          <DocumentIcon size={16} />
        </button>

        <button
          type="button"
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
          aria-expanded={mobileMenuOpen}
          aria-controls="navbar-mobile-menu"
          className="w-9 h-9 bg-[#f0ede1] border border-[#1a1a18] flex items-center justify-center text-[#1a1a18] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[#8b2500] focus-visible:outline-offset-2"
        >
          {mobileMenuOpen ? <CloseIcon size={16} /> : <MenuIcon size={16} />}
        </button>
      </div>

      {/* Mobile Slide-down Drawer */}
      {mobileMenuOpen && (
        <nav
          id="navbar-mobile-menu"
          aria-label="Primary (mobile)"
          className="md:hidden absolute top-20 left-0 right-0 bg-[#f8f6f0] border-b border-[#1a1a18] p-4 z-50 flex flex-col gap-2 rounded-none shadow-none"
        >
          <Link
            to="/"
            aria-current={isActive('/') ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`p-3 border font-ibm-mono text-xs uppercase tracking-[0.08em] font-medium ${
              isActive('/')
                ? 'bg-[#ece7d5] border-[#1a1a18] text-[#1a1a18]'
                : 'bg-[#f0ede1] border-[#d5cfc0] text-[#1a1a18]'
            }`}
          >
            Home
          </Link>
          <Link
            to="/app"
            aria-current={isActive('/app') ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`p-3 border font-ibm-mono text-xs uppercase tracking-[0.08em] font-medium ${
              isActive('/app')
                ? 'bg-[#1a1a18] border-[#1a1a18] text-[#f8f6f0]'
                : 'bg-[#f0ede1] border-[#d5cfc0] text-[#1a1a18]'
            }`}
          >
            Safety Dashboard
          </Link>
          <Link
            to="/explorer"
            aria-current={isActive('/explorer') ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`p-3 border font-ibm-mono text-xs uppercase tracking-[0.08em] font-medium flex items-center gap-2 ${
              isActive('/explorer')
                ? 'bg-[#1a1a18] border-[#1a1a18] text-[#f8f6f0]'
                : 'bg-[#f0ede1] border-[#d5cfc0] text-[#1a1a18]'
            }`}
          >
            <SearchIcon size={15} />
            <span>Drug Explorer</span>
          </Link>
          <Link
            to="/assistant"
            aria-current={isActive('/assistant') ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`p-3 border font-ibm-mono text-xs uppercase tracking-[0.08em] font-medium flex items-center gap-2 ${
              isActive('/assistant')
                ? 'bg-[#1a1a18] border-[#1a1a18] text-[#f8f6f0]'
                : 'bg-[#f0ede1] border-[#d5cfc0] text-[#1a1a18]'
            }`}
          >
            <MessageIcon size={15} />
            <span>Assistant</span>
          </Link>
          <Link
            to="/auth"
            aria-current={isActive('/auth') ? 'page' : undefined}
            onClick={() => setMobileMenuOpen(false)}
            className={`p-3 border font-ibm-mono text-xs uppercase tracking-[0.08em] font-medium flex items-center gap-2 ${
              isActive('/auth')
                ? 'bg-[#1a1a18] border-[#1a1a18] text-[#f8f6f0]'
                : 'bg-[#f0ede1] border-[#d5cfc0] text-[#1a1a18]'
            }`}
          >
            <UserIcon size={15} />
            <span>Account Profile</span>
          </Link>
        </nav>
      )}
    </header>
  );
}
export default Navbar;
