import { useState, useMemo } from 'react';
import { X, Mail, Copy, ExternalLink, ChevronLeft, ChevronRight, CheckCircle, AlertTriangle, Users } from 'lucide-react';
import { getInterpretation } from '../data/clinicalInterpretations';

const STUDY_EMAIL = 'myafrodna@study.org';
const MAX_MAILTO  = 1800;

// ── Template builder ──────────────────────────────────────────────────────────

function formatGreeting(name) {
  if (!name || name === 'Unassigned') return 'Dear Provider,';
  const cleaned = name.replace(/^Dr\.?\s*/i, '').trim();
  return `Dear Dr. ${cleaned},`;
}

function buildBulkBody(providerName, patients) {
  const high   = patients.filter(p => p.priority === 'High');
  const medium = patients.filter(p => p.priority !== 'High');

  const fmtPatient = (p) => {
    const interp = getInterpretation(p.genotype);
    return `  - ${p.id}: ${p.genotype || '—'} — ${p.phenotype || '—'}. ${interp?.clinicalSignificance || p.implication || ''}. Recommended: ${interp?.recommendedAction || p.suggestedAction || '—'}.`;
  };

  const sections = [];
  if (high.length > 0) {
    sections.push('HIGH PRIORITY:\n' + high.map(fmtPatient).join('\n'));
  }
  if (medium.length > 0) {
    sections.push('MEDIUM PRIORITY:\n' + medium.map(fmtPatient).join('\n'));
  }

  return `${formatGreeting(providerName)}

We are writing to inform you of genomic medicine findings from the CYP2C19 Clopidogrel Metabolism Study that require your attention for the following patient${patients.length !== 1 ? 's' : ''}:

${sections.join('\n\n')}

Please match these MyAfroDNA IDs to your patient records and take the appropriate clinical actions. We would appreciate confirmation once patients have been contacted.

This report contains research-grade findings. Clinical validation is recommended before treatment changes.

Kind regards,
MyAfroDNA Study Team
${STUDY_EMAIL}`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function BulkEmailPreview({
  patients,           // array of patients to include
  providers,
  providerAssignments,
  emailedPatients,    // Set<patientId>
  onMarkEmailed,
  onClose,
}) {
  // Group patients by provider name
  const groups = useMemo(() => {
    const map = new Map();
    patients.forEach(p => {
      const key = providerAssignments[p.id] || 'Unassigned';
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(p);
    });
    return Array.from(map.entries()).map(([name, pts]) => {
      const provObj = providers.find(pr => pr.name === name);
      return { name, email: provObj?.email || '', patients: pts };
    });
  }, [patients, providerAssignments, providers]);

  const [idx,     setIdx]     = useState(0);
  const [drafts,  setDrafts]  = useState(() =>
    Object.fromEntries(groups.map(g => [g.name, {
      to:      g.email,
      subject: `MyAfroDNA — Patient Recontact (${g.patients.length} patient${g.patients.length !== 1 ? 's' : ''}) — Action Required`,
      body:    buildBulkBody(g.name, g.patients),
    }]))
  );
  const [copied,  setCopied]  = useState('');

  const group  = groups[idx];
  const draft  = group ? drafts[group.name] : null;

  const update = (field) => (e) => {
    setDrafts(prev => ({
      ...prev,
      [group.name]: { ...prev[group.name], [field]: e.target.value },
    }));
  };

  const mailtoUrl = draft
    ? `mailto:${encodeURIComponent(draft.to)}?subject=${encodeURIComponent(draft.subject)}&body=${encodeURIComponent(draft.body)}`
    : '';
  const isLong = mailtoUrl.length > MAX_MAILTO;

  const handleOpenMailto = () => {
    window.location.href = mailtoUrl;
    group.patients.forEach(p => onMarkEmailed(p.id));
  };

  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  const allEmailed = (g) => g.patients.every(p => emailedPatients.has(p.id));

  if (groups.length === 0) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-10 text-center space-y-4">
          <Users size={40} className="mx-auto text-gray-300" />
          <p className="font-semibold text-gray-700">No patients to email</p>
          <p className="text-sm text-gray-500">Select patients in the report builder first.</p>
          <button onClick={onClose} className="px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800">
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-2xl max-h-[100dvh] sm:max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <Mail size={18} className="text-teal-700" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Email All Providers</p>
              <p className="font-bold text-gray-900">
                {groups.length} provider{groups.length !== 1 ? 's' : ''} · {patients.length} patient{patients.length !== 1 ? 's' : ''}
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Provider nav strip */}
        <div className="flex items-center gap-2 px-5 py-3 border-b border-gray-100 bg-gray-50 shrink-0 overflow-x-auto">
          {groups.map((g, i) => (
            <button
              key={g.name}
              onClick={() => setIdx(i)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium whitespace-nowrap transition-colors shrink-0 ${
                i === idx
                  ? 'bg-teal-700 text-white'
                  : 'bg-white border border-gray-200 text-gray-600 hover:border-teal-400'
              }`}
            >
              {allEmailed(g) && <CheckCircle size={11} className={i === idx ? 'text-teal-200' : 'text-teal-600'} />}
              {g.name}
              <span className={`text-[10px] font-bold px-1 rounded-full ${i === idx ? 'bg-teal-600' : 'bg-gray-100 text-gray-500'}`}>
                {g.patients.length}
              </span>
            </button>
          ))}
        </div>

        {group && draft && (
          <>
            <div className="flex-1 overflow-y-auto p-5 space-y-4">
              {/* Provider info + warnings */}
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-semibold text-gray-900">{group.name}</p>
                  <p className="text-xs text-gray-500">
                    {group.patients.length} patient{group.patients.length !== 1 ? 's' : ''} ·{' '}
                    {group.patients.filter(p => p.priority === 'High').length} high priority
                  </p>
                </div>
                <div className="flex items-center gap-2 text-xs text-gray-500">
                  <button
                    onClick={() => setIdx(i => Math.max(0, i - 1))}
                    disabled={idx === 0}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronLeft size={16} />
                  </button>
                  {idx + 1} / {groups.length}
                  <button
                    onClick={() => setIdx(i => Math.min(groups.length - 1, i + 1))}
                    disabled={idx === groups.length - 1}
                    className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                  >
                    <ChevronRight size={16} />
                  </button>
                </div>
              </div>

              {group.name === 'Unassigned' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  These patients have no assigned provider. Assign providers to enable targeted emails.
                </div>
              )}
              {!group.email && group.name !== 'Unassigned' && (
                <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  No email on file for {group.name}. Enter one below or use Copy to Clipboard.
                </div>
              )}
              {isLong && (
                <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
                  <AlertTriangle size={14} className="shrink-0 mt-0.5" />
                  This email is long — use "Copy email" and paste into your email client for reliability.
                </div>
              )}

              {/* To */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
                <input type="email" value={draft.to} onChange={update('to')} placeholder="provider@hospital.org"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>

              {/* Subject */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</label>
                <input type="text" value={draft.subject} onChange={update('subject')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>

              {/* Body */}
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
                  Body <span className="text-gray-400 normal-case font-normal">(editable)</span>
                </label>
                <textarea rows={12} value={draft.body} onChange={update('body')}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y" />
              </div>
            </div>

            {/* Actions */}
            <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 shrink-0 bg-gray-50 sm:rounded-b-xl">
              <button
                onClick={() => copyText(`To: ${draft.to}\nSubject: ${draft.subject}\n\n${draft.body}`, 'email')}
                className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white bg-white transition-colors"
              >
                {copied === 'email' ? <CheckCircle size={13} className="text-teal-600" /> : <Copy size={13} />}
                {copied === 'email' ? 'Copied!' : 'Copy email'}
              </button>
              <button
                onClick={handleOpenMailto}
                className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
              >
                {allEmailed(group)
                  ? <><CheckCircle size={14} /> Sent — open again</>
                  : <><ExternalLink size={14} /> Open in email client</>
                }
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
