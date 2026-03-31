import { useState, useEffect, useMemo, useRef } from 'react';
import { X, AlertCircle, Loader2 } from 'lucide-react';
import { getStudyColumns } from '../services/rulesEngine';
import useAppStore from '../store/appStore';

const OPERATORS = [
  { value: 'eq',        label: 'equals' },
  { value: 'neq',       label: 'does not equal' },
  { value: 'contains',  label: 'contains' },
  { value: 'gt',        label: 'greater than' },
  { value: 'lt',        label: 'less than' },
  { value: 'in',        label: 'is one of' },
  { value: 'not_empty', label: 'is not empty' },
  { value: 'is_empty',  label: 'is empty' },
];

const VALUE_HIDDEN = new Set(['not_empty', 'is_empty']);
const CUSTOM_SENTINEL = '__custom__';

const EMPTY = { study_id: '', column_name: '', operator: 'eq', value: '', priority: 'High', reason_template: '', is_active: true };

// ── Smart value picker ────────────────────────────────────────────────────────

function ValueInput({ operator, value, onChange, studyId, columnName }) {
  const rawPatients = useAppStore(s => s.rawPatients);

  // Unique non-empty values found in this study column, sorted alphabetically
  const options = useMemo(() => {
    if (!studyId || !columnName) return [];
    const patients = rawPatients.filter(p => p.studyId === studyId);
    if (patients.length === 0) return [];
    const lower = columnName.toLowerCase();
    const vals = new Set();
    for (const p of patients) {
      let v = columnName in p ? p[columnName]
        : Object.entries(p).find(([k]) => k.toLowerCase() === lower)?.[1];
      if (v !== null && v !== undefined && String(v).trim() !== '') {
        vals.add(String(v).trim());
      }
    }
    return [...vals].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [studyId, columnName, rawPatients]);

  // For single-value operators: track whether user is in free-text mode.
  // Initialise to true if editing a rule whose saved value isn't among the options.
  const [useCustom, setUseCustom] = useState(() => {
    if (!value || operator === 'in') return false;
    const store = useAppStore.getState();
    const patients = store.rawPatients.filter(p => p.studyId === studyId);
    const lower = (columnName ?? '').toLowerCase();
    const vals = new Set();
    for (const p of patients) {
      const v = columnName in p ? p[columnName]
        : Object.entries(p).find(([k]) => k.toLowerCase() === lower)?.[1];
      if (v !== null && v !== undefined && String(v).trim() !== '') vals.add(String(v).trim());
    }
    return vals.size > 0 && !vals.has(value);
  });

  // For 'in' operator: text field to type a custom value before adding
  const [customInput, setCustomInput] = useState('');

  // Reset local state when study or column changes
  useEffect(() => {
    setUseCustom(false);
    setCustomInput('');
  }, [studyId, columnName]);

  const noOptions = options.length === 0;

  // ── 'in' operator: multi-select checkboxes ──────────────────────────────
  if (operator === 'in') {
    const selected = value ? value.split(',').map(v => v.trim()).filter(Boolean) : [];

    const toggle = (v) => {
      const next = selected.includes(v)
        ? selected.filter(x => x !== v)
        : [...selected, v];
      onChange(next.join(', '));
    };

    const addCustom = () => {
      const trimmed = customInput.trim();
      if (!trimmed) return;
      if (!selected.includes(trimmed)) onChange([...selected, trimmed].join(', '));
      setCustomInput('');
    };

    if (noOptions) {
      return (
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder="e.g. *17/*17, *2/*2"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
      );
    }

    return (
      <div className="space-y-1.5">
        <div className="border border-gray-300 rounded-lg overflow-hidden">
          <div className="max-h-40 overflow-y-auto divide-y divide-gray-50">
            {options.map(opt => (
              <label key={opt}
                className="flex items-center gap-2 px-3 py-1.5 hover:bg-gray-50 cursor-pointer">
                <input type="checkbox" checked={selected.includes(opt)} onChange={() => toggle(opt)}
                  className="w-3.5 h-3.5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 shrink-0" />
                <span className="font-mono text-xs text-gray-700">{opt}</span>
              </label>
            ))}
          </div>
          {/* Custom value row */}
          <div className="border-t border-gray-200 flex items-center gap-1.5 px-2 py-1.5 bg-gray-50">
            <input type="text" value={customInput} onChange={e => setCustomInput(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && (e.preventDefault(), addCustom())}
              placeholder="Custom value…"
              className="flex-1 border border-gray-200 rounded px-2 py-1 text-xs focus:outline-none focus:ring-1 focus:ring-teal-500" />
            <button type="button" onClick={addCustom} disabled={!customInput.trim()}
              className="px-2 py-1 bg-teal-600 text-white rounded text-xs font-medium hover:bg-teal-700 disabled:opacity-40 transition-colors">
              Add
            </button>
          </div>
        </div>
        {selected.length > 0 && (
          <p className="text-[11px] text-gray-400 truncate">
            {selected.length} selected: {selected.join(', ')}
          </p>
        )}
      </div>
    );
  }

  // ── Single value: fallback to free text ─────────────────────────────────
  if (noOptions || useCustom) {
    return (
      <div className="space-y-1">
        {!noOptions && (
          <button type="button"
            onClick={() => { setUseCustom(false); onChange(''); }}
            className="text-[11px] text-teal-600 hover:underline leading-none">
            ← Pick from existing values
          </button>
        )}
        <input type="text" value={value} onChange={e => onChange(e.target.value)}
          placeholder="Value…"
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
      </div>
    );
  }

  // ── Single value: dropdown ───────────────────────────────────────────────
  return (
    <select
      value={options.includes(value) ? value : ''}
      onChange={e => {
        if (e.target.value === CUSTOM_SENTINEL) { setUseCustom(true); onChange(''); }
        else onChange(e.target.value);
      }}
      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
    >
      <option value="">Select value…</option>
      {options.map(opt => <option key={opt} value={opt}>{opt}</option>)}
      <option disabled>─────────────</option>
      <option value={CUSTOM_SENTINEL}>✏ Custom value…</option>
    </select>
  );
}

// ── Main modal ────────────────────────────────────────────────────────────────

export default function RuleModal({ rule, preselectedStudyId, onSave, onClose }) {
  const studies = useAppStore(s => s.studies);
  const studyList = Object.values(studies).sort((a, b) => a.id.localeCompare(b.id));

  const [form, setForm] = useState(() => rule
    ? { study_id: rule.study_id, column_name: rule.column_name, operator: rule.operator,
        value: rule.value ?? '', priority: rule.priority, reason_template: rule.reason_template,
        is_active: rule.is_active }
    : { ...EMPTY, study_id: preselectedStudyId ?? '' }
  );
  const [columns, setColumns] = useState([]);
  const [saving,  setSaving]  = useState(false);
  const [error,   setError]   = useState('');

  useEffect(() => {
    if (form.study_id) setColumns(getStudyColumns(form.study_id));
    else setColumns([]);
  }, [form.study_id]);

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  // Reset column + value when study changes
  const handleStudyChange = (studyId) => {
    setForm(f => ({ ...f, study_id: studyId, column_name: '', value: '' }));
  };

  // Reset value when column changes
  const handleColumnChange = (col) => {
    setForm(f => ({ ...f, column_name: col, value: '' }));
  };

  // Reset value when operator changes (e.g. switching in/out of 'in')
  const handleOperatorChange = (op) => {
    const wasMulti = form.operator === 'in';
    const nowMulti = op === 'in';
    setForm(f => ({ ...f, operator: op, value: (wasMulti !== nowMulti) ? '' : f.value }));
  };

  const hideValue = VALUE_HIDDEN.has(form.operator);

  const preview = form.study_id && form.column_name && form.operator
    ? `Flag patients in ${form.study_id} where "${form.column_name}" ${OPERATORS.find(o => o.value === form.operator)?.label ?? form.operator}${hideValue ? '' : ` "${form.value}"`} as ${form.priority} priority`
    : null;

  const isValid = form.study_id && form.column_name && form.operator && form.reason_template.trim()
    && (hideValue || form.value.trim());

  const handleSave = async () => {
    if (!isValid) return;
    setError('');
    setSaving(true);
    try {
      await onSave(form);
    } catch (e) {
      setError(e.message ?? 'Failed to save rule');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg flex flex-col max-h-[95vh]">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <h2 className="text-lg font-bold text-gray-900">{rule ? 'Edit Rule' : 'New Recontact Rule'}</h2>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400"><X size={18} /></button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-sm text-red-700">
              <AlertCircle size={15} className="shrink-0 mt-0.5" /> {error}
            </div>
          )}

          {/* Study */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Study *</label>
            <select value={form.study_id} onChange={e => handleStudyChange(e.target.value)}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
              <option value="">Select study…</option>
              {studyList.map(s => <option key={s.id} value={s.id}>{s.shortName || s.id} — {s.name}</option>)}
            </select>
          </div>

          {/* Column */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Column / Field *</label>
            {columns.length > 0 ? (
              <select value={form.column_name} onChange={e => handleColumnChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="">Select field…</option>
                {columns.map(c => <option key={c} value={c}>{c}</option>)}
              </select>
            ) : (
              <input type="text" value={form.column_name} onChange={e => handleColumnChange(e.target.value)}
                placeholder="e.g. genotype"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
            )}
          </div>

          {/* Operator + Value */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-700 mb-1">Operator *</label>
              <select value={form.operator} onChange={e => handleOperatorChange(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                {OPERATORS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
              </select>
            </div>
            {!hideValue && (
              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">Value *</label>
                <ValueInput
                  operator={form.operator}
                  value={form.value}
                  onChange={v => set('value', v)}
                  studyId={form.study_id}
                  columnName={form.column_name}
                />
              </div>
            )}
          </div>

          {/* Priority */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Priority *</label>
            <div className="flex gap-2">
              {['High', 'Medium'].map(p => (
                <button key={p} type="button"
                  onClick={() => set('priority', p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    form.priority === p
                      ? p === 'High' ? 'bg-red-600 text-white border-red-600' : 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-500 hover:bg-gray-50'
                  }`}>
                  {p}
                </button>
              ))}
            </div>
          </div>

          {/* Reason */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 mb-1">Reason / Message *</label>
            <textarea value={form.reason_template} onChange={e => set('reason_template', e.target.value)}
              rows={3} placeholder="This reason will appear on the flagged patient card and in reports…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none" />
          </div>

          {/* Active */}
          <label className="flex items-center gap-2 cursor-pointer">
            <input type="checkbox" checked={form.is_active} onChange={e => set('is_active', e.target.checked)}
              className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500" />
            <span className="text-sm text-gray-700">Active — evaluate this rule when rules are run</span>
          </label>

          {/* Preview */}
          {preview && (
            <div className="bg-teal-50 border border-teal-200 rounded-lg p-3 text-sm text-teal-800">
              <span className="font-medium">Preview: </span>{preview}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-2 p-5 border-t border-gray-100 shrink-0">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={handleSave} disabled={!isValid || saving}
            className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {saving ? <><Loader2 size={14} className="animate-spin" /> Saving…</> : rule ? 'Save Changes' : 'Create Rule'}
          </button>
        </div>
      </div>
    </div>
  );
}
