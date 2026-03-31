import { useState, useRef, useEffect } from 'react';
import { Settings, Search, X, RotateCcw } from 'lucide-react';
import StudyBadge from './StudyBadge';

// Columns that should always be shown and cannot be hidden
const PINNED = new Set(['id', 'studyId']);

// Human-readable labels for known field names
const LABELS = {
  id: 'Patient ID', studyId: 'Study', enrollmentDate: 'Enrolled', age: 'Age',
  sex: 'Sex', gender: 'Gender', lga: 'LGA', tribe: 'Tribe', language: 'Language',
  site: 'Site', sampleType: 'Sample Type', phone: 'Phone', address: 'Address',
  contactPathway: 'Contact Pathway',
  sampleCollected: 'Sample Collected', sampleDate: 'Sample Date',
  genotypingComplete: 'Genotyped', genotypingDate: 'Geno Date', genotype: 'Genotype',
  // CLOP
  providerCode: 'Provider Code', clinicalConditions: 'Clinical Conditions',
  cardioDisease: 'Cardio Disease', clopidogrelUsage: 'Clopidogrel Usage',
  otherDrugs: 'Other Drugs', clopidogrelComplications: 'Clopidogrel Complications',
  recurrentASCVD: 'Recurrent ASCVD', cyp2c19_17: 'CYP2C19*17',
  cvd: 'CVD', cvdDuration: 'CVD Duration', comorbidities: 'Comorbidities',
  familyCvdHistory: 'Family CVD History', adherence: 'Adherence',
  adverseEffects: 'Adverse Effects', outcomes: 'Outcomes',
  cyp2c19Testing: 'CYP2C19 Testing', occupation: 'Occupation', healthInsurance: 'Health Insurance',
  // ENTH
  tubeNumber: 'Tube Number', initials: 'Initials', dob: 'Date of Birth',
  religion: 'Religion', maritalStatus: 'Marital Status', spouseHearingStatus: 'Spouse Hearing',
  physician: 'Physician', hospital: 'Hospital', hearingLossType: 'Hearing Loss Type',
  acquired: 'Acquired?', familyHistoryHearingLoss: 'Family History (Hearing)',
  // UPTH-2
  hypertensionHistory: 'Hypertension History', hypertensionStatus: 'Hypertension Status',
  hypertensionDuration: 'Hypertension Duration', medication: 'Medication',
  weight: 'Weight (kg)', height: 'Height (cm)', bpSystolic: 'BP Systolic',
  bpDiastolic: 'BP Diastolic', urineAnalysis: 'Urine Analysis',
  medicalHistory: 'Medical History', eGFR: 'eGFR', ckdStage: 'CKD Stage',
  // RVPHC5
  malariaDiagnosed: 'Malaria Diagnosed?', malariaEpisodes: 'Malaria Episodes',
  lastMalariaDate: 'Last Malaria Date', malariaTreatment: 'Malaria Treatment',
  preventionMethods: 'Prevention Methods', dnaSample: 'DNA Sample',
  pfResult: 'P.f Result', pvResult: 'P.v Result',
  // AMD
  smoker: 'Smoker?', visualAcuityOD: 'Visual Acuity (OD)', visualAcuityOS: 'Visual Acuity (OS)',
  iop: 'IOP', fundusExam: 'Fundus Exam', amdStatus: 'AMD Status',
  amdType: 'AMD Type', diagnosis: 'Diagnosis', currentMedication: 'Current Medication',
};

const ALWAYS_VISIBLE = ['id', 'studyId', 'enrollmentDate', 'age', 'sex', 'gender', 'lga', 'contactPathway'];

export function getColumnLabel(key) {
  return LABELS[key] ?? key.replace(/([A-Z])/g, ' $1').replace(/^./, s => s.toUpperCase());
}

export default function ColumnManager({ allColumns, visibleSet, studies, onToggle, onReset }) {
  const [open,   setOpen]   = useState(false);
  const [search, setSearch] = useState('');
  const ref = useRef();

  useEffect(() => {
    const handler = e => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const filtered = allColumns.filter(col =>
    search === '' ||
    getColumnLabel(col.key).toLowerCase().includes(search.toLowerCase()) ||
    col.key.toLowerCase().includes(search.toLowerCase())
  );

  // Group: common vs study-specific
  const common  = filtered.filter(c => ALWAYS_VISIBLE.includes(c.key));
  const specific = filtered.filter(c => !ALWAYS_VISIBLE.includes(c.key));

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(o => !o)}
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border rounded-lg transition-colors ${
          open ? 'bg-gray-100 border-gray-300' : 'border-gray-200 text-gray-600 hover:bg-gray-50'
        }`}
      >
        <Settings size={14} />
        Columns
        <span className="text-xs text-gray-400 ml-0.5">({visibleSet.size})</span>
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 bg-white rounded-xl shadow-2xl border border-gray-200 w-72 z-30">
          <div className="flex items-center justify-between px-3 py-2.5 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Show / hide columns</span>
            <button onClick={onReset} className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800">
              <RotateCcw size={11} /> Reset
            </button>
          </div>

          <div className="px-2 pt-2 pb-1">
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                placeholder="Search columns…"
                value={search}
                onChange={e => setSearch(e.target.value)}
                className="w-full pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-teal-500"
              />
            </div>
          </div>

          <div className="max-h-80 overflow-y-auto px-2 pb-2 space-y-1">
            {common.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 py-1 mt-1">Common</p>
                {common.map(col => (
                  <ColRow key={col.key} col={col} visibleSet={visibleSet} pinned={PINNED.has(col.key)} onToggle={onToggle} studies={studies} />
                ))}
              </div>
            )}
            {specific.length > 0 && (
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-1 py-1 mt-1">Study-specific</p>
                {specific.map(col => (
                  <ColRow key={col.key} col={col} visibleSet={visibleSet} pinned={false} onToggle={onToggle} studies={studies} />
                ))}
              </div>
            )}
            {filtered.length === 0 && (
              <p className="text-sm text-gray-400 text-center py-4">No columns match</p>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ColRow({ col, visibleSet, pinned, onToggle, studies }) {
  const checked = pinned || visibleSet.has(col.key);
  return (
    <label className="flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer">
      <input
        type="checkbox"
        checked={checked}
        disabled={pinned}
        onChange={() => !pinned && onToggle(col.key)}
        className="w-3.5 h-3.5 text-teal-600 rounded border-gray-300 focus:ring-teal-500 disabled:opacity-50"
      />
      <span className="flex-1 text-sm text-gray-700">{getColumnLabel(col.key)}</span>
      {col.studyId && (
        <StudyBadge study={col.studyId} studies={studies} size="xs" />
      )}
    </label>
  );
}
