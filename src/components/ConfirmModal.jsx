import { X } from 'lucide-react';

export default function ConfirmModal({ title, message, confirmLabel = 'Confirm', danger = false, onConfirm, onCancel }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-bold text-gray-900">{title}</h2>
          <button onClick={onCancel} className="p-1 rounded-lg hover:bg-gray-100 text-gray-400 shrink-0">
            <X size={16} />
          </button>
        </div>
        <p className="text-sm text-gray-600 leading-relaxed">{message}</p>
        <div className="flex justify-end gap-2 pt-2">
          <button onClick={onCancel}
            className="px-4 py-2 text-sm text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm}
            className={`px-4 py-2 text-sm font-semibold rounded-lg transition-colors ${
              danger
                ? 'bg-red-600 hover:bg-red-700 text-white'
                : 'bg-teal-700 hover:bg-teal-800 text-white'
            }`}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
