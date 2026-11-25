import React from 'react';

export function SkeletonCard() {
  return (
    <div
      className="p-5 border border-[#b7b09d] border-t-[3px] border-t-[#1a1a18] bg-[#f0ede1]"
      role="status"
      aria-live="polite"
    >
      <p className="font-ibm-mono text-xs uppercase tracking-[0.09em] text-[#57534a]">
        LOADING RECORD
      </p>
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div
      className="p-6 border border-[#b7b09d] border-t-[3px] border-t-[#1a1a18] bg-[#f0ede1] space-y-2"
      role="status"
      aria-live="polite"
    >
      <p className="font-ibm-mono text-xs uppercase tracking-[0.09em] text-[#8b2500]">
        READING THE PROFILE
      </p>
      <p className="font-ibm-serif text-xs text-[#57534a]">
        Retrieving monograph details, side effects, and GI safety parameters.
      </p>
    </div>
  );
}

export default SkeletonCard;
