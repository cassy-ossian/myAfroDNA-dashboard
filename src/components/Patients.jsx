import { useState, useRef, useCallback } from 'react';
import { Upload, Search, ChevronUp, ChevronDown, ChevronsUpDown, FlaskConical, Database, Info, X, Mail } from 'lucide-react';
import * as XLSX from 'xlsx';
import ColumnMapper, { applyMapping } from './ColumnMapper';
import EmailCompose from './EmailCompose';
import PathwayBadge from './PathwayBadge';
import { PHENOTYPE_EXPLANATIONS } from '../data/flaggingRules';
import { PATHWAY_OPTIONS } from '../data/contactPathway';

const PRIORITY_BADGE = {
  High:   'bg-red-100 text-red-700',
  Medium: 'bg-amber-100 text-amber-700',
};

const COLUMNS = [
  { key: 'id',                 label: 'MyAfroDNA ID' },
  { key: 'enrollmentDate',     label: 'Enrolled' },
  { key: 'site',               label: 'Site' },
  { key: 'sampleCollected',    label: 'Sample' },
  { key: 'genotypingComplete', label: 'Genotyped' },
  { key: 'genotype',           label: 'CYP2C19' },
  { key: 'phenotype',          label: 'Phenotype' },
  { key: 'flagged',            label: 'Flag' },
  { key: 'contactPathway',     label: 'Pathway', noSort: true },
  { key: 'provider',           label: 'Provider', noSort: true },
];

const BLANK_FORM = { name: '', facility: '', phone: '', email: '', preferredContact: 'Email' };

