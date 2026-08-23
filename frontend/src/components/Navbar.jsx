import React, { useState, useRef, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { useMedicine } from '../context/MedicineContext';
import { 
  ShieldCheck, 
  Sparkles, 
  Search, 
  FileText, 
  User, 
  ChevronDown,
  Menu,
  X
} from 'lucide-react';

export function Navbar() {
  const location = useLocation();
  const { 
    demoPresets, 
    loadPreset,
    setDoctorReportOpen
  } = useMedicine();

  const [showPresetsMenu, setShowPresetsMenu] = useState(false);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const presetsRef = useRef(null);

  const isActive = (path) => location.pathname === path;

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

  return (
    <header className="fixed top-0 w-full z-40 flex justify-between items-center px-4 sm:px-8 md:px-12 h-14 bg-[var(--bg-surface)] border-b border-[var(--border-default)]">
      {/* Brand Logo */}
      <Link to="/" className="flex items-center gap-2 group">
        <div className="w-7 h-7 rounded-[4px] bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center font-bold">
          <ShieldCheck className="w-4 h-4" />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="font-serif text-[20px] font-bold tracking-tight text-[var(--text-primary)]">
            MEDCHECK
          </span>
          <span className="tag font-bold text-[9px] py-0 px-1">
            PRO
          </span>
        </div>
      </Link>

      {/* Center Nav Links (Desktop & Tablet) */}
      <nav className="hidden md:flex items-center gap-1.5 sm:gap-2">
        <Link
          to="/"
          className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors min-h-[36px] flex items-center ${
            isActive('/')
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          Home
        </Link>

        <Link
          to="/app"
          className={`px-3.5 py-1.5 rounded-[6px] text-xs font-bold transition-colors min-h-[36px] flex items-center ${
            isActive('/app')
              ? 'bg-[var(--accent)] text-[var(--text-inverse)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          Safety Dashboard
        </Link>

        <Link
          to="/explorer"
          className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold transition-colors flex items-center gap-1.5 min-h-[36px] ${
            isActive('/explorer')
              ? 'bg-[var(--bg-elevated)] text-[var(--text-primary)] border border-[var(--border-default)]'
              : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)]'
          }`}
        >
          <Search className="w-3.5 h-3.5" />
          <span>Drug Explorer</span>
        </Link>

        {/* Doctor's Report Trigger */}
        <button
          onClick={() => setDoctorReportOpen(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-medium text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--bg-elevated)] border border-[var(--border-default)] transition-colors cursor-pointer min-h-[36px]"
        >
          <FileText className="w-3.5 h-3.5 text-[var(--text-primary)]" />
          <span>Doctor Report</span>
        </button>

        {/* Clinical Scenario Quick-Launcher */}
        <div className="relative" ref={presetsRef}>
          <button
            onClick={() => setShowPresetsMenu(!showPresetsMenu)}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-[6px] text-xs font-semibold bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] text-[var(--text-primary)] border border-[var(--border-default)] transition-colors cursor-pointer min-h-[36px]"
          >
            <Sparkles className="w-3.5 h-3.5 text-[var(--text-primary)]" />
            <span>Scenarios</span>
            <ChevronDown className="w-3 h-3 text-[var(--text-muted)]" />
          </button>

          {showPresetsMenu && (
            <div className="absolute right-0 top-full mt-1.5 w-72 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-1 shadow-lg z-50 flex flex-col gap-1">
              <div className="px-2.5 py-1 text-xs font-bold text-[var(--text-primary)] uppercase tracking-wider border-b border-[var(--border-default)]">
                Preloaded Clinical Cases
              </div>
              {demoPresets.map((preset) => (
                <button
                  key={preset.id}
                  onClick={() => {
                    loadPreset(preset);
                    setShowPresetsMenu(false);
                  }}
                  className="text-left p-2 rounded-[4px] hover:bg-[var(--bg-elevated)] transition-colors flex flex-col gap-0.5 cursor-pointer group"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-serif text-[15px] font-bold text-[var(--text-primary)] group-hover:underline">
                      {preset.name}
                    </span>
                    <span className="tag">
                      {preset.badge}
                    </span>
                  </div>
                  <span className="text-xs text-[var(--text-muted)] line-clamp-1">
                    {preset.description}
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
          className="w-8 h-8 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors ml-1"
        >
          <User className="w-4 h-4" />
        </Link>
      </nav>

      {/* Mobile Actions (< md) */}
      <div className="flex md:hidden items-center gap-1.5">
        <button
          onClick={() => setDoctorReportOpen(true)}
          aria-label="Doctor Report"
          className="w-8 h-8 rounded-[4px] bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)]"
        >
          <FileText className="w-4 h-4" />
        </button>

        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label="Toggle Navigation Menu"
          className="w-8 h-8 rounded-[4px] bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-primary)]"
        >
          {mobileMenuOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
        </button>
      </div>

      {/* Mobile Slide-down Drawer */}
      {mobileMenuOpen && (
        <div className="md:hidden absolute top-14 left-0 right-0 bg-[var(--bg-surface)] border-b border-[var(--border-default)] p-4 shadow-xl z-50 flex flex-col gap-2">
          <Link
            to="/"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 rounded-[6px] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-primary)]"
          >
            Home
          </Link>
          <Link
            to="/app"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 rounded-[6px] bg-[var(--accent)] text-white text-sm font-bold"
          >
            Safety Dashboard
          </Link>
          <Link
            to="/explorer"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 rounded-[6px] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"
          >
            <Search className="w-4 h-4" />
            <span>Drug Explorer</span>
          </Link>
          <Link
            to="/auth"
            onClick={() => setMobileMenuOpen(false)}
            className="p-3 rounded-[6px] bg-[var(--bg-elevated)] text-sm font-semibold text-[var(--text-primary)] flex items-center gap-2"
          >
            <User className="w-4 h-4" />
            <span>Account Profile</span>
          </Link>
        </div>
      )}
    </header>
  );
}
