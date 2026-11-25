import React, { useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useMedicine } from '../context/MedicineContext';
import { searchMedicines, checkMedicines } from '../lib/api';
import {
  ShieldCrossIcon,
  ShieldIcon,
  MedicalCrossIcon,
  DocumentIcon,
  PillIcon,
  ClockIcon,
  BookIcon,
  BalanceIcon,
} from './landing-icons';
import './landing.css';

const BRIEF_LEDGER_ITEMS = [
  {
    num: '01',
    title: 'OpenFDA label monographs',
    desc: 'Prescribing label sections, boxed warnings, and adverse reactions parsed per active ingredient.',
    Icon: BookIcon,
  },
  {
    num: '02',
    title: 'Curated interaction rules',
    desc: 'Evidence-annotated drug pair rules cross-checked for mechanism, clinical impact, and guidance.',
    Icon: BalanceIcon,
  },
  {
    num: '03',
    title: 'Brand alias resolution',
    desc: 'Indian and international brands including Crocin, Dolo, Ecosprin, and Omez mapped to generics.',
    Icon: PillIcon,
  },
  {
    num: '04',
    title: 'Severity and Stomach Guardian',
    desc: 'Pairwise conflicts ranked alongside a combined stomach stress score from 0 to 100.',
    Icon: ShieldCrossIcon,
  },
  {
    num: '05',
    title: '24-hour administration schedule',
    desc: 'Food, alcohol, and dose-spacing guidance anchored to your daily wake time.',
    Icon: ClockIcon,
  },
];

const WORKED_CASE_ROWS = [
  {
    pair: 'Warfarin + Aspirin',
    severityLabel: 'Critical',
    severityClass: 'sev-crit',
    mechanism:
      'Warfarin depletes vitamin K clotting factors while aspirin irreversibly inhibits platelet COX-1, breaking dual pathways of normal hemostasis and raising major gastrointestinal bleeding risk.',
    citation: 'OpenFDA Warfarin and Aspirin Drug Interactions; FDA Black Box Warning; CHEST Antithrombotic Guidelines',
  },
  {
    pair: 'Warfarin + Ibuprofen',
    severityLabel: 'Critical',
    severityClass: 'sev-crit',
    mechanism:
      'Ibuprofen displaces warfarin from plasma protein binding sites, inhibits CYP2C9 clearance, impairs platelet function, and erodes gastric mucosa, multiplying gastrointestinal bleeding 3- to 5-fold.',
    citation: 'OpenFDA Warfarin Boxed Warning and NSAID Drug Interactions; Lexicomp Clinical Monograph',
  },
  {
    pair: 'Aspirin + Ibuprofen',
    severityLabel: 'Caution',
    severityClass: 'sev-caut',
    mechanism:
      'Ibuprofen reversibly binds the platelet COX-1 catalytic channel and blocks low-dose aspirin from acetylating Serine 529, diminishing cardioprotection while adding stomach irritation.',
    citation: 'OpenFDA Aspirin Drug Interactions; FDA Drug Safety Communication; Circulation Journal',
  },
];

