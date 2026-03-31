import { useState, useMemo } from 'react';
import {
  ArrowRight, AlertTriangle, Clock, User, Plus, Trash2,
  ChevronRight, GitMerge, Users, BarChart2, Mail, CheckCircle,
  Phone, Building2, MessageSquare, Send,
} from 'lucide-react';
import { addPatientNote } from '../services/dataService';
import { STAGES, getStage, getNextStageForPathway, isOverdue, durationLabel } from '../data/workflowStages';
import { PATHWAY } from '../data/contactPathway';
import PathwayBadge from './PathwayBadge';
import StudyBadge from './StudyBadge';
import StageTransitionModal from './StageTransitionModal';
import RecontactDetailModal from './RecontactDetailModal';
import ProviderPicker from './ProviderPicker';
import EmailCompose from './EmailCompose';
import useAppStore from '../store/appStore';

const PRIORITY_BADGE = {
  High:   'bg-red-100 text-red-700 border border-red-200',
  Medium: 'bg-amber-100 text-amber-700 border border-amber-200',
};

const PATHWAY_FILTER_OPTIONS = [
  { key: 'all',      label: 'Show All' },
  { key: 'direct',   label: 'Direct Contact' },
  { key: 'provider', label: 'Provider-Mediated' },
  { key: 'none',     label: 'No Contact Method' },
];

// ── Quick note widget ─────────────────────────────────────────────────────────

function QuickNote({ patientId }) {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);

  const handleSave = async (e) => {
    e?.preventDefault();
    if (!text.trim() || busy) return;
    setBusy(true);
    await addPatientNote(patientId, text.trim(), 'manual');
    setText('');
    setOpen(false);
    setBusy(false);
  };

  return (
    <div onClick={e => e.stopPropagation()}>
      {open ? (
        <form onSubmit={handleSave} className="mt-2 flex gap-1">
          <input
            autoFocus
            value={text}
            onChange={e => setText(e.target.value)}
            onKeyDown={e => { if (e.key === 'Escape') { setOpen(false); setText(''); }}}
            placeholder="Add a note…"
            className="flex-1 text-xs border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-1 focus:ring-teal-500"
          />
          <button type="submit" disabled={!text.trim() || busy}
            className="p-1.5 bg-teal-700 text-white rounded-md hover:bg-teal-800 disabled:opacity-40 transition-colors">
            <Send size={11} />
          </button>
          <button type="button" onClick={() => { setOpen(false); setText(''); }}
            className="p-1.5 text-gray-400 hover:text-gray-600 rounded-md border border-gray-200 hover:bg-gray-50 transition-colors text-xs">
            ✕
          </button>
        </form>
      ) : (
        <button
          onClick={() => setOpen(true)}
          className="flex items-center gap-1 text-xs text-gray-400 hover:text-teal-600 transition-colors mt-1.5"
          title="Add a note"
        >
          <MessageSquare size={11} /> Note
        </button>
      )}
    </div>
  );
}

// ── Patient card in kanban column ─────────────────────────────────────────────

