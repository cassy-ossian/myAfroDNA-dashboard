import { useState, useRef, useCallback } from 'react';
import { X, Upload, ChevronRight, Check, AlertTriangle, Loader2 } from 'lucide-react';
import * as XLSX from 'xlsx';
import { inferCategory } from '../data/studyCategories';
import { importFullWorkbook } from '../services/dataService';

// ── Step 1 helpers ─────────────────────────────────────────────────────────────

function detectHeaderRows(rows) {
  // Heuristic: if row[0] values are all strings and row[1] has mixed types, row count = 1.
  // If row[0] looks merged/empty try row[1] as the real header row.
  if (!rows || rows.length < 2) return 1;
  const first  = rows[0];
  const second = rows[1];
  const firstAllStr  = Object.values(first).every(v => typeof v === 'string' || v == null);
  const secondHasNum = Object.values(second).some(v => typeof v === 'number');
  if (firstAllStr && secondHasNum) return 1;
  return 1; // default
}

function parseSheet(workbook, sheetName, headerRows = 1) {
  const ws = workbook.Sheets[sheetName];
  // Read raw to detect header rows, then re-read with proper header offset
  const raw = XLSX.utils.sheet_to_json(ws, { defval: null, raw: false });
  if (raw.length === 0) return [];
  if (headerRows <= 1) return raw;
  // For multi-row headers: skip extra header rows
  return raw.slice(headerRows - 1);
}

function guessStudyId(sheetName) {
  // Use sheet name as study ID, sanitised
  return sheetName.replace(/\s+/g, '-').toUpperCase().slice(0, 20);
}

// ── Step components ────────────────────────────────────────────────────────────

function Step1Upload({ onFile }) {
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef();

  const handleFile = (file) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const data     = new Uint8Array(e.target.result);
      const workbook = XLSX.read(data, { type: 'array', cellDates: true });
      onFile(workbook, file.name);
    };
    reader.readAsArrayBuffer(file);
  };

  return (
    <div className="flex flex-col items-center justify-center p-12 space-y-4">
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files[0]); }}
        onClick={() => inputRef.current.click()}
        className={`w-full max-w-md border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors ${
          dragging ? 'border-teal-500 bg-teal-50' : 'border-gray-300 hover:border-teal-400 hover:bg-gray-50'
        }`}
      >
        <Upload size={32} className={`mx-auto mb-3 ${dragging ? 'text-teal-500' : 'text-gray-400'}`} />
        <p className="text-sm font-medium text-gray-700">Drop an Excel workbook here</p>
        <p className="text-xs text-gray-400 mt-1">or click to browse — .xlsx / .xls / .csv</p>
        <input
          ref={inputRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          className="hidden"
          onChange={e => handleFile(e.target.files[0])}
        />
      </div>
    </div>
  );
}

