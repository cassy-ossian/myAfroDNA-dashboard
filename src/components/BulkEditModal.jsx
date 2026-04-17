import { useState, useMemo } from 'react';
import { X, Loader2, AlertCircle, CheckCircle } from 'lucide-react';
import { fieldInputType, isEditableField, parseDraft } from './EditableCell';

// Labels for known fields — keeps the dropdown human-readable.
const LABELS = {
  age: 'Age', gender: 'Gender', sex: 'Sex', lga: 'LGA', tribe: 'Tribe',
  language: 'Language', contactPathway: 'Contact Pathway',
  phone: 'Phone', email: 'Email', enrollmentDate: 'Enrollment Date',
  site: 'Site', genotype: 'Genotype', sampleCollected: 'Sample Collected',
  genotypingComplete: 'Genotyped', sampleDate: 'Sample Date',
  genotypingDate: 'Genotyping Date', diagnosis: 'Diagnosis',
};

const ENUMS = {
  gender: ['M', 'F'],
  sex: ['M', 'F'],
  contactPathway: ['direct', 'provider', 'both', 'none'],
};

export default function BulkEditModal({ patients, onConfirm, onClose }) {
  const [field,  setField]  = useState('');
  const [value,  setValue]  = useState('');
  const [saving, setSaving] = useState(false);
  const [error,  setError]  = useState(null);

  // Build the list of editable fields from what exists on these patients,
  // plus the common set — so the admin can always pick common fields even
  // when some patients don't have them yet.
  const availableFields = useMemo(() => {
    const seen = new Set();
    const keys = [];
    ['age','gender','sex','lga','tribe','language','contactPathway','phone','email',
     'site','genotype','sampleCollected','genotypingComplete','enrollmentDate',
     'sampleDate','genotypingDate','diagnosis'].forEach(k => {
      if (!seen.has(k)) { seen.add(k); keys.push(k); }
    });
    for (const p of patients) {
      for (const k of Object.keys(p)) {
        if (seen.has(k)) continue;
        if (!isEditableField(k)) continue;
        if (k.startsWith('_')) continue;
        seen.add(k);
        keys.push(k);
      }
    }
    return keys;
  }, [patients]);

  const inputType = field ? fieldInputType(field) : 'text';

  const handleConfirm = async () => {
    setSaving(true);
    setError(null);
    try {
      const parsed = parseDraft(field, value);
      await onConfirm(field, parsed);
    } catch (err) {
      setError(err.message ?? 'Update failed');
      setSaving(false);
    }
    // On success the parent closes the modal
  };

  const canConfirm = field && !saving;
  const fieldLabel = LABELS[field] ?? field;

  return (
    <div className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/40">
      <div className="bg-white w-full sm:rounded-xl shadow-2xl sm:max-w-md max-h-[100dvh] sm:max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">Bulk Edit</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="p-5 space-y-4 flex-1 overflow-y-auto">
          <p className="text-sm text-gray-600">
            Update one field across <strong>{patients.length}</strong> selected patient{patients.length !== 1 ? 's' : ''}.
          </p>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Field</label>
            <select
              value={field}
              onChange={e => { setField(e.target.value); setValue(''); }}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            >
              <option value="">— Select a field —</option>
              {availableFields.map(k => (
                <option key={k} value={k}>{LABELS[k] ?? k}</option>
              ))}
            </select>
          </div>

          {field && (
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New Value</label>
              {inputType === 'enum' ? (
                <select
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">—</option>
                  {ENUMS[field].map(opt => <option key={opt} value={opt}>{opt}</option>)}
                </select>
              ) : inputType === 'boolean' ? (
                <select
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="">—</option>
                  <option value="Yes">Yes</option>
                  <option value="No">No</option>
                </select>
              ) : (
                <input
                  type={inputType === 'number' ? 'number' : 'text'}
                  value={value}
                  onChange={e => setValue(e.target.value)}
                  placeholder={value === '' ? 'Leave blank to clear' : ''}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              )}
            </div>
          )}

          {field && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-3 text-sm text-amber-800">
              Change <strong>{fieldLabel}</strong> to{' '}
              <strong className="font-mono">{value === '' ? '(empty)' : value}</strong>{' '}
              for <strong>{patients.length}</strong> patient{patients.length !== 1 ? 's' : ''}.
            </div>
          )}

          {error && (
            <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" />
              {error}
            </div>
          )}
        </div>

        <div className="flex gap-2 p-5 border-t border-gray-100 shrink-0">
          <button
            onClick={onClose}
            disabled={saving}
            className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!canConfirm}
            className="flex-1 flex items-center justify-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <><Loader2 size={14} className="animate-spin" /> Updating…</> : <><CheckCircle size={14} /> Apply</>}
          </button>
        </div>
      </div>
    </div>
  );
}
