import React from 'react';

export function SkeletonCard() {
  return (
    <div className="card-surface p-5 rounded-xl border border-slate-200 animate-pulse space-y-4">
      <div className="flex items-center justify-between">
        <div className="h-5 bg-slate-200 rounded w-1/3"></div>
        <div className="h-6 bg-slate-200 rounded-full w-20"></div>
      </div>
      <div className="space-y-2">
        <div className="h-4 bg-slate-200 rounded w-full"></div>
        <div className="h-4 bg-slate-200 rounded w-4/5"></div>
      </div>
      <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
        <div className="h-3 bg-slate-200 rounded w-1/4"></div>
      </div>
    </div>
  );
}

export function SkeletonProfile() {
  return (
    <div className="card-surface p-6 rounded-xl border border-slate-200 animate-pulse space-y-6">
      <div className="space-y-2">
        <div className="h-7 bg-slate-200 rounded w-1/2"></div>
        <div className="h-4 bg-slate-200 rounded w-1/3"></div>
      </div>
      <div className="h-24 bg-slate-100 rounded-lg p-4 space-y-2">
        <div className="h-4 bg-slate-200 rounded w-3/4"></div>
        <div className="h-3 bg-slate-200 rounded w-1/2"></div>
      </div>
      <div className="space-y-3">
        <div className="h-4 bg-slate-200 rounded w-1/4"></div>
        <div className="h-10 bg-slate-100 rounded"></div>
        <div className="h-10 bg-slate-100 rounded"></div>
      </div>
    </div>
  );
}

export default SkeletonCard;
