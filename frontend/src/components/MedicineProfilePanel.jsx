import React, { useState } from 'react';
import { useMedicine } from '../context/MedicineContext';
import {
  Pill,
  Utensils,
  FileText,
  Info,
  Clock,
  Wine,
  Citrus,
  Milk,
  Car,
  Activity,
  Flame,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  AlertTriangle,
  HelpCircle,
  X
} from 'lucide-react';

import { SkeletonProfile } from './SkeletonCard';

/**
 * Maps a GIProfile.risk_tier to a tag class.
 *
 * `unknown` is a real tier the backend emits (see the unknown_fallback branch of
 * knowledge_base.get_medicine_profile) and it must NOT share a branch with
 * `gentle`. The previous ternary had no `unknown` case, so an unverified compound
 * -- the one situation where the user most needs a caution signal -- was rendered
 * in reassuring green.
 */
function giTierTagClass(tier) {
  if (tier === 'high') return 'tag-danger';
  if (tier === 'moderate') return 'tag-warning';
  if (tier === 'gentle') return 'tag-success';
  return 'tag-warning';
}

/**
 * A GI score is only meaningful alongside a known tier. The unknown_fallback
 * profile carries stomach_health_score: 0, which rendered as a flawless "0/100" --
 * indistinguishable from a genuinely gentle drug when it actually means "no data".
 */
function formatGiScore(score, tier) {
  if (tier === 'unknown' || typeof score !== 'number' || Number.isNaN(score)) return null;
  return score;
}

