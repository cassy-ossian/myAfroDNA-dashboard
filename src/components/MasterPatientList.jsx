import { useState, useMemo, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, AlertTriangle, Download } from 'lucide-react';
import StudyBadge from './StudyBadge';
import PathwayBadge from './PathwayBadge';
import BatchActionBar from './BatchActionBar';
import FlagForRecontactModal from './FlagForRecontactModal';
import BulkEditModal from './BulkEditModal';
import ColumnManager, { getColumnLabel } from './ColumnManager';
import EditableCell from './EditableCell';
import useAppStore from '../store/appStore';
import { manuallyFlagPatients, bulkAssignProvider, setVisibleColumns, updatePatient, bulkUpdatePatients } from '../services/dataService';
import { exportExcel, exportPatientList } from '../utils/excelExport';

const PAGE_SIZE = 50;

// Columns always shown regardless of manager selection
const PINNED_COLS = ['id', 'studyId'];

// Default visible columns (shown if no explicit selection)
const DEFAULT_VISIBLE = new Set([
  'id', 'studyId', 'enrollmentDate', 'age', 'sex', 'gender', 'lga', 'contactPathway',
]);

function SortIcon({ field, sort }) {
  if (sort.field !== field) return <ChevronUp size={12} className="opacity-20" />;
  return sort.dir === 'asc' ? <ChevronUp size={12} className="text-teal-600" /> : <ChevronDown size={12} className="text-teal-600" />;
}

function lastActivity(patient, recontactCases, patientNotes) {
  const case_ = recontactCases[patient.id];
  const notes  = patientNotes[patient.id] ?? [];
  const caseTs = case_?.history?.at(-1)?.timestamp ?? case_?.stageEnteredAt;
  const noteTs = notes[0]?.timestamp; // notes stored newest-first
  const timestamps = [caseTs, noteTs].filter(Boolean);
  if (!timestamps.length) return null;
  return timestamps.sort().at(-1); // most recent
}

function daysSince(iso) {
  if (!iso) return null;
  return Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
}

function LastActivityCell({ ts }) {
  if (!ts) return <span className="text-gray-300 text-xs">—</span>;
  const days = daysSince(ts);
  const label = days === 0 ? 'Today' : days === 1 ? 'Yesterday' : `${days}d ago`;
  const cls = days > 14 ? 'text-red-600' : days > 7 ? 'text-amber-600' : 'text-gray-500';
  return <span className={`text-xs ${cls}`}>{label}</span>;
}

