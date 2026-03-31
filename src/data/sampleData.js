// Demo dataset — six studies mirroring the real MyAfroDNA spreadsheet structure.
// All patient data is synthetic and for demonstration purposes only.

// ── Shared helpers ────────────────────────────────────────────────────────────

const pick  = (arr, i) => arr[Math.abs(i) % arr.length];
const pad3  = n => String(n).padStart(3, '0');
const pad2  = n => String(n).padStart(2, '0');
const dt    = (y, m, d) => `${y}-${pad2(m)}-${pad2(d)}`;
const mkPhone = i => ['0801','0803','0805','0806','0807','0809','0701','0703','0812','0815'][i % 10] + pad3(100 + ((i * 137) % 900)) + pad2(10 + ((i * 73) % 90));

// ── Shared demographics pools ─────────────────────────────────────────────────

const LGAS_PH    = ['Port Harcourt', 'Obio-Akpor', 'Ikwerre', 'Okrika', 'Bonny', 'Eleme', 'Oyigbo', 'Tai', 'Khana'];
const TRIBES     = ['Ijaw', 'Ikwerre', 'Igbo', 'Yoruba', 'Efik', 'Ogoni', 'Urhobo', 'Kalabari', 'Ibibio', 'Hausa'];
const LANGS      = ['Ijaw', 'Ikwerre', 'Igbo', 'Yoruba', 'Efik', 'Ogoni', 'Urhobo', 'English'];
const RELIGIONS  = ['Christian', 'Muslim', 'Christian', 'Christian', 'Traditional'];
const OCCUPATIONS= ['Civil Servant', 'Trader', 'Nurse', 'Driver', 'Farmer', 'Teacher', 'Engineer', 'Retired', 'Artisan', 'Student'];
const MARITAL    = ['Married', 'Single', 'Married', 'Divorced', 'Widowed', 'Married'];
const SEXES      = ['Male', 'Female'];
const GENDERS    = ['Male', 'Female'];

// ── Study metadata ─────────────────────────────────────────────────────────────