const CHECKER_CAPABILITIES = [
  {
    id: 'labels',
    num: '01',
    name: 'Labels',
    Icon: DocumentIcon,
    desc: 'Resolves brand names and salts to canonical active ingredients, then pulls OpenFDA prescribing labels and local clinical monographs.',
    docketCode: 'DOCKET 01 / LABEL INDEX',
    docketTitle: 'Active ingredient and monograph resolution',
    rows: [
      { field: 'Input parsing', value: 'Splits comma, semicolon, or line-delimited entries' },
      { field: 'Brand mapping', value: 'Crocin and Dolo resolve to Paracetamol; Ecosprin resolves to Aspirin' },
      { field: 'Combination check', value: 'Flags fixed-dose combinations for ingredient coverage' },
      { field: 'Source record', value: 'Curated clinical index paired with OpenFDA label cache' },
    ],
    footerNote: 'Unverified compounds trigger an explicit partial-coverage warning.',
  },
  {
    id: 'interactions',
    num: '02',
    name: 'Interactions',
    Icon: BalanceIcon,
    desc: 'Evaluates every unique pair in your medicine basket for pharmacokinetic and pharmacodynamic conflicts, citing the evidence basis.',
    docketCode: 'DOCKET 02 / PAIRWISE MATRIX',
    docketTitle: 'Pairwise drug-drug evaluation',
    rows: [
      { field: 'Warfarin + Aspirin', value: 'Critical: dual anticoagulant and antiplatelet bleeding hazard' },
      { field: 'Warfarin + Ibuprofen', value: 'Critical: CYP2C9 inhibition, protein displacement, stomach lining injury' },
      { field: 'Aspirin + Ibuprofen', value: 'Caution: competitive COX-1 blockade and additive irritation' },
      { field: 'Duplicate guard', value: 'Detects shared active ingredients across distinct brands' },
    ],
    footerNote: 'Every flagged edge records mechanism, clinical impact, and rule confidence.',
  },
  {
    id: 'severity',
    num: '03',
    name: 'Severity',
    Icon: MedicalCrossIcon,
    desc: 'Orders findings from Critical to Caution to Safe, separating life-threatening bleeding or toxicity hazards from timing adjustments.',
    docketCode: 'DOCKET 03 / RISK RANKING',
    docketTitle: 'Clinical severity stratification',
    rows: [
      { field: 'Critical tier', value: 'Hemorrhage, lactic acidosis, rhabdomyolysis, or hyperkalemia risk' },
      { field: 'Caution tier', value: 'Reduced efficacy, absorption block, or moderate organ strain' },
      { field: 'Compounded effects', value: 'Aggregates shared bleeding, sedation, hypotension, and GI burden' },
      { field: 'Action guidance', value: 'Surfaces physician monitoring or analgesic substitution notes' },
    ],
    footerNote: 'Analysis safety boolean remains false whenever coverage is incomplete.',
  },
  {
    id: 'stomach',
    num: '04',
    name: 'Stomach',
    Icon: ShieldIcon,
    desc: 'Computes the Stomach Guardian stomach stress score from 0 to 100 across verified drugs, adding penalties for multi-NSAID and anticoagulant stacks.',
    docketCode: 'DOCKET 04 / STOMACH GUARDIAN',
    docketTitle: 'How the stomach stress score is worked out',
    rows: [
      { field: 'Base profiles', value: 'Warfarin 50, Aspirin 75, Ibuprofen 85 (mean baseline 70)' },
      { field: 'Dual NSAID penalty', value: '+25 points for simultaneous COX-1 prostaglandin inhibition' },
      { field: 'Bleed synergy', value: '+30 points when anticoagulants and NSAIDs co-occur' },
      { field: 'PPI credit', value: '-20 points when a proton pump inhibitor is present (capped 5 to 100)' },
    ],
    footerNote: 'Case file combined outcome: 100 / 100 (High stomach stress).',
  },
  {
    id: 'schedule',
    num: '05',
    name: 'Schedule',
    Icon: ClockIcon,
    desc: 'Builds a 24-hour food, beverage, and administration timeline anchored to your wake time so absorption clashes stay separated.',
    docketCode: 'DOCKET 05 / 24-HOUR TIMELINE',
    docketTitle: 'Food and dose spacing plan',
    rows: [
      { field: 'Wake anchor', value: 'Calibrated to patient wake time (defaults to 07:00)' },
      { field: 'Empty stomach', value: 'Levothyroxine and PPIs scheduled 30 to 60 minutes pre-meal' },
      { field: 'With meals', value: 'NSAIDs and metformin anchored to meals to buffer gastric mucosa' },
      { field: 'Window spacing', value: 'Immediate-release ibuprofen separated from low-dose aspirin' },
    ],
    footerNote: 'Alcohol and vitamin K stability warnings attach directly to affected slots.',
  },
  {
    id: 'report',
    num: '06',
    name: 'Report',
    Icon: BookIcon,
    desc: 'Compiles all resolved drugs, pair severities, Stomach Guardian contributors, and personal notes into a print-ready doctor summary.',
    docketCode: 'DOCKET 06 / CLINICAL SUMMARY',
    docketTitle: 'Physician consultation export',
    rows: [
      { field: 'Regimen ledger', value: 'Lists every generic, drug class, and coverage verification state' },
      { field: 'Evidence table', value: 'Includes mechanism, action guidance, and OpenFDA / guideline basis' },
      { field: 'Personal notes', value: 'Attaches your local symptom or dosage notes per medicine' },
      { field: 'Data boundary', value: 'Formatted locally in your browser; nothing is transmitted externally' },
    ],
    footerNote: 'Designed for direct review with a prescribing physician or pharmacist.',
  },
];

