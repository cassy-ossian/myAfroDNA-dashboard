// Data service — ALL app data reads and writes go through this file.
//
// Every function is async even though the current implementation is synchronous
// in-memory. This ensures that when we swap to Supabase the function signatures
// stay identical and no calling code changes.
//
// Future swap example:
//   export async function getPatients(filters) {
//     let q = supabase.from('patients').select('*');
//     if (filters?.studyId) q = q.eq('study_id', filters.studyId);
//     const { data } = await q;
//     return data;
//   }

import useAppStore from '../store/appStore';
import { classifyPatient } from '../data/flaggingRules';
import { DEMO_STUDIES, DEMO_PATIENTS, DEMO_PROVIDERS, DEMO_NOTES } from '../data/sampleData';
import { detectContactPathway } from '../data/contactPathway';
import { inferCategory } from '../data/studyCategories';

// Convenience aliases
const getState = () => useAppStore.getState();
const setState = (updater) => useAppStore.setState(updater);

// ── Studies ───────────────────────────────────────────────────────────────────

export async function getStudies() {
  return Object.values(getState().studies);
}

export async function getStudy(studyId) {
  return getState().studies[studyId] ?? null;
}

export async function createStudy(studyData) {
  const id = studyData.id ?? crypto.randomUUID();
  const study = {
    id,
    category: inferCategory(id),
    ...studyData,
  };
  setState(s => ({ studies: { ...s.studies, [id]: study } }));
  return study;
}

export async function updateStudy(studyId, updates) {
  const existing = getState().studies[studyId];
  if (!existing) return null;
  const updated = { ...existing, ...updates };
  setState(s => ({ studies: { ...s.studies, [studyId]: updated } }));
  return updated;
}

export async function setActiveStudy(studyId) {
  setState({ activeStudyId: studyId ?? null });
}

// Import a full workbook (multiple studies at once).
// studiesData: [{ studyId, studyMeta, rows }]
export async function importFullWorkbook(studiesData) {
  const newStudies = { ...getState().studies };
  let newRawPatients = [...getState().rawPatients];

  for (const { studyId, studyMeta, rows } of studiesData) {
    const category = studyMeta.category ?? inferCategory(studyId);
    newStudies[studyId] = { id: studyId, category, ...studyMeta };
    // Remove any existing patients for this study before re-importing
    newRawPatients = newRawPatients.filter(p => p.studyId !== studyId);
    const studyPatients = rows.map(r => ({
      ...r,
      studyId,
      contactPathway: r.contactPathway ?? detectContactPathway(r),
    }));
    newRawPatients = [...newRawPatients, ...studyPatients];
  }

  setState({ studies: newStudies, rawPatients: newRawPatients });
}

// Return all patients with optional filters, including per-study data.
export async function getMasterPatientList(filters) {
  return getPatients(filters);
}

// ── Patients ──────────────────────────────────────────────────────────────────

export async function getPatients(filters) {
  let results = getState().rawPatients.map(classifyPatient);
  if (filters?.studyId) results = results.filter(p => p.studyId === filters.studyId);
  if (filters?.flagged !== undefined) results = results.filter(p => p.flagged === filters.flagged);
  if (filters?.priority) results = results.filter(p => p.priority === filters.priority);
  if (filters?.contactPathway) results = results.filter(p => p.contactPathway === filters.contactPathway);
  return results;
}

export async function getPatient(patientId) {
  const raw = getState().rawPatients.find(p => p.id === patientId);
  return raw ? classifyPatient(raw) : null;
}

export async function getPatientsByStudy(studyId) {
  return getPatients({ studyId });
}

export async function createPatient(patientData) {
  const patient = { id: patientData.id ?? `PAT-${Date.now()}`, ...patientData };
  setState(s => ({ rawPatients: [...s.rawPatients, patient] }));
  return classifyPatient(patient);
}

export async function updatePatient(patientId, updates) {
  let updated = null;
  setState(s => ({
    rawPatients: s.rawPatients.map(p => {
      if (p.id !== patientId) return p;
      updated = { ...p, ...updates };
      return updated;
    }),
  }));
  return updated ? classifyPatient(updated) : null;
}

export async function importPatients(studyId, rows) {
  const incoming = rows.map(r => ({
    ...r,
    studyId: studyId ?? r.studyId ?? null,
    contactPathway: r.contactPathway ?? detectContactPathway(r),
  }));
  // Merge: keep patients from other studies, replace patients for this study
  setState(s => ({
    rawPatients: [
      ...s.rawPatients.filter(p => studyId ? p.studyId !== studyId : false),
      ...incoming,
    ],
  }));
  return incoming.map(classifyPatient);
}

// ── Genotyping ────────────────────────────────────────────────────────────────

export async function getGenotypingResults(patientId) {
  const patient = await getPatient(patientId);
  if (!patient) return null;
  return {
    genotype: patient.genotype,
    genotypingComplete: patient.genotypingComplete,
    genotypingDate: patient.genotypingDate,
    phenotype: patient.phenotype,
    priority: patient.priority,
    flagged: patient.flagged,
  };
}