export const DEMO_STUDIES = {
  CLOP1: {
    id: 'CLOP1',
    name: 'Clopidogrel Metabolism Study (Phase 1)',
    shortName: 'CLOP1',
    category: 'Cardiovascular',
    description: 'CYP2C19 pharmacogenomics in patients on clopidogrel therapy at RSUTH cardiac units.',
    hasCYP2C19: true,
    hasContactInfo: false,
    headers: ['providerCode','id','sampleType','age','sex','lga','tribe','clinicalConditions','cardioDisease','clopidogrelUsage','otherDrugs','clopidogrelComplications','recurrentASCVD','genotype','enrollmentDate','site','sampleCollected','sampleDate','genotypingComplete','genotypingDate'],
    headerRows: 1,
    createdAt: '2025-09-01',
  },
  'CLOP-2': {
    id: 'CLOP-2',
    name: 'Clopidogrel Metabolism Study (Phase 2)',
    shortName: 'CLOP-2',
    category: 'Cardiovascular',
    description: 'Extended clopidogrel cohort with patient contact information and CYP2C19 outcome data.',
    hasCYP2C19: true,
    hasContactInfo: true,
    headers: ['providerCode','id','sampleType','age','sex','occupation','healthInsurance','lga','tribe','phone','cvd','cvdDuration','comorbidities','familyCvdHistory','adherence','adverseEffects','outcomes','cyp2c19Testing','genotype','enrollmentDate','site','sampleCollected','sampleDate','genotypingComplete','genotypingDate'],
    headerRows: 1,
    createdAt: '2025-11-01',
  },
  ENTH: {
    id: 'ENTH',
    name: 'Ear, Nose & Throat Health Study',
    shortName: 'ENTH',
    category: 'Audiology',
    description: 'Genetic factors in hereditary and acquired hearing loss across Nigerian ENT clinics.',
    hasCYP2C19: false,
    hasContactInfo: false,
    headers: ['providerCode','tubeNumber','id','sampleType','initials','dob','gender','address','state','tribe','religion','occupation','maritalStatus','spouseHearingStatus','enrollmentDate','physician','hospital','hearingLossType','acquired','familyHistoryHearingLoss'],
    headerRows: 1,
    createdAt: '2025-10-01',
  },
  'UPTH-2': {
    id: 'UPTH-2',
    name: 'UPTH Nephrology Cohort',
    shortName: 'UPTH-2',
    category: 'Nephrology',
    description: 'Genetic determinants of CKD progression at University of Port Harcourt Teaching Hospital.',
    hasCYP2C19: false,
    hasContactInfo: true,
    headers: ['providerCode','tubeNumber','id','sampleType','age','gender','lga','tribe','language','hypertensionHistory','hypertensionStatus','hypertensionDuration','medication','weight','height','bpSystolic','bpDiastolic','urineAnalysis','medicalHistory','eGFR','ckdStage','phone'],
    headerRows: 1,
    createdAt: '2025-11-01',
  },
  RVPHC5: {
    id: 'RVPHC5',
    name: 'Rural Village Primary Health Care (Wave 5)',
    shortName: 'RVPHC5',
    category: 'Infectious Disease',
    description: 'Malaria and infectious disease biomarker surveillance across rural community health centres.',
    hasCYP2C19: false,
    hasContactInfo: true,
    headers: ['providerCode','tubeNumber','id','sampleType','age','gender','lga','tribe','language','address','phone','occupation','enrollmentDate','hospital','malariaDiagnosed','malariaEpisodes','lastMalariaDate','malariaTreatment','preventionMethods','dnaSample','pfResult','pvResult'],
    headerRows: 1,
    createdAt: '2025-08-15',
  },
  AMD: {
    id: 'AMD',
    name: 'Age-Related Macular Degeneration Study',
    shortName: 'AMD',
    category: 'Ophthalmology',
    description: 'Genetic risk factors for AMD in a West African population cohort.',
    hasCYP2C19: false,
    hasContactInfo: false,
    headers: ['providerCode','id','age','sex','lga','tribe','weight','height','smoker','visualAcuityOD','visualAcuityOS','iop','fundusExam','amdStatus','amdType','diagnosis','currentMedication','enrollmentDate'],
    headerRows: 1,
    createdAt: '2025-12-01',
  },
};

// ── Demo providers ─────────────────────────────────────────────────────────────

export const DEMO_PROVIDERS = [
  { id: 'prov-1', name: 'Dr. Chukwu Okafor',       facility: 'RSUTH',  specialty: 'Interventional Cardiology', phone: '+234-800-000-0001', email: 'okafor@rsuth.example.ng',   preferredContact: 'Phone call' },
  { id: 'prov-2', name: 'Dr. Funke Adeyemi',        facility: 'RSUTH',  specialty: 'Cardiology',                phone: '+234-800-000-0002', email: 'adeyemi@rsuth.example.ng',  preferredContact: 'WhatsApp' },
  { id: 'prov-3', name: 'Dr. Emeka Nwosu',          facility: 'UPTH',   specialty: 'Nephrology',                phone: '+234-800-000-0003', email: 'nwosu@upth.example.ng',     preferredContact: 'Email' },
  { id: 'prov-4', name: 'Dr. Nneka Eze',            facility: 'ENTH',   specialty: 'ENT/Audiology',             phone: '+234-800-000-0004', email: 'eze@enth.example.ng',       preferredContact: 'Phone call' },
  { id: 'prov-5', name: 'Dr. Kwame Mensah',         facility: 'RSU',    specialty: 'Ophthalmology',             phone: '+234-800-000-0005', email: 'mensah@rsu.example.ng',     preferredContact: 'WhatsApp' },
  { id: 'prov-6', name: 'Community Health Officer', facility: 'RVPHC5', specialty: 'Community Health',          phone: '+234-800-000-0006', email: null,                        preferredContact: 'Phone call' },
];