const FAQ_ITEMS = [
  {
    q: 'What is MEDCHECK?',
    a: 'MEDCHECK is an evidence-cited medication safety checker. It resolves brand and generic drug names to canonical active ingredients, evaluates pairwise drug interactions against OpenFDA prescribing labels and curated clinical rules, scores cumulative gastrointestinal stress with Stomach Guardian, and produces a 24-hour food and dose schedule.',
  },
  {
    q: 'How is it different from asking a general chatbot?',
    a: 'A general chatbot predicts plausible prose from a prompt. MEDCHECK begins with structured OpenFDA label monographs and deterministic pharmacological rule tables, cites the underlying label or guideline source on every flagged pair, and states explicitly when label data for a medicine is incomplete.',
  },
  {
    q: 'Does it replace my doctor?',
    a: 'No. MEDCHECK provides informational clinical pharmacology data, not a diagnosis or individualized medical advice. Always consult your prescribing physician or pharmacist before starting, stopping, or changing any medicine, and use the exported summary to support that conversation.',
  },
  {
    q: 'Will it recognize Indian and international brand names?',
    a: 'Yes. Select Indian and international brand aliases, including Crocin, Dolo, Ecosprin, Brufen, Combiflam, Pan 40, and Omez, are resolved to their generic active ingredients before interaction and gastrointestinal risk analysis runs.',
  },
  {
    q: 'How is my data handled?',
    a: 'Anonymous guest sessions require no signup, no payment card, no advertising trackers, and no data selling. Your active medicine basket and notes remain in your local browser storage unless you choose to register an account.',
  },
  {
    q: 'What does it cost?',
    a: 'Nothing. All features in the safety dashboard, Drug Explorer, and doctor report export are free to use because the underlying prescribing label records are public.',
  },
];

function formatSeverityLabel(severity) {
  if (severity === 'high') return { label: 'Critical', cls: 'sev-crit' };
  if (severity === 'moderate') return { label: 'Caution', cls: 'sev-caut' };
  if (severity === 'low') return { label: 'Low', cls: 'sev-caut' };
  return { label: 'Safe', cls: 'sev-safe' };
}

function formatDrugDisplay(name) {
  if (!name) return '';
  return name.charAt(0).toUpperCase() + name.slice(1);
}

