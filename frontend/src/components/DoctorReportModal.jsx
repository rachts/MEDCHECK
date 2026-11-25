import React, { useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import { useMedicine } from '../context/MedicineContext';
import { useModalDismiss } from '../hooks/useModalDismiss';
import {
  CloseIcon,
  PrinterIcon,
  CopyIcon,
  CheckIcon,
  DocumentIcon,
  WarningIcon,
  ClockIcon,
  PillIcon,
  ShieldCrossIcon,
  NetworkIcon,
} from '../pages/landing-icons';

export function ReportContent({
  medicines,
  results,
  personalNotes,
  providerName,
  setProviderName,
  copyError,
  isPrint = false,
}) {
  const interactions = (results?.interactions || []).filter((i) => i.severity !== 'none');
  const foodConflicts = results?.food_conflicts || [];
  const limitedDataWarnings = results?.limited_data_warnings || [];
  const aggregatedSideEffects = results?.aggregated_side_effects || [];
  const giScore = results?.composite_gi_score ?? 0;

  return (
    <div className={`ed-modal space-y-5 bg-[#f8f6f0] text-[#1a1a18] font-ibm-serif ${isPrint ? 'p-6' : ''}`}>
      {copyError && !isPrint && (
        <div className="ed-notice-caut p-3 text-xs flex items-start gap-2 no-print" role="alert">
          <WarningIcon size={15} className="shrink-0 mt-0.5" />
          <span>{copyError}</span>
        </div>
      )}

      {/* Header Info */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-[#f0ede1] border border-[#b7b09d]">
        <div>
          <label
            htmlFor={isPrint ? 'print-report-patient-name' : 'report-patient-name'}
            className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em]"
          >
            Patient / Session
          </label>
          {isPrint ? (
            <span className="text-sm font-semibold text-[#1a1a18] font-newsreader block mt-0.5">
              {providerName || 'Self / Anonymous'}
            </span>
          ) : (
            <input
              id="report-patient-name"
              name="patientName"
              type="text"
              autoComplete="name"
              value={providerName}
              onChange={(e) => setProviderName(e.target.value)}
              placeholder="Enter patient name..."
              className="bg-transparent text-sm font-semibold text-[#1a1a18] outline-none border-b border-[#b7b09d] focus:border-[#1a1a18] w-full font-newsreader mt-0.5 pb-0.5"
            />
          )}
        </div>
        <div>
          <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em]">
            Active Regimen
          </span>
          <span className="text-sm font-semibold text-[#1a1a18] font-newsreader block mt-0.5">
            {medicines.map((m) => m.name).join(', ') || 'No medications'}
          </span>
        </div>
        <div>
          <span className="font-ibm-mono text-[10px] text-[#57534a] uppercase block font-medium tracking-[0.07em]">
            Stomach Health Score
          </span>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className={`font-newsreader text-base font-semibold tabular-nums ${
              giScore > 60 ? 'text-[#8b2500]' : giScore > 30 ? 'text-[#8a5300]' : 'text-[#2d4a22]'
            }`}>
              {!results ? '--' : results?.composite_gi_tier === 'unknown' ? 'N/A' : `${giScore}/100`}
            </span>
            <span className={`ed-tag ${
              !results || results?.composite_gi_tier === 'unknown'
                ? ''
                : results?.composite_gi_tier === 'high'
                ? 'ed-tag-crit'
                : results?.composite_gi_tier === 'moderate'
                ? 'ed-tag-caut'
                : 'ed-tag-safe'
            }`}>
              {!results ? 'NOT ANALYZED' : results?.composite_gi_tier?.toUpperCase() || 'UNKNOWN'}
            </span>
          </div>
        </div>
      </div>

      {/* Section 1: Identified Drug Interactions */}
      <div className="space-y-2.5">
        <h3 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] border-b border-[#b7b09d] pb-1.5 flex items-center gap-2">
          <ShieldCrossIcon size={16} className="text-[#1a1a18]" />
          <span>1. Drug Interaction Matrix ({interactions.length})</span>
        </h3>

        {interactions.length === 0 ? (
          <p className="text-xs text-[#57534a] italic p-3 bg-[#f0ede1] border border-[#d5cfc0]">
            No acute pharmacokinetic or pharmacodynamic drug interactions identified across loaded medicines.
          </p>
        ) : (
          <div className="space-y-2">
            {interactions.map((i, idx) => (
              <div
                key={`${i.drug_a}-${i.drug_b}-${idx}`}
                className={`p-3 bg-[#f0ede1] border text-xs space-y-1 ${
                  i.severity === 'high'
                    ? 'border-[#8b2500] border-t-[3px] border-t-[#8b2500]'
                    : i.severity === 'moderate'
                    ? 'border-[#8a5300] border-t-[3px] border-t-[#8a5300]'
                    : 'border-[#d5cfc0]'
                }`}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-newsreader font-semibold text-[15px] text-[#1a1a18]">
                    {i.drug_a} + {i.drug_b}
                  </span>
                  <span className={`ed-tag ${
                    i.severity === 'high'
                      ? 'ed-tag-crit'
                      : i.severity === 'moderate'
                      ? 'ed-tag-caut'
                      : 'ed-tag-safe'
                  }`}>
                    {i.severity?.toUpperCase()} RISK
                  </span>
                </div>
                <p className="text-xs text-[#1a1a18] leading-relaxed">{i.explanation}</p>
                {i.mechanism && (
                  <p className="text-xs text-[#57534a] font-ibm-serif">
                    Mechanism: {i.mechanism}
                  </p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 1.5: Data Limitations & Unverified Drugs */}
      {limitedDataWarnings.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-newsreader text-[18px] font-semibold text-[#8a5300] border-b border-[#b7b09d] pb-1.5 flex items-center gap-2">
            <WarningIcon size={16} className="text-[#8a5300]" />
            <span>1.5 Data Limitations &amp; Unverified Drugs ({limitedDataWarnings.length})</span>
          </h3>
          <div className="ed-notice-caut p-3 text-xs space-y-1.5">
            {limitedDataWarnings.map((warning, idx) => (
              <p key={idx} className="text-xs text-[#1a1a18] leading-relaxed">
                · {warning}
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Section 2: Food & Administration Guidance */}
      <div className="space-y-2.5">
        <h3 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] border-b border-[#b7b09d] pb-1.5 flex items-center gap-2">
          <ClockIcon size={16} className="text-[#1a1a18]" />
          <span>2. Food, Beverage &amp; Timing Rules ({foodConflicts.length})</span>
        </h3>

        {foodConflicts.length === 0 ? (
          <p className="text-xs text-[#57534a] italic p-3 bg-[#f0ede1] border border-[#d5cfc0]">
            Standard water co-administration recommended. No acute food timing blocks.
          </p>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {foodConflicts.map((f, idx) => (
              <div
                key={`${f.medicine_a}-${f.medicine_b}-${f.conflict_type}-${idx}`}
                className="p-3 bg-[#f0ede1] border border-[#b7b09d] text-xs"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-newsreader font-semibold text-[14px] text-[#1a1a18]">
                    {f.medicine_a} + {f.medicine_b}
                  </span>
                  <span className="ed-tag ed-tag-caut whitespace-nowrap">{f.conflict_type}</span>
                </div>
                <p className="text-xs font-semibold text-[#1a1a18] mt-1">{f.conflict}</p>
                <p className="text-xs text-[#57534a] mt-0.5">
                  Recommended: {f.recommended_schedule}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2.5: Amplified / Compounded Side Effects */}
      {aggregatedSideEffects.length > 0 && (
        <div className="space-y-2.5">
          <h3 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] border-b border-[#b7b09d] pb-1.5 flex items-center gap-2">
            <NetworkIcon size={16} className="text-[#1a1a18]" />
            <span>2.5 Amplified / Compounded Side Effects ({aggregatedSideEffects.length})</span>
          </h3>
          <div className="space-y-2">
            {aggregatedSideEffects.map((se, idx) => (
              <div
                key={`${se.effect}-${idx}`}
                className="p-3 bg-[#f0ede1] border border-[#b7b09d] text-xs space-y-1"
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="font-newsreader font-semibold text-[14px] text-[#1a1a18]">
                    {se.effect}
                  </span>
                  <span className="ed-tag ed-tag-caut">
                    Compounded Risk
                  </span>
                </div>
                <p className="text-xs text-[#2d2b26]">
                  Contributing sources: <strong className="text-[#1a1a18]">{se.sources.join(', ')}</strong>
                </p>
                {se.clinical_note && (
                  <p className="text-xs text-[#57534a] font-ibm-serif">
                    Clinical Note: {se.clinical_note}
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Section 3: Patient Specific Notes */}
      <div className="space-y-2.5">
        <h3 className="font-newsreader text-[18px] font-semibold text-[#1a1a18] border-b border-[#b7b09d] pb-1.5 flex items-center gap-2">
          <PillIcon size={16} className="text-[#1a1a18]" />
          <span>3. Patient Notes &amp; Administration Context</span>
        </h3>

        <div className="space-y-1.5">
          {medicines.map((m) => {
            const note = personalNotes[m.name.toLowerCase()];
            return (
              <div key={m.id} className="p-2.5 bg-[#f0ede1] border border-[#d5cfc0] text-xs flex items-start gap-2">
                <span className="font-newsreader font-semibold text-[14px] text-[#1a1a18] min-w-[100px]">{m.name}:</span>
                <span className="text-xs text-[#2d2b26] italic">
                  {note || 'No custom notes logged.'}
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <div className="pt-3 border-t border-[#b7b09d] text-center font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a]">
        MEDCHECK Clinical Brief · Built on OpenFDA Prescribing Data · Informational Summary
      </div>
    </div>
  );
}

export function DoctorReportModal() {
  const {
    doctorReportOpen,
    setDoctorReportOpen,
    medicines,
    results,
    personalNotes,
    providerName,
    setProviderName
  } = useMedicine();

  const [copied, setCopied] = useState(false);
  const [copyError, setCopyError] = useState(null);

  const closeModal = useCallback(() => setDoctorReportOpen(false), [setDoctorReportOpen]);
  const dialogRef = useModalDismiss(doctorReportOpen, closeModal);

  if (!doctorReportOpen) return null;

  const interactions = (results?.interactions || []).filter((i) => i.severity !== 'none');
  const foodConflicts = results?.food_conflicts || [];
  const limitedDataWarnings = results?.limited_data_warnings || [];
  const aggregatedSideEffects = results?.aggregated_side_effects || [];
  const giScore = results?.composite_gi_score ?? 0;

  const handlePrint = () => {
    window.print();
  };

  const handleCopySummary = async () => {
    let reportMd = `# MEDCHECK CLINICAL BRIEF\n`;
    reportMd += `Date: ${new Date().toLocaleDateString()}\n`;
    reportMd += `Patient/Client: ${providerName || 'Self'}\n\n`;

    reportMd += `## 1. ACTIVE REGIMEN (${medicines.length} medications)\n`;
    medicines.forEach((m) => {
      reportMd += `- ${m.name} (${m.drugType.toUpperCase()})\n`;
      if (personalNotes[m.name.toLowerCase()]) {
        reportMd += `  Note: ${personalNotes[m.name.toLowerCase()]}\n`;
      }
    });

    if (limitedDataWarnings.length > 0) {
      reportMd += `\n## 1.5 DATA LIMITATIONS & UNVERIFIED DRUGS\n`;
      limitedDataWarnings.forEach((w) => {
        reportMd += `- ${w}\n`;
      });
    }

    reportMd += `\n## 2. SAFETY & INTERACTION SUMMARY\n`;
    reportMd += `- Composite Stomach Score: ${!results ? 'Not Analyzed' : results?.composite_gi_tier === 'unknown' ? 'Unknown' : `${giScore}/100 (${results?.composite_gi_tier || 'gentle'})`}\n`;
    reportMd += `- Identified Interactions: ${interactions.length}\n`;

    if (interactions.length > 0) {
      interactions.forEach((i) => {
        reportMd += `  * [${i.severity.toUpperCase()}] ${i.drug_a} + ${i.drug_b}: ${i.explanation}\n`;
        if (i.mechanism) reportMd += `    Mechanism: ${i.mechanism}\n`;
      });
    }

    if (aggregatedSideEffects.length > 0) {
      reportMd += `\n## 2.5 AMPLIFIED / COMPOUNDED SIDE EFFECTS\n`;
      aggregatedSideEffects.forEach((se) => {
        reportMd += `  * ${se.effect} (Sources: ${se.sources.join(', ')})\n`;
        if (se.clinical_note) reportMd += `    Clinical Note: ${se.clinical_note}\n`;
      });
    }

    if (foodConflicts.length > 0) {
      reportMd += `\n## 3. FOOD & TIMING ADVISORIES\n`;
      foodConflicts.forEach((f) => {
        reportMd += `  * ${f.medicine_a} + ${f.medicine_b}: ${f.conflict} (Recommended: ${f.recommended_schedule})\n`;
      });
    }

    reportMd += `\n---\nGenerated by MEDCHECK Clinical Intelligence. Verify with a licensed physician or pharmacist.`;

    try {
      if (typeof navigator !== 'undefined' && navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        await navigator.clipboard.writeText(reportMd);
        setCopyError(null);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } else {
        const textarea = document.createElement('textarea');
        textarea.value = reportMd;
        textarea.setAttribute('readonly', '');
        textarea.style.position = 'fixed';
        textarea.style.top = '-9999px';
        textarea.style.left = '-9999px';
        document.body.appendChild(textarea);
        textarea.select();
        const success = document.execCommand('copy');
        document.body.removeChild(textarea);
        if (!success) throw new Error('execCommand returned false');
        setCopyError(null);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }
    } catch (err) {
      console.warn('MEDCHECK: clipboard write failed, prompting manual copy:', err);
      setCopyError('Clipboard access denied. Please select and copy the text manually, or use Print.');
      setTimeout(() => setCopyError(null), 6000);
    }
  };

  return (
    <>
      <div
        className="ed-modal fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-[#1a1a18]/55 modal-backdrop overflow-y-auto"
        onClick={(e) => {
          if (e.target === e.currentTarget) closeModal();
        }}
      >
        <div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="doctor-report-title"
          tabIndex={-1}
          className="max-w-2xl w-full max-h-[90vh] flex flex-col p-0 overflow-hidden outline-none bg-[#f8f6f0] border border-[#1a1a18] border-t-[3px] border-t-[#1a1a18]"
        >
          {/* Top Control Bar (Hidden in Print) */}
          <div className="flex items-center justify-between gap-3 px-6 py-4 border-b border-[#b7b09d] bg-[#f0ede1] no-print flex-wrap">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 border border-[#1a1a18] bg-[#f8f6f0] text-[#1a1a18] flex items-center justify-center shrink-0">
                <DocumentIcon size={16} />
              </div>
              <div>
                <h2
                  id="doctor-report-title"
                  className="font-newsreader text-[21px] font-semibold text-[#1a1a18] leading-tight"
                >
                  Doctor &amp; Pharmacist Clinical Brief
                </h2>
                <p className="font-ibm-mono text-[10px] uppercase tracking-[0.07em] text-[#57534a] mt-0.5">
                  Exportable medication summary for clinical appointments
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={handleCopySummary}
                className="ed-btn-outline text-[11px] py-1.5 px-3 min-h-[36px]"
                title="Copy markdown text for email or electronic health records"
              >
                {copied ? (
                  <>
                    <CheckIcon size={13} className="text-[#2d4a22]" />
                    <span>Copied</span>
                  </>
                ) : (
                  <>
                    <CopyIcon size={13} />
                    <span className="hidden sm:inline">Copy Text</span>
                  </>
                )}
              </button>

              <button
                type="button"
                onClick={handlePrint}
                className="ed-btn-ink text-[11px] py-1.5 px-3.5 min-h-[36px]"
                title="Print standard clinical summary sheet"
              >
                <PrinterIcon size={13} />
                <span>Print Brief</span>
              </button>

              <button
                type="button"
                onClick={closeModal}
                aria-label="Close Doctor Report Modal"
                className="w-8 h-8 border border-[#b7b09d] bg-[#f8f6f0] text-[#1a1a18] hover:border-[#1a1a18] hover:bg-[#ece7d5] flex items-center justify-center transition-colors cursor-pointer"
              >
                <CloseIcon size={15} />
              </button>
            </div>
          </div>

          {/* Modal Body: Printable Clinical Summary Sheet */}
          <div className="flex-1 overflow-y-auto p-6 space-y-5 bg-[#f8f6f0] text-[#1a1a18] font-ibm-serif">
            <ReportContent
              medicines={medicines}
              results={results}
              personalNotes={personalNotes}
              providerName={providerName}
              setProviderName={setProviderName}
              copyError={copyError}
              isPrint={false}
            />
          </div>
        </div>
      </div>

      {/* Dedicated Portal for Clean Window Printing */}
      {typeof document !== 'undefined' && createPortal(
        <div className="print-report">
          <ReportContent
            medicines={medicines}
            results={results}
            personalNotes={personalNotes}
            providerName={providerName}
            setProviderName={setProviderName}
            copyError={copyError}
            isPrint={true}
          />
        </div>,
        document.body
      )}
    </>
  );
}

export default DoctorReportModal;