// ── CLOP1 patients (CTR 001–030) ──────────────────────────────────────────────
// 3 × *17/*17 (High, auto-flag) at indices 2,5,10
// 2 × *2/*2  (High, auto-flag) at indices 7,9

const CLOP1_GENOS = { 0:'*1/*1',1:'*1/*1',2:'*17/*17',3:'*1/*1',4:'*1/*1',5:'*17/*17',6:'*1/*2',7:'*2/*2',8:'*1/*17',9:'*2/*2',10:'*17/*17',11:'*1/*1' };
const CLOP1_CARDIO = ['Acute Myocardial Infarction','Acute Coronary Syndrome','Stable Angina','NSTEMI','Atrial Fibrillation'];
const CLOP1_COMORBID = ['Hypertension','Hypertension, Diabetes','Hypertension, Dyslipidaemia','Diabetes, Dyslipidaemia','Hypertension'];

const CLOP1_PATIENTS = Array.from({ length: 30 }, (_, i) => {
  const num  = i + 1;
  const id   = `CTR ${pad3(num)}`;
  const genotyped = i < 12;
  const collected = i < 22;
  const genotype  = genotyped ? (CLOP1_GENOS[i] ?? '*1/*1') : null;
  const m = 9 + Math.floor(i / 7);
  const d = (i % 7) * 4 + 1;
  return {
    id, studyId: 'CLOP1', providerCode: 'RSUTH',
    enrollmentDate: dt(2025, m, d),
    site: 'RSUTH Cardiac Department',
    sampleType: 'EDTA Blood',
    age: 40 + (i * 3) % 28,
    sex: pick(SEXES, i + 1),
    lga: pick(LGAS_PH, i),
    tribe: pick(TRIBES, i),
    clinicalConditions: pick(CLOP1_COMORBID, i),
    cardioDisease: pick(CLOP1_CARDIO, i),
    clopidogrelUsage: 'Yes',
    otherDrugs: i % 3 === 0 ? 'Aspirin' : i % 3 === 1 ? 'Aspirin, Statin' : 'Aspirin, ACE Inhibitor',
    clopidogrelComplications: i % 6 === 0 ? 'Minor bleeding' : i % 6 === 3 ? 'GI discomfort' : 'None',
    recurrentASCVD: i % 4 === 0 ? 'Yes' : 'No',
    sampleCollected: collected,
    sampleDate: collected ? dt(2025, m, d + 6) : null,
    genotypingComplete: genotyped,
    genotypingDate: genotyped ? dt(2025, m + 1, d + 12) : null,
    genotype,
    cyp2c19_17: genotype?.includes('*17') ? 'Yes' : (genotype ? 'No' : null),
  };
});

// ── CLOP-2 patients (C1–C20) ──────────────────────────────────────────────────
// 2 auto-flagged: C3 (*2/*2), C7 (*17/*17)

const CLOP2_CVD  = ['Hypertensive Heart Disease','Coronary Artery Disease','Heart Failure','Atrial Fibrillation','Cardiomyopathy'];
const CLOP2_GENOS = { 0:'*1/*1',1:'*1/*1',2:'*2/*2',3:'*1/*1',4:'*1/*1',5:'*1/*1',6:'*17/*17',7:'*1/*1',8:'*1/*17',9:'*1/*1' };

