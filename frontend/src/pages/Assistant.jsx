import React, { useState, useRef, useEffect } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Navbar } from '../components/Navbar';
import { Footer } from '../components/Footer';
import { IndiaBanNotice } from '../components/IndiaBanNotice';
import { chatAboutMedicine } from '../lib/api';
import {
  MessageIcon,
  PillIcon,
  WarningIcon,
  FoodIcon,
  AlcoholIcon,
  ShieldIcon,
  BalanceIcon,
  BookIcon,
  RefreshIcon,
  ArrowRightIcon,
} from './landing-icons';
import './app-editorial.css';

const EXAMPLE_MEDICINES = ['Dolo 650', 'Warfarin', 'Metformin'];

function severityTagClass(severity) {
  const val = (severity || '').toLowerCase();
  if (val === 'high' || val === 'severe' || val === 'critical') return 'ed-tag-crit';
  if (val === 'moderate' || val === 'warning') return 'ed-tag-caut';
  if (val === 'none' || val === 'recommended' || val === 'gentle') return 'ed-tag-safe';
  return '';
}

function formatFrequencyLabel(freq, pct) {
  const label = (freq || '').replace(/_/g, ' ');
  return pct ? `${label} (${pct})` : label;
}

/**
 * Renders Groq plain-language prose cleanly without raw markdown markers or em dashes.
 */