function Step2SelectSheets({ workbook, fileName, sheetConfig, onChange, onNext, onBack }) {
  const sheets = workbook.SheetNames;

  const toggle = (name) => {
    onChange(prev => {
      const next = { ...prev };
      if (next[name]) {
        delete next[name];
      } else {
        const preview  = parseSheet(workbook, name, 1).slice(0, 3);
        const headerRows = detectHeaderRows([...parseSheet(workbook, name, 1)]);
        next[name] = {
          selected: true,
          studyId:  guessStudyId(name),
          studyName: name,
          headerRows,
          preview,
          rawCount: parseSheet(workbook, name, 1).length,
        };
      }
      return next;
    });
  };

  const updateField = (name, field, value) => {
    onChange(prev => ({
      ...prev,
      [name]: { ...prev[name], [field]: value },
    }));
  };

  const selectedCount = Object.values(sheetConfig).filter(c => c?.selected).length;

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-gray-500">{fileName} · {sheets.length} sheet{sheets.length !== 1 ? 's' : ''}</p>
        <p className="text-xs text-gray-400 mt-0.5">Select the sheets that contain study participant data.</p>
      </div>

      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {sheets.map(name => {
          const cfg = sheetConfig[name];
          const isSelected = !!cfg?.selected;

          return (
            <div key={name} className={`rounded-xl border transition-colors ${isSelected ? 'border-teal-400 bg-teal-50' : 'border-gray-200 bg-white'}`}>
              <div className="flex items-center gap-3 p-3">
                <input
                  type="checkbox"
                  checked={isSelected}
                  onChange={() => toggle(name)}
                  className="w-4 h-4 text-teal-600 rounded border-gray-300 focus:ring-teal-500"
                />
                <span className="font-medium text-sm text-gray-900 flex-1">{name}</span>
                {cfg && (
                  <span className="text-xs text-gray-400">{cfg.rawCount} rows</span>
                )}
              </div>

              {isSelected && cfg && (
                <div className="px-3 pb-3 space-y-3 border-t border-teal-200 pt-3">
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Study ID *</label>
                      <input
                        type="text"
                        value={cfg.studyId}
                        onChange={e => updateField(name, 'studyId', e.target.value.toUpperCase())}
                        placeholder="e.g. CLOP1"
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-teal-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Header rows</label>
                      <select
                        value={cfg.headerRows}
                        onChange={e => updateField(name, 'headerRows', Number(e.target.value))}
                        className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white"
                      >
                        <option value={1}>1 (default)</option>
                        <option value={2}>2</option>
                        <option value={3}>3</option>
                      </select>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-gray-600 mb-1">Study name</label>
                    <input
                      type="text"
                      value={cfg.studyName}
                      onChange={e => updateField(name, 'studyName', e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-2.5 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-teal-500"
                    />
                  </div>
                  {/* Preview first 2 data rows */}
                  {cfg.preview?.length > 0 && (
                    <div>
                      <p className="text-xs font-medium text-gray-500 mb-1">Preview (first rows)</p>
                      <div className="overflow-x-auto rounded border border-gray-200 bg-white">
                        <table className="text-xs w-full">
                          <thead className="bg-gray-50">
                            <tr>
                              {Object.keys(cfg.preview[0]).slice(0, 6).map(k => (
                                <th key={k} className="px-2 py-1 text-left text-gray-500 whitespace-nowrap truncate max-w-24">{k}</th>
                              ))}
                              {Object.keys(cfg.preview[0]).length > 6 && <th className="px-2 py-1 text-gray-400">…</th>}
                            </tr>
                          </thead>
                          <tbody>
                            {cfg.preview.slice(0, 2).map((row, i) => (
                              <tr key={i} className="border-t border-gray-100">
                                {Object.values(row).slice(0, 6).map((v, j) => (
                                  <td key={j} className="px-2 py-1 text-gray-600 truncate max-w-24">{String(v ?? '')}</td>
                                ))}
                                {Object.keys(row).length > 6 && <td className="px-2 py-1 text-gray-300">…</td>}
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-between pt-2">
        <button onClick={onBack} className="px-4 py-2 text-sm text-gray-600 hover:text-gray-900 rounded-lg hover:bg-gray-100">
          ← Back
        </button>
        <button
          onClick={onNext}
          disabled={selectedCount === 0}
          className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-lg text-sm font-semibold hover:bg-teal-800 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
        >
          Import {selectedCount} sheet{selectedCount !== 1 ? 's' : ''}
          <ChevronRight size={15} />
        </button>
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function WorkbookImport({ onClose, onImported }) {
  const [step,        setStep]        = useState(1); // 1=upload, 2=select, 3=importing, 4=done
  const [workbook,    setWorkbook]    = useState(null);
  const [fileName,    setFileName]    = useState('');
  const [sheetConfig, setSheetConfig] = useState({});
  const [error,       setError]       = useState('');
  const [importResult, setImportResult] = useState(null);

  const handleFile = useCallback((wb, name) => {
    setWorkbook(wb);
    setFileName(name);
    setSheetConfig({});
    setStep(2);
  }, []);

  const handleImport = useCallback(async () => {
    setError('');
    setStep(3);
    try {
      const studiesData = Object.entries(sheetConfig)
        .filter(([, cfg]) => cfg?.selected)
        .map(([sheetName, cfg]) => {
          const rows = parseSheet(workbook, sheetName, cfg.headerRows);
          // Normalise column names: trim whitespace, replace spaces with camelCase
          const normalised = rows.map(row => {
            const out = {};
            for (const [k, v] of Object.entries(row)) {
              const key = k.trim()
                .replace(/\s+(.)/g, (_, c) => c.toUpperCase())
                .replace(/^./, c => c.toLowerCase());
              out[key] = v;
            }
            // Ensure 'id' field exists
            if (!out.id && (out.ID || out.patientId || out.participantId)) {
              out.id = out.ID ?? out.patientId ?? out.participantId;
            }
            return out;
          }).filter(r => r.id); // drop rows with no ID

          return {
            studyId: cfg.studyId || guessStudyId(sheetName),
            studyMeta: {
              name:        cfg.studyName || sheetName,
              shortName:   cfg.studyId || guessStudyId(sheetName),
              category:    inferCategory(cfg.studyId || guessStudyId(sheetName)),
              description: '',
              hasCYP2C19:  rows.some(r => r.genotype || r.Genotype),
              hasContactInfo: rows.some(r => r.phone || r.Phone || r.email || r.Email),
              headers:     rows.length > 0 ? Object.keys(rows[0]) : [],
              headerRows:  cfg.headerRows,
              createdAt:   new Date().toISOString().split('T')[0],
            },
            rows: normalised,
          };
        });

      await importFullWorkbook(studiesData);

      const totalPatients = studiesData.reduce((n, s) => n + s.rows.length, 0);
      setImportResult({ studies: studiesData.length, patients: totalPatients });
      setStep(4);
      onImported?.();
    } catch (err) {
      setError(err.message ?? 'Import failed');
      setStep(2);
    }
  }, [workbook, sheetConfig, onImported]);

  const STEP_LABELS = ['Upload', 'Select Sheets', 'Importing…', 'Done'];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-5 border-b border-gray-100 shrink-0">
          <div>
            <p className="text-xs text-gray-500 uppercase tracking-wide font-medium">Multi-Study Import</p>
            <h2 className="text-lg font-bold text-gray-900 mt-0.5">Import Workbook</h2>
          </div>
          <div className="flex items-center gap-4">
            {/* Step indicator */}
            <div className="hidden sm:flex items-center gap-1">
              {STEP_LABELS.map((label, i) => {
                const stepNum = i + 1;
                const done    = step > stepNum;
                const active  = step === stepNum;
                return (
                  <span key={label} className="flex items-center gap-1">
                    <span className={`w-5 h-5 rounded-full text-xs flex items-center justify-center font-bold ${
                      done   ? 'bg-teal-600 text-white' :
                      active ? 'bg-teal-100 text-teal-700 ring-2 ring-teal-500' :
                               'bg-gray-100 text-gray-400'
                    }`}>
                      {done ? <Check size={10} /> : stepNum}
                    </span>
                    <span className={`text-xs ${active ? 'text-gray-700 font-medium' : 'text-gray-400'}`}>{label}</span>
                    {i < STEP_LABELS.length - 1 && <ChevronRight size={12} className="text-gray-300 mx-0.5" />}
                  </span>
                );
              })}
            </div>
            <button onClick={onClose} className="p-2 rounded-lg hover:bg-gray-100 text-gray-400">
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {error && (
            <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 rounded-lg p-3 text-sm">
              <AlertTriangle size={15} className="mt-0.5 shrink-0" />
              {error}
            </div>
          )}

          {step === 1 && <Step1Upload onFile={handleFile} />}

          {step === 2 && workbook && (
            <Step2SelectSheets
              workbook={workbook}
              fileName={fileName}
              sheetConfig={sheetConfig}
              onChange={setSheetConfig}
              onNext={handleImport}
              onBack={() => setStep(1)}
            />
          )}

          {step === 3 && (
            <div className="flex flex-col items-center justify-center py-16 gap-4">
              <Loader2 size={32} className="text-teal-600 animate-spin" />
              <p className="text-gray-600 font-medium">Importing studies…</p>
            </div>
          )}

          {step === 4 && importResult && (
            <div className="flex flex-col items-center justify-center py-12 gap-4 text-center">
              <div className="w-14 h-14 rounded-full bg-teal-100 flex items-center justify-center">
                <Check size={28} className="text-teal-600" />
              </div>
              <div>
                <p className="text-lg font-bold text-gray-900">Import complete</p>
                <p className="text-gray-500 text-sm mt-1">
                  {importResult.studies} stud{importResult.studies !== 1 ? 'ies' : 'y'} · {importResult.patients} participants loaded
                </p>
              </div>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-teal-700 text-white rounded-xl text-sm font-semibold hover:bg-teal-800 transition-colors"
              >
                View biobank
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
