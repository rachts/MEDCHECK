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
  X
} from 'lucide-react';

export function MedicineProfilePanel({ onCloseMobile }) {
  const { 
    selectedMedicineName, 
    selectedProfile, 
    profileLoading,
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
          <Pill className="w-6 h-6" />
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
    return (
      <div className="card flex flex-col gap-3 animate-pulse min-h-[380px]">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-[6px] bg-[var(--bg-elevated)]" />
          <div className="flex-1">
            <div className="h-5 w-32 bg-[var(--bg-elevated)] rounded mb-1.5" />
            <div className="h-3.5 w-20 bg-[var(--bg-elevated)]/60 rounded" />
          </div>
        </div>
        <div className="h-8 w-full bg-[var(--bg-elevated)]/40 rounded-[6px] mt-1" />
        <div className="grid grid-cols-2 gap-2 mt-1">
          <div className="h-16 bg-[var(--bg-elevated)]/30 rounded-[6px]" />
          <div className="h-16 bg-[var(--bg-elevated)]/30 rounded-[6px]" />
        </div>
        <div className="h-28 bg-[var(--bg-elevated)]/20 rounded-[6px] mt-1" />
      </div>
    );
  }

  const profile = selectedProfile || {
    name: selectedMedicineName,
    generic_name: selectedMedicineName.toLowerCase(),
    category: 'Prescription Medication',
    drug_type: 'prescription',
    dosage_forms: ['Oral Tablet'],
    description: 'Clinical pharmacological intelligence indexed from FDA prescribing data.',
    side_effects: [],
    food_interactions: [],
    gi_profile: { stomach_health_score: 25, risk_tier: 'gentle', recommendations: [] },
    lifestyle_warnings: []
  };

  const noteText = personalNotes[selectedMedicineName.toLowerCase()] || '';
  const amplifiedEffects = (results?.aggregated_side_effects || []).map(a => a.effect.toLowerCase());

  const isRx = profile.drug_type === 'prescription';
  const isOTC = profile.drug_type === 'otc';

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
            <Pill className="w-5 h-5" />
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
            <span className={`tag mt-0.5 ${
              profile.gi_profile.risk_tier === 'high'
                ? 'tag-danger'
                : profile.gi_profile.risk_tier === 'moderate'
                ? 'tag-warning'
                : 'tag-success'
            }`}>
              {profile.gi_profile.risk_tier?.toUpperCase() || 'GENTLE'}
            </span>
          </div>

          {/* Close button on mobile/tablet */}
          {onCloseMobile && (
            <button
              onClick={onCloseMobile}
              className="lg:hidden p-1.5 rounded-[4px] bg-[var(--bg-elevated)] hover:bg-[#E2E8F0] text-[var(--text-muted)] hover:text-[var(--text-primary)] transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex bg-[var(--bg-elevated)] p-1 rounded-[6px] border border-[var(--border-default)] gap-1 overflow-x-auto">
        {[
          { id: 'overview', label: 'Overview', icon: Info },
          { id: 'sideEffects', label: `Side Fx (${profile.side_effects?.length || 0})`, icon: Activity },
          { id: 'food', label: 'Food & Life', icon: Utensils },
          { id: 'gi', label: 'Stomach', icon: Flame },
          { id: 'notes', label: 'Notes', icon: FileText },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center justify-center gap-1.5 px-2.5 py-1.5 text-xs font-semibold rounded-[4px] whitespace-nowrap min-h-[36px] transition-colors cursor-pointer ${
                isActive
                  ? 'bg-[var(--accent)] text-[var(--text-inverse)]'
                  : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[#E2E8F0]'
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Tab Content: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="flex flex-col gap-3">
          <p className="text-body text-[var(--text-secondary)] bg-[var(--bg-elevated)] p-3 rounded-[6px] border border-[var(--border-default)]">
            {profile.description || 'Clinical overview of pharmacological actions and prescribing safety warnings.'}
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Class</span>
              <span className="text-sm font-semibold text-[var(--text-primary)] mt-0.5 line-clamp-1">
                {profile.category}
              </span>
            </div>

            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Stomach Score</span>
              <span className="metric text-sm text-[var(--severity-moderate)] mt-0.5 block">
                {profile.gi_profile.stomach_health_score}/100
              </span>
            </div>

            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Common Side Effects</span>
              <span className="metric text-sm text-[var(--text-primary)] mt-0.5 block">
                {profile.side_effects.filter(s => s.frequency === 'very_common' || s.frequency === 'common').length} reported
              </span>
            </div>

            <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Food Guidance</span>
              <span className="metric text-sm text-[var(--text-primary)] mt-0.5 block">
                {profile.food_interactions.length} active rules
              </span>
            </div>
          </div>

          {profile.brand_names && profile.brand_names.length > 0 && (
            <div className="flex flex-col gap-1.5 pt-1">
              <span className="text-xs text-[var(--text-muted)] font-bold">Equivalent Brands:</span>
              <div className="flex flex-wrap gap-1.5">
                {profile.brand_names.map((b, i) => (
                  <span key={i} className="tag font-serif text-[13px] font-semibold capitalize">
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
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between text-xs text-[var(--text-muted)] mb-0.5">
            <span>Reported Adverse Reactions</span>
            <span>Frequency</span>
          </div>

          <div className="flex flex-col gap-2 max-h-[300px] overflow-y-auto pr-1">
            {(showAllSideEffects ? profile.side_effects : profile.side_effects.slice(0, 5)).map((se, idx) => {
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
                  key={idx} 
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

                  <div className="w-full h-1.5 bg-[var(--border-default)] rounded-full overflow-hidden mb-1">
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

          {profile.side_effects.length > 5 && (
            <button
              onClick={() => setShowAllSideEffects(!showAllSideEffects)}
              className="text-xs text-[var(--text-primary)] font-semibold hover:underline flex items-center justify-center gap-1 cursor-pointer py-1.5 min-h-[36px]"
            >
              <span>{showAllSideEffects ? 'Show Top Reported' : `Show all ${profile.side_effects.length} effects`}</span>
              {showAllSideEffects ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
            </button>
          )}
        </div>
      )}

      {/* Tab Content: FOOD & LIFESTYLE */}
      {activeTab === 'food' && (
        <div className="flex flex-col gap-2.5">
          {profile.food_interactions.map((fi, idx) => (
            <div key={idx} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-3 flex items-start gap-2.5">
              <div className={`w-7 h-7 rounded-[4px] flex items-center justify-center shrink-0 ${
                fi.severity === 'critical'
                  ? 'bg-[rgba(220,38,38,0.15)] text-[var(--severity-high)]'
                  : 'bg-[rgba(217,119,6,0.15)] text-[var(--severity-moderate)]'
              }`}>
                {fi.type.includes('alcohol') ? <Wine className="w-4 h-4" /> :
                 fi.type.includes('grapefruit') ? <Citrus className="w-4 h-4" /> :
                 fi.type.includes('dairy') ? <Milk className="w-4 h-4" /> :
                 fi.type.includes('empty') ? <Clock className="w-4 h-4" /> :
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

          {profile.lifestyle_warnings.map((lw, idx) => (
            <div key={`lw-${idx}`} className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-2.5 flex items-center gap-2">
              <Car className="w-4 h-4 text-[var(--text-primary)] shrink-0" />
              <span className="text-xs text-[var(--text-secondary)]">{lw}</span>
            </div>
          ))}
        </div>
      )}

      {/* Tab Content: STOMACH */}
      {activeTab === 'gi' && (
        <div className="flex flex-col gap-3">
          <div className="bg-[var(--bg-elevated)] border border-[var(--border-default)] rounded-[6px] p-3.5 flex items-center justify-between">
            <div>
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Stomach Health Score</span>
              <div className="flex items-baseline gap-1 mt-0.5">
                <span className="metric text-2xl text-[var(--text-primary)]">
                  {profile.gi_profile.stomach_health_score}
                </span>
                <span className="text-xs text-[var(--text-muted)]">/ 100 GI Load</span>
              </div>
              <span className={`tag mt-1 ${
                profile.gi_profile.risk_tier === 'high'
                  ? 'tag-danger'
                  : profile.gi_profile.risk_tier === 'moderate'
                  ? 'tag-warning'
                  : 'tag-success'
              }`}>
                {profile.gi_profile.risk_tier} load
              </span>
            </div>

            <div className="w-10 h-10 rounded-[6px] bg-[var(--bg-surface)] border border-[var(--border-default)] flex items-center justify-center text-[var(--severity-moderate)]">
              <Flame className="w-5 h-5" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 text-xs">
            <div className="bg-[var(--bg-elevated)] p-2.5 rounded-[6px] border border-[var(--border-default)]">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Nausea Risk</span>
              <span className="font-semibold text-[var(--text-primary)] capitalize mt-0.5 block">{profile.gi_profile.nausea_risk}</span>
            </div>
            <div className="bg-[var(--bg-elevated)] p-2.5 rounded-[6px] border border-[var(--border-default)]">
              <span className="text-xs text-[var(--text-muted)] uppercase block font-bold">Bleeding / Ulcer</span>
              <span className="font-semibold text-[var(--text-primary)] capitalize mt-0.5 block">{profile.gi_profile.bleeding_risk}</span>
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <span className="text-xs text-[var(--text-muted)] font-bold">Clinical Stomach Guidance:</span>
            {profile.gi_profile.recommendations.map((rec, idx) => (
              <div key={idx} className="flex items-start gap-2 text-xs text-[var(--text-secondary)] bg-[var(--bg-elevated)] p-2.5 rounded-[6px] border border-[var(--border-default)]">
                <CheckCircle2 className="w-4 h-4 text-[var(--severity-low)] shrink-0 mt-0.5" />
                <span>{rec}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Tab Content: NOTES */}
      {activeTab === 'notes' && (
        <div className="flex flex-col gap-2.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-[var(--text-primary)]">Personal Notes for {profile.name}</span>
            <span className="text-xs text-[var(--text-muted)]">Auto-saved</span>
          </div>

          <textarea
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
