import { useState } from 'react';
import { X, Flag, UserCheck, Download, Edit3 } from 'lucide-react';

export default function BatchActionBar({ selected, patients, providers, onFlag, onAssignProvider, onExport, onBulkEdit, onClear }) {
  const [showProviderPicker, setShowProviderPicker] = useState(false);
  const [providerSearch,     setProviderSearch]     = useState('');

  if (selected.size === 0) return null;

  const selectedPatients = patients.filter(p => selected.has(p.id));

  const filteredProviders = providers.filter(p =>
    providerSearch === '' ||
    p.name.toLowerCase().includes(providerSearch.toLowerCase()) ||
    p.facility.toLowerCase().includes(providerSearch.toLowerCase())
  );

  return (
    <>
      {/* Overlay for provider picker */}
      {showProviderPicker && (
        <div className="fixed inset-0 z-[55]" onClick={() => setShowProviderPicker(false)} />
      )}

      {/* Fixed action bar */}
      <div className="fixed bottom-0 left-0 right-0 z-[60] bg-gray-900 border-t border-gray-700 shadow-2xl">
        <div className="max-w-screen-2xl mx-auto px-4 md:px-8 py-3 flex items-center gap-3 flex-wrap">
          <span className="text-sm font-semibold text-white shrink-0">
            {selected.size} selected
          </span>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              onClick={() => onFlag(selectedPatients)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Flag size={13} /> Flag for Recontact
            </button>

            <div className="relative">
              <button
                onClick={() => setShowProviderPicker(s => !s)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <UserCheck size={13} /> Assign Provider
              </button>

              {showProviderPicker && (
                <div className="absolute bottom-full mb-2 left-0 bg-white rounded-xl shadow-2xl border border-gray-200 w-64 z-[65]">
                  <div className="p-2 border-b border-gray-100">
                    <input
                      type="text"
                      placeholder="Search providers…"
                      value={providerSearch}
                      onChange={e => setProviderSearch(e.target.value)}
                      autoFocus
                      className="w-full px-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  <ul className="max-h-48 overflow-y-auto py-1">
                    {filteredProviders.map(p => (
                      <li key={p.id}>
                        <button
                          onClick={() => {
                            onAssignProvider(selectedPatients.map(pt => pt.id), p.name);
                            setShowProviderPicker(false);
                            setProviderSearch('');
                          }}
                          className="w-full text-left px-3 py-2 text-sm hover:bg-gray-50 transition-colors"
                        >
                          <p className="font-medium text-gray-900">{p.name}</p>
                          <p className="text-xs text-gray-400">{p.specialty} · {p.facility}</p>
                        </button>
                      </li>
                    ))}
                    {filteredProviders.length === 0 && (
                      <li className="px-3 py-2 text-sm text-gray-400">No providers found</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            {onBulkEdit && (
              <button
                onClick={() => onBulkEdit(selectedPatients)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-600 hover:bg-teal-500 text-white text-xs font-semibold rounded-lg transition-colors"
              >
                <Edit3 size={13} /> Bulk Edit
              </button>
            )}

            <button
              onClick={() => onExport(selectedPatients)}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-600 hover:bg-gray-500 text-white text-xs font-semibold rounded-lg transition-colors"
            >
              <Download size={13} /> Export Selected
            </button>
          </div>

          <button
            onClick={onClear}
            className="ml-auto p-1.5 text-gray-400 hover:text-white transition-colors"
            title="Clear selection"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Spacer so content isn't hidden behind bar */}
      <div className="h-14" />
    </>
  );
}
