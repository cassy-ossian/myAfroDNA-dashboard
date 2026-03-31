import { useState } from 'react';
import { X, ChevronRight } from 'lucide-react';
import { getStage, getNextStage } from '../data/workflowStages';

const NOTIFICATION_METHODS = ['Email', 'Phone', 'WhatsApp', 'In Person'];
const DIRECT_CONTACT_METHODS = ['Phone Call', 'SMS', 'WhatsApp', 'Email', 'In Person'];
const CLINICAL_ACTIONS = [
  'Dose adjustment',
  'Alternative drug prescribed',
  'Referred to specialist',
  'No change — clinical review sufficient',
  'Other',
];
const CONTACT_OUTCOMES = [
  'Reached — Appointment Scheduled',
  'Reached — Declined',
  'Reached — Callback Requested',
  'Not Reached — Wrong Number',
  'Not Reached — No Answer',
  'Not Reached — Other',
];

const today = () => new Date().toISOString().split('T')[0];

export default function StageTransitionModal({
  patient,
  fromStage,
  toStage,
  pathway,       // 'direct' | 'provider' | 'both' | 'none' — affects which form sections show
  providers,
  onConfirm,
  onCancel,
}) {
  const from = getStage(fromStage);
  const to   = getStage(toStage);

  // Provider pathway fields
  const [provider,         setProvider]         = useState('');
  const [providerFreeText, setProviderFreeText] = useState('');
  const [notifDate,        setNotifDate]        = useState(today());
  const [notifMethod,      setNotifMethod]      = useState('Email');

  // Shared contact fields
  const [contactDate, setContactDate] = useState(today());
  const [contactNote, setContactNote] = useState('');

  // Direct pathway fields
  const [directMethod,  setDirectMethod]  = useState(DIRECT_CONTACT_METHODS[0]);
  const [outcome,       setOutcome]       = useState(CONTACT_OUTCOMES[0]);
  const [followupDate,  setFollowupDate]  = useState('');

  // Clinical outcome fields
  const [clinicalAction, setClinicalAction] = useState(CLINICAL_ACTIONS[0]);
  const [clinicalNote,   setClinicalNote]   = useState('');
  const [closingNote,    setClosingNote]    = useState('');
  const [note,           setNote]           = useState('');

  const isDirect = pathway === 'direct';

  const handleConfirm = () => {
    const payload = { note };

    // Provider pathway: Under Review → Provider Notified
    if (fromStage === 'under_review' && toStage === 'provider_notified') {
      const resolvedProvider = provider === '__freetext__' ? providerFreeText.trim() : provider;
      if (!resolvedProvider) return;
      payload.providerAssigned   = resolvedProvider;
      payload.notificationDate   = notifDate;
      payload.notificationMethod = notifMethod;
    }

    // Direct pathway: Under Review → Patient Contacted
    if (fromStage === 'under_review' && toStage === 'patient_contacted' && isDirect) {
      payload.contactDate         = contactDate;
      payload.directContactMethod = directMethod;
      payload.outcome             = outcome;
      payload.followupDate        = followupDate || null;
      payload.contactNote         = contactNote;
    }

    // Provider pathway: Provider Notified → Patient Contacted
    if (fromStage === 'provider_notified' && toStage === 'patient_contacted') {
      payload.contactDate  = contactDate;
      payload.contactNote  = contactNote;
    }

    // Direct pathway: Patient Contacted → Follow-Up Scheduled
    if (fromStage === 'patient_contacted' && toStage === 'followup_scheduled') {
      payload.followupDate = followupDate;
      payload.contactNote  = contactNote;
    }

    // Both pathways: Patient Contacted / Follow-Up Scheduled → Follow-Up Complete
    if (toStage === 'followup_complete') {
      payload.clinicalAction = clinicalAction;
      payload.clinicalNote   = clinicalNote;
    }

    // Closing
    if (fromStage === 'followup_complete' && toStage === 'closed') {
      payload.closingNote = closingNote;
    }

    onConfirm(payload);
  };

  const isSimple = fromStage === 'flagged' && toStage === 'under_review';

  // Confirm button disabled states
  const confirmDisabled =
    (fromStage === 'under_review' && toStage === 'provider_notified' &&
      !(provider && (provider !== '__freetext__' || providerFreeText.trim())));

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Stage Transition</p>
            <div className="flex items-center gap-2 mt-1">
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${from.headerClass}`}>{from.label}</span>
              <ChevronRight size={14} className="text-gray-400" />
              <span className={`text-xs font-semibold px-2 py-0.5 rounded ${to.headerClass}`}>{to.label}</span>
            </div>
            <p className="text-sm font-semibold text-gray-900 mt-1 font-mono">{patient.id}</p>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Simple transition: Flagged → Under Review */}
          {isSimple && (
            <p className="text-sm text-gray-600">
              Move <span className="font-mono font-semibold">{patient.id}</span> to <strong>Under Review</strong>?
              {isDirect
                ? ' A coordinator will review this case before contacting the patient directly.'
                : ' A coordinator will review this case before notifying the provider.'}
            </p>
          )}

          {/* Provider pathway: Under Review → Provider Notified */}
          {fromStage === 'under_review' && toStage === 'provider_notified' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Assigned Provider *</label>
                <select
                  value={provider}
                  onChange={e => setProvider(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">— Select provider —</option>
                  {providers.map(p => (
                    <option key={p.id} value={p.id}>{p.name} ({p.facility})</option>
                  ))}
                  <option value="__freetext__">Other / enter manually…</option>
                </select>
                {provider === '__freetext__' && (
                  <input
                    type="text"
                    placeholder="Provider name"
                    value={providerFreeText}
                    onChange={e => setProviderFreeText(e.target.value)}
                    className="mt-2 w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                  />
                )}
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Notification Date</label>
                  <input type="date" value={notifDate} onChange={e => setNotifDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Method</label>
                  <select value={notifMethod} onChange={e => setNotifMethod(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {NOTIFICATION_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
            </>
          )}

          {/* Direct pathway: Under Review → Patient Contacted (skips Provider Notified) */}
          {fromStage === 'under_review' && toStage === 'patient_contacted' && isDirect && (
            <>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Contact</label>
                  <input type="date" value={contactDate} onChange={e => setContactDate(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Method</label>
                  <select value={directMethod} onChange={e => setDirectMethod(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                    {DIRECT_CONTACT_METHODS.map(m => <option key={m}>{m}</option>)}
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outcome</label>
                <select value={outcome} onChange={e => setOutcome(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {CONTACT_OUTCOMES.map(o => <option key={o}>{o}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-Up Date (if scheduled)</label>
                <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={contactNote} onChange={e => setContactNote(e.target.value)}
                  placeholder="Any notes about the contact attempt…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </>
          )}

          {/* Provider pathway: Provider Notified → Patient Contacted */}
          {fromStage === 'provider_notified' && toStage === 'patient_contacted' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Patient Contact</label>
                <input type="date" value={contactDate} onChange={e => setContactDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Outcome note</label>
                <textarea rows={3} value={contactNote} onChange={e => setContactNote(e.target.value)}
                  placeholder="Brief description of how the contact went…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </>
          )}

          {/* Direct pathway: Patient Contacted → Follow-Up Scheduled */}
          {fromStage === 'patient_contacted' && toStage === 'followup_scheduled' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Follow-Up Appointment Date</label>
                <input type="date" value={followupDate} onChange={e => setFollowupDate(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                <textarea rows={2} value={contactNote} onChange={e => setContactNote(e.target.value)}
                  placeholder="Any notes about the scheduled follow-up…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </>
          )}

          {/* Both pathways: → Follow-Up Complete */}
          {toStage === 'followup_complete' && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinical Action Taken *</label>
                <select value={clinicalAction} onChange={e => setClinicalAction(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
                  {CLINICAL_ACTIONS.map(a => <option key={a}>{a}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Clinical note</label>
                <textarea rows={3} value={clinicalNote} onChange={e => setClinicalNote(e.target.value)}
                  placeholder="Details of the clinical action taken…"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
              </div>
            </>
          )}

          {/* Follow-Up Complete → Closed */}
          {fromStage === 'followup_complete' && toStage === 'closed' && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Closing note (optional)</label>
              <textarea rows={3} value={closingNote} onChange={e => setClosingNote(e.target.value)}
                placeholder="Any final notes for the record…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
          )}

          {/* General note for non-simple transitions */}
          {!isSimple && toStage !== 'followup_complete' && toStage !== 'closed' &&
           !(fromStage === 'under_review' && toStage === 'patient_contacted' && isDirect) && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Additional note (optional)</label>
              <textarea rows={2} value={note} onChange={e => setNote(e.target.value)}
                placeholder="Any other notes…"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
            </div>
          )}
        </div>

        <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={confirmDisabled}
            className="px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            style={{ backgroundColor: {
              red: '#dc2626', orange: '#ea580c', blue: '#2563eb',
              purple: '#7c3aed', violet: '#7c3aed', teal: '#0f766e', gray: '#4b5563'
            }[to.color] || '#0f766e' }}
          >
            Move to {to.label}
          </button>
        </div>
      </div>
    </div>
  );
}