function PatientCard({
  patient, caseRecord, providers, providerAssignments, emailedPatients, isDragOver,
  onMoveNext, onDragStart, onCardClick, onAssignProvider, onAddProvider, onEmailPatient,
}) {
  const studies  = useAppStore(s => s.studies);
  const stage    = getStage(caseRecord.stage);
  const pathway  = patient.contactPathway || PATHWAY.NONE;
  const nextStage = getNextStageForPathway(caseRecord.stage, pathway);
  const overdue  = isOverdue(caseRecord.stage, caseRecord.stageEnteredAt);
  const duration = durationLabel(caseRecord.stageEnteredAt);
  const assignedProvider = providerAssignments[patient.id] || caseRecord.assignedProvider;
  const wasEmailed = emailedPatients.has(patient.id);

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onCardClick}
      className={`bg-white rounded-lg border ${stage.borderClass} p-3 shadow-sm cursor-grab active:cursor-grabbing
        hover:shadow-md transition-all select-none
        ${isDragOver ? 'opacity-50' : ''}
        ${overdue ? 'ring-2 ring-red-300' : ''}`}
    >
      {/* Card header */}
      <div className="flex items-start justify-between gap-2 mb-2">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          <span className="font-mono font-bold text-gray-900 text-sm truncate">{patient.id}</span>
          <PathwayBadge pathway={pathway} size="xs" />
          {patient.studyId && Object.keys(studies).length > 1 && (
            <StudyBadge study={patient.studyId} studies={studies} size="xs" />
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          {overdue && (
            <span title="Overdue">
              <AlertTriangle size={13} className="text-red-500" />
            </span>
          )}
          {patient.priority && (
            <span className={`text-[11px] font-semibold px-1.5 py-0.5 rounded-full ${PRIORITY_BADGE[patient.priority]}`}>
              {patient.priority}
            </span>
          )}
        </div>
      </div>

      {/* Genotype + phenotype */}
      <div className="flex items-center gap-2 mb-2">
        <span className="font-mono text-xs text-gray-600 bg-gray-100 px-1.5 py-0.5 rounded">{patient.genotype}</span>
        <span className="text-xs text-gray-500">{patient.phenotypeShort || patient.phenotype}</span>
      </div>

      {/* Suggested action */}
      {patient.suggestedAction && (
        <p className="text-xs text-gray-500 mb-2 line-clamp-2 leading-relaxed">
          {patient.suggestedAction}
        </p>
      )}

      {/* Provider + duration */}
      <div className="flex items-center justify-between mt-2 pt-2 border-t border-gray-100">
        <ProviderPicker
          currentProvider={assignedProvider || null}
          providers={providers}
          onAssign={(name) => onAssignProvider(patient.id, name)}
          onAddProvider={onAddProvider}
        />
        <span className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
          <Clock size={11} />{duration}
        </span>
      </div>

      {/* Action row */}
      <div className="mt-2 flex gap-1.5">
        {nextStage && (
          <button
            onClick={e => { e.stopPropagation(); onMoveNext(nextStage.key); }}
            className="flex-1 text-xs font-medium text-center py-1.5 rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center justify-center gap-1 transition-colors"
          >
            <ArrowRight size={12} />
            {nextStage.label}
          </button>
        )}
        <button
          onClick={e => { e.stopPropagation(); onEmailPatient(patient); }}
          disabled={!assignedProvider}
          title={assignedProvider ? `Email ${assignedProvider}` : 'Assign a provider first'}
          className={`flex items-center gap-1 text-xs px-2 py-1.5 rounded-md border transition-colors ${
            wasEmailed
              ? 'border-teal-200 bg-teal-50 text-teal-600'
              : assignedProvider
              ? 'border-gray-200 hover:bg-gray-50 text-gray-500'
              : 'border-gray-100 text-gray-300 cursor-not-allowed'
          }`}
        >
          {wasEmailed ? <CheckCircle size={12} /> : <Mail size={12} />}
          {wasEmailed ? 'Sent' : 'Email'}
        </button>
      </div>

      <QuickNote patientId={patient.id} />
    </div>
  );
}

// ── Kanban column ─────────────────────────────────────────────────────────────