function MedicineProfilePanelBase({ onCloseMobile }) {
  const {
    selectedMedicineName,
    selectedProfile,
    profileLoading,
    profileError,
    personalNotes,
    savePersonalNote,
    results
  } = useMedicine();

  const [activeTab, setActiveTab] = useState('overview');
  const [showAllSideEffects, setShowAllSideEffects] = useState(false);

  if (!selectedMedicineName) {
    return (
      <div className="card flex flex-col items-center justify-center text-center min-h-[340px]">
        <div className="w-12 h-12 rounded-[6px] bg-[var(--bg-elevated)] border border-[var(--border-default)] flex items-center justify-center text-[var(--text-muted)] mb-3">
          <Pill className="w-6 h-6" aria-hidden="true" />
        </div>
        <h3 className="font-serif text-[20px] font-bold text-[var(--text-primary)] mb-1">
          Contextual Profile
        </h3>
        <p className="text-sm text-[var(--text-muted)] max-w-xs font-sans">
          Select any medicine in your basket or interaction graph to inspect side effects, food rules, and stomach impact.
        </p>
      </div>
    );
  }

  if (profileLoading) {
    return <SkeletonProfile />;
  }

  // A failed fetch is reported as a failure. This panel previously substituted a
  // hardcoded profile -- `risk_tier: 'gentle'`, `stomach_health_score: 25`, empty
  // side-effect and food-interaction lists -- under the real medicine's name, so a
  // dropped request rendered as a confident, verified-looking all-clear. There is
  // no safe invented value for any of these fields.
  if (profileError || !selectedProfile) {
    return (
      <div className="card flex flex-col gap-3.5">
        <div className="flex items-start justify-between gap-2 border-b border-[var(--border-default)] pb-3.5">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-[6px] bg-[rgba(217,119,6,0.08)] border border-[rgba(217,119,6,0.2)] text-[var(--severity-moderate)] flex items-center justify-center">
              <HelpCircle className="w-5 h-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="font-serif text-[24px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">
                {selectedMedicineName}
              </h2>
              <p className="text-xs text-[var(--text-muted)] mt-0.5 font-sans">Profile unavailable</p>
            </div>
          </div>
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Close medicine profile"
              className="lg:hidden p-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>

        <div className="alert-warning flex items-start gap-2.5" role="alert">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-bold leading-tight">
              No pharmacology data loaded for this medicine
            </p>
            <p className="text-xs leading-relaxed">
              {profileError || 'The profile request did not complete.'}
            </p>
            <p className="text-xs leading-relaxed">
              This is not a statement that the medicine is safe. Side effects, food
              rules and stomach impact are all unknown here — reselect the medicine to
              retry, and confirm with a pharmacist before relying on any part of this
              screen for this drug.
            </p>
          </div>
        </div>
      </div>
    );
  }

  const profile = selectedProfile;

  // Every array and nested object below is read defensively. `gi_profile` is
  // required by the MedicineProfileResponse model, but a partial payload from a
  // proxy, an older cached response, or a future model change would otherwise
  // throw on `profile.gi_profile.risk_tier` and take out the whole panel.
  const gi = profile.gi_profile || {};
  const giTier = gi.risk_tier || 'unknown';
  const giScore = formatGiScore(gi.stomach_health_score, giTier);
  const giRecommendations = gi.recommendations || [];
  const sideEffects = profile.side_effects || [];
  const foodInteractions = profile.food_interactions || [];
  const lifestyleWarnings = profile.lifestyle_warnings || [];
  const brandNames = profile.brand_names || [];

  // The backend flags a profile it could not verify with data_source
  // "unknown_fallback" plus a disclaimer string. Neither was rendered, so an
  // unverified compound was presented with the same authority as a curated one.
  const isUnverified = profile.data_source === 'unknown_fallback' || giTier === 'unknown';

  const noteText = personalNotes[selectedMedicineName.toLowerCase()] || '';
  const amplifiedEffects = (results?.aggregated_side_effects || []).map(a => a.effect.toLowerCase());

  const isRx = profile.drug_type === 'prescription';
  const isOTC = profile.drug_type === 'otc';

  const TABS = [
    { id: 'overview', label: 'Overview', icon: Info },
    { id: 'sideEffects', label: `Side Fx (${sideEffects.length})`, icon: Activity },
    { id: 'food', label: 'Food & Life', icon: Utensils },
    { id: 'gi', label: 'Stomach', icon: Flame },
    { id: 'notes', label: 'Notes', icon: FileText },
  ];

  return (
    <div className="card flex flex-col gap-4">
      {/* Top Header */}
      <div className="flex items-start justify-between gap-2 border-b border-[var(--border-default)] pb-3.5">
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-[6px] flex items-center justify-center border ${
            isOTC
              ? 'bg-[rgba(5,150,105,0.08)] border-[rgba(5,150,105,0.2)] text-[var(--severity-low)]'
              : isRx
              ? 'bg-[rgba(2,132,199,0.08)] border-[rgba(2,132,199,0.2)] text-[var(--severity-info)]'
              : 'bg-[rgba(124,58,237,0.08)] border-[rgba(124,58,237,0.2)] text-[#7C3AED]'
          }`}>
            <Pill className="w-5 h-5" aria-hidden="true" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="font-serif text-[24px] font-bold text-[var(--text-primary)] tracking-tight leading-tight">
                {profile.name}
              </h2>
              <span className={`tag ${
                isOTC ? 'tag-success' : isRx ? 'text-[#0284C7] bg-[#0284C7]/10 border-[#0284C7]/20' : 'text-[#7C3AED] bg-[#7C3AED]/10 border-[#7C3AED]/20'
              }`}>
                {profile.drug_type?.toUpperCase() || 'RX'}
              </span>
            </div>
            <p className="text-xs text-[var(--text-muted)] mt-0.5 font-sans">
              Generic: <span className="text-[var(--text-secondary)] font-medium capitalize">{profile.generic_name}</span>
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* GI Risk Tag */}
          <div className="text-right">
            <span className="text-xs text-[var(--text-muted)] block uppercase font-bold tracking-wider">Stomach</span>
            <span className={`tag mt-0.5 ${giTierTagClass(giTier)}`}>
              {giTier.toUpperCase()}
            </span>
          </div>

          {/* Close button on mobile/tablet */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              aria-label="Close medicine profile"
              className="lg:hidden p-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      {/* Unverified-data caveat. Rendered above the tabs so it is seen before any
          of the numbers it qualifies. */}
      {isUnverified && (
        <div className="alert-warning flex items-start gap-2.5" role="status">
          <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" aria-hidden="true" />
          <div className="space-y-1">
            <p className="text-sm font-bold leading-tight">Unverified compound — data is incomplete</p>
            <p className="text-xs leading-relaxed">
              {profile.disclaimer ||
                'This medicine was not found in the curated knowledge base or the FDA label index. Empty side-effect and food-interaction lists below mean "not known here", not "none exist".'}
            </p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Medicine profile sections"
        className="flex bg-[var(--bg-elevated)] p-1 rounded-[6px] border border-[var(--border-default)] gap-1 overflow-x-auto"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              role="tab"
              id={`profile-tab-${tab.id}`}
              aria-selected={isActive}
              aria-controls={`profile-panel-${tab.id}`}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-[4px] whitespace-nowrap min-h-[36px] transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--text-inverse)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#E2E8F0]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" aria-hidden="true" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content: OVERVIEW */}
      {activeTab === 'overview' && (
        <div
          role="tabpanel"
          id="profile-panel-overview"
          aria-labelledby="profile-tab-overview"
          className="flex flex-col gap-3"
        >
          <p className="text-body text-[var(--text-secondary)] bg-[var(--bg-elevated)] p-3 rounded-[6px] border border-[var(--border-default)]">
            {profile.description || 'Clinical overview of pharmacological actions and prescribing safety warnings.'}
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Class</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 line-clamp-1">
                {profile.category || 'Unclassified'}
              </span>
            </div>

            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Stomach Score</span>
              <span className="metric text-sm text-[var(--severity-moderate)] mt-0.5 block">
                {giScore === null ? 'No data' : `${giScore}/100`}
              </span>
            </div>

            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Common Side Effects</span>
              <span className="metric text-sm text-[var(--text-primary)] mt-0.5 block">
                {sideEffects.filter(s => s.frequency === 'very_common' || s.frequency === 'common').length} reported
              </span>
            </div>

            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Food Guidance</span>
              <span className="metric text-sm text-[var(--text-primary)] mt-0.5 block">
                {foodInteractions.length} active rules
              </span>
            </div>
          </div>

          {brandNames.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-xs text-[var(--text-muted)] font-bold">Equivalent Brands:</span>
              <div className="flex flex-wrap gap-1.5">
                {/* Keyed on the brand name rather than the bare index. The trailing
                    index is a uniqueness tiebreaker only -- these lists come
                    straight from an FDA label and can legitimately repeat a
                    string, and duplicate sibling keys are their own bug. */}
                {brandNames.map((b, idx) => (
                  <span key={`${b}-${idx}`} className="tag font-serif text-[13px] font-semibold capitalize">
                    {b}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Tab Content: SIDE EFFECTS */}
      {activeTab === 'sideEffects' && (
        <div
          role="tabpanel"
          id="profile-panel-sideEffects"
          aria-labelledby="profile-tab-sideEffects"
          className="flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-0.5">
            <span>Reported Adverse Reactions</span>
            <span>Frequency</span>
          </div>

          {sideEffects.length === 0 ? (
            <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-3 leading-relaxed">
              No side effects are recorded for this medicine in the available data. That
              is an absence of data, not evidence that none occur — check the printed
              leaflet.
            </p>
          ) : (
            <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
              {(showAllSideEffects ? sideEffects : sideEffects.slice(0, 5)).map((se, idx) => {
                const isAmplified = amplifiedEffects.some(ae => se.effect.toLowerCase().includes(ae) || ae.includes(se.effect.toLowerCase()));
                let barWidth = '65%';
                let barColor = 'var(--severity-moderate)';
                let freqLabel = 'Common (1-10%)';

                if (se.frequency === 'very_common') {
                  barWidth = '90%';
                  barColor = 'var(--severity-high)';
                  freqLabel = 'Very Common (>10%)';
                } else if (se.frequency === 'uncommon') {
                  barWidth = '35%';
                  barColor = 'var(--severity-info)';
                  freqLabel = 'Uncommon (0.1-1%)';
                } else if (se.frequency === 'rare') {
                  barWidth = '15%';
                  barColor = 'var(--text-muted)';
                  freqLabel = 'Rare (<0.1%)';
                }

                return (
                  <div
                    // Effect name first, index only as a uniqueness tiebreaker: the
                    // key now tracks the effect rather than the slot, so toggling
                    // "Show all" no longer hands one effect's Amplified highlight
                    // and bar width to a different effect in the same position.
                    key={`${se.effect}-${idx}`}
                    className={`p-2.5 rounded-[6px] border ${
                      isAmplified
                        ? 'bg-[rgba(220,38,38,0.08)] border-[rgba(220,38,38,0.3)]'
                        : 'bg-[var(--bg-elevated)] border-[var(--border-default)]'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-semibold text-[var(--text-primary)]">{se.effect}</span>
                        {isAmplified && (
                          <span className="tag tag-danger">
                            Amplified
                          </span>
                        )}
                      </div>
                      <span className="metric text-xs text-[var(--text-muted)]">{se.frequency_percentage}</span>
                    </div>

                    <div className="w-full h-1.5 bg-[var(--border-default)] rounded-full overflow-hidden mb-1" aria-hidden="true">
                      <div
                        className="h-full rounded-full"
                        style={{ width: barWidth, backgroundColor: barColor }}
                      />
                    </div>

                    <div className="flex items-center justify-between text-xs text-[var(--text-muted)]">
                      <span>{freqLabel}</span>
                      <span className="capitalize">{se.category || 'General'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {sideEffects.length > 5 && (
            <button
              onClick={() => setShowAllSideEffects(!showAllSideEffects)}
              aria-expanded={showAllSideEffects}
              className="text-xs text-[var(--text-primary)] font-semibold hover:underline flex items-center justify-center gap-1 cursor-pointer py-1.5 min-h-[36px]"
            >
              <span>{showAllSideEffects ? 'Show Top Reported' : `Show all ${sideEffects.length} effects`}</span>
              {showAllSideEffects
                ? <ChevronUp className="w-3.5 h-3.5" aria-hidden="true" />
                : <ChevronDown className="w-3.5 h-3.5" aria-hidden="true" />}
            </button>
          )}
        </div>
      )}

      {/* Tab Content: FOOD & LIFESTYLE */}
      {activeTab === 'food' && (
        <div
          role="tabpanel"
          id="profile-panel-food"
          aria-labelledby="profile-tab-food"
          className="flex flex-col gap-2.5"
        >
          {foodInteractions.length === 0 && lifestyleWarnings.length === 0 && (
            <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-3 leading-relaxed">
              No food, alcohol or lifestyle rules are recorded for this medicine. An
              empty list here means none were found in the available data, not that
              none apply.
            </p>
          )}

          {foodInteractions.map((fi, idx) => (
            // `type` is the rule's identity in the backend payload (alcohol,
            // grapefruit, dairy, empty_stomach ...); the index is a tiebreaker in
            // case a label yields two rules of the same type.
            <div key={`${fi.type || fi.title}-${idx}`} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-3 flex items-start gap-2.5">
              <div className={`w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0 ${
                fi.severity === 'critical'
                  ? 'bg-[rgba(220,38,38,0.15)] text-[var(--severity-high)]'
                  : 'bg-[rgba(217,119,6,0.15)] text-[var(--severity-moderate)]'
              }`} aria-hidden="true">
                {/* `type` is optional on the payload; ?? '' keeps .includes() from
                    throwing on a rule that omits it. */}
                {(fi.type ?? '').includes('alcohol') ? <Wine className="w-4 h-4" /> :
                 (fi.type ?? '').includes('grapefruit') ? <Citrus className="w-4 h-4" /> :
                 (fi.type ?? '').includes('dairy') ? <Milk className="w-4 h-4" /> :
                 (fi.type ?? '').includes('empty') ? <Clock className="w-4 h-4" /> :
                 <Utensils className="w-4 h-4" />}
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <h4 className="text-sm font-semibold text-[var(--text-primary)]">{fi.title}</h4>
                  <span className={`tag ${fi.severity === 'critical' ? 'tag-danger' : 'tag-warning'}`}>
                    {fi.severity}
                  </span>
                </div>
                <p className="text-xs text-[var(--text-secondary)] mt-0.5 leading-normal">
                  {fi.description}
                </p>
              </div>
            </div>
          ))}

          {lifestyleWarnings.map((lw, idx) => (
            <div key={`${lw}-${idx}`} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5 flex items-center gap-2">
              <Car className="w-4 h-4 text-[var(--text-primary)] shrink-0" aria-hidden="true" />
              <span className="text-xs text-[var(--text-secondary)]">{lw}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: STOMACH */}
      {activeTab === 'gi' && (
        <div
          role="tabpanel"
          id="profile-panel-gi"
          aria-labelledby="profile-tab-gi"
          className="flex flex-col gap-3"
        >
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Stomach Health Score</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="metric text-2xl text-[var(--text-primary)]">
                  {giScore === null ? '—' : giScore}
                </span>
                <span className="text-xs text-[var(--text-muted)]">
                  {giScore === null ? 'no GI data for this medicine' : '/ 100 GI Load'}
                </span>
              </div>
              <span className={`tag mt-1 ${giTierTagClass(giTier)}`}>
                {giTier} load
              </span>
            </div>

            <div className="w-10 h-10 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--severity-moderate)]" aria-hidden="true">
              <Flame className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[var(--bg-elevated)] p-2.5 rounded-[6px] border border-[var(--border-default)]">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Nausea Risk</span>
              {/* Explicit 'unknown' rather than a blank: these three fields were
                  absent from the old client-side fallback object, and React renders
                  undefined as nothing -- so the label sat above empty space, which
                  reads as "no risk". */}
              <span className="font-semibold text-[var(--text-primary)] capitalize mt-0.5 block">{gi.nausea_risk || 'unknown'}</span>
            </div>
            <div className="bg-[var(--bg-elevated)] p-2.5 rounded-[6px] border border-[var(--border-default)]">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Bleeding / Ulcer</span>
              <span className="font-semibold text-[var(--text-primary)] capitalize mt-0.5 block">{gi.bleeding_risk || 'unknown'}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--text-muted)] font-bold">Clinical Stomach Guidance:</span>
            {giRecommendations.length === 0 ? (
              <p className="text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] p-2.5 rounded-[6px] border border-[var(--border-default)] leading-relaxed">
                No stomach-specific guidance is available for this medicine.
              </p>
            ) : (
              giRecommendations.map((rec, idx) => (
                <div key={`${rec.slice(0, 40)}-${idx}`} className="flex items-start gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] p-2.5 rounded-[6px] border border-[var(--border-default)]">
                  <CheckCircle2 className="w-4 h-4 text-[var(--severity-low)] shrink-0 mt-0.5" aria-hidden="true" />
                  <span>{rec}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* Tab Content: NOTES */}
      {activeTab === 'notes' && (
        <div
          role="tabpanel"
          id="profile-panel-notes"
          aria-labelledby="profile-tab-notes"
          className="flex flex-col gap-2.5"
        >
          <div className="flex items-center justify-between">
            <label htmlFor="medicine-personal-note" className="text-xs font-semibold text-[var(--text-primary)]">
              Personal Notes for {profile.name}
            </label>
            <span className="text-xs text-[var(--text-muted)]">Auto-saved</span>
          </div>

          <textarea
            id="medicine-personal-note"
            value={noteText}
            onChange={(e) => savePersonalNote(profile.name, e.target.value)}
            placeholder="e.g. Prescribed by Dr. Smith for joint pain. Take with dinner..."
            rows={5}
            className="w-full bg-[var(--bg-elevated)] border border-[var(--border-default)] focus:border-[var(--border-hover)] focus:bg-[var(--bg-surface)] rounded-[6px] p-3 text-sm text-[var(--text-primary)] placeholder-[var(--text-muted)] outline-none resize-none transition-colors"
          />

          <p className="text-xs text-[var(--text-muted)]">
            Notes are included in your exportable Doctor's Safety Summary report.
          </p>
        </div>
      )}
    </div>
  );
}

/**
 * Memoised because this panel is one of the most expensive trees in the app (five
 * tab bodies, a scrolling side-effect list) and it sits as a sibling of the basket
 * and the interaction graph inside AppInterface. Its only prop is the stable
 * `onCloseMobile` callback, so without memo every keystroke in the medicine input
 * re-rendered the whole panel.
 *
 * Note this does not memoise away context updates: useMedicine() still re-renders
 * on any context change. It removes the parent-render path only.
 */
export const MedicineProfilePanel = React.memo(MedicineProfilePanelBase);
