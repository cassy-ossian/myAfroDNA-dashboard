import { X, AlertTriangle, CheckCircle, Clock, Info } from 'lucide-react';
import { PHENOTYPE_EXPLANATIONS } from '../data/flaggingRules';
import PathwayBadge from './PathwayBadge';
import ContactInfoPanel from './ContactInfoPanel';
import PatientNotesSection from './PatientNotesSection';

const PRIORITY_STYLES = {
  High:   { badge: 'bg-red-100 text-red-800',    label: 'High Priority' },
  Medium: { badge: 'bg-amber-100 text-amber-800', label: 'Medium Priority' },
};

function Field({ label, value, mono }) {
  return (
    <div>
      <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">{label}</p>
      <p className={`text-sm text-gray-900 ${mono ? 'font-mono' : ''}`}>{value || '—'}</p>
    </div>
  );
}

export default function PatientModal({ patient, onClose, onUpdateContactPathway, onUpdateContactDetails }) {
  if (!patient) return null;

  const explanation = patient.phenotype ? PHENOTYPE_EXPLANATIONS[patient.phenotype] : null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-1">Patient Record</p>
            <div className="flex items-center gap-2.5 flex-wrap">
              <h2 className="text-2xl font-bold text-gray-900 font-mono">{patient.id}</h2>
              {patient.contactPathway && (
                <PathwayBadge pathway={patient.contactPathway} showLabel />
              )}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Flag banner */}
          {patient.flagged && patient.priority && (
            <div className={`rounded-lg p-4 ${patient.priority === 'High' ? 'bg-red-50 border border-red-200' : 'bg-amber-50 border border-amber-200'}`}>
              <div className="flex items-start gap-3">
                <AlertTriangle
                  size={18}
                  className={patient.priority === 'High' ? 'text-red-600 mt-0.5 shrink-0' : 'text-amber-600 mt-0.5 shrink-0'}
                />
                <div>
                  <p className={`font-semibold text-sm ${patient.priority === 'High' ? 'text-red-800' : 'text-amber-800'}`}>
                    {patient.priority === 'High' ? 'Recontact Required' : 'Monitoring Recommended'}
                  </p>
                  <p className={`text-sm mt-1 ${patient.priority === 'High' ? 'text-red-700' : 'text-amber-700'}`}>
                    {patient.suggestedAction}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* Enrollment info */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Enrollment</h3>
            <div className="grid grid-cols-2 gap-4">
              <Field label="MyAfroDNA ID" value={patient.id} mono />
              <Field label="Enrollment Date" value={patient.enrollmentDate} />
              <Field label="Collection Site" value={patient.site} />
            </div>
          </div>

          {/* Sample status */}
          <div>
            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Sample & Genotyping</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Sample Collected</p>
                <div className="flex items-center gap-1.5">
                  {patient.sampleCollected
                    ? <CheckCircle size={15} className="text-teal-600" />
                    : <Clock size={15} className="text-gray-400" />}
                  <p className="text-sm text-gray-900">
                    {patient.sampleCollected ? `Yes${patient.sampleDate ? ` (${patient.sampleDate})` : ''}` : 'Pending'}
                  </p>
                </div>
              </div>
              <div>
                <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Genotyping</p>
                <div className="flex items-center gap-1.5">
                  {patient.genotypingComplete
                    ? <CheckCircle size={15} className="text-teal-600" />
                    : <Clock size={15} className="text-gray-400" />}
                  <p className="text-sm text-gray-900">
                    {patient.genotypingComplete ? `Complete${patient.genotypingDate ? ` (${patient.genotypingDate})` : ''}` : 'Pending'}
                  </p>
                </div>
              </div>
              <Field label="CYP2C19 Genotype" value={patient.genotype} mono />
              {patient.priority && (
                <div>
                  <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Priority</p>
                  <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-semibold ${PRIORITY_STYLES[patient.priority]?.badge}`}>
                    {PRIORITY_STYLES[patient.priority]?.label}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Phenotype */}
          {patient.phenotype && (
            <div>
              <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Pharmacogenomics Result</h3>
              <div className="bg-gray-50 rounded-lg p-4 space-y-3">
                <Field label="CYP2C19 Phenotype" value={patient.phenotype} />
                {patient.implication && (
                  <div>
                    <p className="text-xs text-gray-500 font-medium uppercase tracking-wide mb-0.5">Clinical Implication</p>
                    <p className="text-sm text-gray-700">{patient.implication}</p>
                  </div>
                )}
                {explanation && (
                  <div className="flex items-start gap-2 pt-1 border-t border-gray-200">
                    <Info size={14} className="text-teal-600 mt-0.5 shrink-0" />
                    <p className="text-xs text-gray-500 italic">{explanation}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Contact information */}
          {onUpdateContactPathway && onUpdateContactDetails && (
            <ContactInfoPanel
              patient={patient}
              onUpdateContactPathway={onUpdateContactPathway}
              onUpdateContactDetails={onUpdateContactDetails}
            />
          )}

          {/* Notes & Activity */}
          <div className="border-t border-gray-100 pt-6">
            <PatientNotesSection patientId={patient.id} />
          </div>
        </div>
      </div>
    </div>
  );
}
