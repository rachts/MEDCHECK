import React, { useState, useEffect, useRef } from 'react';
import { useMedicine } from '../context/MedicineContext';
import { MedicineChip } from './MedicineChip';
import { searchMedicines } from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import { 
  Plus, 
  Trash2, 
  ShieldCheck, 
  Search, 
  Flame, 
  Clock, 
  AlertTriangle,
  ArrowRight,
  Pill,
  Archive
} from 'lucide-react';

export function MedicineBasket() {
  const {
    medicines,
    addMedicine,
    removeMedicine,
    clearBasket,
    results,
    loading,
    loadingStage,
    checkSafety,
    inputError,
    setStomachModalOpen
  } = useMedicine();

  const [inputVal, setInputVal] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef(null);

  const debouncedQuery = useDebounce(inputVal, 250);

  useEffect(() => {
    if (!debouncedQuery.trim()) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    let isMounted = true;
    searchMedicines(debouncedQuery).then((data) => {
      if (isMounted) {
        setSearchResults(data);
        setShowDropdown(data.length > 0);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [debouncedQuery]);

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
    if (inputVal.trim()) {
      const added = addMedicine(inputVal);
      if (added) {
        setInputVal('');
        setShowDropdown(false);
      }
    }
  };

  const handleSelectSearchResult = (item) => {
    addMedicine(item.name, item.drug_type);
    setInputVal('');
    setShowDropdown(false);
  };

  const giScore = results?.composite_gi_score || 20;
  const giTier = results?.composite_gi_tier || 'gentle';
  const foodConflictCount = results?.food_conflicts?.length || 0;

  let giFillColor = 'var(--severity-low)'; // #059669
  if (giScore > 60) {
    giFillColor = 'var(--severity-high)'; // #DC2626
  } else if (giScore > 30) {
    giFillColor = 'var(--severity-moderate)'; // #D97706
  }

  return (
    <div className="card flex flex-col gap-4" role="region" aria-label="Medicine Basket">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-[4px] bg-[var(--accent)] text-[var(--text-inverse)] flex items-center justify-center">
            <Pill className="w-4 h-4" aria-hidden="true" />
          </div>
          <div>
            <h2 className="font-serif text-[20px] font-bold text-[var(--text-primary)] leading-tight">
              Medicine Basket
            </h2>
            <p className="text-xs text-[var(--text-muted)] font-sans">
              {medicines.length} medication{medicines.length !== 1 ? 's' : ''} loaded
            </p>
          </div>
        </div>

        {medicines.length > 0 && (
          <button
            onClick={clearBasket}
            className="text-xs text-[var(--text-muted)] hover:text-[var(--severity-high)] flex items-center gap-1 transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-[#E2E8F0]"
            aria-label="Clear all medicines from basket"
          >
            <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
            <span>Clear</span>
          </button>
        )}
      </div>

      {/* Autocomplete Input Form */}
      <div className="relative" ref={dropdownRef}>
        <form onSubmit={handleAddFromInput} className="flex gap-1.5">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3 top-1/2 -translate-y-1/2" aria-hidden="true" />
            <input
              type="text"
              value={inputVal}
              onChange={(e) => setInputVal(e.target.value)}
              onFocus={() => inputVal.trim() && searchResults.length > 0 && setShowDropdown(true)}
              placeholder="Search brand or generic name..."
              className="w-full bg-[var(--bg-input)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] py-2.5 pl-9 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[44px] transition-colors"
              aria-label="Medicine search query"
            />
          </div>

          <button
            type="submit"
            disabled={!inputVal.trim()}
            className="btn-primary min-h-[44px] px-3.5 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Add medicine to basket"
          >
            <Plus className="w-4 h-4" aria-hidden="true" />
            <span className="hidden sm:inline">Add</span>
          </button>
        </form>

        {/* Dropdown */}
        {showDropdown && searchResults.length > 0 && (
          <div className="absolute top-full left-0 right-0 mt-1 bg-[var(--bg-surface)] border border-[var(--border-default)] rounded-[8px] p-1 shadow-lg z-50 flex flex-col gap-1 max-h-[280px] overflow-y-auto">
            {searchResults.map((item, idx) => (
              <div
                // Identity is the medicine, not the row position. Search results are
                // replaced wholesale as the query changes, so an index key made
                // React reuse the previous query's row for a different drug -- the
                // row the user's pointer was already over.
                key={`${item.generic_name}-${item.name}-${idx}`}
                onClick={() => handleSelectSearchResult(item)}
                className="p-2.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] border border-transparent hover:border-[var(--border-hover)] transition-colors cursor-pointer flex items-center justify-between gap-2 min-h-[48px]"
                role="button"
                tabIndex={0}
                // Space as well as Enter, and preventDefault on both. `role="button"`
                // tells assistive tech this behaves like a native button, and a native
                // button activates on Space -- so a screen-reader user following that
                // contract found the row inert and, worse, Space scrolled the dropdown
                // out from under them. preventDefault suppresses that scroll.
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    handleSelectSearchResult(item);
                  }
                }}
              >
                <div className="flex items-center gap-2.5">
                  <div className="w-6 h-6 rounded-[4px] bg-[var(--bg-surface)] flex items-center justify-center text-[var(--text-primary)] shrink-0">
                    <Pill className="w-3.5 h-3.5" aria-hidden="true" />
                  </div>
                  <div>
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="font-serif text-[16px] font-bold text-[var(--text-primary)]">{item.name}</span>
                      {item.brand_context ? (
                        <span className="text-xs text-slate-500 font-sans">({item.brand_context})</span>
                      ) : (
                        <span className="tag">{item.drug_type}</span>
                      )}
                    </div>
                    <p className="text-xs text-[var(--text-muted)] line-clamp-1 font-sans">
                      {item.category}
                    </p>
                  </div>
                </div>

                <span className={`tag shrink-0 ${
                  item.stomach_risk_badge === 'Critical'
                    ? 'tag-danger'
                    : item.stomach_risk_badge === 'Moderate'
                    ? 'tag-warning'
                    : 'tag-success'
                }`}>
                  {item.stomach_risk_badge} GI
                </span>
              </div>
            ))}
          </div>
        )}
      </div>

      {inputError && (
        <div className="alert-danger text-sm flex items-center gap-2" role="alert">
          <AlertTriangle className="w-4 h-4 shrink-0" aria-hidden="true" />
          <span>{inputError}</span>
        </div>
      )}

      {/* Medicines Chips Container */}
      <div className="flex flex-col gap-2 min-h-[120px]">
        {medicines.length === 0 ? (
          <div className="flex-1 flex flex-col items-center justify-center text-center p-5 border border-dashed border-[var(--border-default)] rounded-[8px] bg-[var(--bg-elevated)]">
            <Archive className="w-7 h-7 text-[var(--text-muted)] mb-1.5 stroke-1" aria-hidden="true" />
            <h4 className="font-serif text-[18px] font-bold text-[var(--text-primary)] mb-0.5">
              Your medicine cabinet is empty
            </h4>
            <p className="text-xs text-[var(--text-muted)] max-w-[200px] mb-3">
              Add your first medicine to begin your safety check.
            </p>

            <div className="flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={() => addMedicine('Aspirin', 'otc')}
                className="tag hover:border-[var(--border-hover)] hover:bg-[#E2E8F0] min-h-[36px] px-3 transition-colors cursor-pointer"
              >
                + Aspirin
              </button>
              <button
                type="button"
                onClick={() => addMedicine('Ibuprofen', 'otc')}
                className="tag hover:border-[var(--border-hover)] hover:bg-[#E2E8F0] min-h-[36px] px-3 transition-colors cursor-pointer"
              >
                + Ibuprofen
              </button>
              <button
                type="button"
                onClick={() => addMedicine('Paracetamol', 'otc')}
                className="tag hover:border-[var(--border-hover)] hover:bg-[#E2E8F0] min-h-[36px] px-3 transition-colors cursor-pointer"
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
        <div className="flex flex-col gap-3.5 pt-3 border-t border-[var(--border-default)]">
          {/* Stomach Guardian Score Card */}
          <div
            onClick={() => setStomachModalOpen(true)}
            // role="button" + tabIndex made this card focusable, but there was no key
            // handler behind it: a keyboard user could tab to the score card, press
            // Enter, and nothing opened. Native buttons get that for free; a div has
            // to be given it explicitly. Space is included because that is what a
            // button role implies.
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                setStomachModalOpen(true);
              }
            }}
            className="bg-[var(--bg-elevated)] border border-[var(--border-default)] hover:border-[var(--border-hover)] rounded-[8px] p-3 flex flex-col gap-2 transition-colors cursor-pointer"
            role="button"
            tabIndex={0}
            aria-label={`Stomach Guardian Score: ${giScore} out of 100, Tier: ${giTier}. Open the full breakdown.`}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Flame className="w-4 h-4 text-[var(--severity-moderate)]" aria-hidden="true" />
                <span className="font-serif text-[16px] font-bold text-[var(--text-primary)]">
                  Stomach Guardian
                </span>
              </div>

              <div className="flex items-center gap-1.5">
                <span className="metric text-base text-[var(--text-primary)]">{giScore}</span>
                <span className="text-xs text-[var(--text-muted)]">/100</span>
                <span className={`tag ${
                  giTier === 'high'
                    ? 'tag-danger'
                    : giTier === 'moderate'
                    ? 'tag-warning'
                    : 'tag-success'
                }`}>
                  {giTier}
                </span>
              </div>
            </div>

            {/* Linear Progress Bar */}
            <div className="gi-score-bar">
              <div
                className="gi-score-fill"
                style={{ width: `${Math.min(giScore, 100)}%`, backgroundColor: giFillColor }}
              />
            </div>

            <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
              <span>Cumulative mucosal load</span>
              <span className="text-[var(--text-primary)] font-semibold hover:underline">Inspect →</span>
            </div>
          </div>

          {/* Food Conflict Alert */}
          {foodConflictCount > 0 && (
            <div className="alert-warning text-xs flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Clock className="w-4 h-4 shrink-0 text-[var(--severity-moderate)]" aria-hidden="true" />
                <span className="font-semibold">
                  {foodConflictCount} timing conflict{foodConflictCount > 1 ? 's' : ''}
                </span>
              </div>
              <span className="font-medium underline cursor-pointer">See timeline</span>
            </div>
          )}

          {/* Primary Action Button */}
          <button
            onClick={checkSafety}
            disabled={loading || medicines.length < 1}
            className="btn-primary w-full disabled:opacity-40 disabled:cursor-not-allowed min-h-[48px]"
            aria-label="Analyze Medicine Safety"
          >
            {loading ? (
              <>
                <div className="w-4 h-4 border-2 border-[var(--text-inverse)] border-t-transparent rounded-full animate-spin" />
                <span>{loadingStage || 'Analyzing Clinical Data...'}</span>
              </>
            ) : (
              <>
                <ShieldCheck className="w-4 h-4" aria-hidden="true" />
                <span>Analyze Medicine Safety</span>
                <ArrowRight className="w-4 h-4 ml-0.5" aria-hidden="true" />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}

export default MedicineBasket;