const CLOP2_PATIENTS = Array.from({ length: 20 }, (_, i) => {
  const num  = i + 1;
  const id   = `C${num}`;
  const genotyped = i < 10;
  const collected = i < 15;
  const genotype  = genotyped ? (CLOP2_GENOS[i] ?? '*1/*1') : null;
  const tested = genotyped ? 'Yes' : (collected ? 'Pending' : 'No');
  const m = 11 + Math.floor(i / 7);
  const d = (i % 7) * 4 + 2;
  return {
    id, studyId: 'CLOP-2', providerCode: 'RSUTH',
    enrollmentDate: dt(2025, m, d),
    site: 'RSUTH Cardiac Department',
    sampleType: 'EDTA Blood',
    age: 38 + (i * 4) % 32,
    sex: pick(SEXES, i),
    occupation: pick(OCCUPATIONS, i),
    healthInsurance: i % 3 === 0 ? 'NHIS' : i % 3 === 1 ? 'Private' : 'None',
    lga: pick(LGAS_PH, i + 2),
    tribe: pick(TRIBES, i + 3),
    phone: mkPhone(i + 30),
    cvd: pick(CLOP2_CVD, i),
    cvdDuration: `${(i % 8) + 1} year${(i % 8) + 1 !== 1 ? 's' : ''}`,
    comorbidities: i % 4 === 0 ? 'Hypertension, Diabetes' : i % 4 === 1 ? 'Hypertension' : i % 4 === 2 ? 'Diabetes' : 'None',
    familyCvdHistory: i % 3 === 0 ? 'Yes' : 'No',
    adherence: i % 3 === 0 ? 'Good' : i % 3 === 1 ? 'Fair' : 'Poor',
    adverseEffects: i % 5 === 0 ? 'GI bleeding' : i % 5 === 2 ? 'Bruising' : 'None',
    outcomes: i % 4 === 0 ? 'Stable' : i % 4 === 1 ? 'Improved' : i % 4 === 2 ? 'Worsened' : 'Stable',
    cyp2c19Testing: tested,
    sampleCollected: collected,
    sampleDate: collected ? dt(2025, m, d + 7) : null,
    genotypingComplete: genotyped,
    genotypingDate: genotyped ? dt(2025, m + 1, d + 14) : null,
    genotype,
  };
});

// ── ENTH patients (ENT 001–015) ────────────────────────────────────────────────
// ENT 004, ENT 009 → manually flagged (family history of hearing loss)

const ENTH_HEARING = ['Bilateral sensorineural','Unilateral sensorineural','Conductive','Mixed','Bilateral profound','Unilateral conductive'];
const ENTH_PHYSICIANS = ['Dr. Nneka Eze', 'Dr. Biodun Afolabi', 'Dr. Samuel Okonkwo'];

const ENTH_PATIENTS = Array.from({ length: 15 }, (_, i) => {
  const num  = i + 1;
  const id   = `ENT ${pad3(num)}`;
  const hasFamily = (i === 3 || i === 8); // ENT 004, ENT 009
  const m = 10 + Math.floor(i / 6);
  const d = (i % 6) * 5 + 1;
  const birthYear = 1970 + (i * 4) % 30;
  const manualFlag = hasFamily ? {
    reason: 'New genetic testing available for hereditary hearing loss — patient has documented family history.',
    priority: 'Medium',
    flaggedDate: dt(2026, 1, 10 + i),
  } : undefined;
  return {
    id, studyId: 'ENTH', providerCode: 'ENTH',
    tubeNumber: `ENTH-T${pad3(num)}`,
    enrollmentDate: dt(2025, m, d),
    site: 'ENTH ENT Clinic, Lagos',
    sampleType: pick(['EDTA Blood','Buccal Swab'], i),
    initials: ['A.O.','B.C.','C.I.','D.E.','E.F.','F.G.','G.H.','H.J.','I.K.','J.L.','K.M.','L.N.','M.O.','N.P.','O.Q.'][i],
    dob: `${birthYear}-${pad2(3 + (i % 9))}-${pad2(5 + (i % 20))}`,
    gender: pick(GENDERS, i),
    address: `${num + 10} ${pick(['Broad St','Allen Ave','Awolowo Rd','Bode Thomas','Lekki Expressway'], i)}, Lagos`,
    state: 'Lagos',
    tribe: pick(TRIBES, i + 5),
    religion: pick(RELIGIONS, i),
    occupation: pick(OCCUPATIONS, i + 1),
    maritalStatus: pick(MARITAL, i),
    spouseHearingStatus: i % 2 === 0 ? 'Normal' : 'Unknown',
    physician: pick(ENTH_PHYSICIANS, i),
    hospital: i % 2 === 0 ? 'Lagos University Teaching Hospital' : 'National Hospital Abuja',
    hearingLossType: pick(ENTH_HEARING, i),
    acquired: i % 3 === 0 ? 'Yes' : 'No',
    familyHistoryHearingLoss: hasFamily ? 'Yes' : (i % 4 === 0 ? 'Yes' : 'No'),
    ...(manualFlag && { manualFlag }),
  };
});

