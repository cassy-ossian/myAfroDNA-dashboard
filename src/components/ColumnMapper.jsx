// Column mapping UI: shown after a spreadsheet is uploaded to let the user
// map detected columns to the required fields before importing.
import { ArrowRight, HelpCircle } from 'lucide-react';

const REQUIRED_FIELDS = [
  { key: 'id',                 label: 'Patient / MyAfroDNA ID',   required: true,  hint: 'Unique patient identifier' },
  { key: 'enrollmentDate',     label: 'Enrollment Date',          required: false, hint: 'Date patient enrolled in the study' },
  { key: 'site',               label: 'Collection Site',          required: false, hint: 'Hospital or site name' },
  { key: 'sampleCollected',    label: 'Sample Collected (yes/no or date)', required: false, hint: 'Whether the blood/saliva sample has been taken' },
  { key: 'genotypingComplete', label: 'Genotyping Complete (yes/no or date)', required: false, hint: 'Whether genotyping has been run' },
  { key: 'genotype',           label: 'CYP2C19 Genotype Result',  required: false, hint: 'e.g. *1/*1, *2/*2, *17/*17' },
  { key: 'phone',              label: 'Phone Number',             required: false, hint: 'Patient phone for direct outreach (enables direct contact pathway)' },
  { key: 'email',              label: 'Patient Email',            required: false, hint: 'Patient email for direct outreach' },
  { key: 'address',            label: 'Address',                  required: false, hint: 'Patient postal/physical address' },
  { key: 'providerCode',       label: 'Provider Code / ID',       required: false, hint: 'Provider code or ID for provider-mediated contact' },
];

export default function ColumnMapper({ detectedColumns, mapping, onMappingChange, onConfirm, onCancel }) {
  const allRequiredMapped = REQUIRED_FIELDS
    .filter(f => f.required)
    .every(f => mapping[f.key] && mapping[f.key] !== '');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="p-6 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Map Spreadsheet Columns</h2>
          <p className="text-sm text-gray-500 mt-1">
            Match your file's columns to the fields the app needs. Required fields are marked with *.
            Unmapped optional fields will just be blank.
          </p>
        </div>
        <div className="p-6 space-y-4">
          {REQUIRED_FIELDS.map(field => (
            <div key={field.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                {field.label} {field.required && <span className="text-red-500">*</span>}
                <span title={field.hint} className="ml-1 inline-block cursor-help">
                  <HelpCircle size={13} className="inline text-gray-400" />
                </span>
              </label>
              <div className="flex items-center gap-2">
                <select
                  value={mapping[field.key] || ''}
                  onChange={e => onMappingChange(field.key, e.target.value)}
                  className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
                >
                  <option value="">— Not in this file —</option>
                  {detectedColumns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
              {mapping[field.key] && (
                <p className="text-xs text-teal-600 mt-1 flex items-center gap-1">
                  <ArrowRight size={11} /> Mapped to "{mapping[field.key]}"
                </p>
              )}
            </div>
          ))}
        </div>
        <div className="flex justify-end gap-3 p-6 border-t border-gray-100">
          <button
            onClick={onCancel}
            className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={!allRequiredMapped}
            className="px-4 py-2 text-sm font-semibold text-white bg-teal-700 hover:bg-teal-800 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Import Data
          </button>
        </div>
      </div>
    </div>
  );
}

// Parse a raw spreadsheet row using the confirmed column mapping.
// Returns a patient object in the app's internal schema.
export function applyMapping(row, mapping, index) {
  const get = (key) => {
    const col = mapping[key];
    if (!col) return undefined;
    return row[col];
  };

  const parseBoolean = (val) => {
    if (val === undefined || val === null || val === '') return false;
    const s = String(val).toLowerCase().trim();
    if (s === 'yes' || s === 'true' || s === '1' || s === 'y') return true;
    // If it looks like a date string, treat as collected
    if (s.match(/\d{4}[-/]\d{1,2}[-/]\d{1,2}/)) return true;
    return false;
  };

  const parseDate = (val) => {
    if (!val) return null;
    const s = String(val).trim();
    // Accept ISO dates as-is; do a basic sanity check
    return s || null;
  };

  const id = get('id') ? String(get('id')).trim() : `ROW-${index + 1}`;

  return {
    id,
    enrollmentDate: parseDate(get('enrollmentDate')),
    site: get('site') ? String(get('site')).trim() : null,
    sampleCollected: parseBoolean(get('sampleCollected')),
    sampleDate: parseDate(get('sampleCollected')),
    genotypingComplete: parseBoolean(get('genotypingComplete')),
    genotypingDate: parseDate(get('genotypingComplete')),
    genotype: get('genotype') ? String(get('genotype')).trim() : null,
    phone:        get('phone')        ? String(get('phone')).trim()        : null,
    email:        get('email')        ? String(get('email')).trim()        : null,
    address:      get('address')      ? String(get('address')).trim()      : null,
    providerCode: get('providerCode') ? String(get('providerCode')).trim() : null,
  };
}