export default function MasterPatientList({ patients, studies, providers, onSelectPatient }) {
  const recontactCases      = useAppStore(s => s.recontactCases);
  const patientNotes        = useAppStore(s => s.patientNotes);
  const storedCols          = useAppStore(s => s.visibleColumns);
  const providerAssignments = useAppStore(s => s.providerAssignments);

  const [search,      setSearch]      = useState('');
  const [studyFilter, setStudyFilter] = useState('');
  const [sort,        setSort]        = useState({ field: 'enrollmentDate', dir: 'desc' });
  const [page,        setPage]        = useState(1);
  const [selected,    setSelected]    = useState(new Set());
  const [flagModal,   setFlagModal]   = useState(false);
  const [bulkEditOpen, setBulkEditOpen] = useState(false);

  const userRole = useAppStore(s => s.userRole);
  const readOnly = userRole === 'provider';

  const handleCellSave = useCallback(async (patientId, field, value) => {
    await updatePatient(patientId, { [field]: value });
  }, []);

  // Column visibility
  const visibleSet = useMemo(
    () => storedCols ? new Set(storedCols) : new Set(DEFAULT_VISIBLE),
    [storedCols]
  );

  // Build the full column list from all studies' headers
  const allColumns = useMemo(() => {
    const seen = new Set();
    const cols = [];
    const addCol = (key, studyId = null) => {
      if (seen.has(key)) return;
      seen.add(key);
      cols.push({ key, studyId });
    };
    // Common columns first
    ['id','studyId','enrollmentDate','age','sex','gender','lga','contactPathway'].forEach(k => addCol(k));
    // Per-study columns
    Object.values(studies).sort((a,b) => a.id.localeCompare(b.id)).forEach(study => {
      (study.headers ?? []).forEach(k => addCol(k, study.id));
    });
    // Extra from actual patient data
    patients.slice(0, 50).forEach(p => Object.keys(p).forEach(k => addCol(k)));
    return cols.filter(c => !['studyId','flagged','priority','phenotype','implication','suggestedAction','flaggedBy','contactDetails','manualFlag'].includes(c.key));
  }, [studies, patients]);

  // Effective columns to display (pinned + visible from manager)
  const displayCols = useMemo(() => {
    const extra = allColumns.filter(c => !PINNED_COLS.includes(c.key) && visibleSet.has(c.key));
    return extra;
  }, [allColumns, visibleSet]);

  const handleToggleCol = useCallback((key) => {
    const next = new Set(visibleSet);
    if (next.has(key)) next.delete(key); else next.add(key);
    setVisibleColumns([...next]);
  }, [visibleSet]);

  const handleResetCols = useCallback(() => setVisibleColumns(null), []);

  const studyList = useMemo(() => Object.values(studies).sort((a,b) => a.id.localeCompare(b.id)), [studies]);

  const filtered = useMemo(() => {
    let list = patients;
    if (studyFilter) list = list.filter(p => p.studyId === studyFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(p =>
        p.id?.toLowerCase().includes(q) ||
        p.studyId?.toLowerCase().includes(q) ||
        p.site?.toLowerCase().includes(q) ||
        p.lga?.toLowerCase().includes(q) ||
        p.tribe?.toLowerCase().includes(q) ||
        p.diagnosis?.toLowerCase().includes(q) ||
        p.genotype?.toLowerCase().includes(q)
      );
    }
    return list;
  }, [patients, search, studyFilter]);

  const sorted = useMemo(() => {
    return [...filtered].sort((a, b) => {
      const va = a[sort.field] ?? '';
      const vb = b[sort.field] ?? '';
      const cmp = String(va).localeCompare(String(vb));
      return sort.dir === 'asc' ? cmp : -cmp;
    });
  }, [filtered, sort]);

  const totalPages = Math.max(1, Math.ceil(sorted.length / PAGE_SIZE));
  const paginated  = sorted.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  const toggleSort = (field) => {
    setPage(1);
    setSort(s => s.field === field ? { field, dir: s.dir === 'asc' ? 'desc' : 'asc' } : { field, dir: 'asc' });
  };

  // Selection helpers
  const toggleSelect  = id => setSelected(prev => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll     = () => {
    if (paginated.every(p => selected.has(p.id))) {
      setSelected(prev => { const n = new Set(prev); paginated.forEach(p => n.delete(p.id)); return n; });
    } else {
      setSelected(prev => { const n = new Set(prev); paginated.forEach(p => n.add(p.id)); return n; });
    }
  };
  const allChecked  = paginated.length > 0 && paginated.every(p => selected.has(p.id));
  const someChecked = paginated.some(p => selected.has(p.id)) && !allChecked;

  const handleFlag = useCallback(async (selectedPts) => {
    setFlagModal({ patients: selectedPts });
  }, []);

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

  const handleBulkEditConfirm = useCallback(async (field, value) => {
    const ids = [...selected];
    await bulkUpdatePatients(ids, { [field]: value });
    setBulkEditOpen(false);
    setSelected(new Set());
  }, [selected]);

  const handleExport = useCallback(() => {
    const dateStr = new Date().toISOString().split('T')[0];
    exportPatientList(filtered, {
      filename: `MyAfroDNA_Full_Export_${dateStr}.xlsx`,
      recontactCases,
      providerAssignments,
      includeStudyCol: true,
    });
  }, [filtered, recontactCases, providerAssignments]);

  const Th = ({ field, label, className = '' }) => (
    <th onClick={() => toggleSort(field)}
      className={`px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none whitespace-nowrap ${className}`}>
      <span className="flex items-center gap-1">{label}<SortIcon field={field} sort={sort} /></span>
    </th>
  );

  return (
    <div className="p-4 md:p-8 space-y-5 pb-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">All Patients</h1>
          <p className="text-gray-500 text-sm mt-1">
            {patients.length} participant{patients.length !== 1 ? 's' : ''} across {studyList.length} stud{studyList.length !== 1 ? 'ies' : 'y'}
            {filtered.length !== patients.length && ` · ${filtered.length} shown`}
          </p>
        </div>
        {filtered.length > 0 && (
          <button onClick={handleExport}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shrink-0">
            <Download size={14} /> Export to Excel
          </button>
        )}
      </div>

      {/* Filters + column manager */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1 max-w-sm">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input type="text" placeholder="Search ID, LGA, diagnosis…" value={search}
            onChange={e => { setSearch(e.target.value); setPage(1); }}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <select value={studyFilter} onChange={e => { setStudyFilter(e.target.value); setPage(1); }}
          className="text-sm border border-gray-300 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
          <option value="">All studies</option>
          {studyList.map(s => <option key={s.id} value={s.id}>{s.shortName || s.id} — {s.name}</option>)}
        </select>
        <ColumnManager allColumns={allColumns} visibleSet={visibleSet} studies={studies}
          onToggle={handleToggleCol} onReset={handleResetCols} />
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
        {paginated.length === 0 ? (
          <div className="p-16 text-center"><p className="text-gray-400 text-sm">No patients match your filters.</p></div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  {/* Checkbox */}
                  <th className="w-10 px-3 py-3">
                    <input type="checkbox" checked={allChecked} ref={el => { if (el) el.indeterminate = someChecked; }}
                      onChange={toggleAll}
                      className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" />
                  </th>
                  <Th field="id"             label="Patient ID" />
                  <Th field="studyId"        label="Study" />
                  {displayCols.filter(c => c.key !== 'id' && c.key !== 'studyId').map(col => (
                    <Th key={col.key} field={col.key} label={getColumnLabel(col.key)} />
                  ))}
                  <Th field="contactPathway" label="Pathway" />
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Status</th>
                  <th className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider whitespace-nowrap">Last Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {paginated.map(p => {
                  const isSelected = selected.has(p.id);
                  const la = lastActivity(p, recontactCases, patientNotes);
                  return (
                    <tr key={p.id}
                      className={`transition-colors ${isSelected ? 'bg-teal-50' : 'hover:bg-gray-50'}`}
                    >
                      <td className="w-10 px-3 py-2.5" onClick={e => e.stopPropagation()}>
                        <input type="checkbox" checked={isSelected} onChange={() => toggleSelect(p.id)}
                          className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500 cursor-pointer" />
                      </td>
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectPatient(p)}>
                        <div className="flex items-center gap-1.5">
                          {p.flagged && <AlertTriangle size={13} className={p.priority === 'High' ? 'text-red-500' : 'text-amber-500'} />}
                          <span className="font-mono font-semibold text-gray-900">{p.id}</span>
                        </div>
                      </td>
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectPatient(p)}>
                        <StudyBadge study={p.studyId} studies={studies} size="xs" />
                      </td>
                      {displayCols.filter(c => c.key !== 'id' && c.key !== 'studyId').map(col => (
                        <td key={col.key} className="px-3 py-2.5 text-gray-600 max-w-36">
                          <EditableCell
                            field={col.key}
                            value={p[col.key]}
                            patient={p}
                            readOnly={readOnly}
                            onSave={handleCellSave}
                            renderValue={(v) => v != null && v !== ''
                              ? <span>{String(v)}</span>
                              : <span className="text-gray-300">—</span>}
                          />
                        </td>
                      ))}
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectPatient(p)}>
                        {p.contactPathway && p.contactPathway !== 'none'
                          ? <PathwayBadge pathway={p.contactPathway} size="xs" />
                          : <span className="text-gray-300 text-xs">—</span>}
                      </td>
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectPatient(p)}>
                        {p.genotypingComplete
                          ? <span className="text-xs text-teal-700 font-medium bg-teal-50 px-2 py-0.5 rounded-full">Genotyped</span>
                          : p.sampleCollected
                            ? <span className="text-xs text-blue-600 font-medium bg-blue-50 px-2 py-0.5 rounded-full">Collected</span>
                            : <span className="text-xs text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">Enrolled</span>}
                      </td>
                      <td className="px-3 py-2.5 cursor-pointer" onClick={() => onSelectPatient(p)}>
                        <LastActivityCell ts={la} />
                      </td>
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
        providers={providers}
        onFlag={handleFlag}
        onAssignProvider={(ids, name) => handleBulkAssign(ids, name)}
        onBulkEdit={readOnly ? undefined : () => setBulkEditOpen(true)}
        onExport={(selectedPts) => {
          const dateStr = new Date().toISOString().split('T')[0];
          exportPatientList(selectedPts, {
            filename: `MyAfroDNA_Full_Export_${dateStr}.xlsx`,
            recontactCases,
            providerAssignments,
            includeStudyCol: true,
          });
        }}
        onClear={() => setSelected(new Set())}
      />

      {bulkEditOpen && (
        <BulkEditModal
          patients={patients.filter(p => selected.has(p.id))}
          onConfirm={handleBulkEditConfirm}
          onClose={() => setBulkEditOpen(false)}
        />
      )}

      {/* Flag modal */}
      {flagModal && (
        <FlagForRecontactModal
          patients={flagModal.patients}
          onConfirm={handleFlagConfirm}
          onCancel={() => setFlagModal(false)}
        />
      )}
    </div>
  );
}
