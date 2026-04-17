import { useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';

// Field-type hints — drive which input to render and how to parse the value.
const BOOLEAN_FIELDS = new Set(['sampleCollected', 'genotypingComplete', 'flagged']);
const NUMBER_FIELDS  = new Set(['age', 'weight', 'height', 'bpSystolic', 'bpDiastolic', 'decibelsLost', 'eGFR', 'malariaCycles', 'malariaEpisodes', 'iop']);

// Enum fields: dropdown with fixed options.
const ENUM_FIELDS = {
  gender:         ['M', 'F'],
  sex:            ['M', 'F'],
  contactPathway: ['direct', 'provider', 'both', 'none'],
};

// Fields that must not be edited inline — primary key + derived fields.
const NON_EDITABLE = new Set(['id', 'flagged', 'priority', 'phenotype', 'implication', 'suggestedAction', 'flaggedBy']);

export function fieldInputType(field) {
  if (BOOLEAN_FIELDS.has(field)) return 'boolean';
  if (NUMBER_FIELDS.has(field))  return 'number';
  if (ENUM_FIELDS[field])        return 'enum';
  return 'text';
}

export function isEditableField(field) {
  return !NON_EDITABLE.has(field);
}

// Parse the draft string value into the appropriate type for Supabase.
export function parseDraft(field, draft) {
  const t = typeof draft === 'string' ? draft.trim() : draft;
  if (t === '' || t === null || t === undefined) return null;

  if (BOOLEAN_FIELDS.has(field)) {
    if (typeof t === 'boolean') return t;
    return /^(yes|y|true|1)$/i.test(String(t));
  }
  if (NUMBER_FIELDS.has(field)) {
    const n = Number(t);
    return Number.isNaN(n) ? null : n;
  }
  return t;
}

/**
 * Inline editable cell.
 *
 * Props:
 *   field, value, patient — the cell being rendered
 *   renderValue(value, patient, field)  — what to show when not editing (returns a React node)
 *   onSave(patientId, field, newValue)  — async save handler; throws to signal failure
 *   readOnly                             — true hides the edit affordance
 */
export default function EditableCell({ field, value, patient, renderValue, onSave, readOnly }) {
  const [editing, setEditing] = useState(false);
  const [draft,   setDraft]   = useState('');
  const [status,  setStatus]  = useState(null); // 'saving' | 'ok' | 'err'

  const canEdit = !readOnly && isEditableField(field);
  const inputType = fieldInputType(field);

  const beginEdit = (e) => {
    if (!canEdit) return;
    e.stopPropagation();
    if (inputType === 'boolean') {
      setDraft(value === true ? 'Yes' : value === false ? 'No' : '');
    } else {
      setDraft(value == null ? '' : String(value));
    }
    setEditing(true);
  };

  const commit = async (overrideValue) => {
    setEditing(false);
    const raw = overrideValue !== undefined ? overrideValue : draft;
    const parsed = parseDraft(field, raw);
    // No-op if unchanged
    const curNorm = value == null ? null : value;
    if (parsed === curNorm) return;

    setStatus('saving');
    try {
      await onSave(patient.id, field, parsed);
      setStatus('ok');
      setTimeout(() => setStatus(null), 1500);
    } catch (err) {
      console.error('[EditableCell] save failed:', err);
      setStatus('err');
      setTimeout(() => setStatus(null), 2500);
    }
  };

  if (editing) {
    const stopClick = (e) => e.stopPropagation();
    const onKey = (e) => {
      if (e.key === 'Enter')  { e.preventDefault(); commit(); }
      if (e.key === 'Escape') { e.preventDefault(); setEditing(false); }
    };
    if (inputType === 'enum') {
      return (
        <select
          autoFocus
          value={draft}
          onChange={e => { setDraft(e.target.value); commit(e.target.value); }}
          onBlur={() => setEditing(false)}
          onClick={stopClick}
          onKeyDown={onKey}
          className="w-full border border-teal-500 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
        >
          <option value="">—</option>
          {ENUM_FIELDS[field].map(opt => <option key={opt} value={opt}>{opt}</option>)}
        </select>
      );
    }
    if (inputType === 'boolean') {
      return (
        <select
          autoFocus
          value={draft}
          onChange={e => { setDraft(e.target.value); commit(e.target.value); }}
          onBlur={() => setEditing(false)}
          onClick={stopClick}
          onKeyDown={onKey}
          className="w-full border border-teal-500 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500 bg-white"
        >
          <option value="">—</option>
          <option value="Yes">Yes</option>
          <option value="No">No</option>
        </select>
      );
    }
    return (
      <input
        autoFocus
        type={inputType === 'number' ? 'number' : 'text'}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={() => commit()}
        onClick={stopClick}
        onKeyDown={onKey}
        className="w-full border border-teal-500 rounded px-1.5 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-teal-500"
      />
    );
  }

  return (
    <div
      onClick={beginEdit}
      className={`flex items-center gap-1 min-w-0 ${canEdit ? 'hover:bg-teal-50 rounded px-1 -mx-1' : ''} ${status === 'ok' ? 'bg-teal-50 rounded px-1 -mx-1' : ''} ${status === 'err' ? 'bg-red-50 rounded px-1 -mx-1' : ''}`}
      title={canEdit ? 'Click to edit' : undefined}
    >
      <div className="flex-1 min-w-0 truncate">
        {renderValue(value, patient, field)}
      </div>
      {status === 'saving' && <Loader2 size={11} className="animate-spin text-gray-400 shrink-0" />}
      {status === 'ok'     && <Check    size={11} className="text-teal-600 shrink-0" />}
      {status === 'err'    && <X        size={11} className="text-red-600 shrink-0" />}
    </div>
  );
}
