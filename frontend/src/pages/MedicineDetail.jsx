import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { Disclaimer } from '../components/Disclaimer';
import { IndiaBanNotice } from '../components/IndiaBanNotice';
import { getMedicineProfile } from '../lib/api';
import { useMedicine } from '../context/MedicineContext';
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  PlusIcon,
  ShieldIcon,
  WarningIcon,
  ClockIcon,
  FoodIcon,
  AlcoholIcon,
  PulseIcon,
  LayersIcon,
  CheckIcon,
} from './landing-icons';
import './app-editorial.css';

export function MedicineDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const { addMedicine } = useMedicine();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [added, setAdded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function loadData() {
      if (!name) return;
      setLoading(true);
      setError(null);
      try {
        const data = await getMedicineProfile(name);
        if (!cancelled) {
          setProfile(data);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err?.message || 'Could not load clinical monograph for this medicine.');
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    }
    loadData();
    return () => {
      cancelled = true;
    };
  }, [name]);

  const handleAddToBasket = () => {
    if (!profile) return;
    addMedicine(profile.name, profile.drug_type || 'otc');
    setAdded(true);
    setTimeout(() => {
      navigate('/app');
    }, 400);
  };

  const getFoodIcon = (type) => {
    switch (type) {
      case 'avoid_alcohol':
        return (
          <span className="w-7 h-7 border border-[#8a5300] bg-[#f4eee0] text-[#8a5300] flex items-center justify-center shrink-0 mt-0.5">
            <AlcoholIcon size={14} />
          </span>
        );
      case 'empty_stomach':
        return (
          <span className="w-7 h-7 border border-[#1a1a18] bg-[#f0ede1] text-[#1a1a18] flex items-center justify-center shrink-0 mt-0.5">
            <ClockIcon size={14} />
          </span>
        );
      case 'take_with_food':
        return (
          <span className="w-7 h-7 border border-[#2d4a22] bg-[#e8eee3] text-[#2d4a22] flex items-center justify-center shrink-0 mt-0.5">
            <FoodIcon size={14} />
          </span>
        );
      default:
        return (
          <span className="w-7 h-7 border border-[#8a5300] bg-[#f4eee0] text-[#8a5300] flex items-center justify-center shrink-0 mt-0.5">
            <WarningIcon size={14} />
          </span>
        );
    }
  };

  const giScore = profile?.gi_profile?.stomach_health_score;
  const giBarColor =
    giScore == null
      ? '#57534a'
      : giScore >= 60
      ? '#8b2500'
      : giScore >= 30
      ? '#8a5300'
      : '#2d4a22';

  const giTierTagClass =
    profile?.gi_profile?.risk_tier === 'high'
      ? 'ed-tag-crit'
      : profile?.gi_profile?.risk_tier === 'moderate'
      ? 'ed-tag-caut'
      : profile?.gi_profile?.risk_tier && profile.gi_profile.risk_tier !== 'unknown'
      ? 'ed-tag-safe'
      : '';

  return (
    <div className="ed-app min-h-screen flex flex-col bg-[#f8f6f0] text-[#1a1a18]">
      <Navbar />

      <main className="flex-1 pt-28 pb-20 px-4 sm:px-8 max-w-[1200px] mx-auto w-full">
        {/* Navigation Breadcrumb / Back button */}
        <div className="mb-6 flex items-center justify-between gap-4 flex-wrap">
          <button
            type="button"
            onClick={() => navigate(-1)}
            className="ed-btn-outline text-[11px] py-2 px-3.5 min-h-[38px]"
          >
            <ArrowLeftIcon size={14} />
            <span>Back</span>
          </button>

          <Link
            to="/explorer"
            className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a18] hover:text-[#8b2500] hover:underline underline-offset-4 inline-flex items-center gap-1.5"
          >
            <span>Browse all medicines</span>
            <ArrowRightIcon size={13} />
          </Link>
        </div>

        {/* Loading state */}
        {loading && (
          <div className="ed-sheet p-6" role="status" aria-live="polite">
            <p className="font-ibm-mono text-xs uppercase tracking-[0.09em] text-[#1a1a18] font-medium">
              READING THE LABEL
            </p>
          </div>
        )}

        {/* Error state */}
        {!loading && error && (
          <div className="ed-notice-crit p-5 flex items-start gap-3 mb-6" role="alert">
            <div className="w-8 h-8 bg-[#f8f6f0] border border-[#8b2500] text-[#8b2500] flex items-center justify-center shrink-0 mt-0.5">
              <WarningIcon size={16} />
            </div>
            <div className="flex-1">
              <h3 className="font-newsreader text-[19px] font-semibold text-[#1a1a18] leading-snug">
                Could not load this medicine
              </h3>
              <p className="text-xs sm:text-sm mt-1 text-[#2d2b26] font-ibm-serif leading-relaxed">
                {error}
              </p>
              <button
                type="button"
                onClick={() => window.location.reload()}
                className="ed-btn-outline text-[11px] py-1.5 px-3.5 mt-3 min-h-[36px]"
              >
                Retry
              </button>
            </div>
          </div>
        )}

        {/* Monograph Content */}
        {!loading && profile && (
          <div className="flex flex-col gap-6">
            {/* Ruled Registry Entry Header */}
            <header className="border-t-[3px] border-t-[#1a1a18] border-b border-[#b7b09d] pt-5 pb-5 flex flex-col gap-5">
              <div className="flex flex-col md:flex-row md:items-start justify-between gap-5">
                <div className="flex flex-col gap-2 min-w-0">
                  <p className="font-ibm-mono text-[11px] uppercase tracking-[0.09em] text-[#8b2500] font-medium">
                    {profile.drug_type === 'prescription' ? 'Prescription Only' : 'Over The Counter'}
                    {profile.category ? ` · ${profile.category}` : ''}
                    {profile.is_fdc ? ' · Combination medicine' : ''}
                  </p>

                  <h1 className="font-newsreader text-[34px] sm:text-[42px] font-medium text-[#1a1a18] leading-[1.08] tracking-[-0.015em]">
                    {profile.name}
                  </h1>
                </div>

                <div className="flex flex-col sm:flex-row md:flex-col gap-2.5 shrink-0 md:pt-1">
                  <button
                    type="button"
                    onClick={handleAddToBasket}
                    disabled={added}
                    className={
                      added
                        ? 'inline-flex items-center justify-center gap-2 px-[18px] py-[10px] border border-[#2d4a22] bg-[#2d4a22] text-[#f8f6f0] font-ibm-mono text-[0.72rem] tracking-[0.08em] uppercase font-medium min-h-[44px] cursor-default whitespace-nowrap'
                        : 'ed-btn-ink min-h-[44px] whitespace-nowrap'
                    }
                  >
                    {added ? (
                      <>
                        <CheckIcon size={15} />
                        <span>Added to Basket</span>
                      </>
                    ) : (
                      <>
                        <PlusIcon size={15} />
                        <span>Add to Basket &amp; Check</span>
                      </>
                    )}
                  </button>
                </div>
              </div>

              {/* Ruled Compound & Brand Rows */}
              <dl className="border-t border-[#d5cfc0] divide-y divide-[#d5cfc0]">
                <div className="py-2.5 grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-1 sm:gap-4 items-baseline">
                  <dt className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a]">
                    Main ingredient (generic name):
                  </dt>
                  <dd className="font-ibm-serif text-sm font-medium text-[#1a1a18] capitalize">
                    {profile.generic_name}
                  </dd>
                </div>

                {profile.brand_names && profile.brand_names.length > 0 && (
                  <div className="py-2.5 grid grid-cols-1 sm:grid-cols-[240px_1fr] gap-1 sm:gap-4 items-baseline">
                    <dt className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a]">
                      Also sold as:
                    </dt>
                    <dd className="font-ibm-serif text-sm text-[#2d2b26] leading-relaxed">
                      {profile.brand_names.slice(0, 8).join(', ')}
                    </dd>
                  </div>
                )}
              </dl>

              {profile.india_ban?.matched && (
                <IndiaBanNotice info={profile.india_ban} />
              )}
            </header>

            {/* FDC Notice if applicable */}
            {profile.is_fdc && (
              <div className="ed-notice-caut p-4 flex items-start gap-3" role="status">
                <div className="w-7 h-7 bg-[#f8f6f0] border border-[#8a5300] text-[#8a5300] flex items-center justify-center shrink-0 mt-0.5">
                  <LayersIcon size={15} />
                </div>
                <div className="flex-1">
                  <h2 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] leading-snug">
                    Combination medicine
                  </h2>
                  <p className="text-xs sm:text-[13px] text-[#2d2b26] mt-1 font-ibm-serif leading-relaxed">
                    {profile.fdc_warning || 'This medicine has more than one active ingredient in one tablet.'}
                  </p>
                  {profile.fdc_ingredients?.length > 0 && (
                    <div className="flex items-center gap-1.5 mt-2.5 flex-wrap">
                      <span className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] font-semibold text-[#1a1a18] mr-1">
                        Ingredients checked:
                      </span>
                      {profile.fdc_ingredients.map((ing) => (
                        <span key={ing} className="ed-tag ed-tag-caut capitalize">
                          {ing}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Grid of Clinical Dimensions */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 items-start">
              {/* Gastrointestinal Safety Profile */}
              <section className="ed-sheet p-5 flex flex-col gap-4" aria-label="Stomach safety">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#b7b09d]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0">
                      <ShieldIcon size={15} />
                    </div>
                    <h2 className="font-newsreader font-semibold text-[20px] text-[#1a1a18] leading-tight">
                      Stomach safety
                    </h2>
                  </div>
                  <span className={`ed-tag ${giTierTagClass}`}>
                    {profile.gi_profile?.risk_tier ? profile.gi_profile.risk_tier.toUpperCase() : 'UNKNOWN'} TIER
                  </span>
                </div>

                <div className="flex items-baseline justify-between gap-4 py-1">
                  <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a] font-medium">
                    Stomach stress score
                  </span>
                  <span className="font-newsreader text-2xl font-semibold text-[#1a1a18] tabular-nums">
                    {giScore != null ? (
                      <>
                        {giScore}
                        <span className="font-ibm-mono text-xs font-normal text-[#57534a] ml-0.5">/100</span>
                      </>
                    ) : (
                      <span className="text-base font-medium text-[#57534a]">Not available</span>
                    )}
                  </span>
                </div>

                <div className="w-full bg-[#ece7d5] h-2 border border-[#b7b09d]">
                  <div
                    className="h-full transition-all duration-300"
                    style={{
                      width: `${Math.min(100, giScore ?? 0)}%`,
                      backgroundColor: giBarColor,
                    }}
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 border border-[#b7b09d] bg-[#f8f6f0] divide-y sm:divide-y-0 sm:divide-x divide-[#d5cfc0] text-center">
                  <div className="p-2.5">
                    <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
                      Feeling sick (nausea)
                    </span>
                    <strong className="font-newsreader text-[15px] font-semibold capitalize text-[#1a1a18] mt-0.5 block">
                      {profile.gi_profile?.nausea_risk || 'Low'}
                    </strong>
                  </div>
                  <div className="p-2.5">
                    <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
                      Ulcer risk
                    </span>
                    <strong className="font-newsreader text-[15px] font-semibold capitalize text-[#1a1a18] mt-0.5 block">
                      {profile.gi_profile?.ulcer_risk || 'Low'}
                    </strong>
                  </div>
                  <div className="p-2.5">
                    <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
                      Bleeding risk
                    </span>
                    <strong className="font-newsreader text-[15px] font-semibold capitalize text-[#1a1a18] mt-0.5 block">
                      {profile.gi_profile?.bleeding_risk || 'None'}
                    </strong>
                  </div>
                </div>

                {profile.gi_profile?.recommendations?.length > 0 && (
                  <div className="space-y-2 pt-2 border-t border-[#d5cfc0]">
                    <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] font-medium text-[#1a1a18] block">
                      How to protect your stomach:
                    </span>
                    <ul className="text-xs text-[#2d2b26] font-ibm-serif space-y-1.5 leading-relaxed">
                      {profile.gi_profile.recommendations.map((rec, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-ibm-mono text-[#8b2500] shrink-0">-</span>
                          <span>{rec}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>

              {/* Food & Timing Schedule Considerations */}
              <section className="ed-sheet p-5 flex flex-col gap-4" aria-label="Food and timing rules">
                <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#b7b09d]">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0">
                      <FoodIcon size={15} />
                    </div>
                    <h2 className="font-newsreader font-semibold text-[20px] text-[#1a1a18] leading-tight">
                      Food and timing rules
                    </h2>
                  </div>
                  <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a]">
                    {profile.food_interactions?.length || 0} Rule{(profile.food_interactions?.length || 0) !== 1 ? 's' : ''}
                  </span>
                </div>

                {profile.food_interactions && profile.food_interactions.length > 0 ? (
                  <div className="border border-[#b7b09d] bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
                    {profile.food_interactions.map((food, idx) => (
                      <div
                        key={idx}
                        className="p-3.5 flex items-start gap-3"
                      >
                        {getFoodIcon(food.type)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center justify-between gap-2 flex-wrap">
                            <h3 className="font-newsreader font-semibold text-[16px] text-[#1a1a18] leading-snug">
                              {food.title}
                            </h3>
                            <span className={`ed-tag ${
                              food.severity === 'critical'
                                ? 'ed-tag-crit'
                                : food.severity === 'warning'
                                ? 'ed-tag-caut'
                                : 'ed-tag-safe'
                            }`}>
                              {food.severity}
                            </span>
                          </div>
                          <p className="text-xs text-[#2d2b26] mt-1 font-ibm-serif leading-relaxed">
                            {food.description}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-xs text-[#2d2b26] bg-[#f8f6f0] border border-[#d5cfc0] p-3.5 font-ibm-serif leading-relaxed">
                    No special food rules for this medicine. You can take it with water, unless your doctor has told you otherwise.
                  </p>
                )}

                {profile.lifestyle_warnings?.length > 0 && (
                  <div className="pt-2 border-t border-[#d5cfc0] space-y-2">
                    <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] font-medium text-[#1a1a18] block">
                      Everyday cautions:
                    </span>
                    <ul className="text-xs text-[#2d2b26] font-ibm-serif space-y-1.5 leading-relaxed">
                      {profile.lifestyle_warnings.map((warn, i) => (
                        <li key={i} className="flex items-start gap-2">
                          <span className="font-ibm-mono text-[#8a5300] shrink-0">-</span>
                          <span>{warn}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </section>
            </div>

            {/* Side Effects Frequency Ledger */}
            <section className="ed-sheet p-5 flex flex-col gap-4" aria-label="Side effects">
              <div className="flex items-center justify-between gap-3 flex-wrap pb-3 border-b border-[#b7b09d]">
                <div className="flex items-center gap-2.5">
                  <div className="w-7 h-7 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0">
                    <PulseIcon size={15} />
                  </div>
                  <h2 className="font-newsreader font-semibold text-[20px] text-[#1a1a18] leading-tight">
                    Side effects
                  </h2>
                </div>
                <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#57534a]">
                  From the official FDA label
                </span>
              </div>

              {profile.side_effects && profile.side_effects.length > 0 ? (
                <>
                  {/* Desktop Ruled Ledger Table */}
                  <div className="hidden md:block overflow-x-auto border border-[#b7b09d] bg-[#f8f6f0]">
                    <table className="ed-docket-table">
                      <thead>
                        <tr>
                          <th scope="col">Category</th>
                          <th scope="col">Side effect</th>
                          <th scope="col">Severity</th>
                          <th scope="col">Frequency</th>
                        </tr>
                      </thead>
                      <tbody className="font-ibm-serif text-sm">
                        {profile.side_effects.map((se, i) => (
                          <tr key={i}>
                            <td className="font-ibm-mono text-[11px] uppercase tracking-[0.06em] text-[#57534a]">
                              {se.category || 'General'}
                            </td>
                            <td className="font-newsreader text-[16px] font-semibold text-[#1a1a18]">
                              {se.effect}
                            </td>
                            <td>
                              <span className={`ed-tag ${
                                se.severity === 'severe'
                                  ? 'ed-tag-crit'
                                  : se.severity === 'moderate'
                                  ? 'ed-tag-caut'
                                  : 'ed-tag-safe'
                              }`}>
                                {se.severity}
                              </span>
                            </td>
                            <td className="font-ibm-mono text-xs text-[#2d2b26] tabular-nums">
                              {se.frequency_percentage || se.frequency}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* Mobile Ruled Ledger Rows */}
                  <div className="md:hidden border border-[#b7b09d] bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
                    {profile.side_effects.map((se, i) => (
                      <div key={i} className="p-3.5 flex flex-col gap-1.5">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] font-medium">
                            {se.category || 'General'}
                          </span>
                          <span className={`ed-tag ${
                            se.severity === 'severe'
                              ? 'ed-tag-crit'
                              : se.severity === 'moderate'
                              ? 'ed-tag-caut'
                              : 'ed-tag-safe'
                          }`}>
                            {se.severity}
                          </span>
                        </div>
                        <h3 className="font-newsreader font-semibold text-[16px] text-[#1a1a18] leading-snug">
                          {se.effect}
                        </h3>
                        <span className="font-ibm-mono text-[11px] text-[#57534a]">
                          Frequency: {se.frequency_percentage || se.frequency}
                        </span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <p className="text-xs text-[#2d2b26] bg-[#f8f6f0] border border-[#d5cfc0] p-3.5 font-ibm-serif leading-relaxed">
                  No common side effects are listed for this medicine in its official label. The medicine&apos;s package leaflet has the full list.
                </p>
              )}
            </section>
          </div>
        )}

        {/* Disclaimer */}
        <div className="mt-12 flex justify-center">
          <Disclaimer />
        </div>
      </main>

      <Footer />
    </div>
  );
}

export default MedicineDetail;
