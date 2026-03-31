import { useState, useRef, useEffect } from 'react';
import { User, ChevronDown, Plus, Check, X } from 'lucide-react';

const BLANK_FORM = { name: '', facility: '', phone: '', email: '', preferredContact: 'Email' };

// ── Quick-add modal ───────────────────────────────────────────────────────────

function QuickAddModal({ onSave, onCancel }) {
  const [form, setForm] = useState(BLANK_FORM);
  const set = (k) => (e) => setForm(v => ({ ...v, [k]: e.target.value }));

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/40"
      onClick={onCancel}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add New Provider</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded">
            <X size={18} />
          </button>
        </div>

        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
          <input
            autoFocus
            type="text"
            placeholder="Dr. Jane Smith"
            value={form.name}
            onChange={set('name')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility</label>
          <input
            type="text"
            placeholder="University Teaching Hospital"
            value={form.facility}
            onChange={set('facility')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input
              type="text"
              placeholder="+27 11 555 0100"
              value={form.phone}
              onChange={set('phone')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input
              type="text"
              placeholder="dr@hospital.org"
              value={form.email}
              onChange={set('email')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
            />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Contact</label>
          <select
            value={form.preferredContact}
            onChange={set('preferredContact')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
          >
            {['Email', 'Phone', 'WhatsApp', 'In Person'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button
            onClick={onCancel}
            className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100"
          >
            Cancel
          </button>
          <button
            onClick={() => onSave(form)}
            disabled={!form.name.trim()}
            className="px-4 py-1.5 text-sm font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50"
          >
            Add &amp; Assign
          </button>
        </div>
      </div>
    </div>
  );
}

// ── ProviderPicker ────────────────────────────────────────────────────────────
// Used on cards (kanban, flagged list, dashboard attention list).
// For the Patients table, a native <select> is used inline in Patients.jsx.

export default function ProviderPicker({
  currentProvider,   // string | null
  providers,         // array of { id, name, facility }
  onAssign,          // (name: string | null) => void
  onAddProvider,     // (providerObj) => void
}) {
  const [open, setOpen] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const ref = useRef();

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const pick = (name) => {
    onAssign(name);
    setOpen(false);
  };

  const handleQuickSave = (form) => {
    if (!form.name.trim()) return;
    const provider = { ...form, name: form.name.trim(), id: `prov-${Date.now()}` };
    onAddProvider(provider);
    onAssign(provider.name);
    setShowAdd(false);
  };

  return (
    <>
      <div ref={ref} className="relative" onClick={e => e.stopPropagation()}>
        {/* Trigger button */}
        <button
          onClick={() => setOpen(v => !v)}
          className={`flex items-center gap-1 text-xs rounded-md px-1.5 py-1 transition-colors ${
            currentProvider
              ? 'text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200'
              : 'text-gray-400 hover:text-teal-600 border border-dashed border-gray-300 hover:border-teal-400'
          }`}
        >
          <User size={11} className="shrink-0" />
          <span className="max-w-[130px] truncate leading-none">
            {currentProvider || 'Assign provider'}
          </span>
          <ChevronDown size={10} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
        </button>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full left-0 mt-1 w-60 bg-white rounded-xl border border-gray-200 shadow-xl z-50 py-1">
            {/* Existing providers */}
            <div className="max-h-52 overflow-y-auto">
              {providers.length === 0 ? (
                <p className="px-3 py-2.5 text-xs text-gray-400 italic">No providers registered yet</p>
              ) : (
                providers.map(p => (
                  <button
                    key={p.id}
                    onClick={() => pick(p.name)}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 flex items-center justify-between gap-2 ${currentProvider === p.name ? 'bg-teal-50' : ''}`}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{p.name}</p>
                      {p.facility && <p className="text-xs text-gray-400 truncate">{p.facility}</p>}
                    </div>
                    {currentProvider === p.name && <Check size={13} className="text-teal-600 shrink-0" />}
                  </button>
                ))
              )}
            </div>

            {/* Clear assignment */}
            {currentProvider && (
              <div className="border-t border-gray-100">
                <button
                  onClick={() => pick(null)}
                  className="w-full text-left px-3 py-2 text-xs text-red-500 hover:bg-red-50"
                >
                  Remove assignment
                </button>
              </div>
            )}

            {/* Add new */}
            <div className="border-t border-gray-100">
              <button
                onClick={() => { setOpen(false); setShowAdd(true); }}
                className="w-full text-left px-3 py-2.5 text-xs font-medium text-teal-700 hover:bg-teal-50 flex items-center gap-1.5"
              >
                <Plus size={12} /> Add new provider…
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Quick-add modal (rendered outside dropdown to avoid z-index issues) */}
      {showAdd && (
        <QuickAddModal
          onSave={handleQuickSave}
          onCancel={() => setShowAdd(false)}
        />
      )}
    </>
  );
}
