import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { searchMedicines, getMedicineProfile } from '../lib/api';
import { useMedicine } from '../context/MedicineContext';
import { 
  Search, 
  Plus, 
  SlidersHorizontal,
  X,
  Pill
} from 'lucide-react';

export function DrugExplorer() {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('all');
  
  // Side-by-side comparison state
  const [compareList, setCompareList] = useState([]);
  const [compareProfiles, setCompareProfiles] = useState([]);
  const [compareLoading, setCompareLoading] = useState(false);

  const { addMedicine, selectMedicine } = useMedicine();
  const navigate = useNavigate();

  const categories = [
    { id: 'all', label: 'All Classes' },
    { id: 'nsaid', label: 'NSAID / Pain' },
    { id: 'cardio', label: 'Heart & Blood' },
    { id: 'diabetes', label: 'Diabetes' },
    { id: 'gi', label: 'Stomach & Acid' },
    { id: 'antibiotic', label: 'Antibiotics' },
  ];

  useEffect(() => {
    async function fetchResults() {
      setLoading(true);
      try {
        const data = await searchMedicines(query);
        setResults(data);
      } catch (e) {
        console.warn('Search error:', e);
      } finally {
        setLoading(false);
      }
    }
    fetchResults();
  }, [query]);

  useEffect(() => {
    async function loadCompareProfiles() {
      if (compareList.length === 0) {
        setCompareProfiles([]);
        return;
      }
      setCompareLoading(true);
      try {
        const profiles = await Promise.all(compareList.map(name => getMedicineProfile(name)));
        setCompareProfiles(profiles.filter(Boolean));
      } catch (e) {
        console.warn('Compare fetch error:', e);
      } finally {
        setCompareLoading(false);
      }
    }
    loadCompareProfiles();
  }, [compareList]);

  const toggleCompare = (name) => {
    setCompareList((prev) => {
      if (prev.includes(name)) {
        return prev.filter(n => n !== name);
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

  const filteredResults = results.filter((item) => {
    if (selectedCategory === 'all') return true;
    const cat = item.category.toLowerCase();
    if (selectedCategory === 'nsaid') return cat.includes('nsaid') || cat.includes('analgesic');
    if (selectedCategory === 'cardio') return cat.includes('anticoagulant') || cat.includes('statin') || cat.includes('blocker') || cat.includes('calcium');
    if (selectedCategory === 'diabetes') return cat.includes('antidiabetic') || cat.includes('biguanide');
    if (selectedCategory === 'gi') return cat.includes('proton pump') || cat.includes('gastric');
    if (selectedCategory === 'antibiotic') return cat.includes('antibacterial') || cat.includes('quinolone') || cat.includes('penicillin');
    return true;
  });

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
            Inspect reported adverse reactions, food & alcohol guidelines, and Stomach Guardian mucosal safety scores before adding to your regimen.
          </p>

          {/* Search bar */}
          <div className="relative mt-2">
            <Search className="w-4 h-4 text-[var(--text-muted)] absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
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
                <SlidersHorizontal className="w-4 h-4 text-[var(--text-primary)]" />
                <h3 className="font-serif text-[18px] font-bold text-[var(--text-primary)]">
                  Side-by-Side Comparison ({compareList.length}/3)
                </h3>
              </div>
              <button
                onClick={() => setCompareList([])}
                className="text-xs text-[var(--text-muted)] hover:text-[var(--text-primary)] flex items-center gap-1 cursor-pointer"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close</span>
              </button>
            </div>

            {compareLoading ? (
              <div className="h-20 flex items-center justify-center text-xs text-[var(--text-muted)]">
                Loading comparison pharmacology...
              </div>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {compareProfiles.map((p, idx) => (
                  <div key={idx} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[8px] p-3.5 flex flex-col gap-2.5">
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
                        <span className="metric text-sm text-[var(--severity-moderate)]">{p.gi_profile.stomach_health_score}/100</span>
                      </div>
                      <div>
                        <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Food Rule</span>
                        <span>{p.food_interactions[0]?.title || 'Take with water'}</span>
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

        {/* Results Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3.5">
          {filteredResults.map((item, idx) => {
            const isComparing = compareList.includes(item.name);
            return (
              <div
                key={idx}
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
                    <span className={`tag ${
                      item.stomach_risk_badge === 'High'
                        ? 'tag-danger'
                        : item.stomach_risk_badge === 'Moderate'
                        ? 'tag-warning'
                        : 'tag-success'
                    }`}>
                      {item.stomach_risk_badge} GI
                    </span>

                    {item.top_side_effects?.slice(0, 2).map((se, i) => (
                      <span key={i} className="tag">
                        {se}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 border-t border-[var(--border-default)]">
                  <button
                    onClick={() => toggleCompare(item.name)}
                    className={`btn-secondary flex-1 text-xs py-2 min-h-[40px] ${
                      isComparing ? 'border-[var(--accent)] font-bold' : ''
                    }`}
                  >
                    {isComparing ? 'Comparing ✓' : 'Compare'}
                  </button>

                  <button
                    onClick={() => handleAddAndGo(item.name, item.drug_type)}
                    className="btn-primary p-2 min-h-[40px] w-10 flex items-center justify-center rounded-[6px]"
                    title="Add to Basket"
                  >
                    <Plus className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>

        <div className="flex justify-center mt-4">
          <Disclaimer />
        </div>
      </main>

      <Footer />
    </div>
  );
}
