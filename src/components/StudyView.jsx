import { useState, useMemo, useCallback, useEffect } from 'react';
import { Search, ChevronUp, ChevronDown, AlertTriangle, Dna, Phone, BookOpen, Play, Settings, Loader2, Download, Trash2, Lock, Plus, Eye, EyeOff } from 'lucide-react';
import { getRulesForStudy, runRulesForStudy } from '../services/rulesEngine';
import StudyBadge from './StudyBadge';
import PathwayBadge from './PathwayBadge';
import BatchActionBar from './BatchActionBar';
import FlagForRecontactModal from './FlagForRecontactModal';
import BulkEditModal from './BulkEditModal';
import EditableCell from './EditableCell';
import { manuallyFlagPatients, bulkAssignProvider, deleteStudy, updatePatient, bulkUpdatePatients, addStudyColumn } from '../services/dataService';
import { exportPatientList } from '../utils/excelExport';
import useAppStore from '../store/appStore';

const HIDDEN_COLS = new Set(['studyId','contactPathway','flagged','priority','phenotype',
  'implication','suggestedAction','flaggedBy','contactDetails','manualFlag']);

const LABELS = {
  id:'Patient ID', enrollmentDate:'Enrolled', site:'Site', sampleCollected:'Sample',
  sampleDate:'Sample Date', genotypingComplete:'Genotyped', genotypingDate:'Geno Date',
  genotype:'Genotype', diagnosis:'Diagnosis', malariaCycles:'Malaria Episodes',
  phone:'Phone', address:'Address', hearingTestResult:'Hearing Test',
  decibelsLost:'dB Lost', eGFR:'eGFR', ckdStage:'CKD Stage',
  providerCode:'Provider Code', sampleType:'Sample Type', age:'Age', sex:'Sex',
  gender:'Gender', lga:'LGA', tribe:'Tribe', language:'Language',
  clinicalConditions:'Clinical Conditions', cardioDisease:'Cardio Disease',
  clopidogrelUsage:'Clopidogrel Use', recurrentASCVD:'Recurrent ASCVD',
  cyp2c19_17:'CYP2C19*17', cvd:'CVD', occupation:'Occupation',
  healthInsurance:'Health Insurance', familyCvdHistory:'Family CVD Hx',
  cyp2c19Testing:'CYP2C19 Testing', tubeNumber:'Tube No.',
  initials:'Initials', dob:'D.O.B', hearingLossType:'Hearing Loss Type',
  acquired:'Acquired?', familyHistoryHearingLoss:'Family Hx (Hearing)',
  hypertensionHistory:'HTN History', medication:'Medication',
  bpSystolic:'BP Sys.', bpDiastolic:'BP Dia.', urineAnalysis:'Urine',
  medicalHistory:'Medical History', malariaDiagnosed:'Malaria Dx?',
  malariaEpisodes:'Malaria Episodes', malariaTreatment:'Treatment',
  pfResult:'P.f', pvResult:'P.v', dnaSample:'DNA',
  smoker:'Smoker?', visualAcuityOD:'VA-OD', visualAcuityOS:'VA-OS',
  iop:'IOP', fundusExam:'Fundus', amdStatus:'AMD Status', amdType:'AMD Type',
  currentMedication:'Medication', weight:'Wt(kg)', height:'Ht(cm)',
};

const PAGE_SIZE = 50;

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ChevronUp size={12} className="opacity-20" />;
  return sort.dir === 'asc' ? <ChevronUp size={12} className="text-teal-600" /> : <ChevronDown size={12} className="text-teal-600" />;
}

function CellValue({ field, value, patient }) {
  if (field === 'sampleCollected' || field === 'genotypingComplete') {
    return <span className={value ? 'text-teal-600 font-medium' : 'text-gray-400'}>{value ? 'Yes' : 'No'}</span>;
  }
  if (field === 'id') {
    return (
      <span className="flex items-center gap-1.5">
        {patient.flagged && <AlertTriangle size={12} className={patient.priority === 'High' ? 'text-red-500' : 'text-amber-400'} />}
        <span className="font-mono font-semibold text-gray-900">{value}</span>
      </span>
    );
  }
  if (field === 'phone') {
    return value ? <span className="flex items-center gap-1 text-blue-600"><Phone size={11} />{value}</span> : <span className="text-gray-300">—</span>;
  }
  if (value === null || value === undefined || value === '') return <span className="text-gray-300">—</span>;
  return <span className="text-gray-700">{String(value)}</span>;
}

