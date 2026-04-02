import { useState, useMemo } from 'react';
import { X, Mail, Copy, MessageSquare, ExternalLink, AlertTriangle, CheckCircle } from 'lucide-react';
import { getInterpretation } from '../data/clinicalInterpretations';

const STUDY_EMAIL = 'myafrodna@study.org';
const MAX_MAILTO  = 1800;

// ── Template builders ─────────────────────────────────────────────────────────

function formatProviderGreeting(name) {
  if (!name) return 'Dear Provider,';
  const cleaned = name.replace(/^Dr\.?\s*/i, '').trim();
  return `Dear Dr. ${cleaned},`;
}

function buildBody(patient, providerName) {
  const interp = getInterpretation(patient.genotype);
  return `${formatProviderGreeting(providerName)}

We are writing to inform you of a genomic medicine finding from the CYP2C19 Clopidogrel Metabolism Study that requires your attention.

Patient: ${patient.id}
Finding: ${patient.genotype || '—'} — ${patient.phenotype || '—'}
Clinical Significance: ${interp?.clinicalSignificance || patient.implication || '—'}
Clinical Interpretation: ${interp?.reportSummary || '—'}
Recommended Action: ${interp?.recommendedAction || patient.suggestedAction || '—'}

Please match this MyAfroDNA ID to your patient records and take the appropriate clinical action. We would appreciate confirmation once the patient has been contacted.

This report contains research-grade findings. Clinical validation is recommended before treatment changes.

Kind regards,
MyAfroDNA Study Team
${STUDY_EMAIL}`;
}

function buildWhatsApp(patient) {
  const interp = getInterpretation(patient.genotype);
  return `*MyAfroDNA Recontact — ${patient.id}*\nGenotype: ${patient.genotype} (${patient.phenotype})\nAction required: ${interp?.recommendedAction || patient.suggestedAction || '—'}\n\nThis is a priority recontact request from the MyAfroDNA CYP2C19 study. Please contact this patient regarding their genomic medicine findings.\n\n— MyAfroDNA Study Team`;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function EmailCompose({
  patient,
  providers,          // full provider list
  providerAssignments,
  onMarkEmailed,      // (patientId) => void
  onClose,
}) {
  const providerName   = providerAssignments[patient.id] || null;
  const providerObj    = providers.find(p => p.name === providerName) || null;
  const hasEmail       = !!providerObj?.email;

  const [to,      setTo]      = useState(providerObj?.email || '');
  const [subject, setSubject] = useState(`MyAfroDNA — Patient Recontact: ${patient.id} — Action Required`);
  const [body,    setBody]    = useState(() => buildBody(patient, providerName));
  const [copied,  setCopied]  = useState(''); // 'email' | 'whatsapp' | ''

  const mailtoUrl = useMemo(() => {
    const base = `mailto:${encodeURIComponent(to)}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    return base;
  }, [to, subject, body]);

  const isLong    = mailtoUrl.length > MAX_MAILTO;
  const noProvider = !providerName;

  const handleOpenMailto = () => {
    window.location.href = mailtoUrl;
    onMarkEmailed(patient.id);
  };

  const copyText = async (text, key) => {
    await navigator.clipboard.writeText(text);
    setCopied(key);
    setTimeout(() => setCopied(''), 2000);
  };

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-2xl max-h-[100dvh] sm:max-h-[92vh] flex flex-col">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <Mail size={18} className="text-teal-700" />
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Email Provider</p>
              <p className="font-bold text-gray-900">
                {providerName || 'No provider assigned'} — <span className="font-mono">{patient.id}</span>
              </p>
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Warnings */}
          {noProvider && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              No provider is assigned to this patient. You can still compose an email but the To field will be empty.
            </div>
          )}
          {providerName && !hasEmail && (
            <div className="flex items-start gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg text-sm text-amber-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              No email address on file for {providerName}. Enter one below or use Copy to Clipboard.
            </div>
          )}
          {isLong && (
            <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              This email is long — some email clients may truncate it. We recommend using "Copy email" and pasting into your email client.
            </div>
          )}

          {/* To */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">To</label>
            <input
              type="email"
              value={to}
              onChange={e => setTo(e.target.value)}
              placeholder="provider@hospital.org"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Subject */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Subject</label>
            <input
              type="text"
              value={subject}
              onChange={e => setSubject(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>

          {/* Body */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Body
              <span className="ml-2 text-gray-400 normal-case font-normal">(editable)</span>
            </label>
            <textarea
              rows={14}
              value={body}
              onChange={e => setBody(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500 resize-y"
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4 border-t border-gray-100 shrink-0 bg-gray-50 sm:rounded-b-xl">
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => copyText(`To: ${to}\nSubject: ${subject}\n\n${body}`, 'email')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors bg-white"
            >
              {copied === 'email' ? <CheckCircle size={14} className="text-teal-600" /> : <Copy size={14} />}
              {copied === 'email' ? 'Copied!' : 'Copy email'}
            </button>
            <button
              onClick={() => copyText(buildWhatsApp(patient), 'whatsapp')}
              className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium border border-gray-300 rounded-lg hover:bg-white transition-colors bg-white"
            >
              {copied === 'whatsapp' ? <CheckCircle size={14} className="text-teal-600" /> : <MessageSquare size={14} />}
              {copied === 'whatsapp' ? 'Copied!' : 'Copy for WhatsApp'}
            </button>
          </div>
          <button
            onClick={handleOpenMailto}
            className="flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors"
          >
            <ExternalLink size={14} />
            Open in email client
          </button>
        </div>
      </div>
    </div>
  );
}