// ── UPTH-2 patients (UPTH-001–UPTH-020) ──────────────────────────────────────
// UPTH-001–UPTH-012: have phone (direct/both pathway)
// UPTH-013–UPTH-020: no phone (provider-mediated)
// UPTH-005 manually flagged (critical eGFR decline)

const UPTH2_DIAGNOSES = ['Hypertensive nephropathy','Diabetic nephropathy','Chronic glomerulonephritis','Obstructive uropathy','Polycystic kidney disease'];
const CKD_STAGES = { 65:'Stage 2', 50:'Stage 3a', 38:'Stage 3b', 25:'Stage 4', 14:'Stage 4', 9:'Stage 5', 12:'Stage 5', 44:'Stage 3a', 55:'Stage 3a', 31:'Stage 3b', 18:'Stage 4', 62:'Stage 2', 48:'Stage 3a', 72:'Stage 2', 37:'Stage 3b', 22:'Stage 4', 58:'Stage 3a', 42:'Stage 3a', 15:'Stage 4', 28:'Stage 3b' };
const EGFRS = [65,50,38,25,14,9,12,44,55,31,18,62,48,72,37,22,58,42,15,28];

const UPTH2_PATIENTS = Array.from({ length: 20 }, (_, i) => {
  const num  = i + 1;
  const id   = `UPTH-${pad3(num)}`;
  const eGFR = EGFRS[i];
  const hasPhone = i < 12;
  const m = 11 + Math.floor(i / 7);
  const d = (i % 7) * 4 + 3;
  const manualFlag = (i === 4) ? { // UPTH-005
    reason: 'Critical eGFR decline — eGFR dropped to 9 ml/min/1.73m². Needs urgent nephrology review.',
    priority: 'High',
    flaggedDate: dt(2026, 2, 1),
  } : undefined;
  return {
    id, studyId: 'UPTH-2', providerCode: 'UPTH-2',
    tubeNumber: `UPTH-T${pad3(num)}`,
    enrollmentDate: dt(2025, m, d),
    site: pick(['UPTH Nephrology Clinic','RSUTH Renal Unit','UPTH Dialysis Centre'], i),
    sampleType: 'EDTA Blood',
    age: 35 + (i * 5) % 30,
    gender: pick(GENDERS, i + 2),
    lga: pick(LGAS_PH, i + 1),
    tribe: pick(TRIBES, i + 2),
    language: pick(LANGS, i),
    hypertensionHistory: i % 3 !== 2 ? 'Yes' : 'No',
    hypertensionStatus: i % 3 !== 2 ? 'Controlled' : 'N/A',
    hypertensionDuration: i % 3 !== 2 ? `${(i % 8) + 1} years` : 'N/A',
    medication: i % 4 === 0 ? 'Amlodipine, Lisinopril' : i % 4 === 1 ? 'Metformin, Lisinopril' : i % 4 === 2 ? 'Amlodipine' : 'Lisinopril, Furosemide',
    weight: 60 + (i * 3) % 30,
    height: 155 + (i * 4) % 30,
    bpSystolic: 130 + (i * 7) % 40,
    bpDiastolic: 80 + (i * 3) % 20,
    urineAnalysis: i % 4 === 0 ? 'Proteinuria ++' : i % 4 === 1 ? 'Haematuria' : i % 4 === 2 ? 'Normal' : 'Proteinuria +',
    medicalHistory: pick(UPTH2_DIAGNOSES, i),
    eGFR,
    ckdStage: CKD_STAGES[eGFR] || 'Stage 3a',
    ...(hasPhone && { phone: mkPhone(i + 50) }),
    ...(manualFlag && { manualFlag }),
  };
});

