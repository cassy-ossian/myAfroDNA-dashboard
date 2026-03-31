import { useState } from 'react';
import { MessageSquare, Zap, Send } from 'lucide-react';
import useAppStore from '../store/appStore';
import { addPatientNote } from '../services/dataService';

function formatTimestamp(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  const now = new Date();
  const diffMs = now - d;
  const diffDays = Math.floor(diffMs / 86400000);
  if (diffDays === 0) return `Today ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  if (diffDays === 1) return `Yesterday ${d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function PatientNotesSection({ patientId }) {
  const notes  = useAppStore(s => s.patientNotes[patientId] ?? []);
  const [text, setText]  = useState('');
  const [busy, setBusy]  = useState(false);

  const handleSubmit = async (e) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    await addPatientNote(patientId, text.trim(), 'manual');
    setText('');
    setBusy(false);
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handleSubmit();
  };

  return (
    <div>
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">Notes & Activity</h3>

      {/* Add note form */}
      <form onSubmit={handleSubmit} className="mb-4">
        <div className="flex gap-2">
          <textarea
            rows={2}
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Add a note… (Cmd+Enter to save)"
            className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 resize-none"
          />
          <button
            type="submit"
            disabled={!text.trim() || busy}
            className="px-3 py-2 bg-teal-700 text-white rounded-lg hover:bg-teal-800 transition-colors disabled:opacity-40 disabled:cursor-not-allowed self-end"
          >
            <Send size={14} />
          </button>
        </div>
      </form>

      {/* Notes list */}
      {notes.length === 0 ? (
        <p className="text-xs text-gray-400 italic text-center py-4">No notes yet</p>
      ) : (
        <div className="space-y-3 max-h-64 overflow-y-auto pr-1">
          {notes.map(note => (
            <div key={note.id} className="flex gap-2.5">
              <div className="mt-0.5 shrink-0">
                {note.type === 'system'
                  ? <Zap size={13} className="text-teal-500" />
                  : <MessageSquare size={13} className="text-gray-400" />
                }
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm text-gray-700 leading-relaxed">{note.text}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{formatTimestamp(note.timestamp)}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
