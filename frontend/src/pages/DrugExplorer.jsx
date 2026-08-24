import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { searchMedicines, getMedicineProfile } from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import { useMedicine } from '../context/MedicineContext';
import {
  Search,
  Plus,
  SlidersHorizontal,
  X,
  AlertTriangle,
  SearchX
} from 'lucide-react';

// Human labels for the therapeutic-class slugs the backend emits in
// MedicineSearchResult.category_tags (see derive_category_tags in
// services/search_engine.py). The chip list itself is derived from the slugs
// actually present in the current results rather than hardcoded, so a chip can
// never offer a filter that matches nothing, and a new backend slug shows up
// without a frontend change -- it just falls back to a title-cased label.
const CATEGORY_LABELS = {
  nsaid: 'NSAID',
  analgesic: 'Pain & Fever',
  anticoagulant: 'Blood Thinners',
  cardio: 'Heart & Blood',
  diabetes: 'Diabetes',
  gi: 'Stomach & Acid',
  antibiotic: 'Antibiotics',
  endocrine: 'Hormonal',
  cns: 'Nervous System',
  general: 'Other',
};

function labelForCategory(slug) {
  return CATEGORY_LABELS[slug] || slug.charAt(0).toUpperCase() + slug.slice(1);
}

export function DrugExplorer() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Side-by-side comparison state
  const [compareList, setCompareList] = useState([]);
  const [compareProfiles, setCompareProfiles] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const { addMedicine, selectMedicine } = useMedicine();
  const navigate = useNavigate();

  // Debounced so a burst of keystrokes issues one request instead of one per
  // character. Without this the grid also cannot show an honest empty state: it
  // would flash "no medicines found" between every letter typed.
  const debouncedQuery = useDebounce(query, 300);

  // Monotonic request id. Responses can arrive out of order -- a slow request for
  // "a" resolving after a fast one for "aspirin" would repaint the grid with the
  // wrong results -- so only the newest request is allowed to commit state.
  const latestRequestRef = useRef(0);

  useEffect(() => {
    const requestId = latestRequestRef.current + 1;
    latestRequestRef.current = requestId;

    let cancelled = false;

    async function fetchResults() {
      setLoading(true);
      setSearchError(null);
      try {
        const data = await searchMedicines(debouncedQuery);
        if (cancelled || requestId !== latestRequestRef.current) return;
        setResults(Array.isArray(data) ? data : []);
      } catch (e) {
        if (cancelled || requestId !== latestRequestRef.current) return;
        // Surfaced rather than only logged: silently keeping the previous results
        // on screen presents stale data as a live answer to the new query.
        setSearchError(e?.message || 'Search is unavailable right now.');
        setResults([]);
      } finally {
        if (!cancelled && requestId === latestRequestRef.current) {
          setLoading(false);
        }
      }
    }

    fetchResults();
    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  useEffect(() => {
    let cancelled = false;

    async function loadCompareProfiles() {
      if (compareList.length === 0) {
        setCompareProfiles([]);
        return;
      }
      setCompareLoading(true);
      try {
        const profiles = await Promise.all(compareList.map((name) => getMedicineProfile(name)));
        if (cancelled) return;
        setCompareProfiles(profiles.filter(Boolean));
      } catch (e) {
        if (cancelled) return;
        console.warn('Compare fetch error:', e);
      } finally {
        if (!cancelled) setCompareLoading(false);
      }
    }

    loadCompareProfiles();
    return () => {
      cancelled = true;
    };
  }, [compareList]);

  const toggleCompare = (name) => {
    setCompareList((prev) => {
      if (prev.includes(name)) {
        return prev.filter((n) => n !== name);
      }
      if (prev.length >= 3) {
        return [...prev.slice(1), name];
      }
      return [...prev, name];
    });
  };

  const handleAddAndGo = (medName, drugType) => {
    addMedicine(medName, drugType);
    selectMedicine(medName);
    navigate('/app');
  };

  // Chips offered for the current result set, in the canonical order of
  // CATEGORY_LABELS so the row does not reshuffle between searches.
  const categories = useMemo(() => {
    const present = new Set();
    results.forEach((item) => {
      (item.category_tags || []).forEach((tag) => present.add(tag));
    });

    const known = Object.keys(CATEGORY_LABELS).filter((slug) => present.has(slug));
    const unknown = [...present].filter((slug) => !(slug in CATEGORY_LABELS)).sort();

    return [
      { id: 'all', label: 'All Classes' },
      ...[...known, ...unknown].map((slug) => ({ id: slug, label: labelForCategory(slug) })),
    ];
  }, [results]);

  // A chip that disappears when the results change must not leave an active filter
  // that now matches nothing -- that reads exactly like the broken empty grid this
  // screen used to have.
  useEffect(() => {
    if (selectedCategory !== 'all' && !categories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categories, selectedCategory]);

  // Filtering on the backend's category_tags replaces a list of hand-maintained
  // substring rules against the free-text `category` prose. Those rules silently
  // dropped whole classes: a brand-only row's category is the literal string
  // "Pharmacological Agent", which matched none of them, so brand results vanished
  // from every filter except "All Classes".
  const filteredResults = useMemo(() => {
    if (selectedCategory === 'all') return results;
    return results.filter((item) => (item.category_tags || []).includes(selectedCategory));
  }, [results, selectedCategory]);

  const showEmptyState = !loading && !searchError && filteredResults.length === 0;

  return (
    <div className="min-h-screen flex flex-col bg-[var(--bg-base)] text-[var(--text-primary)]">
      <Navbar />

      <main className="flex-1 pt-24 pb-12 px-4 sm:px-8 max-w-6xl mx-auto w-full flex flex-col gap-6">
        {/* Search Hero with Cormorant Garamond */}
        <div className="text-center max-w-2xl mx-auto space-y-3">
          <div className="badge badge-info">
            <Search className="w-3 h-3" />
            <span>Pharmacology Intelligence Catalog</span>
          </div>
          <h1 className="text-h1 text-[var(--text-primary)]">
            Explore Before You Commit
          </h1>
          <p className="text-body text-[var(--text-secondary)]">
            Inspect reported adverse reactions, food &amp; alcohol guidelines, and Stomach Guardian mucosal safety scores before adding to your regimen.
          </p>

          {/* Search bar */}
          <div className="relative mt-2">
            <Search
              className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2"
              aria-hidden="true"
            />
            <label htmlFor="drug-search" className="sr-only">
              Search medicines by brand or generic name
            </label>
            <input
              id="drug-search"
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search brand (e.g. Advil, Lipitor, Tylenol) or generic..."
              className="w-full bg-[var(--bg-surface)] border border-[var(--border-default)] focus:border-[var(--border-hover)] rounded-[8px] py-3 pl-10 pr-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none min-h-[48px] shadow-sm transition-colors"
            />
          </div>

          {/* Category Chips */}
          <div className="flex flex-wrap items-center justify-center gap-1.5 pt-1">
            {categories.map((c) => (
              <button
                key={c.id}
                onClick={() => setSelectedCategory(c.id)}
                aria-pressed={selectedCategory === c.id}
                className={`px-3 py-1.5 rounded-[6px] text-xs font-semibold min-h-[36px] transition-colors cursor-pointer ${
                  selectedCategory === c.id
                    ? 'bg-[var(--accent)] text-[var(--text-inverse)]'
                    : 'bg-[var(--bg-surface)] hover:bg-[var(--bg-elevated)] text-[var(--text-secondary)] border border-[var(--border-default)]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </div>

        {/* Side-by-Side Comparison Drawer */}
        {compareList.length > 0 && (
          <div className="card flex flex-col gap-3">
            <div className="flex items-center justify-between border-b border-[var(--border-default)] pb-2.5">
              <div className="flex items-center gap-1.5">
                <SlidersHorizontal className="w-4 h-4 text-[var(--text-primary)]" aria-hidden="true" />
                <h3 className="font-serif text-[18px] font-bold text-[var(--text-primary)]">
                  Side-by-Side Comparison ({compareList.length}/3)
                </h3>
              </div>
              <button
                onClick={() => setCompareList([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" aria-hidden="true" />
                <span>Close</span>
              </button>
            </div>

            {compareLoading ? (
              <div className="h-20 flex items-center justify-center text-xs text-[var(--text-muted)]">
                Loading comparison pharmacology...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {compareProfiles.map((p) => (
                  <div key={p.name} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[8px] p-3.5 flex flex-col gap-2.5">
                    <div className="flex items-center justify-between">
                      <h4 className="font-serif text-[18px] font-bold text-[var(--text-primary)]">{p.name}</h4>
                      <span className="tag">
                        {p.drug_type}
                      </span>
                    </div>

                    <div className="space-y-1.5 text-xs text-[var(--text-secondary)]">
                      <div>
                        <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Class</span>
                        <span className="text-[var(--text-primary)] font-medium">{p.category}</span>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Stomach Score</span>
                        <span className="metric text-sm text-[var(--severity-moderate)]">
                          {p.gi_profile?.stomach_health_score ?? '—'}/100
                        </span>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Food Rule</span>
                        <span>{p.food_interactions?.[0]?.title || 'Take with water'}</span>
                      </div>
                    </div>

                    <button
                      onClick={() => handleAddAndGo(p.name, p.drug_type)}
                      className="btn-primary w-full mt-auto text-xs py-2 min-h-[40px]"
                    >
                      Add to Basket →
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Search failure. Distinct from "no matches": the catalog was never
            reached, so the absence of results says nothing about the query. */}
        {searchError && (
          <div className="alert-danger flex items-start gap-2.5" role="alert">
            <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
            <div>
              <p className="text-sm font-bold leading-tight">Could not reach the medicine catalog</p>
              <p className="text-xs leading-relaxed mt-0.5">{searchError}</p>
            </div>
          </div>
        )}

        {/* Loading skeletons. Previously the grid simply held the previous query's
            results while a new search was in flight, with nothing to indicate the
            screen was mid-update. */}
        {loading && (
          <div
            className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5"
            aria-hidden="true"
          >
            {Array.from({ length: 8 }, (_, i) => (
              <div key={`skeleton-${i}`} className="card flex flex-col gap-3 animate-pulse">
                <div className="h-5 w-3/4 rounded-[4px] bg-[var(--bg-elevated)]" />
                <div className="h-3 w-1/2 rounded-[4px] bg-[var(--bg-elevated)]" />
                <div className="h-3 w-full rounded-[4px] bg-[var(--bg-elevated)]" />
                <div className="flex gap-1.5 pt-1">
                  <div className="h-5 w-16 rounded-[4px] bg-[var(--bg-elevated)]" />
                  <div className="h-5 w-12 rounded-[4px] bg-[var(--bg-elevated)]" />
                </div>
                <div className="h-10 w-full rounded-[6px] bg-[var(--bg-elevated)] mt-auto" />
              </div>
            ))}
          </div>
        )}

        <span className="sr-only" role="status" aria-live="polite">
          {loading
            ? 'Searching medicines'
            : `${filteredResults.length} medicine${filteredResults.length === 1 ? '' : 's'} found`}
        </span>

        {/* No matches. The grid used to render nothing at all here, which is
            indistinguishable from the page having failed to load. */}
        {showEmptyState && (
          <div className="card flex flex-col items-center text-center gap-3 py-12">
            <div className="w-11 h-11 rounded-[8px] bg-[var(--bg-elevated)] border border-[var(--border-default)] text-[var(--text-muted)] flex items-center justify-center">
              <SearchX className="w-5 h-5" aria-hidden="true" />
            </div>
            <h3 className="font-serif text-[20px] font-bold text-[var(--text-primary)]">
              {query.trim() ? `No medicines found for "${query.trim()}"` : 'No medicines to show'}
            </h3>
            <p className="text-body text-[var(--text-secondary)] max-w-md">
              {selectedCategory !== 'all'
                ? 'Nothing in the catalog matches this search within the selected class. Try another class or clear the filter.'
                : 'Try a generic name (ibuprofen, warfarin, metformin) or a common brand (Advil, Lipitor, Tylenol).'}
            </p>
            {selectedCategory !== 'all' && (
              <button onClick={() => setSelectedCategory('all')} className="btn-secondary text-xs">
                Show all classes
              </button>
            )}
          </div>
        )}

        {/* Results Grid */}
        {!loading && filteredResults.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
            {filteredResults.map((item) => {
              const isComparing = compareList.includes(item.name);
              return (
                <div
                  // Identity is the medicine, not its position: an index key makes
                  // React reuse the previous query's card for a different drug, so
                  // in-card state (the Compare toggle) lands on the wrong row.
                  key={`${item.generic_name}-${item.name}`}
                  className="card flex flex-col justify-between gap-3 group"
                >
                  <div className="flex flex-col gap-1.5">
                    <div className="flex items-start justify-between gap-1.5">
                      <div>
                        <h3 className="font-serif text-[18px] font-bold text-[var(--text-primary)] group-hover:underline transition-colors leading-tight">
                          {item.name}
                        </h3>
                        <span className="text-xs text-[var(--text-muted)] capitalize block font-sans">
                          {item.generic_name}
                        </span>
                      </div>

                      <span className="tag">
                        {item.drug_type}
                      </span>
                    </div>

                    <p className="text-body text-[var(--text-secondary)] line-clamp-2">
                      {item.category}
                    </p>

                    <div className="flex flex-wrap gap-1 pt-1">
                      {/* The backend emits "Critical" for the top GI tier (see
                          search_medicine_database); matching on "High" left every
                          highest-risk drug rendering in reassuring green. */}
                      <span className={`tag ${
                        item.stomach_risk_badge === 'Critical' || item.stomach_risk_badge === 'High'
                          ? 'tag-danger'
                          : item.stomach_risk_badge === 'Moderate'
                          ? 'tag-warning'
                          : 'tag-success'
                      }`}>
                        {item.stomach_risk_badge} GI
                      </span>

                      {item.top_side_effects?.slice(0, 2).map((se) => (
                        <span key={se} className="tag">
                          {se}
                        </span>
                      ))}
                    </div>
                  </div>

                  <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-default)]">
                    <button
                      onClick={() => toggleCompare(item.name)}
                      aria-pressed={isComparing}
                      className={`btn-secondary flex-1 text-xs py-2 min-h-[40px] ${
                        isComparing ? 'border-[var(--accent)] font-bold' : ''
                      }`}
                    >
                      {isComparing ? 'Comparing ✓' : 'Compare'}
                    </button>

                    <button
                      onClick={() => handleAddAndGo(item.name, item.drug_type)}
                      className="btn-primary p-2 min-h-[40px] w-10 flex items-center justify-center rounded-[6px]"
                      aria-label={`Add ${item.name} to basket`}
                      title="Add to Basket"
                    >
                      <Plus className="w-4 h-4" aria-hidden="true" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        <div className="flex justify-center mt-4">
          <Disclaimer />
        </div>
      </main>

      <Footer />
    </div>
  );
}