// ── RVPHC5 patients (RVPHC5-1–RVPHC5-25) ─────────────────────────────────────
// All have phone and address.
// RVPHC5-3, RVPHC5-12 → manually flagged (positive malaria RDT)

const RVP_HOSPITALS = ['Amasiri PHC', 'Okposi Rural Health Centre', 'Eke Community Clinic', 'Izzi PHC', 'Afikpo North General Hospital'];
const RVP_LGAS = ['Afikpo North', 'Ohaozara', 'Isi-Uzo', 'Izzi', 'Ivo', 'Afikpo South'];
const RVP_ADDRESSES = ['Amasiri, Afikpo North LGA, Ebonyi State','Okposi, Ohaozara LGA, Ebonyi State','Eke, Isi-Uzo LGA, Enugu State','Izzi, Izzi LGA, Ebonyi State','Ohaozara, Ebonyi State'];
const PREVENTION = ['Insecticide-treated net','Indoor residual spraying','Both','None','Insecticide-treated net'];

const RVPHC5_PATIENTS = Array.from({ length: 25 }, (_, i) => {
  const num = i + 1;
  const id  = `RVPHC5-${num}`;
  const pfPositive = (i === 2 || i === 11); // RVPHC5-3, RVPHC5-12
  const m = 8 + Math.floor(i / 8);
  const d = (i % 8) * 3 + 2;
  const manualFlag = pfPositive ? {
    reason: 'Positive malaria RDT result. Follow-up needed to verify treatment completion.',
    priority: 'Medium',
    flaggedDate: dt(2025, m + 1, d + 5),
  } : undefined;
  return {
    id, studyId: 'RVPHC5', providerCode: 'RVPHC5',
    tubeNumber: `RVP-T${pad3(num)}`,
    enrollmentDate: dt(2025, m, d),
    site: pick(RVP_HOSPITALS, i),
    sampleType: pick(['EDTA Blood','DBS'], i),
    age: 15 + (i * 4) % 50,
    gender: pick(GENDERS, i + 1),
    lga: pick(RVP_LGAS, i),
    tribe: pick(['Ezza','Igbo','Ikwo','Izzi','Afikpo','Ohaozara'], i),
    language: 'Igbo',
    address: pick(RVP_ADDRESSES, i),
    phone: mkPhone(i + 70),
    occupation: pick(OCCUPATIONS, i + 3),
    hospital: pick(RVP_HOSPITALS, i),
    malariaDiagnosed: i % 5 !== 4 ? 'Yes' : 'No',
    malariaEpisodes: 1 + (i * 2) % 8,
    lastMalariaDate: dt(2025, 5 + (i % 3), 10 + (i % 15)),
    malariaTreatment: pick(['Artemether-Lumefantrine','Artesunate-Amodiaquine','Quinine','Artemether-Lumefantrine'], i),
    preventionMethods: pick(PREVENTION, i),
    dnaSample: 'Yes',
    pfResult: pfPositive ? 'Positive' : (i % 4 === 0 ? 'Positive' : 'Negative'),
    pvResult: i % 7 === 0 ? 'Positive' : 'Negative',
    ...(manualFlag && { manualFlag }),
  };
});

// ── AMD patients (RSU.AMD.01–RSU.AMD.10) ──────────────────────────────────────

const AMD_TYPES = ['Dry AMD','Wet AMD','Dry AMD','Dry AMD','Wet AMD','Intermediate AMD','Dry AMD','Wet AMD','Intermediate AMD','Dry AMD'];
const AMD_STATUS = ['Early','Intermediate','Advanced','Early','Advanced','Intermediate','Early','Advanced','Intermediate','Early'];
const AMD_MEDS  = ['Ranibizumab injections','Bevacizumab','AREDS2 supplements','AREDS2 supplements','Aflibercept injections','AREDS2 supplements','None','Bevacizumab','AREDS2 supplements','None'];
const AMD_FUNDUS= ['Drusen deposits, foveal involvement','Choroidal neovascularisation','Drusen deposits','Large soft drusen','Geographic atrophy','Drusen deposits, RPE changes','Small hard drusen','Subretinal fluid','Drusen, pigmentary changes','Multiple small drusen'];