export function Landing() {
  const navigate = useNavigate();
  const { medicines, addMedicine, loadPreset, demoPresets } = useMedicine();

  const [inputValue, setInputValue] = useState('');
  const [isScanning, setIsScanning] = useState(false);
  const [showScanResult, setShowScanResult] = useState(false);
  const [scanData, setScanData] = useState({
    status: 'idle', // 'idle' | 'analyzed' | 'fallback' | 'single' | 'none'
    resolved: [],
    unknown: [],
    interactions: [],
    critCount: 0,
    cautCount: 0,
    giScore: null,
    giTier: null,
    summary: '',
  });

  const [activeTab, setActiveTab] = useState(0);
  const medInputRef = useRef(null);

  const handleScanSubmit = async (e) => {
    e.preventDefault();
    const raw = inputValue.trim();
    if (!raw) return;

    setIsScanning(true);

    const tokens = raw
      .split(/[,;\n]+/)
      .map((s) => s.trim())
      .filter(Boolean);

    const seenQueries = new Set();
    const uniqueQueries = [];
    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (!seenQueries.has(lower)) {
        seenQueries.add(lower);
        uniqueQueries.push(token);
      }
    }

    const resolved = [];
    const unknown = [];

    for (const query of uniqueQueries) {
      try {
        const results = await searchMedicines(query);
        if (results && results.length > 0) {
          const match = results[0];
          const rawGen = match.generic_name || match.name;
          const canonical = rawGen.charAt(0).toUpperCase() + rawGen.slice(1).toLowerCase();
          resolved.push({
            query,
            genericName: canonical,
            drugType: match.drug_type || 'otc',
            severity: 'neutral',
          });
        } else {
          unknown.push(query);
        }
      } catch (err) {
        console.warn('Search lookup error for:', query, err);
        unknown.push(query);
      }
    }

    const uniqueResolvedMap = new Map();
    for (const item of resolved) {
      const key = item.genericName.toLowerCase();
      if (!uniqueResolvedMap.has(key)) {
        uniqueResolvedMap.set(key, item);
      }
    }
    const uniqueResolved = Array.from(uniqueResolvedMap.values());

    // Add newly resolved medicines to basket under canonical generic names
    const existingLower = new Set(medicines.map((m) => m.name.toLowerCase()));
    for (const item of uniqueResolved) {
      const lowerKey = item.genericName.toLowerCase();
      if (!existingLower.has(lowerKey)) {
        existingLower.add(lowerKey);
        addMedicine(item.genericName, item.drugType);
      }
    }

    if (uniqueResolved.length >= 2) {
      try {
        const namesToAnalyze = uniqueResolved.map((m) => m.genericName);
        const checkResult = await checkMedicines(namesToAnalyze);

        const interactions = (checkResult.interactions || []).filter((ix) => ix.severity !== 'none');
        const critCount = interactions.filter((ix) => ix.severity === 'high').length;
        const cautCount = interactions.filter((ix) => ix.severity === 'moderate').length;
        const giScore = checkResult.composite_gi_score ?? null;
        const giTier = checkResult.composite_gi_tier ?? null;

        const resolvedWithSeverity = uniqueResolved.map((m) => {
          const lower = m.genericName.toLowerCase();
          const related = interactions.filter(
            (ix) => ix.drug_a.toLowerCase() === lower || ix.drug_b.toLowerCase() === lower
          );
          let severity = 'safe';
          if (related.some((ix) => ix.severity === 'high')) {
            severity = 'crit';
          } else if (related.some((ix) => ix.severity === 'moderate')) {
            severity = 'caut';
          }
          return { ...m, severity };
        });

        setScanData({
          status: 'analyzed',
          resolved: resolvedWithSeverity,
          unknown,
          interactions,
          critCount,
          cautCount,
          giScore,
          giTier,
          summary: checkResult.summary || '',
        });
      } catch (analysisErr) {
        console.warn('Real analysis call failed (offline/unreachable):', analysisErr);
        setScanData({
          status: 'fallback',
          resolved: uniqueResolved.map((m) => ({ ...m, severity: 'neutral' })),
          unknown,
          interactions: [],
          critCount: 0,
          cautCount: 0,
          giScore: null,
          giTier: null,
          summary: '',
        });
      }
    } else if (uniqueResolved.length === 1) {
      setScanData({
        status: 'single',
        resolved: uniqueResolved.map((m) => ({ ...m, severity: 'safe' })),
        unknown,
        interactions: [],
        critCount: 0,
        cautCount: 0,
        giScore: null,
        giTier: null,
        summary: '',
      });
    } else {
      setScanData({
        status: 'none',
        resolved: [],
        unknown,
        interactions: [],
        critCount: 0,
        cautCount: 0,
        giScore: null,
        giTier: null,
        summary: '',
      });
    }

    setShowScanResult(true);
    setIsScanning(false);
  };

  const handleOpenFullScan = () => {
    navigate('/app');
  };

  const handleRunExampleCase = () => {
    const sarahPreset = demoPresets.find((p) => p.id === 'sarah-demo') || demoPresets[0];
    if (sarahPreset) {
      loadPreset(sarahPreset);
    }
    navigate('/app');
  };

  const currentTab = CHECKER_CAPABILITIES[activeTab];

  return (
    <div className="landing-page">
      {/* 1. HEADER */}
      <header className="ed-header">
        <div className="ed-wrap ed-nav-inner">
          <a className="ed-brand" href="#top" aria-label="MEDCHECK home">
            <span className="ed-brand-mark" aria-hidden="true">
              <ShieldCrossIcon size={18} />
            </span>
            <span className="ed-wordmark">MEDCHECK</span>
          </a>

          <div className="ed-nav-right">
            <nav className="ed-nav-links" aria-label="Main navigation">
              <a href="#checker">The Checker</a>
              <a href="#example">The Example</a>
              <a href="#questions">Questions</a>
            </nav>

            <Link to="/app" className="ed-btn-outline">
              Open the Safety Dashboard
            </Link>
          </div>
        </div>
      </header>

      <main id="top">
        {/* 2. HERO */}
        <section className="ed-hero" aria-labelledby="hero-heading">
          <div className="ed-wrap ed-hero-grid">
            <div>
              <div className="ed-kicker ed-mono">
                <DocumentIcon size={15} />
                <span>Evidence-cited medication safety</span>
              </div>

              <h1 id="hero-heading">Medication safety, checked against the label.</h1>

              <p className="ed-lede">
                MEDCHECK evaluates your regimen against OpenFDA prescribing labels and curated clinical rules to surface
                drug interactions, side-effect compounding, food and timing conflicts, and Stomach Guardian stomach risk.
                Enter prescription drugs, over-the-counter medicines, or common brands to review every pair before you
                take them together.
              </p>

              <div className="ed-scan-wrap">
                <form onSubmit={handleScanSubmit}>
                  <label htmlFor="medInput" className="ed-scan-label ed-mono">
                    Paste or type medicines (comma, semicolon, or line separated)
                  </label>
                  <div className="ed-scan-box">
                    <input
                      ref={medInputRef}
                      id="medInput"
                      type="text"
                      placeholder="e.g. Warfarin, Aspirin, Ibuprofen or Crocin, Ecosprin"
                      autoComplete="off"
                      value={inputValue}
                      onChange={(e) => setInputValue(e.target.value)}
                      disabled={isScanning}
                      aria-describedby="scanHint"
                    />
                    <button className="ed-btn-ink" type="submit" disabled={isScanning}>
                      {isScanning ? 'Checking' : 'Check labels'}
                    </button>
                  </div>
                </form>

                {isScanning && (
                  <p className="ed-scan-status ed-mono" role="status" aria-live="polite">
                    CHECKING THE LABELS
                  </p>
                )}

                {showScanResult && !isScanning && (
                  <div className="ed-scan-result" role="region" aria-label="Label check summary">
                    <div className="ed-tag-row">
                      {scanData.resolved.map((m, idx) => (
                        <span
                          key={`res-${idx}`}
                          className={`ed-tag ${
                            m.severity === 'crit'
                              ? 'crit'
                              : m.severity === 'caut'
                              ? 'caut'
                              : m.severity === 'safe'
                              ? 'safe'
                              : ''
                          }`}
                        >
                          {m.genericName}
                        </span>
                      ))}
                      {scanData.unknown.map((u, idx) => (
                        <span key={`unk-${idx}`} className="ed-tag unk">
                          ? {u}
                        </span>
                      ))}
                    </div>

                    {scanData.status === 'analyzed' && (
                      <>
                        <div className="ed-scan-summary-bar">
                          <span>{scanData.resolved.length} medicines</span>
                          <span style={{ color: scanData.critCount > 0 ? 'var(--terracotta)' : 'var(--ink)' }}>
                            {scanData.critCount} critical
                          </span>
                          <span style={{ color: scanData.cautCount > 0 ? 'var(--amber)' : 'var(--ink)' }}>
                            {scanData.cautCount} caution
                          </span>
                          <span>
                            Stomach Guardian{' '}
                            {scanData.giScore !== null
                              ? `${scanData.giScore}/100${scanData.giTier ? ` (${scanData.giTier})` : ''}`
                              : 'Unavailable'}
                          </span>
                        </div>

                        <div className="ed-scan-docket-wrap">
                          <table className="ed-scan-docket">
                            <thead>
                              <tr>
                                <th scope="col">Pair</th>
                                <th scope="col">Severity</th>
                                <th scope="col">Finding</th>
                              </tr>
                            </thead>
                            <tbody>
                              {scanData.interactions.length > 0 ? (
                                scanData.interactions.map((ix, idx) => {
                                  const sev = formatSeverityLabel(ix.severity);
                                  return (
                                    <tr key={`${ix.drug_a}-${ix.drug_b}-${idx}`}>
                                      <td style={{ whiteSpace: 'nowrap', fontWeight: 600 }}>
                                        {formatDrugDisplay(ix.drug_a)} + {formatDrugDisplay(ix.drug_b)}
                                      </td>
                                      <td className={sev.cls}>{sev.label}</td>
                                      <td>{ix.mechanism || ix.explanation}</td>
                                    </tr>
                                  );
                                })
                              ) : (
                                <tr>
                                  <td>Analyzed basket</td>
                                  <td className="sev-safe">Safe</td>
                                  <td>
                                    {scanData.summary ||
                                      'No known pairwise interactions detected in verified clinical records.'}
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    )}

                    {scanData.status === 'fallback' && (
                      <p className="ed-scan-note">
                        {scanData.resolved.length} medicines resolved and added to your basket. The live interaction
                        check could not finish here; the full check is ready in the dashboard.
                      </p>
                    )}

                    {scanData.status === 'single' && (
                      <p className="ed-scan-note">
                        1 medicine resolved and added to your basket. Add at least two medicines to run pairwise
                        interaction checks, or open the dashboard for its full monograph profile.
                      </p>
                    )}

                    {scanData.status === 'none' && (
                      <p className="ed-scan-note">
                        No catalog matches were found for those entries. Try generic active ingredients or common brands
                        such as Warfarin, Aspirin, Ibuprofen, Crocin, Dolo, or Ecosprin.
                      </p>
                    )}

                    <button type="button" className="ed-btn-outline" onClick={handleOpenFullScan}>
                      Open the full scan
                    </button>
                  </div>
                )}

                <p className="ed-scan-hint ed-mono" id="scanHint">
                  Free to run · No account · No card · Anonymous guest session
                </p>
              </div>
            </div>

            <aside className="ed-brief-sheet" aria-labelledby="brief-heading">
              <div className="ed-brief-head">
                <div>
                  <span className="ed-mono" style={{ color: 'var(--ink-muted)' }}>
                    Index and Sources
                  </span>
                  <h2 id="brief-heading">What the checker reads</h2>
                </div>
                <ShieldCrossIcon size={22} />
              </div>

              <ol className="ed-brief-list">
                {BRIEF_LEDGER_ITEMS.map((item) => {
                  const IconComp = item.Icon;
                  return (
                    <li key={item.num} className="ed-brief-item">
                      <span className="ed-brief-num">{item.num}</span>
                      <span className="ed-brief-icon">
                        <IconComp size={17} />
                      </span>
                      <div>
                        <span className="ed-brief-title">{item.title}</span>
                        <span className="ed-brief-desc">{item.desc}</span>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </aside>
          </div>
        </section>

        {/* 3. THE WORKED EXAMPLE (DOCKET) */}
        <section id="example" className="ed-section" aria-labelledby="example-heading">
          <div className="ed-wrap">
            <div className="ed-sec-head">
              <div className="ed-mono">Section 01 · Worked Clinical Docket</div>
              <h2 id="example-heading">Case file: Warfarin, Aspirin, Ibuprofen</h2>
              <p>
                A three-agent regimen combining an oral anticoagulant with two NSAIDs, evaluated against OpenFDA
                prescribing labels and deterministic clinical rules.
              </p>
            </div>

            <div className="ed-docket-wrap">
              <table className="ed-docket-table">
                <thead>
                  <tr>
                    <th scope="col">Pair / Assessment</th>
                    <th scope="col">Severity</th>
                    <th scope="col">Mechanism in plain words</th>
                    <th scope="col">OpenFDA and clinical basis</th>
                  </tr>
                </thead>
                <tbody>
                  {WORKED_CASE_ROWS.map((row) => (
                    <tr key={row.pair}>
                      <td className="ed-docket-pair">{row.pair}</td>
                      <td className={row.severityClass}>{row.severityLabel}</td>
                      <td>{row.mechanism}</td>
                      <td className="ed-docket-cite">{row.citation}</td>
                    </tr>
                  ))}
                  <tr className="ed-docket-outcome">
                    <td className="ed-docket-pair">Stomach Guardian outcome</td>
                    <td className="sev-crit">High · 100 / 100</td>
                    <td>
                      Each medicine starts with a stomach stress score of its own (Warfarin 50, Aspirin 75, Ibuprofen 85;
                      average 70). Two NSAID painkillers together add +25, and a blood thinner taken with an NSAID adds
                      +30 for bleeding risk. The total is capped at 100.
                    </td>
                    <td className="ed-docket-cite">
                      MEDCHECK Stomach Guardian scoring rules; OpenFDA label warnings on stomach bleeding and ulcers
                    </td>
                  </tr>
                </tbody>
              </table>
            </div>

            <p className="ed-docket-cite" style={{ marginTop: '12px', marginBottom: 0 }}>
              The Stomach Guardian score is MEDCHECK&apos;s own way of adding up stomach risk from the warnings on each
              medicine&apos;s label. It is not a clinical standard or a medical measurement.
            </p>

            <div className="ed-docket-action">
              <button type="button" className="ed-text-link" onClick={handleRunExampleCase}>
                Run this case in the dashboard
              </button>
              <span className="ed-mono" style={{ color: 'var(--ink-muted)' }}>
                Preset: Sarah&apos;s Demo (sarah-demo) · 2 Critical · 1 Caution · GI 100/100
              </span>
            </div>
          </div>
        </section>

        {/* 4. THE CHECKER (LEDGER + TABBED DOCKET) */}
        <section id="checker" className="ed-section" aria-labelledby="checker-heading">
          <div className="ed-wrap">
            <div className="ed-sec-head">
              <div className="ed-mono">Section 02 · Capabilities Ledger</div>
              <h2 id="checker-heading">Six steps from drug name to clinical dossier</h2>
              <p>
                Select any numbered step in the ledger to inspect its underlying rule structure and output record.
              </p>
            </div>

            <div className="ed-checker-grid">
              <div className="ed-ledger-list" role="tablist" aria-label="Checker capabilities">
                {CHECKER_CAPABILITIES.map((cap, idx) => {
                  const IconComp = cap.Icon;
                  const isActive = activeTab === idx;
                  return (
                    <button
                      key={cap.id}
                      type="button"
                      role="tab"
                      id={`tab-${cap.id}`}
                      aria-selected={isActive}
                      aria-controls={`panel-${cap.id}`}
                      className={`ed-ledger-tab ${isActive ? 'active' : ''}`}
                      onClick={() => setActiveTab(idx)}
                    >
                      <span className="ed-ledger-num">{cap.num}</span>
                      <span className="ed-ledger-icon">
                        <IconComp size={17} />
                      </span>
                      <span>
                        <span className="ed-ledger-title">{cap.name}</span>
                        <span className="ed-ledger-desc">{cap.desc}</span>
                      </span>
                    </button>
                  );
                })}
              </div>

              <div
                className="ed-specimen-sheet"
                role="tabpanel"
                id={`panel-${currentTab.id}`}
                aria-labelledby={`tab-${currentTab.id}`}
              >
                <div key={currentTab.id} className="ed-specimen-body">
                  <div className="ed-specimen-header">
                    <span className="ed-mono">{currentTab.docketCode}</span>
                    <currentTab.Icon size={18} />
                  </div>

                  <h3 className="ed-specimen-title">{currentTab.docketTitle}</h3>

                  <table className="ed-specimen-table">
                    <tbody>
                      {currentTab.rows.map((r) => (
                        <tr key={r.field}>
                          <th scope="row">{r.field}</th>
                          <td>{r.value}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <p className="ed-specimen-foot">{currentTab.footerNote}</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 5. MODES: GUARDIAN AND CO-PILOT */}
        <section id="modes" className="ed-section" aria-labelledby="modes-heading">
          <div className="ed-wrap">
            <div className="ed-sec-head">
              <div className="ed-mono">Section 03 · Operating Modes</div>
              <h2 id="modes-heading">Guardian and Co-pilot</h2>
              <p>Use automated regimen screening or step through every pharmacological record manually.</p>
            </div>

            <div className="ed-modes-grid">
              <article className="ed-mode-sheet forest-top">
                <div className="ed-mode-head">
                  <span className="ed-mono" style={{ color: 'var(--forest)' }}>
                    Mode 01 · Hands-off
                  </span>
                  <ShieldIcon size={18} />
                </div>
                <h3>Guardian</h3>
                <p className="ed-mode-lede">
                  Built for patients and caregivers who want clear safety flags and an ordered daily schedule without
                  parsing monographs by hand.
                </p>

                <ol className="ed-mode-steps">
                  <li>
                    <span className="step-num">01</span>
                    <div>
                      <strong>How it works</strong>
                      Resolves generic ingredients, scores every pair against OpenFDA labels and curated rules, and
                      calculates the Stomach Guardian composite score automatically.
                    </div>
                  </li>
                  <li>
                    <span className="step-num">02</span>
                    <div>
                      <strong>Involvement</strong>
                      Review the severity summary and inspect the generated 24-hour food and spacing plan before taking
                      action.
                    </div>
                  </li>
                  <li>
                    <span className="step-num">03</span>
                    <div>
                      <strong>Control</strong>
                      Your basket and wake time define the guardrails; nothing is altered, submitted, or shared without
                      your explicit choice.
                    </div>
                  </li>
                </ol>
              </article>

              <article className="ed-mode-sheet">
                <div className="ed-mode-head">
                  <span className="ed-mono" style={{ color: 'var(--terracotta)' }}>
                    Mode 02 · Hands-on
                  </span>
                  <BalanceIcon size={18} />
                </div>
                <h3>Co-pilot</h3>
                <p className="ed-mode-lede">
                  Built for clinicians, pharmacists, and attentive patients who want to inspect mechanisms, evidence
                  sources, and coverage directly.
                </p>

                <ol className="ed-mode-steps">
                  <li>
                    <span className="step-num">01</span>
                    <div>
                      <strong>How it works</strong>
                      Opens the interactive interaction matrix, side-effect compounding ledger, individual drug dossiers,
                      and rule provenance side by side.
                    </div>
                  </li>
                  <li>
                    <span className="step-num">02</span>
                    <div>
                      <strong>Involvement</strong>
                      Examine underlying mechanisms, check partial-data flags, and compare timing windows or alternative
                      analgesics directly in the workspace.
                    </div>
                  </li>
                  <li>
                    <span className="step-num">03</span>
                    <div>
                      <strong>Control</strong>
                      Add or remove compounds freely, adjust wake timing, attach personal notes, and print the doctor
                      summary on demand.
                    </div>
                  </li>
                </ol>
              </article>
            </div>
          </div>
        </section>

        {/* 6. FREE STATEMENT */}
        <section id="access" className="ed-section" aria-labelledby="free-heading">
          <div className="ed-wrap">
            <div className="ed-free-ledger">
              <div className="ed-mono">Public Access Ledger</div>
              <h2 id="free-heading">Free. No account, no card, no advertising, no data selling.</h2>
              <p>
                Every analysis runs on public OpenFDA prescribing label data and curated pharmacological rules over
                anonymous guest sessions.
              </p>
              <Link to="/app" className="ed-btn-outline">
                Open the Safety Dashboard
              </Link>
            </div>
          </div>
        </section>

        {/* 7. QUESTIONS (FAQ) */}
        <section id="questions" className="ed-section" aria-labelledby="questions-heading">
          <div className="ed-wrap">
            <div className="ed-sec-head">
              <div className="ed-mono">Section 04 · Questions</div>
              <h2 id="questions-heading">Common questions</h2>
              <p>Direct answers on label sources, brand resolution, privacy, and clinical boundaries.</p>
            </div>

            <div className="ed-faq-list">
              {FAQ_ITEMS.map((item) => (
                <details key={item.q} className="ed-faq-item">
                  <summary>
                    <span>{item.q}</span>
                    <span className="ed-faq-toggle" aria-hidden="true" />
                  </summary>
                  <div className="ed-faq-answer">{item.a}</div>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 8. FINAL BLOCK */}
        <section className="ed-final-section" aria-labelledby="final-heading">
          <div className="ed-wrap">
            <div className="ed-final-panel">
              <div>
                <div className="ed-mono">Ready to verify</div>
                <h2 id="final-heading">Check your medicines against the label.</h2>
                <p>
                  Enter your prescriptions, over-the-counter pain relievers, or brand names to inspect interactions,
                  Stomach Guardian score, and 24-hour timing in the Safety Dashboard.
                </p>
              </div>
              <div>
                <Link to="/app" className="ed-btn-parchment">
                  Check my medicines
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      {/* 9. FOOTER */}
      <footer className="ed-footer">
        <div className="ed-wrap">
          <div className="ed-footer-top">
            <a className="ed-brand" href="#top" aria-label="MEDCHECK top">
              <span className="ed-brand-mark" aria-hidden="true">
                <ShieldCrossIcon size={18} />
              </span>
              <span className="ed-wordmark">MEDCHECK</span>
            </a>

            <nav className="ed-footer-links" aria-label="Footer navigation">
              <a href="#checker">The Checker</a>
              <a href="#example">The Example</a>
              <a href="#questions">Questions</a>
              <Link to="/app">Safety Dashboard</Link>
              <Link to="/explorer">Drug Explorer</Link>
            </nav>
          </div>

          <p className="ed-footer-disclaimer">
            <strong>Clinical Safety Disclaimer:</strong> MEDCHECK provides informational clinical pharmacology data
            synthesized from OpenFDA prescribing labels and verified pharmacological rules. It is not a substitute for
            clinical judgment or individualized medical advice. Always consult your prescribing physician before altering
            any drug regimen.
          </p>

          <p className="ed-footer-meta">
            MEDCHECK v2.0 · OpenFDA Prescribing Labels and Curated Pharmacological Rules
          </p>
        </div>
      </footer>
    </div>
  );
}
export default Landing;
