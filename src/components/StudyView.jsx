import { useState, useMemo, useCallback } from 'react';
import { Search, ChevronUp, ChevronDown, AlertTriangle, Dna, Phone } from 'lucide-react';
import StudyBadge from './StudyBadge';
import PathwayBadge from './PathwayBadge';
import BatchActionBar from './BatchActionBar';
import FlagForRecontactModal from './FlagForRecontactModal';
import { manuallyFlagPatients, bulkAssignProvider } from '../services/dataService';

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

export default function StudyView({ study, patients, studies, providers, onSelectPatient }) {
  const [search,    setSearch]    = useState('');
  const [sort,      setSort]      = useState({ field: 'enrollmentDate', dir: 'desc' });
  const [page,      setPage]      = useState(1);
  const [selected,  setSelected]  = useState(new Set());
  const [flagModal, setFlagModal] = useState(false);

  const columns = useMemo(() => {
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
        <div className="text-right shrink-0">
          <p className="text-3xl font-bold text-gray-900">{patients.length}</p>
          <p className="text-xs text-gray-400 mt-0.5">participants</p>
        </div>
      </div>

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

      {/* Search */}
      <div className="relative max-w-sm">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input type="text" placeholder="Search patients…" value={search}
          onChange={e => { setSearch(e.target.value); setPage(1); }}
          className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500" />
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
                    <th key={col} onClick={() => toggleSort(col)}
                      className="px-3 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-700 select-none whitespace-nowrap">
                      <span className="flex items-center gap-1">{LABELS[col] ?? col}<SortIcon field={col} sort={sort} /></span>
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
                      {columns.map(col => (
                        <td key={col} onClick={() => onSelectPatient(p)}
                          className="px-3 py-2.5 max-w-48 truncate cursor-pointer">
                          <CellValue field={col} value={p[col]} patient={p} />
                        </td>
                      ))}
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
        onExport={() => {}}
        onClear={() => setSelected(new Set())}
      />

      {/* Flag modal */}
      {flagModal && (
        <FlagForRecontactModal patients={flagModal.patients} onConfirm={handleFlagConfirm} onCancel={() => setFlagModal(false)} />
      )}
    </div>
  );
}