// CellValue is the read-mode renderer passed into EditableCell. It handles
// icons / formatting specific to this table (flag markers, phone icon, etc.).

function RulesSummary({ studyId, onManageRules }) {
  const [rules,        setRules]        = useState([]);
  const [open,         setOpen]         = useState(true);
  const [running,      setRunning]      = useState(false);
  const [runResult,    setRunResult]    = useState(null);

  useEffect(() => {
    if (!studyId) return;
    getRulesForStudy(studyId).then(setRules);
  }, [studyId]);

  const activeRules = rules.filter(r => r.is_active);

  const handleRun = async (e) => {
    e.stopPropagation();
    setRunning(true);
    setRunResult(null);
    const result = await runRulesForStudy(studyId);
    setRunResult(result);
    setRunning(false);
  };

  if (rules.length === 0) {
    return (
      <div className="bg-amber-50 border border-amber-200 rounded-xl px-4 py-3 flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 text-sm text-amber-700">
          <AlertTriangle size={14} className="shrink-0" />
          No recontact rules configured for this study.
        </div>
        <button onClick={onManageRules}
          className="text-xs text-amber-700 font-semibold hover:underline shrink-0">
          Add Rule
        </button>
      </div>
    );
  }

  const OPERATOR_SHORT = { eq: '=', neq: '≠', contains: '~', gt: '>', lt: '<', in: 'in', not_empty: '≠∅', is_empty: '=∅' };

  return (
    <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
      <button onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-50 transition-colors">
        <div className="flex items-center gap-2 text-sm font-medium text-gray-700">
          <BookOpen size={14} className="text-teal-600" />
          Recontact Rules
          <span className="text-xs font-normal text-gray-400">({activeRules.length} active)</span>
        </div>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="px-4 pb-4 space-y-3 border-t border-gray-100">
          <div className="mt-3 space-y-1.5">
            {activeRules.map(r => (
              <div key={r.id} className="flex items-center gap-2 text-xs text-gray-600">
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${r.priority === 'High' ? 'bg-red-500' : 'bg-amber-400'}`} />
                <span className="font-mono text-gray-700">{r.column_name}</span>
                <span className="text-gray-400">{OPERATOR_SHORT[r.operator] ?? r.operator}</span>
                {r.value && <span className="font-mono text-teal-700">{r.value}</span>}
                <span className="text-gray-400">→</span>
                <span className={`font-semibold ${r.priority === 'High' ? 'text-red-600' : 'text-amber-600'}`}>{r.priority}</span>
              </div>
            ))}
            {rules.filter(r => !r.is_active).length > 0 && (
              <p className="text-xs text-gray-400 mt-1">{rules.filter(r => !r.is_active).length} inactive rule{rules.filter(r => !r.is_active).length !== 1 ? 's' : ''} hidden</p>
            )}
          </div>
          {runResult && (
            <div className="text-xs text-teal-700 bg-teal-50 border border-teal-200 rounded-lg px-3 py-2">
              Evaluated {runResult.newlyFlagged + runResult.alreadyFlagged + runResult.noMatch} patients —{' '}
              <strong>{runResult.newlyFlagged}</strong> newly flagged, <strong>{runResult.alreadyFlagged}</strong> already flagged.
            </div>
          )}
          <div className="flex items-center gap-2 pt-1">
            <button onClick={handleRun} disabled={running || activeRules.length === 0}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-teal-700 text-white rounded-lg text-xs font-semibold hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
              {running ? <><Loader2 size={11} className="animate-spin" /> Running…</> : <><Play size={11} /> Run Rules Now</>}
            </button>
            <button onClick={onManageRules}
              className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
              <Settings size={11} /> Manage Rules
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function StudyView({ study, patients, studies, providers, onSelectPatient, onNavigate }) {
  const [search,    setSearch]    = useState('');
  const [sort,      setSort]      = useState({ field: 'enrollmentDate', dir: 'desc' });
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState(new Set());
  const [flagModal, setFlagModal] = useState(false);

  // Delete study modal
  const [deleteStep,   setDeleteStep]   = useState(0); // 0=closed, 1=typing
  const [deleteInput,  setDeleteInput]  = useState('');
  const [deleting,     setDeleting]     = useState(false);
  const [deleteError,  setDeleteError]  = useState(null);

  const recontactCases      = useAppStore(s => s.recontactCases);
  const providerAssignments = useAppStore(s => s.providerAssignments);
  const userRole            = useAppStore(s => s.userRole);
  const profiles            = useAppStore(s => s.profiles);
  const user                = useAppStore(s => s.user);

  // Determine if the current user can edit patients in this study.
  // Admin: always. Coordinator: only if study is in their assigned_studies. Provider: never.
  const canEdit = useMemo(() => {
    if (userRole === 'admin') return true;
    if (userRole === 'coordinator') {
      const me = profiles.find(p => p.id === user?.id);
      return (me?.assigned_studies ?? []).includes(study?.id);
    }
    return false;
  }, [userRole, profiles, user, study]);

  const readOnly = !canEdit;

  const handleCellSave = useCallback(async (patientId, field, value) => {
    await updatePatient(patientId, { [field]: value });
  }, []);

  const handleDeleteStudy = useCallback(async () => {
    if (!study) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteStudy(study.id);
      setDeleting(false);
      setDeleteStep(0);
      setDeleteInput('');
      onNavigate?.('dashboard');
    } catch (err) {
      setDeleting(false);
      setDeleteError(err.message ?? 'Delete failed');
    }
  }, [study, onNavigate]);

  const columns = useMemo(() => {
    let base;
    if (study?.headers?.length) base = study.headers.filter(h => !HIDDEN_COLS.has(h));
    else if (patients.length === 0) base = ['id'];
    else {
      const allKeys = new Set();
      for (const p of patients.slice(0, 20)) Object.keys(p).forEach(k => allKeys.add(k));
      base = [...allKeys].filter(k => !HIDDEN_COLS.has(k));
    }
    // Filter out session-hidden columns
    return base.filter(k => !hiddenForStudy.includes(k));
  }, [study, patients, hiddenForStudy]);

  const allStudyColumns = useMemo(() => {
    if (study?.headers?.length) return study.headers.filter(h => !HIDDEN_COLS.has(h));
    if (patients.length === 0) return ['id'];
    const allKeys = new Set();
    for (const p of patients.slice(0, 20)) Object.keys(p).forEach(k => allKeys.add(k));
    return [...allKeys].filter(k => !HIDDEN_COLS.has(k));
  }, [study, patients]);

  const filtered = useMemo(() => {
    if (!search.trim()) return patients;
    const q = search.trim().toLowerCase();
    return patients.filter(p => columns.some(col => String(p[col] ?? '').toLowerCase().includes(q)));
  }, [patients, search, columns]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sort.field] ?? '';
      const vb = b[sort.field] ?? '';
      const cmp = typeof va === 'number' && typeof vb === 'number'
        ? va - vb : String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort   = (field) => { setPage(1); setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' }); };
  const toggleSelect = id => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll    = () => {
    if (paginated.every(p => selected.has(p.id)))
      setSelected(prev => { const n = new Set(prev); paginated.forEach(p => n.delete(p.id)); return n; });
    else
      setSelected(prev => { const n = new Set(prev); paginated.forEach(p => n.add(p.id)); return n; });
  };
  const allChecked  = paginated.length > 0 && paginated.every(p => selected.has(p.id));
  const someChecked = paginated.some(p => selected.has(p.id)) && !allChecked;

  const handleFlagConfirm = useCallback(async ({ reason, priority, notes }) => {
    const ids = flagModal.patients.map(p => p.id);
    await manuallyFlagPatients(ids, { reason, priority, notes });
    setFlagModal(false);
    setSelected(new Set());
  }, [flagModal]);

  const handleBulkAssign = useCallback(async (ids, providerName) => {
    await bulkAssignProvider(ids, providerName);
    setSelected(new Set());
  }, []);

  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const handleBulkEditConfirm = useCallback(async (field, value) => {
    const ids = [...selected];
    await bulkUpdatePatients(ids, { [field]: value });
    setBulkEditOpen(false);
    setSelected(new Set());
  }, [selected]);

  // Custom column modal
  const [addColOpen, setAddColOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState('text');
  const [addingCol,  setAddingCol]  = useState(false);
  const [addColError, setAddColError] = useState(null);

  const handleAddColumn = async (e) => {
    e.preventDefault();
    if (!newColName.trim()) return;
    setAddingCol(true);
    setAddColError(null);
    try {
      // Normalise to camelCase key for consistency with imported fields
      const key = newColName.trim()
        .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
        .replace(/^./, c => c.toLowerCase());
      await addStudyColumn(study.id, { key, label: newColName.trim(), type: newColType });
      setAddingCol(false);
      setAddColOpen(false);
      setNewColName('');
      setNewColType('text');
    } catch (err) {
      setAddColError(err.message ?? 'Failed to add column');
      setAddingCol(false);
    }
  };

  // Column visibility (session-level, stored in Zustand)
  const hiddenColumnsByStudy = useAppStore(s => s.hiddenColumnsByStudy);
  const setHiddenColumnsByStudy = useAppStore(s => s.setHiddenColumnsByStudy);
  const hiddenForStudy = hiddenColumnsByStudy?.[study?.id] ?? [];
  const toggleHideColumn = (col) => {
    const next = hiddenForStudy.includes(col)
      ? hiddenForStudy.filter(c => c !== col)
      : [...hiddenForStudy, col];
    setHiddenColumnsByStudy({ ...(hiddenColumnsByStudy ?? {}), [study.id]: next });
  };

  // Column header menu state
  const [openMenuCol, setOpenMenuCol] = useState(null);

  if (!study) return <div className="p-8 text-center text-gray-400"><p>Study not found.</p></div>;

  return (
    <div className="p-4 md:p-8 space-y-6 pb-4">
      {/* Header */}
      <div className="flex items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <StudyBadge study={study} studies={studies} />
            {study.hasCYP2C19 && (
              <span className="flex items-center gap-1 text-xs font-medium text-teal-700 bg-teal-50 px-2 py-0.5 rounded-full">
                <Dna size={11} /> CYP2C19
              </span>
            )}
            {study.hasContactInfo && (
              <span className="flex items-center gap-1 text-xs font-medium text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full">
                <Phone size={11} /> Contact info
              </span>
            )}
          </div>
          <h1 className="text-2xl font-bold text-gray-900 mt-1">{study.name}</h1>
          <p className="text-gray-500 text-sm mt-1">{study.description}</p>
        </div>
        <div className="flex flex-col items-end gap-2 shrink-0">
          <div className="text-right">
            <p className="text-3xl font-bold text-gray-900">{patients.length}</p>
            <p className="text-xs text-gray-400 mt-0.5">participants</p>
          </div>
          {filtered.length > 0 && (
            <button
              onClick={() => {
                const dateStr = new Date().toISOString().split('T')[0];
                exportPatientList(filtered, {
                  filename: `MyAfroDNA_${(study.shortName || study.id).replace(/[^a-zA-Z0-9]/g, '_')}Export${dateStr}.xlsx`,
                  recontactCases,
                  providerAssignments,
                  studyHeaders: study.headers ?? null,
                  includeStudyCol: false,
                });
              }}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors">
              <Download size={14} /> Export to Excel
            </button>
          )}
          {userRole === 'admin' && (
            <button
              onClick={() => { setDeleteStep(1); setDeleteInput(''); setDeleteError(null); }}
              className="flex items-center gap-2 px-3 py-2 border border-red-200 text-red-700 rounded-xl text-sm font-medium hover:bg-red-50 transition-colors">
              <Trash2 size={14} /> Delete Study
            </button>
          )}
        </div>
      </div>

      {/* Read-only banner for non-admin coordinators without study access */}
      {readOnly && userRole !== 'provider' && (
        <div className="flex items-center gap-2 bg-amber-50 border border-amber-200 text-amber-800 rounded-lg px-3 py-2 text-sm">
          <Lock size={14} className="shrink-0" />
          You have read-only access to this study.
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Enrolled',         value: patients.length },
          { label: 'Sample collected', value: patients.filter(p => p.sampleCollected).length },
          { label: 'Genotyped',        value: patients.filter(p => p.genotypingComplete).length },
          { label: 'Flagged',          value: patients.filter(p => p.flagged).length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white rounded-xl border border-gray-200 p-4 text-center">
            <p className="text-2xl font-bold text-gray-900">{value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{label}</p>
          </div>
        ))}
      </div>

      {/* Rules summary */}
      {study && (
        <RulesSummary
          studyId={study.id}
          onManageRules={() => onNavigate?.('rules')}
        />
      )}

      {/* Search + column actions */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search patients…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        {canEdit && (
          <button
            onClick={() => { setAddColOpen(true); setNewColName(''); setNewColType('text'); setAddColError(null); }}
            className="flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-teal-700 border border-teal-300 rounded-lg hover:bg-teal-50 transition-colors"
          >
            <Plus size={14} /> Add Column
          </button>
        )}
        {hiddenForStudy.length > 0 && (
          <button
            onClick={() => setHiddenColumnsByStudy({ ...(hiddenColumnsByStudy ?? {}), [study.id]: [] })}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Eye size={14} /> Show all ({hiddenForStudy.length} hidden)
          </button>
        )}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {paginated.length === 0 ? (
          <div className="p-16 text-center"><p className="text-gray-400 text-sm">No patients match your search.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allChecked}
                      ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" />
                  </th>
                  {columns.map(col => (
                    <th key={col}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider select-none whitespace-nowrap relative">
                      <div className="flex items-center gap-1">
                        <span
                          onClick={() => toggleSort(col)}
                          className="flex items-center gap-1 cursor-pointer hover:text-gray-700"
                        >
                          {LABELS[col] ?? col}<SortIcon field={col} sort={sort} />
                        </span>
                        {col !== 'id' && (
                          <button
                            onClick={e => { e.stopPropagation(); setOpenMenuCol(openMenuCol === col ? null : col); }}
                            className="ml-1 p-0.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600"
                            aria-label="Column menu"
                          >
                            <ChevronDown size={11} />
                          </button>
                        )}
                      </div>
                      {openMenuCol === col && (
                        <>
                          <div className="fixed inset-0 z-40" onClick={() => setOpenMenuCol(null)} />
                          <div className="absolute top-full left-0 mt-1 z-50 bg-white rounded-lg shadow-lg border border-gray-200 py-1 min-w-[140px]">
                            <button
                              onClick={() => { toggleHideColumn(col); setOpenMenuCol(null); }}
                              className="w-full flex items-center gap-2 px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 normal-case tracking-normal"
                            >
                              <EyeOff size={12} /> Hide Column
                            </button>
                          </div>
                        </>
                      )}
                    </th>
                  ))}
                  {study.hasContactInfo && (
                    <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Pathway</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(p => {
                  const isSel = selected.has(p.id);
                  return (
                    <tr key={p.id} className={`transition-colors ${isSel ? 'bg-teal-50' : 'hover:bg-gray-50'}`}>
                      <td className="w-10 px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSel} onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" />
                      </td>
                      {columns.map(col => {
                        // Clicking the ID column opens the patient detail modal;
                        // other columns become editable in place.
                        if (col === 'id') {
                          return (
                            <td key={col} onClick={() => onSelectPatient(p)}
                              className="px-3 py-2.5 max-w-48 truncate cursor-pointer">
                              <CellValue field={col} value={p[col]} patient={p} />
                            </td>
                          );
                        }
                        return (
                          <td key={col} className="px-3 py-2.5 max-w-48">
                            <EditableCell
                              field={col}
                              value={p[col]}
                              patient={p}
                              readOnly={readOnly}
                              onSave={handleCellSave}
                              renderValue={(v, pt, f) => <CellValue field={f} value={v} patient={pt} />}
                            />
                          </td>
                        );
                      })}
                      {study.hasContactInfo && (
                        <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectPatient(p)}>
                          {p.contactPathway && p.contactPathway !== 'none'
                            ? <PathwayBadge pathway={p.contactPathway} size="xs" />
                            : <span className="text-gray-300 text-xs">—</span>}
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm text-gray-500">
          <span>Showing {(page-1)*PAGE_SIZE+1}–{Math.min(page*PAGE_SIZE, sorted.length)} of {sorted.length}</span>
          <div className="flex gap-2">
            <button disabled={page===1} onClick={() => setPage(p=>p-1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Previous</button>
            <span className="px-3 py-1.5 text-gray-700 font-medium">{page} / {totalPages}</span>
            <button disabled={page===totalPages} onClick={() => setPage(p=>p+1)}
              className="px-3 py-1.5 rounded-lg border border-gray-200 hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors">Next</button>
          </div>
        </div>
      )}

      {/* Batch action bar */}
      <BatchActionBar
        selected={selected}
        patients={patients}
        providers={providers ?? []}
        onFlag={pts => setFlagModal({ patients: pts })}
        onAssignProvider={(ids, name) => handleBulkAssign(ids, name)}
        onBulkEdit={canEdit ? () => setBulkEditOpen(true) : undefined}
        onExport={(selectedPts) => {
          const dateStr = new Date().toISOString().split('T')[0];
          exportPatientList(selectedPts, {
            filename: `MyAfroDNA_${(study.shortName || study.id).replace(/[^a-zA-Z0-9]/g, '_')}Export${dateStr}.xlsx`,
            recontactCases,
            providerAssignments,
            studyHeaders: study.headers ?? null,
            includeStudyCol: false,
          });
        }}
        onClear={() => setSelected(new Set())}
      />

      {/* Flag modal */}
      {flagModal && (
        <FlagForRecontactModal patients={flagModal.patients} onConfirm={handleFlagConfirm} onCancel={() => setFlagModal(false)} />
      )}

      {/* Bulk edit modal */}
      {bulkEditOpen && (
        <BulkEditModal
          patients={patients.filter(p => selected.has(p.id))}
          onConfirm={handleBulkEditConfirm}
          onClose={() => setBulkEditOpen(false)}
        />
      )}

      {/* Add column modal */}
      {addColOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-gray-900">Add Column</h2>
            <form onSubmit={handleAddColumn} className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Column Name</label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  placeholder="e.g. Blood Pressure"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Column Type</label>
                <select
                  value={newColType}
                  onChange={e => setNewColType(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                >
                  <option value="text">Text</option>
                  <option value="number">Number</option>
                  <option value="date">Date</option>
                  <option value="boolean">Yes / No</option>
                </select>
              </div>
              {addColError && (
                <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                  <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                  {addColError}
                </div>
              )}
              <div className="flex gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setAddColOpen(false)}
                  disabled={addingCol}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addingCol || !newColName.trim()}
                  className="flex-1 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 transition-colors"
                >
                  {addingCol ? 'Adding…' : 'Add Column'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete study confirmation */}
      {deleteStep === 1 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center shrink-0">
                <AlertTriangle size={20} className="text-red-600" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900">Delete Study</h2>
                <p className="text-sm text-gray-600 mt-1">
                  You are about to permanently delete <strong>{study.name}</strong> and all{' '}
                  <strong>{patients.length}</strong> patient{patients.length !== 1 ? 's' : ''} in this study.
                  This cannot be undone.
                </p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">
                Type <strong className="font-mono text-red-700">{study.name}</strong> to confirm:
              </label>
              <input
                type="text"
                value={deleteInput}
                onChange={e => setDeleteInput(e.target.value)}
                autoFocus
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-red-500"
              />
            </div>
            {deleteError && (
              <div className="flex items-start gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
                <AlertTriangle size={15} className="shrink-0 mt-0.5" />
                {deleteError}
              </div>
            )}
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setDeleteStep(0); setDeleteInput(''); setDeleteError(null); }}
                disabled={deleting}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeleteStudy}
                disabled={deleteInput !== study.name || deleting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {deleting ? 'Deleting…' : 'Delete Study'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
