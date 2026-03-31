import { useState } from 'react';
import { X, AlertTriangle } from 'lucide-react';

export default function FlagForRecontactModal({ patients, onConfirm, onCancel }) {
  const [reason,   setReason]   = useState('');
  const [priority, setPriority] = useState('Medium');
  const [notes,    setNotes]    = useState('');

  const handleConfirm = () => {
    if (!reason.trim()) return;
    onConfirm({ reason: reason.trim(), priority, notes: notes.trim() });
  };

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-md">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Flag for Recontact</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">
              {patients.length} patient{patients.length !== 1 ? 's' : ''} selected
            </h2>
          </div>
          <button onClick={onCancel} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
            <X size={18} />
          </button>
        </div>

        {/* Form */}
        <div className="p-5 space-y-4">
          {patients.length <= 5 && (
            <div className="flex flex-wrap gap-1.5">
              {patients.map(p => (
                <span key={p.id} className="text-xs font-mono bg-gray-100 text-gray-700 px-2 py-0.5 rounded">{p.id}</span>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Recontact Reason <span className="text-red-500">*</span>
            </label>
            <textarea
              rows={3}
              value={reason}
              onChange={e => setReason(e.target.value)}
              placeholder="e.g. New genetic testing available — patient has documented family history of hereditary condition"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Priority</label>
            <div className="flex gap-2">
              {['High', 'Medium'].map(p => (
                <button
                  key={p}
                  onClick={() => setPriority(p)}
                  className={`flex-1 py-2 rounded-lg text-sm font-semibold border transition-colors ${
                    priority === p
                      ? p === 'High'
                        ? 'bg-red-600 text-white border-red-600'
                        : 'bg-amber-500 text-white border-amber-500'
                      : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                  }`}
                >
                  {p === 'High' ? '🔴 High' : '🟡 Medium'}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes (optional)</label>
            <textarea
              rows={2}
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Any additional context for the coordinator…"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
            />
          </div>

          {priority === 'High' && reason.trim() && (
            <div className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700">
              <AlertTriangle size={13} className="mt-0.5 shrink-0" />
              High priority flags will be highlighted prominently in the Recontact Workflow.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 p-5 border-t border-gray-100">
          <button onClick={onCancel} className="px-4 py-2 text-sm font-medium text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button
            onClick={handleConfirm}
            disabled={!reason.trim()}
            className={`px-4 py-2 text-sm font-semibold text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed ${
              priority === 'High' ? 'bg-red-600 hover:bg-red-700' : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            Flag {patients.length} Patient{patients.length !== 1 ? 's' : ''}
          </button>
        </div>
      </div>
    </div>
  );
}
