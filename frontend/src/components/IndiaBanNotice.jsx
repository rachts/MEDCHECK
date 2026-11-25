import React from 'react';
import { WarningIcon } from '../pages/landing-icons';

/**
 * Full-border editorial critical notice for CDSCO / Government of India
 * banned or halted medicine entries.
 */
export function IndiaBanNotice({ info, className = '' }) {
  if (!info?.matched) return null;

  return (
    <div
      className={`border border-[#8b2500] bg-[#f3e9e4] p-4 space-y-1.5 font-ibm-serif ${className}`}
      style={{ borderRadius: 0, boxShadow: 'none' }}
      role="alert"
      aria-label={`India regulatory notice: ${info.heading}`}
    >
      <div className="flex items-start gap-2.5">
        <div className="w-7 h-7 bg-[#f8f6f0] border border-[#8b2500] text-[#8b2500] flex items-center justify-center shrink-0 mt-0.5">
          <WarningIcon size={14} />
        </div>
        <div className="space-y-1 min-w-0 flex-1">
          <span className="font-ibm-mono text-[10px] font-semibold uppercase tracking-[0.08em] text-[#8b2500] block">
            CDSCO · GOVERNMENT OF INDIA
          </span>
          <h3 className="font-newsreader text-[18px] font-semibold text-[#8b2500] leading-snug">
            {info.heading}
          </h3>
          <p className="text-xs sm:text-[13px] text-[#1a1a18] leading-relaxed">
            {info.message}
          </p>
          <p className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] pt-0.5 break-words">
            Official entry: {info.entry_name}
            {info.notification ? ` · ${info.notification}` : ''}
            {' · '}Source: CDSCO Data Bank
          </p>
        </div>
      </div>
    </div>
  );
}

export default IndiaBanNotice;
