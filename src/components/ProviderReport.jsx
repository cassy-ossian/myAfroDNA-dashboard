// Printable/exportable provider report for flagged patients.
// Designed to be handed to a cardiologist — clean, no jargon where avoidable.
import { X, Printer } from 'lucide-react';
import logoImg from '../assets/myafrodna-logo.png';

const TODAY = new Date().toLocaleDateString('en-GB', {
  day: '2-digit', month: 'long', year: 'numeric'
});

export default function ProviderReport({ flaggedPatients, onClose }) {
  const high = flaggedPatients.filter(p => p.priority === 'High');
  const medium = flaggedPatients.filter(p => p.priority === 'Medium');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal controls (not printed) */}
        <div className="no-print flex items-center justify-between p-4 border-b border-gray-100 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <button
              onClick={() => window.print()}
              className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 transition-colors"
            >
              <Printer size={15} /> Print / Save as PDF
            </button>
            <p className="text-xs text-gray-400">Use your browser's print dialog to save as PDF</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        {/* Report content */}
        <div className="p-8 space-y-8" id="provider-report">
          {/* Header */}
          <div className="border-b-2 border-teal-700 pb-6">
            <div className="flex items-start justify-between">
              <div>
                <img src={logoImg} alt="MyAfroDNA" className="h-12 mb-1" />
                <p className="text-sm text-gray-500 mt-0.5">Genomic Medicine Research Programme</p>
              </div>
              <div className="text-right">
                <p className="text-xs text-gray-500 uppercase tracking-wide">Report Generated</p>
                <p className="text-sm font-semibold text-gray-800">{TODAY}</p>
              </div>
            </div>
            <div className="mt-4">
              <h2 className="text-lg font-bold text-gray-900">
                CYP2C19 Genomic Medicine — Patient Recontact Summary
              </h2>
              <p className="text-sm text-gray-600 mt-1">
                Study: Clopidogrel Metabolism &amp; Cardiovascular Outcomes
              </p>
            </div>
          </div>

          {/* Summary box */}
          <div className="bg-gray-50 rounded-lg p-4 grid grid-cols-3 gap-4 text-center">
            <div>
              <p className="text-2xl font-bold text-gray-900">{flaggedPatients.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Total patients flagged</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-red-700">{high.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Require recontact (high priority)</p>
            </div>
            <div>
              <p className="text-2xl font-bold text-amber-600">{medium.length}</p>
              <p className="text-xs text-gray-500 mt-0.5">Monitoring recommended (medium)</p>
            </div>
          </div>

          {/* Instructions */}
          <div className="text-sm text-gray-600 space-y-2 border-l-4 border-teal-200 pl-4">
            <p className="font-semibold text-gray-800">For the treating clinician:</p>
            <p>
              Patients listed below carry CYP2C19 genetic variants affecting clopidogrel metabolism.
              MyAfroDNA IDs can be cross-referenced with your own patient records using the study
              enrolment register. <strong>No patient names are included in this document</strong> to
              protect confidentiality.
            </p>
            <p>
              High-priority patients require prompt recontact and likely need an alternative
              antiplatelet agent. Medium-priority patients warrant monitoring and clinical review.
            </p>
          </div>

          {/* High priority patients */}
          {high.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-red-500" />
                <h3 className="font-bold text-gray-900 text-base uppercase tracking-wide">
                  High Priority — Recontact Required ({high.length})
                </h3>
              </div>
              <div className="space-y-4">
                {high.map((p, i) => (
                  <ReportPatientCard key={p.id} patient={p} index={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* Medium priority patients */}
          {medium.length > 0 && (
            <section>
              <div className="flex items-center gap-2 mb-4">
                <div className="w-3 h-3 rounded-full bg-amber-400" />
                <h3 className="font-bold text-gray-900 text-base uppercase tracking-wide">
                  Medium Priority — Monitoring Recommended ({medium.length})
                </h3>
              </div>
              <div className="space-y-4">
                {medium.map((p, i) => (
                  <ReportPatientCard key={p.id} patient={p} index={i + 1} />
                ))}
              </div>
            </section>
          )}

          {/* Footer */}
          <div className="border-t border-gray-200 pt-4 text-xs text-gray-400 space-y-1">
            <p>Generated by MyAfroDNA Research Dashboard · {TODAY}</p>
            <p>This document is intended for use by authorised clinical personnel only.</p>
            <p>Patient IDs are study identifiers. Clinicians must use the enrolment register to match to their records.</p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ReportPatientCard({ patient: p, index }) {
  const priorityColor = p.priority === 'High' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50';
  const idColor = p.priority === 'High' ? 'text-red-800' : 'text-amber-800';

  return (
    <div className={`rounded-lg border p-4 ${priorityColor}`}>
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-400 font-mono">#{index}</span>
          <span className={`font-mono font-bold text-lg ${idColor}`}>{p.id}</span>
        </div>
        <div className="text-right">
          <span className="text-xs text-gray-500">CYP2C19 Genotype</span>
          <p className="font-mono font-bold text-gray-900">{p.genotype || 'Unknown'}</p>
        </div>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Phenotype Classification</p>
          <p className="text-gray-900 font-medium">{p.phenotype}</p>
        </div>
        <div>
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Genotyping Date</p>
          <p className="text-gray-900">{p.genotypingDate || 'Not recorded'}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Clinical Implication</p>
          <p className="text-gray-700">{p.implication}</p>
        </div>
        <div className="sm:col-span-2">
          <p className="text-xs text-gray-500 uppercase tracking-wide font-medium mb-0.5">Recommended Action</p>
          <p className="text-gray-900 font-medium">{p.suggestedAction}</p>
        </div>
      </div>
    </div>
  );
}