export async function updateGenotypingResult(patientId, result) {
  return updatePatient(patientId, result);
}

// ── Providers ─────────────────────────────────────────────────────────────────

export async function getProviders() {
  return [...getState().providers];
}

export async function getProvider(providerId) {
  return getState().providers.find(p => p.id === providerId) ?? null;
}

export async function createProvider(providerData) {
  const provider = { id: providerData.id ?? crypto.randomUUID(), ...providerData };
  setState(s => ({ providers: [...s.providers, provider] }));
  return provider;
}

export async function updateProvider(providerId, updates) {
  let updated = null;
  setState(s => ({
    providers: s.providers.map(p => {
      if (p.id !== providerId) return p;
      updated = { ...p, ...updates };
      return updated;
    }),
  }));
  return updated;
}

export async function removeProvider(providerId) {
  setState(s => ({ providers: s.providers.filter(p => p.id !== providerId) }));
}

export async function assignProvider(patientId, providerName) {
  setState(s => {
    // Update flat assignments map
    const providerAssignments = { ...s.providerAssignments };
    if (providerName === null) {
      delete providerAssignments[patientId];
    } else {
      providerAssignments[patientId] = providerName;
    }

    // Keep recontactCase in sync
    const recontactCases = s.recontactCases[patientId]
      ? {
          ...s.recontactCases,
          [patientId]: { ...s.recontactCases[patientId], assignedProvider: providerName },
        }
      : s.recontactCases;

    return { providerAssignments, recontactCases };
  });
}

// ── Recontact workflow ────────────────────────────────────────────────────────

export async function getRecontactEvents(filters) {
  let results = Object.values(getState().recontactCases);
  if (filters?.patientId) results = results.filter(c => c.patientId === filters.patientId);
  if (filters?.stage) results = results.filter(c => c.stage === filters.stage);
  return results;
}

// Creates a recontact case for a patient only if one doesn't already exist.
export async function createRecontactEvent(eventData) {
  const { patientId } = eventData;
  setState(s => {
    if (s.recontactCases[patientId]) return s; // idempotent — no-op if already exists
    const now = new Date().toISOString();
    return {
      recontactCases: {
        ...s.recontactCases,
        [patientId]: {
          patientId,
          stage: eventData.stage ?? 'flagged',
          stageEnteredAt: eventData.stageEnteredAt ?? now,
          assignedProvider: eventData.assignedProvider ?? null,
          flaggedBy:        eventData.flaggedBy ?? 'auto',
          flagReason:       eventData.flagReason ?? null,
          history: eventData.history ?? [{
            from: null, to: 'flagged', timestamp: now,
            note: eventData.flaggedBy === 'manual'
              ? (eventData.flagReason ?? 'Manually flagged for recontact.')
              : 'Automatically flagged based on CYP2C19 genotype result.',
            providerAssigned: null, notificationMethod: null, notificationDate: null,
            contactDate: null, contactNote: null, clinicalAction: null,
            clinicalNote: null, closingNote: null,
          }],
        },
      },
    };
  });
  return getState().recontactCases[patientId];
}

export async function updateRecontactStatus(patientId, toStage, payload) {
  setState(s => {
    const existing = s.recontactCases[patientId];
    if (!existing) return s;
    const now = new Date().toISOString();
    const newProvider = payload.providerAssigned || existing.assignedProvider;
    const historyEntry = {
      from: existing.stage, to: toStage, timestamp: now,
      note: payload.note || null,
      providerAssigned: payload.providerAssigned || null,
      notificationMethod: payload.notificationMethod || null,
      notificationDate: payload.notificationDate || null,
      contactDate: payload.contactDate || null,
      contactNote: payload.contactNote || null,
      clinicalAction: payload.clinicalAction || null,
      clinicalNote: payload.clinicalNote || null,
      closingNote: payload.closingNote || null,
    };
    // Sync providerAssignments if a provider was set via the transition modal
    const providerAssignments = payload.providerAssigned
      ? { ...s.providerAssignments, [patientId]: payload.providerAssigned }
      : s.providerAssignments;

    return {
      recontactCases: {
        ...s.recontactCases,
        [patientId]: {
          ...existing,
          stage: toStage,
          stageEnteredAt: now,
          assignedProvider: newProvider,
          history: [...existing.history, historyEntry],
        },
      },
      providerAssignments,
    };
  });
  return getState().recontactCases[patientId];
}

export async function getRecontactHistory(patientId) {
  return getState().recontactCases[patientId]?.history ?? [];
}

// ── Contact pathway ───────────────────────────────────────────────────────────

export async function updateContactPathway(patientId, pathway) {
  return updatePatient(patientId, { contactPathway: pathway });
}

export async function getContactDetails(patientId) {
  const patient = await getPatient(patientId);
  if (!patient) return null;
  return {
    contactPathway: patient.contactPathway ?? null,
    contactDetails: patient.contactDetails ?? null,
  };
}