function Column({ stage, patients, cases, providers, providerAssignments, emailedPatients, onMovePatient, onCardClick, dragState, onDragOver, onDrop, onDragLeave, onAssignProvider, onAddProvider, onEmailPatient }) {
  const count = patients.length;
  const overdueCount = patients.filter(p => isOverdue(stage.key, cases[p.id]?.stageEnteredAt)).length;

  return (
    <div
      className={`flex flex-col min-w-[220px] max-w-[260px] w-full rounded-xl border-2 transition-colors
        ${dragState.overStage === stage.key && dragState.patientId
          ? 'border-teal-400 bg-teal-50'
          : `${stage.borderClass} bg-gray-50/60`}`}
      onDragOver={e => { e.preventDefault(); onDragOver(stage.key); }}
      onDrop={() => onDrop(stage.key)}
      onDragLeave={onDragLeave}
    >
      <div className={`px-3 py-2.5 rounded-t-xl ${stage.headerClass} border-b ${stage.borderClass}`}>
        <div className="flex items-center justify-between">
          <span className="font-semibold text-xs uppercase tracking-wide">{stage.label}</span>
          <div className="flex items-center gap-1.5">
            {overdueCount > 0 && (
              <span className="flex items-center gap-0.5 text-xs bg-red-200 text-red-800 px-1.5 py-0.5 rounded-full font-bold">
                <AlertTriangle size={10} />{overdueCount}
              </span>
            )}
            <span className="text-xs font-bold opacity-70">{count}</span>
          </div>
        </div>
      </div>

      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[60vh]">
        {patients.length === 0 && (
          <div className="text-center py-8 text-xs text-gray-400 italic">No patients</div>
        )}
        {patients.map(p => (
          <PatientCard
            key={p.id}
            patient={p}
            caseRecord={cases[p.id]}
            providers={providers}
            providerAssignments={providerAssignments}
            emailedPatients={emailedPatients}
            isDragOver={dragState.patientId && dragState.overStage === stage.key && dragState.patientId !== p.id}
            onMoveNext={(toStageKey) => onMovePatient(p.id, stage.key, toStageKey)}
            onDragStart={() => dragState.setDragging(p.id, stage.key)}
            onCardClick={() => onCardClick(p)}
            onAssignProvider={onAssignProvider}
            onAddProvider={onAddProvider}
            onEmailPatient={onEmailPatient}
          />
        ))}
      </div>
    </div>
  );
}

// ── Provider registry tab ─────────────────────────────────────────────────────