// Compact quick-add modal used from table provider cell
function QuickAddModal({ onSave, onCancel }) {
  const [form, setForm] = useState(BLANK_FORM);
  const set = (k) => (e) => setForm(v => ({ ...v, [k]: e.target.value }));
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onCancel}>
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-sm p-5 space-y-3" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-gray-900">Add New Provider</h3>
          <button onClick={onCancel} className="text-gray-400 hover:text-gray-600 p-1 rounded"><X size={18} /></button>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Name *</label>
          <input autoFocus type="text" placeholder="Dr. Jane Smith" value={form.name} onChange={set('name')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Facility</label>
          <input type="text" placeholder="University Teaching Hospital" value={form.facility} onChange={set('facility')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Phone</label>
            <input type="text" placeholder="+27 11 555 0100" value={form.phone} onChange={set('phone')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Email</label>
            <input type="text" placeholder="dr@hospital.org" value={form.email} onChange={set('email')}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">Preferred Contact</label>
          <select value={form.preferredContact} onChange={set('preferredContact')}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500">
            {['Email', 'Phone', 'WhatsApp', 'In Person'].map(m => <option key={m}>{m}</option>)}
          </select>
        </div>
        <div className="flex justify-end gap-2 pt-1">
          <button onClick={onCancel} className="px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">Cancel</button>
          <button onClick={() => onSave(form)} disabled={!form.name.trim()}
            className="px-4 py-1.5 text-sm font-semibold bg-teal-700 text-white rounded-lg hover:bg-teal-800 disabled:opacity-50">
            Add &amp; Assign
          </button>
        </div>
      </div>
    </div>
  );
}

function SortIcon({ col, sortKey, sortDir }) {
  if (sortKey !== col) return <ChevronsUpDown size={13} className="text-gray-300" />;
  return sortDir === 'asc'
    ? <ChevronUp size={13} className="text-teal-600" />
    : <ChevronDown size={13} className="text-teal-600" />;
}

function StatusBadge({ collected, genotyped, flagged, priority }) {
  if (!collected) return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-500">Not collected</span>;
  if (!genotyped) return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700">Awaiting genotyping</span>;
  if (flagged && priority) return <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${PRIORITY_BADGE[priority]}`}>{priority} priority</span>;
  return <span className="inline-block px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">Normal</span>;
}

export default function Patients({ patients, providerAssignments, providers, emailedPatients, onPatientsImported, onSelectPatient, onLoadDemo, onAssignProvider, onAddProvider, onMarkEmailed, onUpdateContactPathway }) {
  const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState('id');
  const [sortDir, setSortDir] = useState('asc');
  const [dragging, setDragging] = useState(false);
  const [mapperState, setMapperState] = useState(null);
  const [phenoTooltip, setPhenoTooltip] = useState(null);
  const [quickAdd, setQuickAdd] = useState(null);
  const [composeFor, setComposeFor] = useState(null); // patient to email
  const fileInputRef = useRef();

  const handleSort = (key, noSort) => {
    if (noSort) return;
    if (sortKey === key) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDir('asc');
    }
  };

  const handleProviderSelect = (patientId, value) => {
    if (value === '__add_new__') {
      setQuickAdd(patientId);
    } else {
      onAssignProvider(patientId, value || null);
    }
  };

  const handleQuickAddSave = (form) => {
    if (!form.name.trim() || !quickAdd) return;
    const provider = { ...form, name: form.name.trim(), id: `prov-${Date.now()}` };
    onAddProvider(provider);
    onAssignProvider(quickAdd, provider.name);
    setQuickAdd(null);
  };

  const processFile = useCallback((file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const data = new Uint8Array(e.target.result);
      const wb = XLSX.read(data, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rawRows = XLSX.utils.sheet_to_json(ws, { defval: '' });
      if (!rawRows.length) return;
      const detectedColumns = Object.keys(rawRows[0]);
      // Auto-guess mapping by fuzzy column name match
      const guessMapping = (field) => {
        const patterns = {
          id:                 [/id$/i, /patient/i, /myafrodna/i, /mad/i],
          enrollmentDate:     [/enrol/i, /enroll/i, /date/i],
          site:               [/site/i, /hospital/i, /location/i, /centre/i, /center/i],
          sampleCollected:    [/sample/i, /collected/i, /collection/i],
          genotypingComplete: [/genotyp/i, /genotype.*complete/i, /sequenc/i],
          genotype:           [/genotype$/i, /cyp/i, /result/i, /variant/i],
          phone:              [/phone/i, /mobile/i, /tel/i, /contact.*no/i, /phone.*no/i],
          email:              [/email/i, /e.mail/i],
          address:            [/address/i, /addr/i, /location/i],
          providerCode:       [/provider.*code/i, /prov.*code/i, /doctor.*code/i, /gp.*code/i],
        };
        const pats = patterns[field] || [];
        return detectedColumns.find(col => pats.some(p => p.test(col))) || '';
      };
      const mapping = {};
      ['id','enrollmentDate','site','sampleCollected','genotypingComplete','genotype','phone','email','address','providerCode'].forEach(f => {
        mapping[f] = guessMapping(f);
      });
      setMapperState({ rawRows, detectedColumns, mapping });
    };
    reader.readAsArrayBuffer(file);
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) processFile(file);
  }, [processFile]);

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) processFile(file);
    e.target.value = '';
  };

  const handleMappingConfirm = () => {
    const { rawRows, mapping } = mapperState;
    const imported = rawRows.map((row, i) => applyMapping(row, mapping, i));
    onPatientsImported(imported);
    setMapperState(null);
  };

  // Filter + sort
  const filtered = patients
    .filter(p => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        p.id?.toLowerCase().includes(q) ||
        p.site?.toLowerCase().includes(q) ||
        p.genotype?.toLowerCase().includes(q) ||
        p.phenotype?.toLowerCase().includes(q) ||
        p.enrollmentDate?.toLowerCase().includes(q)
      );
    })
    .sort((a, b) => {
      const av = a[sortKey] ?? '';
      const bv = b[sortKey] ?? '';
      const cmp = String(av).localeCompare(String(bv), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });

  return (
    <div className="p-4 md:p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Patients</h1>
        <p className="text-gray-500 text-sm mt-1">
          Upload a spreadsheet or load demo data to get started
        </p>
      </div>

      {/* Upload zone */}
      <div
        onDrop={handleDrop}
        onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onClick={() => fileInputRef.current?.click()}
        className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
          dragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
        }`}
      >
        <Upload size={28} className={`mx-auto mb-3 ${dragging ? 'text-teal-600' : 'text-gray-400'}`} />
        <p className="font-semibold text-gray-700">Drop your spreadsheet here, or click to browse</p>
        <p className="text-sm text-gray-500 mt-1">Accepts .xlsx and .csv files</p>
        <input
          ref={fileInputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleFileChange}
          className="hidden"
        />
      </div>

      {/* Demo data button */}
      {patients.length === 0 && (
        <div className="flex items-center justify-center gap-3 text-sm text-gray-500">
          <span>No data loaded.</span>
          <button
            onClick={onLoadDemo}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-teal-700 text-white font-medium hover:bg-teal-800 transition-colors text-sm"
          >
            <Database size={14} /> Load demo data
          </button>
        </div>
      )}

      {/* Table */}
      {patients.length > 0 && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          {/* Search + count */}
          <div className="p-4 border-b border-gray-100 flex flex-col sm:flex-row sm:items-center gap-3">
            <div className="relative flex-1">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search by ID, site, genotype, phenotype…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500 focus:border-transparent"
              />
            </div>
            <p className="text-sm text-gray-500 shrink-0">{filtered.length} of {patients.length} patients</p>
            <button
              onClick={onLoadDemo}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-50 transition-colors text-sm shrink-0"
            >
              <Database size={14} /> Reload demo
            </button>
          </div>

          {/* Scrollable table */}
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  {COLUMNS.map(col => (
                    <th
                      key={col.key}
                      onClick={() => handleSort(col.key, col.noSort)}
                      className={`px-4 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap select-none ${col.noSort ? '' : 'cursor-pointer hover:text-gray-700'}`}
                    >
                      <span className="flex items-center gap-1">
                        {col.label}
                        {!col.noSort && <SortIcon col={col.key} sortKey={sortKey} sortDir={sortDir} />}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filtered.map(p => (
                  <tr
                    key={p.id}
                    onClick={() => onSelectPatient(p)}
                    className="hover:bg-teal-50/40 cursor-pointer transition-colors"
                  >
                    <td className="px-4 py-3 font-mono font-semibold text-gray-900">{p.id}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{p.enrollmentDate || '—'}</td>
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap max-w-[180px] truncate">{p.site || '—'}</td>
                    <td className="px-4 py-3">
                      {p.sampleCollected
                        ? <span className="text-teal-700 font-medium">Yes</span>
                        : <span className="text-gray-400">Pending</span>}
                    </td>
                    <td className="px-4 py-3">
                      {p.genotypingComplete
                        ? <span className="text-teal-700 font-medium">Complete</span>
                        : <span className="text-gray-400">Pending</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-gray-700">{p.genotype || '—'}</td>
                    <td className="px-4 py-3 relative">
                      {p.phenotype ? (
                        <span
                          className="cursor-help border-b border-dotted border-gray-400 text-gray-700"
                          onMouseEnter={() => setPhenoTooltip(p.id)}
                          onMouseLeave={() => setPhenoTooltip(null)}
                        >
                          {p.phenotype}
                          {phenoTooltip === p.id && PHENOTYPE_EXPLANATIONS[p.phenotype] && (
                            <span className="absolute z-10 bottom-full left-0 mb-1 w-60 bg-gray-900 text-white text-xs rounded-lg p-2 shadow-lg pointer-events-none">
                              {PHENOTYPE_EXPLANATIONS[p.phenotype]}
                            </span>
                          )}
                        </span>
                      ) : '—'}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        collected={p.sampleCollected}
                        genotyped={p.genotypingComplete}
                        flagged={p.flagged}
                        priority={p.priority}
                      />
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <PathwayBadge pathway={p.contactPathway} size="xs" />
                        <select
                          value={p.contactPathway || 'none'}
                          onChange={e => onUpdateContactPathway?.(p.id, e.target.value)}
                          className="text-xs border border-gray-200 rounded-md px-1.5 py-1 bg-white text-gray-600 focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-[130px]"
                        >
                          {PATHWAY_OPTIONS.map(o => (
                            <option key={o.value} value={o.value}>{o.label}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3" onClick={e => e.stopPropagation()}>
                      <div className="flex items-center gap-1.5">
                        <select
                          value={providerAssignments[p.id] || ''}
                          onChange={e => handleProviderSelect(p.id, e.target.value)}
                          className={`text-xs border rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-teal-500 max-w-[150px] ${
                            providerAssignments[p.id]
                              ? 'border-teal-200 bg-teal-50 text-teal-800'
                              : 'border-gray-200 text-gray-400 bg-white'
                          }`}
                        >
                          <option value="">— Assign provider —</option>
                          {providers.map(prov => (
                            <option key={prov.id} value={prov.name}>{prov.name}</option>
                          ))}
                          <option value="__add_new__">+ Add new provider…</option>
                        </select>
                        {providerAssignments[p.id] && (
                          <button
                            onClick={() => setComposeFor(p)}
                            title={`Email ${providerAssignments[p.id]}`}
                            className={`p-1 rounded transition-colors ${
                              emailedPatients.has(p.id)
                                ? 'text-teal-600'
                                : 'text-gray-400 hover:text-teal-600'
                            }`}
                          >
                            <Mail size={13} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {filtered.length === 0 && (
              <div className="text-center py-12 text-gray-400">
                <FlaskConical size={32} className="mx-auto mb-2 opacity-30" />
                <p className="text-sm">No patients match your search</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Email compose modal */}
      {composeFor && (
        <EmailCompose
          patient={composeFor}
          providers={providers}
          providerAssignments={providerAssignments}
          onMarkEmailed={onMarkEmailed}
          onClose={() => setComposeFor(null)}
        />
      )}

      {/* Quick-add provider modal (from table cell) */}
      {quickAdd && (
        <QuickAddModal
          onSave={handleQuickAddSave}
          onCancel={() => setQuickAdd(null)}
        />
      )}

      {/* Column mapper modal */}
      {mapperState && (
        <ColumnMapper
          detectedColumns={mapperState.detectedColumns}
          mapping={mapperState.mapping}
          onMappingChange={(field, col) =>
            setMapperState(s => ({ ...s, mapping: { ...s.mapping, [field]: col } }))
          }
          onConfirm={handleMappingConfirm}
          onCancel={() => setMapperState(null)}
        />
      )}
    </div>
  );
}
