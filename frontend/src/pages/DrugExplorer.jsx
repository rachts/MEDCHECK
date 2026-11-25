import React, { useState, useEffect, useMemo, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { searchMedicines, getMedicineProfile } from '../lib/api';
import { useDebounce } from '../hooks/useDebounce';
import { useMedicine } from '../context/MedicineContext';
import {
  SearchIcon,
  PlusIcon,
  BalanceIcon,
  CloseIcon,
  WarningIcon,
  CheckIcon,
  ArrowRightIcon,
} from './landing-icons';
import './app-editorial.css';

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

function giBadgeClass(badge) {
  if (badge === 'Critical' || badge === 'High') return 'ed-tag-crit';
  if (badge === 'Moderate') return 'ed-tag-caut';
  return 'ed-tag-safe';
}

function giScoreColor(score) {
  if (typeof score !== 'number') return 'text-[#57534a]';
  if (score > 60) return 'text-[#8b2500]';
  if (score > 30) return 'text-[#8a5300]';
  return 'text-[#2d4a22]';
}

export function DrugExplorer() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchError, setSearchError] = useState(null);
  const [selectedCategory, setSelectedCategory] = useState('all');

  const [compareList, setCompareList] = useState([]);
  const [compareProfiles, setCompareProfiles] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const { addMedicine, selectMedicine } = useMedicine();
  const navigate = useNavigate();

  const debouncedQuery = useDebounce(query, 300);
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

  useEffect(() => {
    if (selectedCategory !== 'all' && !categories.some((c) => c.id === selectedCategory)) {
      setSelectedCategory('all');
    }
  }, [categories, selectedCategory]);

  const filteredResults = useMemo(() => {
    if (selectedCategory === 'all') return results;
    return results.filter((item) => (item.category_tags || []).includes(selectedCategory));
  }, [results, selectedCategory]);

  const showEmptyState = !loading && !searchError && filteredResults.length === 0;

  return (
    <div className="ed-app min-h-screen flex flex-col bg-[#f8f6f0] text-[#1a1a18]">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 px-4 sm:px-8 max-w-[1200px] mx-auto w-full flex flex-col gap-6">
        {/* Editorial Search Masthead */}
        <section className="border-b border-[#b7b09d] pb-6 space-y-4">
          <div className="max-w-3xl space-y-2.5">
            <div className="inline-flex items-center gap-2 font-ibm-mono text-[11px] uppercase tracking-[0.09em] text-[#8b2500] font-medium">
              <SearchIcon size={14} />
              <span>Pharmacology Intelligence Catalog</span>
            </div>
            <h1 className="font-newsreader text-[34px] sm:text-[42px] font-medium text-[#1a1a18] leading-[1.08] tracking-[-0.015em]">
              Explore Before You Commit
            </h1>
            <p className="text-[15px] text-[#2d2b26] leading-relaxed font-ibm-serif max-w-2xl">
              Inspect reported adverse reactions, food &amp; alcohol guidelines, and Stomach Guardian mucosal safety indicators before adding to your regimen.
            </p>
          </div>

          {/* Search Bar */}
          <div className="relative max-w-2xl">
            <SearchIcon
              size={16}
              className="text-[#57534a] absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none"
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
              className="w-full bg-[#f8f6f0] border border-[#1a1a18] py-3 pl-10 pr-4 text-sm text-[#1a1a18] placeholder-[#57534a] outline-none min-h-[48px] font-ibm-serif"
            />
          </div>

          {/* Category Filters */}
          <div className="flex flex-wrap items-center gap-1.5 pt-1" role="group" aria-label="Filter by pharmacological class">
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => setSelectedCategory(c.id)}
                aria-pressed={selectedCategory === c.id}
                className={`px-3 py-1.5 font-ibm-mono text-[11px] uppercase tracking-[0.07em] font-medium min-h-[34px] transition-colors cursor-pointer border ${
                  selectedCategory === c.id
                    ? 'bg-[#1a1a18] text-[#f8f6f0] border-[#1a1a18]'
                    : 'bg-[#f0ede1] hover:bg-[#ece7d5] text-[#2d2b26] border-[#b7b09d] hover:border-[#1a1a18]'
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>
        </section>

        {/* Side-by-Side Comparison Docket */}
        {compareList.length > 0 && (
          <section className="ed-sheet p-5 flex flex-col gap-4" aria-label="Side-by-side medicine comparison">
            <div className="flex items-center justify-between border-b border-[#b7b09d] pb-3 gap-3">
              <div className="flex items-center gap-2.5">
                <div className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0">
                  <BalanceIcon size={15} />
                </div>
                <div>
                  <h2 className="font-newsreader text-[20px] font-semibold text-[#1a1a18] leading-tight">
                    Side-by-Side Comparison ({compareList.length}/3)
                  </h2>
                  <p className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a]">
                    Comparative pharmacology docket
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompareList([])}
                className="ed-btn-outline text-[11px] py-1.5 px-2.5"
              >
                <CloseIcon size={13} />
                <span>Close</span>
              </button>
            </div>

            {compareLoading ? (
              <div className="py-5 px-3 bg-[#f8f6f0] border border-[#d5cfc0] font-ibm-mono text-xs uppercase tracking-[0.08em] text-[#8b2500]" role="status" aria-live="polite">
                READING COMPARISON PROFILES
              </div>
            ) : (
              <>
                {/* Desktop Comparison Table */}
                <div className="hidden md:block overflow-x-auto border border-[#b7b09d] bg-[#f8f6f0]">
                  <table className="ed-docket-table">
                    <thead>
                      <tr>
                        <th scope="col" className="w-40">Attribute</th>
                        {compareProfiles.map((p) => (
                          <th key={p.name} scope="col" className="text-[#1a1a18]">
                            <div className="flex items-center justify-between gap-2">
                              <span className="font-newsreader text-[17px] font-semibold normal-case tracking-normal text-[#1a1a18]">
                                {p.name}
                              </span>
                              <span className="ed-tag">{p.drug_type}</span>
                            </div>
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="font-ibm-serif text-sm">
                      <tr>
                        <th scope="row" className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] bg-[#f0ede1] font-medium">
                          Class
                        </th>
                        {compareProfiles.map((p) => (
                          <td key={`${p.name}-class`} className="text-[#1a1a18] font-medium">
                            {p.category}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] bg-[#f0ede1] font-medium">
                          Stomach Score
                        </th>
                        {compareProfiles.map((p) => {
                          const score = p.gi_profile?.stomach_health_score;
                          const tier = p.gi_profile?.risk_tier;
                          return (
                            <td key={`${p.name}-gi`}>
                              <span className={`font-newsreader text-base font-semibold tabular-nums ${giScoreColor(score)}`}>
                                {score ?? '--'}/100
                              </span>
                              {tier && (
                                <span className={`ml-2 ed-tag ${
                                  tier === 'high' ? 'ed-tag-crit' : tier === 'moderate' ? 'ed-tag-caut' : 'ed-tag-safe'
                                }`}>
                                  {tier}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                      <tr>
                        <th scope="row" className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] bg-[#f0ede1] font-medium">
                          Food Rule
                        </th>
                        {compareProfiles.map((p) => (
                          <td key={`${p.name}-food`} className="text-xs text-[#2d2b26] leading-relaxed">
                            {p.food_interactions?.[0]?.title || 'Take with water'}
                          </td>
                        ))}
                      </tr>
                      <tr>
                        <th scope="row" className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] bg-[#f0ede1] font-medium">
                          Actions
                        </th>
                        {compareProfiles.map((p) => (
                          <td key={`${p.name}-actions`}>
                            <div className="flex items-center gap-2 flex-wrap">
                              <button
                                type="button"
                                onClick={() => navigate(`/medicine/${encodeURIComponent(p.name)}`)}
                                className="ed-btn-outline text-[11px] py-1.5 px-2.5"
                              >
                                Details
                              </button>
                              <button
                                type="button"
                                onClick={() => handleAddAndGo(p.name, p.drug_type)}
                                className="ed-btn-ink text-[11px] py-1.5 px-2.5"
                              >
                                <span>Add to Basket</span>
                                <ArrowRightIcon size={12} />
                              </button>
                            </div>
                          </td>
                        ))}
                      </tr>
                    </tbody>
                  </table>
                </div>

                {/* Mobile Ruled Comparison Rows */}
                <div className="md:hidden border border-[#b7b09d] bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
                  {compareProfiles.map((p) => {
                    const score = p.gi_profile?.stomach_health_score;
                    return (
                      <div key={p.name} className="p-4 flex flex-col gap-2.5 font-ibm-serif">
                        <div className="flex items-center justify-between gap-2">
                          <h3 className="font-newsreader text-[18px] font-semibold text-[#1a1a18]">{p.name}</h3>
                          <span className="ed-tag">{p.drug_type}</span>
                        </div>
                        <div className="space-y-1.5 text-xs text-[#2d2b26]">
                          <div>
                            <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block tracking-[0.06em]">Class</span>
                            <span className="text-[#1a1a18] font-medium">{p.category}</span>
                          </div>
                          <div>
                            <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block tracking-[0.06em]">Stomach Score</span>
                            <span className={`font-newsreader text-sm font-semibold tabular-nums ${giScoreColor(score)}`}>
                              {score ?? '--'}/100
                            </span>
                          </div>
                          <div>
                            <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block tracking-[0.06em]">Food Rule</span>
                            <span>{p.food_interactions?.[0]?.title || 'Take with water'}</span>
                          </div>
                        </div>
                        <div className="flex items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => navigate(`/medicine/${encodeURIComponent(p.name)}`)}
                            className="ed-btn-outline flex-1 text-[11px] py-2"
                          >
                            Details
                          </button>
                          <button
                            type="button"
                            onClick={() => handleAddAndGo(p.name, p.drug_type)}
                            className="ed-btn-ink flex-1 text-[11px] py-2"
                          >
                            <span>Add to Basket</span>
                            <ArrowRightIcon size={12} />
                          </button>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </>
            )}
          </section>
        )}

        {/* Search failure */}
        {searchError && (
          <div className="ed-notice-crit p-4 flex items-start gap-2.5 font-ibm-serif" role="alert">
            <WarningIcon size={16} className="mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-semibold text-[#1a1a18] leading-tight">Could not reach the medicine catalog</p>
              <p className="text-xs leading-relaxed mt-1">{searchError}</p>
            </div>
          </div>
        )}

        {/* Discrete Mono Loading State (no shimmer/skeletons) */}
        {loading && (
          <div className="ed-sheet p-5 flex items-center justify-between gap-3">
            <span className="font-ibm-mono text-xs uppercase tracking-[0.09em] text-[#8b2500] font-medium">
              READING THE CATALOG
            </span>
            <span className="font-ibm-serif text-xs text-[#57534a]">
              Querying prescribing monographs and brand aliases
            </span>
          </div>
        )}

        <span className="sr-only" role="status" aria-live="polite">
          {loading
            ? 'Searching medicines'
            : `${filteredResults.length} medicine${filteredResults.length === 1 ? '' : 's'} found`}
        </span>

        {/* No matches */}
        {showEmptyState && (
          <div className="ed-sheet flex flex-col items-center text-center gap-3 py-12 px-6">
            <div className="w-11 h-11 bg-[#f8f6f0] border border-[#b7b09d] text-[#57534a] flex items-center justify-center">
              <SearchIcon size={20} />
            </div>
            <h2 className="font-newsreader text-[22px] font-semibold text-[#1a1a18]">
              {query.trim() ? `No medicines found for "${query.trim()}"` : 'No medicines to show'}
            </h2>
            <p className="text-sm text-[#57534a] max-w-md font-ibm-serif leading-relaxed">
              {selectedCategory !== 'all'
                ? 'Nothing in the catalog matches this search within the selected class. Try another class or clear the filter.'
                : 'Try a generic name (ibuprofen, warfarin, metformin) or a common brand (Advil, Lipitor, Tylenol).'}
            </p>
            {selectedCategory !== 'all' && (
              <button
                type="button"
                onClick={() => setSelectedCategory('all')}
                className="ed-btn-outline text-[11px] mt-1"
              >
                Show all classes
              </button>
            )}
          </div>
        )}

        {/* Results Ledger (Docket Table on Desktop, Ruled Rows on Mobile) */}
        {!loading && filteredResults.length > 0 && (
          <section className="ed-sheet flex flex-col" aria-label="Catalog entries">
            <div className="px-4 py-3 border-b border-[#b7b09d] bg-[#ece7d5] flex items-center justify-between flex-wrap gap-2">
              <span className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a18] font-medium">
                Catalog Ledger · {filteredResults.length} {filteredResults.length === 1 ? 'Entry' : 'Entries'}
              </span>
              <span className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a]">
                Select up to 3 medicines to compare
              </span>
            </div>

            {/* Desktop Ruled Docket Table */}
            <div className="hidden md:block overflow-x-auto">
              <table className="ed-docket-table">
                <thead>
                  <tr>
                    <th scope="col">Medicine / Active Ingredient</th>
                    <th scope="col">Therapeutic Class</th>
                    <th scope="col">GI Risk &amp; Reactions</th>
                    <th scope="col" className="text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredResults.map((item) => {
                    const isComparing = compareList.includes(item.name);
                    return (
                      <tr key={`${item.generic_name}-${item.name}`}>
                        <td>
                          <div className="flex items-start gap-2.5">
                            <div>
                              <div className="flex items-center gap-2 flex-wrap">
                                <button
                                  type="button"
                                  onClick={() => navigate(`/medicine/${encodeURIComponent(item.name)}`)}
                                  className="font-newsreader text-[18px] font-semibold text-[#1a1a18] hover:text-[#8b2500] hover:underline underline-offset-4 text-left leading-tight cursor-pointer"
                                >
                                  {item.name}
                                </button>
                                <span className="ed-tag">{item.drug_type}</span>
                              </div>
                              <span className="font-ibm-serif text-xs text-[#57534a] capitalize block mt-0.5">
                                {item.generic_name}
                              </span>
                            </div>
                          </div>
                        </td>
                        <td className="font-ibm-serif text-sm text-[#2d2b26] max-w-[260px]">
                          {item.category}
                        </td>
                        <td>
                          <div className="flex flex-wrap gap-1.5">
                            <span className={`ed-tag ${giBadgeClass(item.stomach_risk_badge)}`}>
                              {item.stomach_risk_badge} GI
                            </span>
                            {item.top_side_effects?.slice(0, 2).map((se) => (
                              <span key={se} className="ed-tag">
                                {se}
                              </span>
                            ))}
                          </div>
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => navigate(`/medicine/${encodeURIComponent(item.name)}`)}
                              className="ed-btn-outline text-[11px] py-1.5 px-2.5 min-h-[36px]"
                              title={`View details for ${item.name}`}
                            >
                              Details
                            </button>

                            <button
                              type="button"
                              onClick={() => toggleCompare(item.name)}
                              aria-pressed={isComparing}
                              className={`text-[11px] py-1.5 px-2.5 min-h-[36px] ${
                                isComparing ? 'ed-btn-ink' : 'ed-btn-outline'
                              }`}
                            >
                              {isComparing && <CheckIcon size={12} />}
                              <span>{isComparing ? 'Comparing' : 'Compare'}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleAddAndGo(item.name, item.drug_type)}
                              className="ed-btn-ink p-2 min-h-[36px] w-9"
                              aria-label={`Add ${item.name} to basket`}
                              title="Add to Basket"
                            >
                              <PlusIcon size={15} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Ruled Ledger Rows */}
            <div className="md:hidden bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
              {filteredResults.map((item) => {
                const isComparing = compareList.includes(item.name);
                return (
                  <article
                    key={`${item.generic_name}-${item.name}-mobile`}
                    className="p-4 flex flex-col gap-3"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="font-newsreader text-[19px] font-semibold text-[#1a1a18] leading-tight">
                          {item.name}
                        </h3>
                        <span className="text-xs text-[#57534a] capitalize block font-ibm-serif mt-0.5">
                          {item.generic_name}
                        </span>
                      </div>
                      <span className="ed-tag">{item.drug_type}</span>
                    </div>

                    <p className="text-xs text-[#2d2b26] font-ibm-serif leading-relaxed">
                      {item.category}
                    </p>

                    <div className="flex flex-wrap gap-1.5">
                      <span className={`ed-tag ${giBadgeClass(item.stomach_risk_badge)}`}>
                        {item.stomach_risk_badge} GI
                      </span>
                      {item.top_side_effects?.slice(0, 2).map((se) => (
                        <span key={se} className="ed-tag">
                          {se}
                        </span>
                      ))}
                    </div>

                    <div className="flex items-center gap-2 pt-2 border-t border-[#d5cfc0]">
                      <button
                        type="button"
                        onClick={() => navigate(`/medicine/${encodeURIComponent(item.name)}`)}
                        className="ed-btn-outline text-[11px] py-2 px-2.5 min-h-[38px]"
                        title={`View details for ${item.name}`}
                      >
                        Details
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleCompare(item.name)}
                        aria-pressed={isComparing}
                        className={`flex-1 text-[11px] py-2 min-h-[38px] ${
                          isComparing ? 'ed-btn-ink' : 'ed-btn-outline'
                        }`}
                      >
                        {isComparing && <CheckIcon size={12} />}
                        <span>{isComparing ? 'Comparing' : 'Compare'}</span>
                      </button>

                      <button
                        type="button"
                        onClick={() => handleAddAndGo(item.name, item.drug_type)}
                        className="ed-btn-ink p-2 min-h-[38px] w-10"
                        aria-label={`Add ${item.name} to basket`}
                        title="Add to Basket"
                      >
                        <PlusIcon size={15} />
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        )}

        <div className="flex justify-center mt-4">
          <Disclaimer />
        </div>
      </main>

      <Footer />
    </div>
  );
}
export default DrugExplorer;