export async function updateContactDetails(patientId, details) {
  // If adding first contact info to a patient with no method, auto-promote to 'direct'
  const current = getState().rawPatients.find(p => p.id === patientId);
  const updates = { ...details };
  if (current && current.contactPathway === 'none' && (details.phone || details.email || details.address)) {
    updates.contactPathway = 'direct';
  }
  return updatePatient(patientId, updates);
}

// ── Manual flagging ───────────────────────────────────────────────────────────

// Manually flag one or more patients for recontact.
// Stores manualFlag on the patient and creates/updates recontact cases.
export async function manuallyFlagPatients(patientIds, { reason, priority = 'Medium', notes = '' }) {
  const now = new Date().toISOString();
  setState(s => {
    const updatedPatients = s.rawPatients.map(p => {
      if (!patientIds.includes(p.id)) return p;
      return { ...p, manualFlag: { reason, priority, notes, flaggedDate: now } };
    });

    const newCases = { ...s.recontactCases };
    for (const patientId of patientIds) {
      if (!newCases[patientId]) {
        newCases[patientId] = {
          patientId,
          stage: 'flagged',
          stageEnteredAt: now,
          assignedProvider: null,
          flaggedBy: 'manual',
          flagReason: reason,
          history: [{
            from: null, to: 'flagged', timestamp: now,
            note: reason,
            providerAssigned: null, notificationMethod: null, notificationDate: null,
            contactDate: null, contactNote: null, clinicalAction: null,
            clinicalNote: null, closingNote: null,
          }],
        };
      } else {
        // Update existing case with manual flag info
        newCases[patientId] = { ...newCases[patientId], flaggedBy: 'manual', flagReason: reason };
      }
    }

    return { rawPatients: updatedPatients, recontactCases: newCases };
  });
}

// Remove manual flag from a patient (reverts to auto-classification).
export async function removeManualFlag(patientId) {
  return updatePatient(patientId, { manualFlag: undefined });
}

// ── Bulk provider assignment ──────────────────────────────────────────────────

export async function bulkAssignProvider(patientIds, providerName) {
  setState(s => {
    const providerAssignments = { ...s.providerAssignments };
    for (const pid of patientIds) {
      if (providerName === null) {
        delete providerAssignments[pid];
      } else {
        providerAssignments[pid] = providerName;
      }
    }
    return { providerAssignments };
  });
}

// ── Patient notes ─────────────────────────────────────────────────────────────

export async function addPatientNote(patientId, text, type = 'manual') {
  const note = { id: crypto.randomUUID(), text, timestamp: new Date().toISOString(), type };
  setState(s => ({
    patientNotes: {
      ...s.patientNotes,
      [patientId]: [note, ...(s.patientNotes[patientId] ?? [])],
    },
  }));
  return note;
}

export async function getPatientNotes(patientId) {
  return useAppStore.getState().patientNotes[patientId] ?? [];
}

// ── Column visibility ─────────────────────────────────────────────────────────

export async function setVisibleColumns(columns) {
  setState({ visibleColumns: columns }); // null = defaults, string[] = explicit
}

// ── Email tracking ────────────────────────────────────────────────────────────

export async function markEmailed(patientId) {
  setState(s => ({ emailedPatients: new Set([...s.emailedPatients, patientId]) }));
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getReportData(filters) {
  const [patients, providers, recontactEvents] = await Promise.all([
    getPatients(filters),
    getProviders(),
    getRecontactEvents(filters),
  ]);
  const providerAssignments = { ...getState().providerAssignments };
  return { patients, providers, recontactCases: recontactEvents, providerAssignments };
}

// ── Bulk operations ───────────────────────────────────────────────────────────

export async function exportAllData() {
  const s = getState();
  return {
    rawPatients: [...s.rawPatients],
    studies: { ...s.studies },
    providers: [...s.providers],
    recontactCases: { ...s.recontactCases },
    providerAssignments: { ...s.providerAssignments },
    emailedPatients: [...s.emailedPatients],
  };
}

export async function importWorkbook(sheets) {
  if (sheets.patients) setState({ rawPatients: sheets.patients });
  if (sheets.providers) setState({ providers: sheets.providers });
  if (sheets.recontactCases) {
    const casesById = sheets.recontactCases.reduce((acc, c) => {
      acc[c.patientId] = c;
      return acc;
    }, {});
    setState({ recontactCases: casesById });
  }
  if (sheets.assignments) setState({ providerAssignments: sheets.assignments });
}

// ── Demo data ─────────────────────────────────────────────────────────────────

export async function loadDemoData() {
  const rawPatients = DEMO_PATIENTS.map(p => ({
    ...p,
    contactPathway: p.contactPathway ?? detectContactPathway(p),
  }));
  setState({
    studies: DEMO_STUDIES,
    rawPatients,
    providers: DEMO_PROVIDERS,
    patientNotes: DEMO_NOTES,
  });
}