function FormattedAnswer({ text }) {
  const sanitized = (text || '').replace(/\s*\u2014\s*/g, '; ');
  const blocks = sanitized.split(/\n{2,}/).map((b) => b.trim()).filter(Boolean);

  return (
    <div className="space-y-3 font-ibm-serif text-[14.5px] leading-relaxed text-[#1a1a18]">
      {blocks.map((block, idx) => {
        const lines = block.split('\n').map((l) => l.trim()).filter(Boolean);
        return (
          <div key={idx} className="space-y-1">
            {lines.map((rawLine, lineIdx) => {
              const line = rawLine.replace(/^#+\s*/, '').replace(/\*\*/g, '');
              const colonMatch = line.match(/^([A-Za-z][A-Za-z0-9\s/&-]{2,48}):\s*(.*)$/);
              if (colonMatch) {
                const heading = colonMatch[1];
                const body = colonMatch[2];
                return (
                  <p key={lineIdx} className="leading-relaxed">
                    <span className="font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#1a1a18] font-semibold mr-1.5">
                      {heading}:
                    </span>
                    {body && <span>{body}</span>}
                  </p>
                );
              }
              if (line.startsWith('- ') || line.startsWith('* ')) {
                return (
                  <p key={lineIdx} className="pl-4 relative leading-relaxed">
                    <span className="absolute left-0 text-[#8b2500] font-ibm-mono">-</span>
                    <span>{line.slice(2)}</span>
                  </p>
                );
              }
              return (
                <p key={lineIdx} className="leading-relaxed">
                  {line}
                </p>
              );
            })}
          </div>
        );
      })}
    </div>
  );
}

/**
 * Ruled label profile docket shown below the Groq summary (or standalone when AI is unavailable).
 */
function MedicineDocket({ entry }) {
  const { profile, boxed_warning: boxedWarning, known_interactions: knownInteractions, label_interaction_notes: labelNotes } = entry;
  if (!profile) return null;

  const gi = profile.gi_profile;
  const sideEffects = profile.side_effects || [];
  const foodRules = profile.food_interactions || [];
  const lifestyleWarnings = profile.lifestyle_warnings || [];
  const interactions = knownInteractions || [];
  const fdaNotes = labelNotes || [];

  return (
    <div className="border border-[#b7b09d] bg-[#f8f6f0] divide-y divide-[#d5cfc0]">
      {/* 1. Overview */}
      <section className="p-4 sm:p-5 space-y-3" aria-label="Overview">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
            01 / Overview
          </h3>
          <Link
            to={`/medicine/${encodeURIComponent(profile.name)}`}
            className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#8b2500] hover:underline underline-offset-4 inline-flex items-center gap-1"
          >
            <span>Open Monograph Page</span>
            <ArrowRightIcon size={11} />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5">
          <div className="bg-[#f0ede1] border border-[#d5cfc0] p-2.5">
            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
              Generic Ingredient
            </span>
            <span className="font-newsreader text-[15px] font-semibold text-[#1a1a18] capitalize">
              {profile.generic_name}
            </span>
          </div>

          <div className="bg-[#f0ede1] border border-[#d5cfc0] p-2.5">
            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
              Pharmacological Class
            </span>
            <span className="font-newsreader text-[15px] font-semibold text-[#1a1a18]">
              {profile.category}
            </span>
          </div>

          <div className="bg-[#f0ede1] border border-[#d5cfc0] p-2.5">
            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] block">
              Dosage Forms
            </span>
            <span className="font-ibm-serif text-xs text-[#1a1a18]">
              {profile.dosage_forms?.length ? profile.dosage_forms.join(', ') : 'Not specified'}
            </span>
          </div>
        </div>

        {profile.brand_names && profile.brand_names.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] mr-1">
              Known Brands:
            </span>
            {profile.brand_names.map((brand) => (
              <span key={brand} className="ed-tag">
                {brand}
              </span>
            ))}
          </div>
        )}

        {profile.is_fdc && profile.fdc_ingredients && profile.fdc_ingredients.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#8a5300] mr-1">
              Active Combination Ingredients:
            </span>
            {profile.fdc_ingredients.map((ing) => (
              <span key={ing} className="ed-tag ed-tag-caut">
                {ing}
              </span>
            ))}
          </div>
        )}
      </section>

      {/* 2. Uses */}
      <section className="p-4 sm:p-5 space-y-2" aria-label="Uses">
        <h3 className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
          02 / Uses &amp; Mechanism
        </h3>
        <p className="font-ibm-serif text-sm text-[#2d2b26] leading-relaxed">
          {profile.description || 'Detailed therapeutic indications are not listed in the available profile.'}
        </p>
      </section>

      {/* 3. Side Effects */}
      <section className="p-4 sm:p-5 space-y-2.5" aria-label="Side Effects">
        <h3 className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
          03 / Side Effects ({sideEffects.length})
        </h3>
        {sideEffects.length > 0 ? (
          <div className="border border-[#d5cfc0] divide-y divide-[#d5cfc0]">
            {sideEffects.map((se, idx) => (
              <div key={`${se.effect}-${idx}`} className="px-3 py-2.5 flex flex-wrap items-center justify-between gap-2 bg-[#f8f6f0]">
                <div>
                  <p className="font-ibm-serif text-sm font-medium text-[#1a1a18]">
                    {se.effect}
                  </p>
                  <p className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] mt-0.5">
                    {se.category || 'General'} · {formatFrequencyLabel(se.frequency, se.frequency_percentage)}
                  </p>
                </div>
                <span className={`ed-tag ${severityTagClass(se.severity)}`}>
                  {se.severity}
                </span>
              </div>
            ))}
          </div>
        ) : (
          <p className="font-ibm-serif text-xs text-[#57534a]">
            No side effects are listed in the available label profile.
          </p>
        )}
      </section>

      {/* 4. Food and Alcohol */}
      <section className="p-4 sm:p-5 space-y-2.5" aria-label="Food and Alcohol">
        <h3 className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
          04 / Food and Alcohol ({foodRules.length})
        </h3>
        {foodRules.length > 0 ? (
          <div className="space-y-2">
            {foodRules.map((fi, idx) => {
              const isAlcohol = (fi.type || '').includes('alcohol');
              return (
                <div key={`${fi.type}-${idx}`} className="bg-[#f0ede1] border border-[#d5cfc0] p-3 flex items-start gap-2.5">
                  <div className="w-7 h-7 bg-[#f8f6f0] border border-[#b7b09d] flex items-center justify-center shrink-0 text-[#1a1a18] mt-0.5">
                    {isAlcohol ? <AlcoholIcon size={14} /> : <FoodIcon size={14} />}
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-center justify-between gap-2 flex-wrap">
                      <span className="font-newsreader text-[16px] font-semibold text-[#1a1a18]">
                        {fi.title}
                      </span>
                      <span className={`ed-tag ${severityTagClass(fi.severity)}`}>
                        {fi.severity}
                      </span>
                    </div>
                    <p className="font-ibm-serif text-xs text-[#2d2b26] leading-relaxed">
                      {fi.description}
                    </p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="font-ibm-serif text-xs text-[#57534a]">
            No specific food or alcohol restrictions are documented in this label profile.
          </p>
        )}
      </section>

      {/* 5. Precautions and Warnings */}
      <section className="p-4 sm:p-5 space-y-3" aria-label="Precautions and Warnings">
        <h3 className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
          05 / Precautions and Warnings
        </h3>

        {boxedWarning && (
          <div className="ed-notice-crit p-3.5 flex items-start gap-2.5" role="alert">
            <div className="w-7 h-7 bg-[#f8f6f0] border border-[#8b2500] text-[#8b2500] flex items-center justify-center shrink-0 mt-0.5">
              <WarningIcon size={14} />
            </div>
            <div className="space-y-1">
              <span className="font-ibm-mono text-[10px] font-semibold uppercase tracking-[0.07em] text-[#8b2500] block">
                Boxed Warning · Critical Escalation
              </span>
              <p className="font-ibm-serif text-xs text-[#1a1a18] leading-relaxed">
                {boxedWarning}
              </p>
            </div>
          </div>
        )}

        {profile.is_fdc && profile.fdc_warning && (
          <div className="ed-notice-caut p-3 flex items-start gap-2">
            <WarningIcon size={14} className="shrink-0 mt-0.5" />
            <p className="font-ibm-serif text-xs text-[#1a1a18] leading-relaxed">
              {profile.fdc_warning}
            </p>
          </div>
        )}

        {gi && (
          <div className="bg-[#f0ede1] border border-[#d5cfc0] p-3 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="inline-flex items-center gap-1.5 font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#1a1a18] font-medium">
                <ShieldIcon size={13} />
                <span>Stomach Guardian Stomach Risk</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-newsreader text-base font-semibold tabular-nums text-[#1a1a18]">
                  {gi.stomach_health_score}/100
                </span>
                <span className={`ed-tag ${severityTagClass(gi.risk_tier)}`}>
                  {gi.risk_tier}
                </span>
              </div>
            </div>
            <p className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a]">
              Nausea: {gi.nausea_risk} · Ulcer: {gi.ulcer_risk} · Bleeding: {gi.bleeding_risk}
            </p>
            {gi.recommendations && gi.recommendations.length > 0 && (
              <ul className="space-y-1 pt-1 border-t border-[#d5cfc0]">
                {gi.recommendations.map((rec, idx) => (
                  <li key={idx} className="font-ibm-serif text-xs text-[#2d2b26] leading-relaxed flex items-start gap-2">
                    <span className="font-ibm-mono text-[#57534a]">-</span>
                    <span>{rec}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        {lifestyleWarnings.length > 0 && (
          <ul className="space-y-1.5">
            {lifestyleWarnings.map((warn, idx) => (
              <li key={idx} className="bg-[#f0ede1] border border-[#d5cfc0] px-3 py-2 font-ibm-serif text-xs text-[#2d2b26] leading-relaxed flex items-start gap-2">
                <WarningIcon size={13} className="text-[#8a5300] shrink-0 mt-0.5" />
                <span>{warn}</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 6. Known Interactions */}
      <section className="p-4 sm:p-5 space-y-2.5" aria-label="Known Interactions">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <h3 className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#57534a] font-medium">
            06 / Known Interactions ({interactions.length})
          </h3>
          <Link
            to="/app"
            className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#1a1a18] hover:text-[#8b2500] hover:underline underline-offset-4 inline-flex items-center gap-1"
          >
            <BalanceIcon size={12} />
            <span>Check Multi-Drug Basket</span>
          </Link>
        </div>

        {interactions.length > 0 ? (
          <div className="space-y-2">
            {interactions.map((ix, idx) => (
              <div
                key={`${ix.other_medicine}-${idx}`}
                className={`p-3 border space-y-1.5 ${
                  ix.severity === 'high'
                    ? 'bg-[#f3e9e4] border-[#8b2500] border-t-[3px] border-t-[#8b2500]'
                    : ix.severity === 'moderate'
                    ? 'bg-[#f4eee0] border-[#8a5300] border-t-[3px] border-t-[#8a5300]'
                    : 'bg-[#f0ede1] border-[#d5cfc0]'
                }`}
              >
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <span className="font-newsreader text-[16px] font-semibold text-[#1a1a18]">
                    With {ix.other_medicine}
                  </span>
                  <span className={`ed-tag ${severityTagClass(ix.severity)}`}>
                    {ix.severity}
                  </span>
                </div>
                <p className="font-ibm-serif text-xs text-[#1a1a18] leading-relaxed">
                  {ix.explanation}
                </p>
                {ix.action_guidance && (
                  <p className="font-ibm-serif text-xs text-[#2d2b26] leading-relaxed">
                    <span className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a] mr-1">
                      Guidance:
                    </span>
                    {ix.action_guidance}
                  </p>
                )}
                {ix.evidence_source && (
                  <p className="font-ibm-mono text-[10px] uppercase tracking-[0.06em] text-[#57534a]">
                    Source: {ix.evidence_source}
                  </p>
                )}
              </div>
            ))}
          </div>
        ) : fdaNotes.length > 0 ? (
          <div className="space-y-1.5">
            {fdaNotes.map((note, idx) => (
              <p key={idx} className="bg-[#f0ede1] border border-[#d5cfc0] p-3 font-ibm-serif text-xs text-[#2d2b26] leading-relaxed">
                {note}
              </p>
            ))}
          </div>
        ) : (
          <p className="font-ibm-serif text-xs text-[#57534a]">
            No pairwise interaction rules are indexed for this medicine in the curated clinical rule table. Use the Safety Dashboard to check a specific medicine combination.
          </p>
        )}
      </section>
    </div>
  );
}

export function Assistant() {
  const [searchParams] = useSearchParams();
  const [entries, setEntries] = useState([]);
  const [activeMedicine, setActiveMedicine] = useState(null);
  const [inputValue, setInputValue] = useState('');
  const [loading, setLoading] = useState(false);
  const [requestError, setRequestError] = useState(null);
  const [lastFailedRequest, setLastFailedRequest] = useState(null);

  const inputRef = useRef(null);
  const bottomRef = useRef(null);
  const entryCounterRef = useRef(0);
  const didAutoSubmitParamRef = useRef(false);

  useEffect(() => {
    if (entries.length > 0 || loading || requestError) {
      bottomRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [entries.length, loading, requestError]);

  const nextId = () => {
    entryCounterRef.current += 1;
    return `msg-${entryCounterRef.current}`;
  };

  const submitQuery = async ({ medicine, question, displayText, skipVisitorAppend = false }) => {
    const cleanMed = (medicine || '').trim();
    if (!cleanMed || loading) return;

    const isFollowUp = Boolean(question && question.trim());
    setRequestError(null);
    setLastFailedRequest(null);

    if (!skipVisitorAppend) {
      setEntries((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'visitor',
          text: displayText || (isFollowUp ? question.trim() : cleanMed),
          medicine: activeMedicine || cleanMed,
          isFollowUp,
        },
      ]);
      setInputValue('');
    }

    setLoading(true);
    try {
      const res = await chatAboutMedicine(cleanMed, isFollowUp ? question.trim() : null);

      if ((res.found || res.ai_fallback || res.catalogue_match || res.india_ban?.matched) && !res.india_ban_overview) {
        setActiveMedicine(res.medicine);
      }

      setEntries((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          found: res.found,
          ai_fallback: Boolean(res.ai_fallback),
          catalogue_match: Boolean(res.catalogue_match),
          catalogue: res.catalogue || null,
          disclaimer: res.disclaimer || null,
          queriedInput: cleanMed,
          medicine: res.medicine,
          profile: res.profile,
          answer: res.answer,
          ai_available: res.ai_available,
          message: res.message,
          boxed_warning: res.boxed_warning,
          known_interactions: res.known_interactions || [],
          label_interaction_notes: res.label_interaction_notes || [],
          india_ban: res.india_ban || null,
          india_ban_overview: Boolean(res.india_ban_overview),
          isFollowUp,
        },
      ]);
    } catch (err) {
      setRequestError(
        err?.message || 'Could not reach the clinical assistant service. Please try again.',
      );
      setLastFailedRequest({
        medicine: cleanMed,
        question: isFollowUp ? question.trim() : null,
        displayText: displayText || (isFollowUp ? question.trim() : cleanMed),
      });
    } finally {
      setLoading(false);
    }
  };

  const submitQueryRef = useRef(submitQuery);
  submitQueryRef.current = submitQuery;

  useEffect(() => {
    if (didAutoSubmitParamRef.current) return;
    const medicineParam = (searchParams.get('medicine') || '').trim();
    if (medicineParam && entries.length === 0) {
      didAutoSubmitParamRef.current = true;
      submitQueryRef.current({
        medicine: medicineParam,
        question: null,
        displayText: medicineParam,
      });
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleSubmit = (e) => {
    e.preventDefault();
    const trimmed = inputValue.trim();
    if (!trimmed || loading) return;

    if (activeMedicine) {
      submitQuery({
        medicine: activeMedicine,
        question: trimmed,
        displayText: trimmed,
      });
    } else {
      submitQuery({
        medicine: trimmed,
        question: null,
        displayText: trimmed,
      });
    }
  };

  const handleNewMedicine = () => {
    if (loading) return;
    setActiveMedicine(null);
    setRequestError(null);
    setLastFailedRequest(null);
    setInputValue('');
    inputRef.current?.focus();
  };

  const handleRetry = () => {
    if (!lastFailedRequest || loading) return;
    submitQuery({
      ...lastFailedRequest,
      skipVisitorAppend: true,
    });
  };

  return (
    <div className="ed-app min-h-screen flex flex-col bg-[#f8f6f0] text-[#1a1a18]">
      <Navbar />

      <main className="flex-1 pt-28 pb-16 px-4 sm:px-8 max-w-[980px] mx-auto w-full flex flex-col gap-6">
        {/* Editorial Masthead */}
        <header className="border-b border-[#b7b09d] pb-5 space-y-2.5">
          <div className="inline-flex items-center gap-2 font-ibm-mono text-[11px] uppercase tracking-[0.09em] text-[#8b2500] font-medium">
            <MessageIcon size={14} />
            <span>Medicine Label Assistant</span>
          </div>
          <h1 className="font-newsreader text-[34px] sm:text-[42px] font-medium text-[#1a1a18] leading-[1.08] tracking-[-0.015em]">
            Plain-Language Label Reader
          </h1>
          <p className="text-[15px] text-[#2d2b26] leading-relaxed font-ibm-serif max-w-2xl">
            Enter the name of a medicine you are taking to read a plain-language summary alongside its complete label profile, grounded strictly in MEDCHECK clinical records.
          </p>
        </header>

        {/* Ruled Conversation Ledger */}
        <section aria-label="Medicine conversation ledger" className="flex flex-col gap-5">
          {entries.length === 0 && !loading && !requestError && (
            <div className="ed-sheet p-5 sm:p-6 flex flex-col gap-4">
              <div className="flex items-center justify-between gap-2 pb-3 border-b border-[#d5cfc0]">
                <span className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a18] font-medium">
                  Consultation Ledger
                </span>
                <span className="ed-tag">Profile-Grounded</span>
              </div>
              <p className="font-ibm-serif text-sm text-[#2d2b26] leading-relaxed">
                Start by naming a brand or generic medicine (such as Dolo 650, Crocin, Ecosprin, Warfarin, or Metformin). Once a medicine is open, you can ask follow-up questions against its label data.
              </p>
              <div className="flex flex-wrap items-center gap-2 pt-1">
                <span className="font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#57534a] mr-1">
                  Try an example:
                </span>
                {EXAMPLE_MEDICINES.map((med) => (
                  <button
                    key={med}
                    type="button"
                    onClick={() => submitQuery({ medicine: med, question: null, displayText: med })}
                    className="ed-btn-outline text-[11px] py-1.5 px-3"
                  >
                    {med}
                  </button>
                ))}
              </div>
            </div>
          )}

          {entries.map((entry) => {
            if (entry.role === 'visitor') {
              return (
                <article
                  key={entry.id}
                  className="bg-[#1a1a18] text-[#f8f6f0] border border-[#1a1a18] p-4 sm:p-5 flex flex-col gap-1.5"
                >
                  <span className="font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#d5cfc0]">
                    {entry.isFollowUp
                      ? `Visitor Follow-Up · ${entry.medicine}`
                      : 'Visitor Medicine Inquiry'}
                  </span>
                  <p className="font-ibm-serif text-[15px] leading-relaxed text-[#f8f6f0]">
                    {entry.text}
                  </p>
                </article>
              );
            }

            if (entry.india_ban_overview) {
              return (
                <article
                  key={entry.id}
                  className="ed-sheet p-5 sm:p-6 flex flex-col gap-4"
                  aria-label="India banned medicines overview"
                >
                  <div className="flex items-start justify-between gap-3 pb-3 border-b border-[#b7b09d]">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-[#f8f6f0] border border-[#1a1a18] text-[#1a1a18] flex items-center justify-center shrink-0 mt-0.5">
                        <BookIcon size={17} />
                      </div>
                      <div>
                        <h2 className="font-newsreader text-[24px] font-semibold text-[#1a1a18] leading-tight">
                          Banned and Halted Medicines in India
                        </h2>
                        <p className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] mt-0.5">
                          CDSCO · Government of India Overview
                        </p>
                      </div>
                    </div>
                    <span className="ed-tag">Official Data</span>
                  </div>
                  <div className="ed-inset p-4 sm:p-5">
                    <FormattedAnswer text={entry.answer} />
                  </div>
                </article>
              );
            }

            if (entry.catalogue_match) {
              const catalogueDisclaimer =
                entry.disclaimer ||
                'This is from the Indian medicines catalogue, not from the MEDCHECK clinical database. It has no interaction check and no stomach safety score. Kindly consult a pharmacist before use.';
              const substitutes = entry.catalogue?.substitutes || [];
              return (
                <article
                  key={entry.id}
                  className="ed-sheet p-5 sm:p-6 flex flex-col gap-4"
                  style={{ borderRadius: 0, boxShadow: 'none' }}
                  aria-label={`Catalogue reference for ${entry.medicine}`}
                >
                  {entry.india_ban?.matched && <IndiaBanNotice info={entry.india_ban} />}

                  {/* Full-Border Ink Notice at the Very Top */}
                  <div
                    className="border border-[#1a1a18] bg-[#f8f6f0] p-3.5 sm:p-4 flex items-start gap-3"
                    style={{ borderRadius: 0, boxShadow: 'none' }}
                    role="note"
                    aria-label="Indian medicines catalogue disclaimer"
                  >
                    <div className="w-7 h-7 bg-[#f0ede1] border border-[#1a1a18] text-[#1a1a18] flex items-center justify-center shrink-0 mt-0.5">
                      <BookIcon size={14} />
                    </div>
                    <div className="space-y-1">
                      <span className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a18] font-semibold block">
                        INDIAN MEDICINES CATALOGUE · REFERENCE DATA
                      </span>
                      <p className="font-ibm-serif text-xs sm:text-[13px] text-[#1a1a18] leading-relaxed">
                        {catalogueDisclaimer}
                      </p>
                    </div>
                  </div>

                  {/* Product Heading (No source tags, no docket) */}
                  <div className="flex items-start gap-3 pb-3 border-b border-[#d5cfc0]">
                    <div className="w-9 h-9 bg-[#f8f6f0] border border-[#1a1a18] text-[#1a1a18] flex items-center justify-center shrink-0 mt-0.5">
                      <PillIcon size={17} />
                    </div>
                    <div>
                      <h2 className="font-newsreader text-[24px] font-semibold text-[#1a1a18] leading-tight">
                        {entry.catalogue?.name || entry.medicine}
                      </h2>
                      <p className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] mt-0.5">
                        {entry.isFollowUp
                          ? 'Follow-up response · Catalogue reference entry'
                          : 'Catalogue reference entry'}
                      </p>
                    </div>
                  </div>

                  {/* Catalogue Answer Prose */}
                  <div className="ed-inset p-4 sm:p-5">
                    <FormattedAnswer text={entry.answer} />
                  </div>

                  {/* Ruled List of Substitute Brands */}
                  {substitutes.length > 0 && (
                    <section
                      className="border border-[#b7b09d] bg-[#f8f6f0]"
                      style={{ borderRadius: 0, boxShadow: 'none' }}
                      aria-label="Other brands with the same composition"
                    >
                      <div className="px-4 py-2.5 bg-[#f0ede1] border-b border-[#b7b09d]">
                        <h3 className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a18] font-semibold">
                          OTHER BRANDS WITH THE SAME COMPOSITION
                        </h3>
                      </div>
                      <ul className="divide-y divide-[#d5cfc0]">
                        {substitutes.map((sub, idx) => (
                          <li key={`${sub}-${idx}`} className="px-4 py-2 font-ibm-serif text-sm text-[#1a1a18]">
                            {sub}
                          </li>
                        ))}
                      </ul>
                    </section>
                  )}
                </article>
              );
            }

            if (entry.ai_fallback) {
              const fallbackDisclaimer =
                entry.disclaimer ||
                'This is AI-fetched data, not from the MEDCHECK database. Kindly consult a pharmacist before use.';
              return (
                <article
                  key={entry.id}
                  className="ed-sheet-caut p-5 sm:p-6 flex flex-col gap-4"
                  aria-label={`AI-fetched overview for ${entry.medicine}`}
                >
                  {entry.india_ban?.matched && <IndiaBanNotice info={entry.india_ban} />}

                  {/* Prominent Bordered AI-Fetched Notice at the Very Top */}
                  <div
                    className="ed-notice-caut p-3.5 sm:p-4 flex items-start gap-3"
                    role="note"
                    aria-label="AI-fetched information disclaimer"
                  >
                    <div className="w-7 h-7 bg-[#f8f6f0] border border-[#8a5300] text-[#8a5300] flex items-center justify-center shrink-0 mt-0.5">
                      <WarningIcon size={14} />
                    </div>
                    <div className="space-y-1">
                      <span className="font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#8a5300] font-semibold block">
                        AI-FETCHED INFORMATION
                      </span>
                      <p className="font-ibm-serif text-xs sm:text-[13px] text-[#1a1a18] leading-relaxed">
                        {fallbackDisclaimer}
                      </p>
                    </div>
                  </div>

                  {/* Medicine Heading (No source tags, no profile docket) */}
                  <div className="flex items-start gap-3 pb-3 border-b border-[#d5cfc0]">
                    <div className="w-9 h-9 bg-[#f8f6f0] border border-[#8a5300] text-[#8a5300] flex items-center justify-center shrink-0 mt-0.5">
                      <PillIcon size={17} />
                    </div>
                    <div>
                      <h2 className="font-newsreader text-[24px] font-semibold text-[#1a1a18] leading-tight">
                        {entry.medicine}
                      </h2>
                      <p className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] mt-0.5">
                        {entry.isFollowUp
                          ? 'Follow-up response · General AI overview'
                          : 'Not in MEDCHECK database · General AI overview'}
                      </p>
                    </div>
                  </div>

                  {/* General AI Answer Prose */}
                  <div className="ed-inset p-4 sm:p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#d5cfc0] flex-wrap">
                      <span className="font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#8a5300] font-semibold">
                        {entry.isFollowUp
                          ? 'General AI Answer'
                          : 'General AI Overview'}
                      </span>
                      <span className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a]">
                        Outside MEDCHECK Label Database
                      </span>
                    </div>
                    <FormattedAnswer text={entry.answer} />
                  </div>
                </article>
              );
            }

            if (!entry.found && entry.india_ban?.matched) {
              return (
                <article
                  key={entry.id}
                  className="ed-sheet-crit p-5 sm:p-6 flex flex-col gap-4"
                  aria-label={`India regulatory notice for ${entry.medicine}`}
                >
                  <IndiaBanNotice info={entry.india_ban} />

                  <div className="flex flex-wrap items-start justify-between gap-3 pb-3 border-b border-[#d5cfc0]">
                    <div className="flex items-start gap-3">
                      <div className="w-9 h-9 bg-[#f8f6f0] border border-[#8b2500] text-[#8b2500] flex items-center justify-center shrink-0 mt-0.5">
                        <PillIcon size={17} />
                      </div>
                      <div>
                        <h2 className="font-newsreader text-[24px] font-semibold text-[#1a1a18] leading-tight">
                          {entry.medicine}
                        </h2>
                        <p className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] mt-0.5">
                          {entry.isFollowUp
                            ? 'Follow-up response · CDSCO regulatory record'
                            : 'CDSCO regulatory record'}
                        </p>
                      </div>
                    </div>
                    <span className="ed-tag ed-tag-crit">{entry.india_ban.heading}</span>
                  </div>

                  <p className="font-ibm-serif text-xs text-[#2d2b26] leading-relaxed">
                    No separate MEDCHECK prescribing label monograph is indexed for this medicine. Follow the official India regulatory notice above and ask your doctor or pharmacist.
                  </p>
                </article>
              );
            }

            if (!entry.found) {
              return (
                <article
                  key={entry.id}
                  className="ed-sheet-caut p-5 sm:p-6 flex flex-col gap-3"
                >
                  <div className="flex items-start gap-3 pb-3 border-b border-[#d5cfc0]">
                    <div className="w-8 h-8 bg-[#f4eee0] border border-[#8a5300] text-[#8a5300] flex items-center justify-center shrink-0 mt-0.5">
                      <WarningIcon size={16} />
                    </div>
                    <div className="space-y-1">
                      <span className="ed-tag ed-tag-caut">Not Found in Database</span>
                      <h2 className="font-newsreader text-[22px] font-semibold text-[#1a1a18] leading-tight">
                        {entry.queriedInput}
                      </h2>
                    </div>
                  </div>
                  <p className="font-ibm-serif text-sm text-[#2d2b26] leading-relaxed">
                    {entry.message ||
                      'This medicine was not found in the MEDCHECK database. Please check the spelling or try entering the generic active ingredient name.'}
                  </p>
                </article>
              );
            }

            const showDocket = !entry.isFollowUp || !entry.ai_available;

            return (
              <article
                key={entry.id}
                className="ed-sheet p-5 sm:p-6 flex flex-col gap-4"
                aria-label={`Label response for ${entry.medicine}`}
              >
                {entry.india_ban?.matched && <IndiaBanNotice info={entry.india_ban} />}

                {/* Assistant Sheet Header */}
                <div className="flex flex-wrap items-start justify-between gap-3 pb-3.5 border-b border-[#b7b09d]">
                  <div className="flex items-start gap-3">
                    <div className="w-9 h-9 bg-[#f8f6f0] border border-[#1a1a18] text-[#1a1a18] flex items-center justify-center shrink-0 mt-0.5">
                      <PillIcon size={17} />
                    </div>
                    <div>
                      <h2 className="font-newsreader text-[24px] font-semibold text-[#1a1a18] leading-tight">
                        {entry.medicine}
                      </h2>
                      <p className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] mt-0.5">
                        {entry.profile?.name && entry.profile.name !== entry.medicine
                          ? `${entry.profile.name} · `
                          : ''}
                        {!entry.isFollowUp &&
                        entry.queriedInput.toLowerCase() !== entry.medicine.toLowerCase()
                          ? `Resolved from "${entry.queriedInput}"`
                          : entry.isFollowUp
                          ? 'Follow-up response'
                          : 'Canonical label record'}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-1.5">
                    {entry.profile?.drug_type && (
                      <span className="ed-tag">{entry.profile.drug_type}</span>
                    )}
                    {entry.profile?.data_source && (
                      <span className="ed-tag ed-tag-olive">
                        {entry.profile.data_source === 'curated_kb'
                          ? 'Curated Label KB'
                          : 'OpenFDA Label'}
                      </span>
                    )}
                    {entry.profile?.is_fdc && (
                      <span className="ed-tag ed-tag-caut">Combination Product</span>
                    )}
                  </div>
                </div>

                {/* Plain-Language Groq Summary OR Honest Fallback Notice */}
                {entry.ai_available && entry.answer ? (
                  <div className="ed-inset p-4 sm:p-5 space-y-2.5">
                    <div className="flex items-center justify-between gap-2 pb-2 border-b border-[#d5cfc0] flex-wrap">
                      <span className="font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#8b2500] font-medium">
                        {entry.isFollowUp
                          ? 'Plain-Language Answer'
                          : 'Plain-Language Summary'}
                      </span>
                      <span className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a]">
                        Grounded Strictly in Label Data
                      </span>
                    </div>
                    <FormattedAnswer text={entry.answer} />
                  </div>
                ) : (
                  <div
                    className="bg-[#f4eee0] border border-[#8a5300] px-3.5 py-2.5 font-ibm-mono text-[11px] uppercase tracking-[0.07em] text-[#8a5300] font-medium"
                    role="status"
                  >
                    PLAIN-LANGUAGE SUMMARY UNAVAILABLE; SHOWING THE LABEL PROFILE
                  </div>
                )}

                {/* Full Ruled Profile Docket */}
                {showDocket && <MedicineDocket entry={entry} />}
              </article>
            );
          })}

          {/* Discrete Mono Loading Indicator */}
          {loading && (
            <div
              className="ed-sheet p-4 sm:p-5 flex items-center justify-between gap-3"
              role="status"
              aria-live="polite"
            >
              <span className="font-ibm-mono text-xs uppercase tracking-[0.09em] text-[#8b2500] font-medium">
                READING THE LABEL
              </span>
              <span className="font-ibm-serif text-xs text-[#57534a]">
                Resolving canonical profile and label guidance
              </span>
            </div>
          )}

          {/* Honest Network / Backend Error Notice */}
          {requestError && (
            <div className="ed-notice-crit p-4 sm:p-5 flex flex-col gap-3" role="alert">
              <div className="flex items-start gap-2.5">
                <div className="w-8 h-8 bg-[#f8f6f0] border border-[#8b2500] text-[#8b2500] flex items-center justify-center shrink-0 mt-0.5">
                  <WarningIcon size={16} />
                </div>
                <div className="space-y-1">
                  <span className="ed-tag ed-tag-crit font-semibold">
                    Lookup Unreachable
                  </span>
                  <p className="font-ibm-serif text-sm text-[#1a1a18] leading-relaxed">
                    {requestError}
                  </p>
                </div>
              </div>
              {lastFailedRequest && (
                <div className="pt-2 border-t border-[#d5cfc0] flex justify-end">
                  <button
                    type="button"
                    onClick={handleRetry}
                    disabled={loading}
                    className="ed-btn-ink"
                  >
                    <RefreshIcon size={14} />
                    <span>Retry</span>
                  </button>
                </div>
              )}
            </div>
          )}

          <div ref={bottomRef} />
        </section>

        {/* Composer Ledger Box */}
        <section
          aria-label="Ask about a medicine"
          className="ed-sheet p-4 sm:p-5 flex flex-col gap-3"
        >
          {activeMedicine ? (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#d5cfc0]">
              <div className="inline-flex items-center gap-2 font-ibm-mono text-[11px] uppercase tracking-[0.08em] text-[#1a1a18] font-medium">
                <PillIcon size={14} className="text-[#8b2500]" />
                <span>ASKING ABOUT: {activeMedicine.toUpperCase()}</span>
              </div>
              <button
                type="button"
                onClick={handleNewMedicine}
                disabled={loading}
                className="ed-btn-outline text-[11px] py-1 px-2.5 min-h-[32px]"
              >
                New medicine
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-2 pb-2.5 border-b border-[#d5cfc0]">
              <span className="font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#57534a]">
                Examples:
              </span>
              {EXAMPLE_MEDICINES.map((med) => (
                <button
                  key={med}
                  type="button"
                  onClick={() => submitQuery({ medicine: med, question: null, displayText: med })}
                  disabled={loading}
                  className="ed-btn-outline text-[11px] py-1 px-2.5 min-h-[32px]"
                >
                  {med}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex flex-col sm:flex-row gap-2.5">
            <label htmlFor="assistant-input" className="sr-only">
              {activeMedicine
                ? `Ask a follow-up question about ${activeMedicine}`
                : 'Enter a medicine name'}
            </label>
            <input
              id="assistant-input"
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              disabled={loading}
              maxLength={activeMedicine ? 500 : 100}
              placeholder={
                activeMedicine
                  ? `Ask a follow-up question about ${activeMedicine} (e.g. food rules, side effects)...`
                  : 'Enter a medicine name (e.g. Dolo 650, Warfarin, Metformin)...'
              }
              className="flex-1 bg-[#f8f6f0] border border-[#1a1a18] px-3.5 py-2.5 text-sm text-[#1a1a18] placeholder-[#57534a] outline-none min-h-[46px] font-ibm-serif disabled:opacity-60"
            />
            <button
              type="submit"
              disabled={loading || !inputValue.trim()}
              className="ed-btn-ink min-h-[46px] px-6 shrink-0 disabled:opacity-45 disabled:cursor-not-allowed"
            >
              <span>Ask</span>
              <ArrowRightIcon size={14} />
            </button>
          </form>
        </section>

        {/* Always-Visible Educational Disclaimer Strip */}
        <aside
          aria-label="Clinical educational disclaimer"
          className="border border-[#b7b09d] border-t-[3px] border-t-[#1a1a18] bg-[#f0ede1] p-4 flex items-start gap-3"
        >
          <WarningIcon size={16} className="text-[#8b2500] shrink-0 mt-0.5" />
          <div className="space-y-1">
            <span className="font-ibm-mono text-[10px] uppercase tracking-[0.08em] text-[#8b2500] font-semibold block">
              Educational Label Information Only
            </span>
            <p className="font-ibm-serif text-xs text-[#2d2b26] leading-relaxed">
              This assistant explains medicine label information for education only and is not medical advice. Questions about personal treatment, dosing changes, or symptoms belong to a doctor or pharmacist.
            </p>
          </div>
        </aside>
      </main>

      <Footer />
    </div>
  );
}

export default Assistant;