function ProviderRegistry({ providers, cases, onAddProvider, onRemoveProvider }) {
  const [form, setForm] = useState({ name: '', facility: '', phone: '', email: '', preferredContact: 'Email' });
  const [adding, setAdding] = useState(false);

  const assignedCounts = {};
  Object.values(cases).forEach(c => {
    if (c.assignedProvider) {
      assignedCounts[c.assignedProvider] = (assignedCounts[c.assignedProvider] || 0) + 1;
    }
  });

  const handleAdd = () => {
    if (!form.name.trim()) return;
    onAddProvider({ ...form, id: `prov-${Date.now()}` });
    setForm({ name: '', facility: '', phone: '', email: '', preferredContact: 'Email' });
    setAdding(false);
  };

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold text-gray-900">Provider Registry</h2>
          <p className="text-sm text-gray-500">{providers.length} provider{providers.length !== 1 ? 's' : ''} registered</p>
        </div>
        <button
          onClick={() => setAdding(v => !v)}
          className="flex items-center gap-1.5 px-3 py-2 bg-teal-700 text-white rounded-lg text-sm font-medium hover:bg-teal-800 transition-colors"
        >
          <Plus size={15} /> Add Provider
        </button>
      </div>

      {adding && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-5 space-y-3">
          <h3 className="font-semibold text-sm text-teal-800 mb-2">New Provider</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {[
              { key: 'name',     label: 'Name *',     placeholder: 'Dr. Jane Smith' },
              { key: 'facility', label: 'Facility',   placeholder: 'University Teaching Hospital' },
              { key: 'phone',    label: 'Phone',      placeholder: '+27 11 555 0100' },
              { key: 'email',    label: 'Email',      placeholder: 'dr.smith@hospital.org' },
            ].map(f => (
              <div key={f.key}>
                <label className="block text-xs font-medium text-gray-700 mb-1">{f.label}</label>
                <input
                  type="text"
                  placeholder={f.placeholder}
                  value={form[f.key]}
                  onChange={e => setForm(v => ({ ...v, [f.key]: e.target.value }))}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
            ))}
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Contact</label>
              <select
                value={form.preferredContact}
                onChange={e => setForm(v => ({ ...v, preferredContact: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
              >
                {['Email', 'Phone', 'WhatsApp', 'In Person'].map(m => <option key={m}>{m}</option>)}
              </select>
            </div>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button onClick={() => setAdding(false)} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">Cancel</button>
            <button onClick={handleAdd} disabled={!form.name.trim()} className="px-3 py-1.5 text-sm font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50">Add</button>
          </div>
        </div>
      )}

      {providers.length === 0 && !adding ? (
        <div className="bg-white border border-gray-200 rounded-xl p-12 text-center text-gray-400">
          <Users size={32} className="mx-auto mb-3 opacity-30" />
          <p className="font-medium">No providers registered yet</p>
          <p className="text-sm mt-1">Add providers to assign them during the recontact workflow</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-100">
                {['Name', 'Facility', 'Contact', 'Preferred Method', 'Assigned Patients', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {providers.map(p => (
                <tr key={p.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{p.name}</td>
                  <td className="px-4 py-3 text-gray-600">{p.facility || '—'}</td>
                  <td className="px-4 py-3 text-gray-600">
                    {p.email && <div>{p.email}</div>}
                    {p.phone && <div className="text-xs text-gray-400">{p.phone}</div>}
                  </td>
                  <td className="px-4 py-3 text-gray-600">{p.preferredContact}</td>
                  <td className="px-4 py-3">
                    <span className="font-semibold text-teal-700">{assignedCounts[p.name] || 0}</span>
                  </td>
                  <td className="px-4 py-3">
                    <button onClick={() => onRemoveProvider(p.id)} className="text-gray-300 hover:text-red-500 transition-colors">
                      <Trash2 size={14} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Main screen ───────────────────────────────────────────────────────────────

export default function RecontactWorkflow({
  flaggedPatients,
  recontactCases,
  providerAssignments,
  providers,
  emailedPatients,
  onMovePatient,
  onAddProvider,
  onRemoveProvider,
  onAssignProvider,
  onMarkEmailed,
}) {
  const studies = useAppStore(s => s.studies);

  const [activeTab,      setActiveTab]      = useState('pipeline');
  const [mobileStage,    setMobileStage]    = useState(STAGES[0].key);
  const [transition,     setTransition]     = useState(null);
  const [detailPatient,  setDetailPatient]  = useState(null);
  const [composeFor,     setComposeFor]     = useState(null);
  const [pathwayFilter,  setPathwayFilter]  = useState('all');

  const [draggingId,    setDraggingId]    = useState(null);
  const [dragFromStage, setDragFromStage] = useState(null);
  const [dragOverStage, setDragOverStage] = useState(null);

  const dragState = {
    patientId: draggingId,
    overStage: dragOverStage,
    setDragging: (id, stg) => { setDraggingId(id); setDragFromStage(stg); },
  };

  // Filter patients by pathway
  const filteredFlaggedPatients = useMemo(() => {
    if (pathwayFilter === 'all') return flaggedPatients;
    if (pathwayFilter === 'none') return flaggedPatients.filter(p => !p.contactPathway || p.contactPathway === 'none');
    return flaggedPatients.filter(p =>
      p.contactPathway === pathwayFilter || p.contactPathway === 'both'
    );
  }, [flaggedPatients, pathwayFilter]);

  // Visible stages depend on active filter (hide irrelevant columns)
  const visibleStages = useMemo(() => {
    if (pathwayFilter === 'direct') return STAGES.filter(s => s.key !== 'provider_notified');
    if (pathwayFilter === 'provider') return STAGES.filter(s => s.key !== 'followup_scheduled');
    return STAGES;
  }, [pathwayFilter]);

  // Initiate a stage move — validates that the target stage is valid for the patient's pathway
  const handleMoveRequest = (patientId, fromStage, toStage) => {
    if (!toStage) return;
    const patient = flaggedPatients.find(p => p.id === patientId);
    const pathway = patient?.contactPathway || 'provider';
    // Prevent invalid stage transitions for the pathway
    if (pathway === 'direct' && toStage === 'provider_notified') return;
    if (pathway !== 'direct' && pathway !== 'both' && toStage === 'followup_scheduled') return;
    setTransition({ patientId, fromStage, toStage, pathway });
  };

  const handleTransitionConfirm = (payload) => {
    const { patientId, fromStage, toStage } = transition;
    onMovePatient(patientId, toStage, payload);
    setTransition(null);
  };

  const handleDrop = (targetStage) => {
    setDragOverStage(null);
    if (!draggingId || !dragFromStage || targetStage === dragFromStage) {
      setDraggingId(null);
      return;
    }
    const allKeys = STAGES.map(s => s.key);
    const fromIdx = allKeys.indexOf(dragFromStage);
    const toIdx   = allKeys.indexOf(targetStage);
    if (toIdx > fromIdx) {
      handleMoveRequest(draggingId, dragFromStage, targetStage);
    }
    setDraggingId(null);
    setDragFromStage(null);
  };

  // Summary stats
  const total        = filteredFlaggedPatients.length;
  const stageCounts  = {};
  STAGES.forEach(s => { stageCounts[s.key] = 0; });
  Object.values(recontactCases).forEach(c => {
    if (stageCounts[c.stage] !== undefined) stageCounts[c.stage]++;
  });

  const closedCases = Object.values(recontactCases).filter(c => c.stage === 'closed' && c.history.length > 1);
  const avgDays = closedCases.length
    ? Math.round(closedCases.reduce((sum, c) => {
        const start = new Date(c.history[0].timestamp);
        const end   = new Date(c.history[c.history.length - 1].timestamp);
        return sum + (end - start) / 86400000;
      }, 0) / closedCases.length)
    : null;

  const overdueCount = Object.values(recontactCases).filter(c => isOverdue(c.stage, c.stageEnteredAt)).length;

  // Group filtered patients by stage
  const patientsByStage = {};
  STAGES.forEach(s => { patientsByStage[s.key] = []; });
  filteredFlaggedPatients.forEach(p => {
    const c = recontactCases[p.id];
    if (c && patientsByStage[c.stage] !== undefined) {
      patientsByStage[c.stage].push(p);
    } else if (patientsByStage['flagged']) {
      patientsByStage['flagged'].push(p);
    }
  });

  const transitionPatient = transition
    ? flaggedPatients.find(p => p.id === transition.patientId)
    : null;

  const detailCase = detailPatient ? recontactCases[detailPatient.id] : null;

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Recontact Workflow</h1>
        <p className="text-gray-500 text-sm mt-1">Track patients through the recontact pipeline from flagging to case closure</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        {[
          { key: 'pipeline',  label: 'Pipeline',         icon: GitMerge },
          { key: 'providers', label: 'Provider Registry', icon: Users },
        ].map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            onClick={() => setActiveTab(key)}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              activeTab === key
                ? 'border-teal-600 text-teal-700'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >
            <Icon size={15} /> {label}
          </button>
        ))}
      </div>

      {/* ── PIPELINE TAB ── */}
      {activeTab === 'pipeline' && (
        <>
          {/* Summary stats */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">
                {pathwayFilter === 'all' ? 'Total Flagged' : 'Showing'}
              </p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{total}</p>
            </div>
            <div className={`bg-white rounded-xl border p-4 ${overdueCount > 0 ? 'border-red-200 bg-red-50' : 'border-gray-200'}`}>
              <p className={`text-xs font-medium ${overdueCount > 0 ? 'text-red-600' : 'text-gray-500'}`}>Overdue</p>
              <p className={`text-2xl font-bold mt-1 ${overdueCount > 0 ? 'text-red-700' : 'text-gray-900'}`}>{overdueCount}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">Closed Cases</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{stageCounts.closed || 0}</p>
            </div>
            <div className="bg-white rounded-xl border border-gray-200 p-4">
              <p className="text-xs text-gray-500 font-medium">Avg. Days to Close</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{avgDays !== null ? `${avgDays}d` : '—'}</p>
            </div>
          </div>

          {/* Pathway filter toggles */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-500 font-medium">Filter by pathway:</span>
            {PATHWAY_FILTER_OPTIONS.map(opt => (
              <button
                key={opt.key}
                onClick={() => setPathwayFilter(opt.key)}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${
                  pathwayFilter === opt.key
                    ? 'bg-teal-700 text-white'
                    : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                }`}
              >
                {opt.key === 'direct'   && <Phone size={11} />}
                {opt.key === 'provider' && <Building2 size={11} />}
                {opt.label}
                {opt.key !== 'all' && (
                  <span className={`ml-0.5 ${pathwayFilter === opt.key ? 'opacity-70' : 'text-gray-400'}`}>
                    ({opt.key === 'none'
                      ? flaggedPatients.filter(p => !p.contactPathway || p.contactPathway === 'none').length
                      : flaggedPatients.filter(p => p.contactPathway === opt.key || p.contactPathway === 'both').length
                    })
                  </span>
                )}
              </button>
            ))}
          </div>

          {/* Stage mini-counters */}
          <div className="flex flex-wrap gap-2">
            {visibleStages.map(s => (
              <div key={s.key} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${s.headerClass}`}>
                <span className={`w-1.5 h-1.5 rounded-full ${s.dotClass}`} />
                {s.label}: <strong>{patientsByStage[s.key]?.length || 0}</strong>
              </div>
            ))}
          </div>

          {/* Empty state */}
          {flaggedPatients.length === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-16 text-center text-gray-400">
              <GitMerge size={40} className="mx-auto mb-3 opacity-30" />
              <p className="font-medium">No flagged patients yet</p>
              <p className="text-sm mt-1">Load patient data to begin the recontact workflow</p>
            </div>
          )}

          {flaggedPatients.length > 0 && total === 0 && (
            <div className="bg-white border border-gray-200 rounded-xl p-10 text-center text-gray-400">
              <p className="text-sm">No patients match the current pathway filter</p>
            </div>
          )}

          {/* Mobile stage selector */}
          {total > 0 && (
            <div className="md:hidden">
              <select
                value={mobileStage}
                onChange={e => setMobileStage(e.target.value)}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 mb-4"
              >
                {visibleStages.map(s => (
                  <option key={s.key} value={s.key}>{s.label} ({patientsByStage[s.key]?.length || 0})</option>
                ))}
              </select>
              {visibleStages.filter(s => s.key === mobileStage).map(stage => (
                <Column
                  key={stage.key}
                  stage={stage}
                  patients={patientsByStage[stage.key] || []}
                  cases={recontactCases}
                  providers={providers}
                  providerAssignments={providerAssignments}
                  emailedPatients={emailedPatients}
                  onMovePatient={(pid, from, to) => handleMoveRequest(pid, from, to)}
                  onCardClick={p => setDetailPatient(p)}
                  dragState={{ ...dragState, setDragging: () => {} }}
                  onDragOver={() => {}}
                  onDrop={() => {}}
                  onDragLeave={() => {}}
                  onAssignProvider={onAssignProvider}
                  onAddProvider={onAddProvider}
                  onEmailPatient={setComposeFor}
                />
              ))}
            </div>
          )}

          {/* Desktop kanban */}
          {total > 0 && (
            <div className="hidden md:flex gap-4 overflow-x-auto pb-4">
              {visibleStages.map(stage => (
                <Column
                  key={stage.key}
                  stage={stage}
                  patients={patientsByStage[stage.key] || []}
                  cases={recontactCases}
                  providers={providers}
                  providerAssignments={providerAssignments}
                  emailedPatients={emailedPatients}
                  onMovePatient={(pid, from, to) => handleMoveRequest(pid, from, to)}
                  onCardClick={p => setDetailPatient(p)}
                  dragState={dragState}
                  onDragOver={stgKey => setDragOverStage(stgKey)}
                  onDrop={handleDrop}
                  onDragLeave={() => setDragOverStage(null)}
                  onAssignProvider={onAssignProvider}
                  onAddProvider={onAddProvider}
                  onEmailPatient={setComposeFor}
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* ── PROVIDERS TAB ── */}
      {activeTab === 'providers' && (
        <ProviderRegistry
          providers={providers}
          cases={recontactCases}
          onAddProvider={onAddProvider}
          onRemoveProvider={onRemoveProvider}
        />
      )}

      {/* Stage transition modal */}
      {transition && transitionPatient && (
        <StageTransitionModal
          patient={transitionPatient}
          fromStage={transition.fromStage}
          toStage={transition.toStage}
          pathway={transition.pathway}
          providers={providers}
          onConfirm={handleTransitionConfirm}
          onCancel={() => setTransition(null)}
        />
      )}

      {/* Detail modal */}
      {detailPatient && detailCase && (
        <RecontactDetailModal
          patient={detailPatient}
          caseRecord={detailCase}
          onClose={() => setDetailPatient(null)}
        />
      )}

      {/* Email compose */}
      {composeFor && (
        <EmailCompose
          patient={composeFor}
          providers={providers}
          providerAssignments={providerAssignments}
          onMarkEmailed={onMarkEmailed}
          onClose={() => setComposeFor(null)}
        />
      )}
    </div>
  );
}
