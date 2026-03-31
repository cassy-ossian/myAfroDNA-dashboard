import { X, Clock, CheckCircle, ChevronRight, User, Phone, AlertTriangle } from 'lucide-react';
import { getStage, durationLabel } from '../data/workflowStages';
import { PHENOTYPE_EXPLANATIONS } from '../data/flaggingRules';

const STEP_COLORS = {
  flagged:            'bg-red-500',
  under_review:       'bg-orange-500',
  provider_notified:  'bg-blue-500',
  patient_contacted:  'bg-purple-500',
  followup_complete:  'bg-teal-500',
  closed:             'bg-gray-400',
};

function TimelineEntry({ entry, isLast }) {
  const stage = getStage(entry.to);
  return (
    <div className="flex gap-3">
      <div className="flex flex-col items-center">
        <div className={`w-3 h-3 rounded-full mt-1 shrink-0 ${STEP_COLORS[entry.to] || 'bg-gray-300'}`} />
        {!isLast && <div className="w-0.5 bg-gray-200 flex-1 my-1" />}
      </div>
      <div className="pb-4 min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-gray-900">{stage.label}</span>
          <span className="text-xs text-gray-400">
            {entry.timestamp ? new Date(entry.timestamp).toLocaleDateString('en-GB', {
              day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
            }) : ''}
          </span>
        </div>

        {entry.providerAssigned && (
          <p className="text-xs text-gray-600 mt-1 flex items-center gap-1">
            <User size={11} /> Provider: <span className="font-medium">{entry.providerAssigned}</span>
            {entry.notificationMethod && <span className="text-gray-400">via {entry.notificationMethod}</span>}
            {entry.notificationDate && <span className="text-gray-400">on {entry.notificationDate}</span>}
          </p>
        )}
        {entry.contactDate && (
          <p className="text-xs text-gray-600 mt-1">
            Patient contacted: <span className="font-medium">{entry.contactDate}</span>
          </p>
        )}
        {entry.clinicalAction && (
          <p className="text-xs text-gray-600 mt-1">
            Action: <span className="font-medium">{entry.clinicalAction}</span>
          </p>
        )}

        {(entry.note || entry.contactNote || entry.clinicalNote || entry.closingNote) && (
          <p className="text-xs text-gray-500 mt-1 italic">
            "{entry.contactNote || entry.clinicalNote || entry.closingNote || entry.note}"
          </p>
        )}
      </div>
    </div>
  );
}

export default function RecontactDetailModal({ patient, caseRecord, onClose }) {
  if (!patient || !caseRecord) return null;

  const currentStage = getStage(caseRecord.stage);
  const explanation = patient.phenotype ? PHENOTYPE_EXPLANATIONS[patient.phenotype] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Recontact Record</p>
            <div className="flex items-center gap-3">
              <h2 className="text-2xl font-bold text-gray-900 font-mono">{patient.id}</h2>
              <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${currentStage.headerClass}`}>
                {currentStage.label}
              </span>
              {patient.priority === 'High' && (
                <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-semibold">High Priority</span>
              )}
            </div>
          </div>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-6">
          {/* Clinical summary */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 bg-gray-50 rounded-lg p-4 text-sm">
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Genotype</p>
              <p className="font-mono font-semibold text-gray-900">{patient.genotype || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Phenotype</p>
              <p className="text-gray-900">{patient.phenotype || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Site</p>
              <p className="text-gray-700">{patient.site || '—'}</p>
            </div>
            <div>
              <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">In stage for</p>
              <p className="text-gray-700">{durationLabel(caseRecord.stageEnteredAt)}</p>
            </div>
          </div>

          {/* Implication */}
          {patient.implication && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
              <p className="text-xs font-semibold text-amber-700 uppercase tracking-wide mb-1">Clinical Implication</p>
              <p className="text-sm text-amber-900">{patient.implication}</p>
              {patient.suggestedAction && (
                <p className="text-sm font-medium text-amber-800 mt-2">
                  → {patient.suggestedAction}
                </p>
              )}
            </div>
          )}

          {/* Assigned provider */}
          {caseRecord.assignedProvider && (
            <div className="flex items-start gap-3 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <User size={16} className="text-blue-600 mt-0.5 shrink-0" />
              <div>
                <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-0.5">Assigned Provider</p>
                <p className="text-sm font-medium text-blue-900">{caseRecord.assignedProvider}</p>
              </div>
            </div>
          )}

          {/* Timeline */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-4">Activity Timeline</h3>
            <div>
              {caseRecord.history.map((entry, i) => (
                <TimelineEntry
                  key={i}
                  entry={entry}
                  isLast={i === caseRecord.history.length - 1}
                />
              ))}
            </div>
          </div>

          {/* Phenotype explanation */}
          {explanation && (
            <p className="text-xs text-gray-400 italic border-t border-gray-100 pt-4">
              <strong>Plain-language note:</strong> {explanation}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
