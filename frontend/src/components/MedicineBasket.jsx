import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useMedicine } from '../context/MedicineContext';
import { searchMedicines, searchIndiaCatalogue } from '../lib/api';
import { MedicineChip } from './MedicineChip';
import {
  SearchIcon,
  PlusIcon,
  RemoveIcon,
  PillIcon,
  ShieldCrossIcon,
  ShieldIcon,
  ClockIcon,
  ArrowRightIcon,
  WarningIcon,
  BasketIcon,
  InfoIcon,
} from '../pages/landing-icons';

export function MedicineBasket({ onSeeTimeline }) {
  const navigate = useNavigate();
  const {
    medicines,
    addMedicine,
    removeMedicine,
    clearBasket,
    checkSafety,
    loading,
    loadingStage,
    results,
    setStomachModalOpen
  } = useMedicine();

  const [inputVal, setInputVal] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [catalogueResults, setCatalogueResults] = useState([]);
  const [isSearching, setIsSearching] = useState(false);
  const [searchError, setSearchError] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const [inputError, setInputError] = useState('');

  const dropdownRef = useRef(null);

  // Debounce autocomplete search input by 250ms
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(inputVal);
    }, 250);
    return () => clearTimeout(timer);
  }, [inputVal]);

  // Query clinical search and Indian medicines reference catalogue
  useEffect(() => {
    let active = true;

    async function fetchMatches() {
      const q = debouncedQuery.trim();
      if (!q) {
        setSearchResults([]);
        setCatalogueResults([]);
        setIsSearching(false);
        setSearchError(false);
        return;
      }

      setIsSearching(true);
      setSearchError(false);

      try {
        const [clinicalOutcome, catalogueOutcome] = await Promise.allSettled([
          searchMedicines(q),
          searchIndiaCatalogue(q, 5),
        ]);

        if (!active) return;

        const nextClinical =
          clinicalOutcome.status === 'fulfilled' && Array.isArray(clinicalOutcome.value)
            ? clinicalOutcome.value
            : [];
        const nextCatalogue =
          catalogueOutcome.status === 'fulfilled' && Array.isArray(catalogueOutcome.value?.results)
            ? catalogueOutcome.value.results.slice(0, 5)
            : [];

        const bothFailed =
          clinicalOutcome.status === 'rejected' && catalogueOutcome.status === 'rejected';

        if (clinicalOutcome.status === 'rejected') {
          console.warn('MEDCHECK: clinical search API request failed:', clinicalOutcome.reason);
        }
        if (catalogueOutcome.status === 'rejected') {
          console.warn('MEDCHECK: catalogue search API request failed:', catalogueOutcome.reason);
        }

        setSearchResults(nextClinical);
        setCatalogueResults(nextCatalogue);
        setSearchError(bothFailed);
        setShowDropdown(true);
      } catch (err) {
        if (active) {
          console.warn('MEDCHECK: search API request failed:', err);
          setSearchResults([]);
          setCatalogueResults([]);
          setSearchError(true);
          setShowDropdown(true);
        }
      } finally {
        if (active) setIsSearching(false);
      }
    }

    fetchMatches();
    return () => {
      active = false;
    };
  }, [debouncedQuery]);

  // Click outside listener for dropdown
  useEffect(() => {
    function handleClickOutside(e) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleAddFromInput = (e) => {
    e.preventDefault();
    const trimmed = inputVal.trim();
    if (!trimmed) return;

    const exists = medicines.some(
      (m) => m.name.toLowerCase() === trimmed.toLowerCase()
    );
    if (exists) {
      setInputError(`"${trimmed}" is already in your basket`);
      setTimeout(() => setInputError(''), 3000);
      return;
    }

    addMedicine(trimmed, 'otc');
    setInputVal('');
    setShowDropdown(false);
  };

  const handleSelectSearchResult = (item) => {
    const exists = medicines.some(
      (m) => m.name.toLowerCase() === item.name.toLowerCase()
    );
    if (exists) {
      setInputError(`"${item.name}" is already in your basket`);
      setTimeout(() => setInputError(''), 3000);
      setShowDropdown(false);
      return;
    }

    addMedicine(item.name, item.drug_type || 'otc');
    setInputVal('');
    setShowDropdown(false);
  };

  const handleSelectCatalogueResult = (item) => {
    setShowDropdown(false);
    navigate(`/assistant?medicine=${encodeURIComponent(item.name)}`);
  };

  const hasResults = Boolean(results);
  const giScore = hasResults ? (results.composite_gi_score ?? 0) : null;
  const giTier = hasResults ? (results.composite_gi_tier || 'unknown') : null;
  const foodConflictCount = results?.food_conflicts?.length || 0;

  let giFillColor = '#2d4a22';
  if (!hasResults || giTier === 'unknown') {
    giFillColor = '#57534a';
  } else if (giScore > 60) {
    giFillColor = '#8b2500';
  } else if (giScore > 30) {
    giFillColor = '#8a5300';
  }

  return (
    <div className="ed-sheet p-5 flex flex-col gap-4" role="region" aria-label="Medicine Basket">
      {/* Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[#b7b09d] pb-3.5">
        <div className="flex items-start gap-2.5">
          <div className="w-8 h-8 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0 mt-0.5">
            <PillIcon size={16} />
          </div>
          <div>
            <h2 className="font-newsreader text-[21px] font-semibold text-[#1a1a18] leading-tight">
              Medicine Basket
            </h2>
            <div className="flex items-center gap-1.5 flex-wrap mt-1">
              <p className="font-ibm-mono text-[11px] uppercase tracking-[0.06em] text-[#57534a]">
                {medicines.length} medication{medicines.length !== 1 ? 's' : ''} loaded
              </p>
              {results?.analysis_coverage && (
                <span className={`ed-tag ${
                  results.analysis_coverage === 'full'
                    ? 'ed-tag-safe'
                    : results.analysis_coverage === 'partial'
                    ? 'ed-tag-caut'
                    : ''
                }`}>
                  Covers {results.verified_medicines_count ?? medicines.length} of {results.total_medicines_count ?? medicines.length}
                </span>
              )}
            </div>
          </div>
        </div>

        {medicines.length > 0 && (
          <button
            type="button"
            onClick={clearBasket}
            className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] hover:text-[#8b2500] hover:underline underline-offset-4 flex items-center gap-1 transition-colors cursor-pointer py-1 px-1 shrink-0"
            aria-label="Clear all medicines from basket"
          >
            <RemoveIcon size={13} />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Autocomplete Input Form */}
      <div className="relative" ref={dropdownRef}>
        <form onSubmit={handleAddFromInput} className="flex items-stretch border border-[#1a1a18] bg-[#f8f6f0]">
          <div className="relative flex-1 min-w-0">
            <SearchIcon
              size={15}
              className="text-[#57534a] absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none"
            />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onFocus={() =>
                inputVal.trim() &&
                (searchResults.length > 0 || catalogueResults.length > 0) &&
                setShowDropdown(true)
              }
              placeholder="Search brand or generic name..."
              className="w-full bg-[#f8f6f0] py-2.5 pl-9 pr-3 text-sm text-[#1a1a18] placeholder-[#57534a] outline-none min-h-[44px] font-ibm-serif"
              aria-label="Medicine search query"
            />
          </div>

          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="ed-btn-ink border-0 border-l border-[#1a1a18] min-h-[44px] px-3.5 disabled:opacity-35 disabled:cursor-not-allowed shrink-0"
            aria-label="Add medicine to basket"
          >
            <PlusIcon size={15} />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>

        {/* Dropdown */}
        {showDropdown && debouncedQuery.trim().length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[#f8f6f0] border border-[#1a1a18] border-t-[3px] border-t-[#1a1a18] z-50 flex flex-col max-h-[360px] overflow-y-auto">
            {searchResults.length > 0 || catalogueResults.length > 0 ? (
              <>
                {searchResults.map((item, idx) => (
                  <div
                    key={`${item.generic_name}-${item.name}-${idx}`}
                    onClick={() => handleSelectSearchResult(item)}
                    className="p-2.5 bg-[#f8f6f0] hover:bg-[#f0ede1] border-b border-[#d5cfc0] last:border-b-0 transition-colors cursor-pointer flex items-center justify-between gap-2 min-h-[48px]"
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault();
                        handleSelectSearchResult(item);
                      }
                    }}
                  >
                    <div className="flex items-center gap-2.5 min-w-0">
                      <div className="w-6 h-6 border border-[#b7b09d] bg-[#f0ede1] flex items-center justify-center text-[#1a1a18] shrink-0">
                        <PillIcon size={13} />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-newsreader text-[16px] font-semibold text-[#1a1a18]">{item.name}</span>
                          {item.brand_context ? (
                            <span className="text-xs text-[#57534a] font-ibm-serif">({item.brand_context})</span>
                          ) : (
                            <span className="ed-tag">{item.drug_type}</span>
                          )}
                        </div>
                        <p className="text-xs text-[#57534a] line-clamp-1 font-ibm-serif">
                          {item.category}
                        </p>
                      </div>
                    </div>

                    <span className={`ed-tag shrink-0 ${
                      item.stomach_risk_badge === 'Critical'
                        ? 'ed-tag-crit'
                        : item.stomach_risk_badge === 'Moderate'
                        ? 'ed-tag-caut'
                        : 'ed-tag-safe'
                    }`}>
                      {item.stomach_risk_badge} GI
                    </span>
                  </div>
                ))}

                {catalogueResults.length > 0 && (
                  <div
                    className={searchResults.length > 0 ? 'border-t-2 border-[#1a1a18]' : ''}
                    role="group"
                    aria-label="From the Indian medicines catalogue"
                  >
                    <div className="px-2.5 py-1.5 bg-[#ece7d5] border-b border-[#b7b09d] font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
                      FROM THE INDIAN MEDICINES CATALOGUE
                    </div>
                    {catalogueResults.slice(0, 5).map((item, idx) => (
                      <button
                        key={`cat-${item.name}-${idx}`}
                        type="button"
                        onClick={() => handleSelectCatalogueResult(item)}
                        className="w-full text-left p-2.5 bg-[#f8f6f0] hover:bg-[#f0ede1] border-b border-[#d5cfc0] last:border-b-0 transition-colors cursor-pointer flex items-center justify-between gap-2 min-h-[44px]"
                      >
                        <div className="min-w-0">
                          <span className="font-newsreader text-[15px] font-semibold text-[#1a1a18] block truncate">
                            {item.name}
                          </span>
                          {item.therapeutic_class && (
                            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block truncate mt-0.5">
                              {item.therapeutic_class}
                            </span>
                          )}
                        </div>
                        <ArrowRightIcon size={13} className="text-[#57534a] shrink-0" />
                      </button>
                    ))}
                  </div>
                )}
              </>
            ) : searchError ? (
              <div className="p-3 text-xs ed-notice-crit space-y-1 font-ibm-serif">
                <p className="font-semibold flex items-center gap-1.5 font-ibm-mono uppercase tracking-[0.06em]">
                  <WarningIcon size={14} />
                  <span>Search service unavailable</span>
                </p>
                <p>Press <strong>Add</strong> or Enter to check &ldquo;{inputVal}&rdquo; directly against fallback clinical tables.</p>
              </div>
            ) : !isSearching ? (
              <div className="p-3 text-xs text-[#2d2b26] space-y-1.5 bg-[#f0ede1] font-ibm-serif">
                <div className="flex items-center gap-1.5 font-semibold text-[#1a1a18]">
                  <InfoIcon size={14} className="text-[#1a1a18] shrink-0" />
                  <span>No direct match in active catalog</span>
                </div>
                <p className="text-[#57534a] leading-relaxed">
                  Tip: Try searching by active generic compound (e.g. <em>Paracetamol</em>, <em>Pantoprazole</em>) or press <strong>Enter</strong> to evaluate &ldquo;{debouncedQuery}&rdquo; via fallback databases.
                </p>
              </div>
            ) : null}
          </div>
        )}
      </div>

      {inputError && (
        <div className="ed-notice-crit p-2.5 text-xs flex items-center gap-2 font-ibm-serif" role="alert">
          <WarningIcon size={14} className="shrink-0" />
          <span>{inputError}</span>
        </div>
      )}

      {medicines.some((m) => results?.profiles?.[m.name.toLowerCase()]?.is_fdc) && (
        <div className="ed-notice-caut text-xs flex items-start gap-2 p-2.5 font-ibm-serif" role="alert">
          <WarningIcon size={14} className="shrink-0 mt-0.5" />
          <span>
            <strong>Combination product:</strong> Analysis covers primary ingredient only.
          </span>
        </div>
      )}

      {results?.analysis_coverage === 'partial' && (
        <div className="ed-notice-caut text-xs flex items-start gap-2 p-2.5 font-ibm-serif" role="alert">
          <WarningIcon size={14} className="shrink-0 mt-0.5" />
          <span>
            <strong>Partial scan:</strong> Analysis covers {results.verified_medicines_count ?? 0} of {results.total_medicines_count ?? medicines.length} medicines. Unverified medicines cannot be guaranteed safe.
          </span>
        </div>
      )}

      {/* Medicines Chips Container */}
      <div className="flex flex-col gap-2 min-h-[120px]">
        {medicines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-5 border border-[#b7b09d] bg-[#ece7d5]">
            <BasketIcon size={24} className="text-[#57534a] mb-2" />
            <h4 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] mb-0.5">
              Your medicine cabinet is empty
            </h4>
            <p className="text-xs text-[#57534a] max-w-[220px] mb-3.5 font-ibm-serif">
              Add your first medicine to begin your safety check.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => addMedicine('Aspirin', 'otc')}
                className="ed-btn-outline text-[11px] py-1.5 px-2.5"
              >
                + Aspirin
              </button>
              <button
                type="button"
                onClick={() => addMedicine('Ibuprofen', 'otc')}
                className="ed-btn-outline text-[11px] py-1.5 px-2.5"
              >
                + Ibuprofen
              </button>
              <button
                type="button"
                onClick={() => addMedicine('Paracetamol', 'otc')}
                className="ed-btn-outline text-[11px] py-1.5 px-2.5"
              >
                + Paracetamol
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {medicines.map((med) => (
              <MedicineChip
                key={med.id}
                medicine={med}
                onRemove={removeMedicine}
              />
            ))}
          </div>
        )}
      </div>

      {/* Basket Footer */}
      {medicines.length > 0 && (
        <div className="flex flex-col gap-3.5 pt-3.5 border-t border-[#b7b09d]">
          {/* Stomach Guardian Score Card */}
          <div
            onClick={() => setStomachModalOpen(true)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setStomachModalOpen(true);
              }
            }}
            className="bg-[#f8f6f0] border border-[#b7b09d] hover:border-[#1a1a18] p-3.5 flex flex-col gap-2.5 transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={hasResults ? `Stomach Guardian stomach risk score: ${giScore} out of 100, Tier: ${giTier}. Open the full breakdown.` : 'Stomach Guardian stomach risk score: Not analyzed yet.'}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1.5">
                <ShieldIcon size={16} className="text-[#8a5300] shrink-0" />
                <span className="font-newsreader text-[16px] font-semibold text-[#1a1a18]">
                  Stomach Guardian
                </span>
                <span className="ed-tag text-[9px] px-1.5 py-0.5">Our score</span>
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                {!hasResults ? (
                  <>
                    <span className="font-newsreader text-base text-[#57534a]">--</span>
                    <span className="ed-tag">not analyzed</span>
                  </>
                ) : giTier === 'unknown' ? (
                  <>
                    <span className="text-xs font-medium text-[#57534a] font-ibm-mono">No GI Data</span>
                    <span className="ed-tag">unknown</span>
                  </>
                ) : (
                  <>
                    <span className="font-newsreader text-lg font-semibold text-[#1a1a18] tabular-nums">{giScore}</span>
                    <span className="font-ibm-mono text-[11px] text-[#57534a]">/100</span>
                    <span className={`ed-tag ${
                      giTier === 'high'
                        ? 'ed-tag-crit'
                        : giTier === 'moderate'
                        ? 'ed-tag-caut'
                        : 'ed-tag-safe'
                    }`}>
                      {giTier}
                    </span>
                  </>
                )}
              </div>
            </div>

            {/* Linear Progress Bar */}
            <div className="h-1.5 bg-[#ece7d5] border border-[#d5cfc0] overflow-hidden">
              <div
                className="h-full"
                style={{ width: hasResults ? `${Math.min(giScore, 100)}%` : '0%', backgroundColor: giFillColor }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[#57534a]">
              <span className="font-ibm-serif">Combined stomach stress</span>
              <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#8b2500] font-medium inline-flex items-center gap-1 hover:underline underline-offset-4">
                <span>Inspect</span>
                <ArrowRightIcon size={12} />
              </span>
            </div>
          </div>

          {/* Food Conflict Alert */}
          {foodConflictCount > 0 && (
            <div className="ed-notice-caut p-2.5 text-xs flex items-center justify-between gap-2 font-ibm-serif">
              <div className="flex items-center gap-1.5">
                <ClockIcon size={14} className="shrink-0" />
                <span className="font-semibold">
                  {foodConflictCount} timing conflict{foodConflictCount > 1 ? 's' : ''}
                </span>
              </div>
              <span
                onClick={() => {
                  if (typeof onSeeTimeline === 'function') onSeeTimeline();
                  setTimeout(() => {
                    const el = document.getElementById('food-timeline');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }, 50);
                }}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    if (typeof onSeeTimeline === 'function') onSeeTimeline();
                    setTimeout(() => {
                      const el = document.getElementById('food-timeline');
                      if (el) el.scrollIntoView({ behavior: 'smooth' });
                    }, 50);
                  }
                }}
                className="font-ibm-mono text-[11px] uppercase tracking-[0.06em] font-medium underline underline-offset-4 cursor-pointer hover:text-[#1a1a18] transition-colors shrink-0"
              >
                See timeline
              </span>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={checkSafety}
            disabled={loading || medicines.length < 1}
            className="ed-btn-ink w-full disabled:opacity-45 disabled:cursor-not-allowed min-h-[46px]"
            aria-label="Analyze Medicine Safety"
          >
            {loading ? (
              <span>{loadingStage ? loadingStage.toUpperCase() : 'CHECKING THE LABELS'}</span>
            ) : (
              <>
                <ShieldCrossIcon size={16} />
                <span>Analyze Medicine Safety</span>
                <ArrowRightIcon size={15} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default MedicineBasket;