const AMD_PATIENTS = Array.from({ length: 10 }, (_, i) => {
  const num = i + 1;
  const id  = `RSU.AMD.${pad2(num)}`;
  const m   = 12 + Math.floor(i / 5);
  const d   = (i % 5) * 5 + 3;
  return {
    id, studyId: 'AMD', providerCode: 'RSU.AMD',
    enrollmentDate: dt(m > 12 ? 2026 : 2025, m > 12 ? m - 12 : m, d),
    site: 'Rivers State University Hospital Ophthalmology Dept',
    age: 55 + (i * 3) % 25,
    sex: pick(SEXES, i + 2),
    lga: pick(LGAS_PH, i + 4),
    tribe: pick(TRIBES, i + 7),
    weight: 60 + (i * 4) % 25,
    height: 155 + (i * 5) % 25,
    smoker: i % 3 === 0 ? 'Yes' : 'No',
    visualAcuityOD: pick(['6/6','6/9','6/12','6/18','6/24','6/60'], i),
    visualAcuityOS: pick(['6/6','6/12','6/18','6/24'], i + 1),
    iop: 12 + (i * 2) % 8,
    fundusExam: AMD_FUNDUS[i],
    amdStatus: AMD_STATUS[i],
    amdType: AMD_TYPES[i],
    diagnosis: `${AMD_TYPES[i]} — ${AMD_STATUS[i]} Stage`,
    currentMedication: AMD_MEDS[i],
  };
});

// ── Exports ───────────────────────────────────────────────────────────────────

// Legacy single-study export (for the existing Patients screen)
export const SAMPLE_PATIENTS = CLOP1_PATIENTS;

// Multi-study
export const DEMO_PATIENTS = [
  ...CLOP1_PATIENTS,
  ...CLOP2_PATIENTS,
  ...ENTH_PATIENTS,
  ...UPTH2_PATIENTS,
  ...RVPHC5_PATIENTS,
  ...AMD_PATIENTS,
];

// Pre-seeded activity notes for the demo (added to patientNotes in loadDemoData)
export const DEMO_NOTES = {
  'CTR 003': [{ id: 'n1', text: 'CYP2C19 *17/*17 result flagged automatically. Coordinator notified.', timestamp: '2025-11-05T09:00:00Z', type: 'system' }],
  'CTR 005': [{ id: 'n2', text: 'CYP2C19 *17/*17 result flagged automatically. Provider email drafted.', timestamp: '2025-11-15T10:30:00Z', type: 'system' }],
  'CTR 008': [{ id: 'n3', text: 'Poor metabolizer result confirmed by second reading.', timestamp: '2025-12-01T14:00:00Z', type: 'manual' }],
  'ENT 004': [{ id: 'n4', text: 'Family history confirmed at intake — both parents with progressive hearing loss.', timestamp: '2026-01-12T11:00:00Z', type: 'manual' }],
  'ENT 009': [{ id: 'n5', text: 'Patient flagged — sibling also enrolled, familial pattern suspected.', timestamp: '2026-01-15T09:30:00Z', type: 'manual' }],
  'UPTH-005': [{ id: 'n6', text: 'eGFR has declined from 45 to 9 ml/min/1.73m² over 6 months. Urgent referral raised.', timestamp: '2026-02-01T08:00:00Z', type: 'system' }, { id: 'n7', text: 'Dr. Nwosu notified via email. Awaiting response.', timestamp: '2026-02-02T10:15:00Z', type: 'manual' }],
  'RVPHC5-3':  [{ id: 'n8', text: 'Positive P. falciparum RDT. ACT treatment started on enrolment day.', timestamp: '2025-09-08T07:30:00Z', type: 'system' }],
  'RVPHC5-12': [{ id: 'n9', text: 'Positive RDT confirmed. Home visit scheduled to verify treatment completion.', timestamp: '2025-11-18T13:00:00Z', type: 'system' }],
};
