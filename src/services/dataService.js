// Data service — ALL app data reads and writes go through this file.
//
// Architecture:
//   • Supabase is the source of truth for persisted data.
//   • Zustand store is a local cache — populated on load, kept in sync on writes.
//   • Every write goes to Supabase first, then updates the cache.
//   • classifyPatient() is called on read (not persisted).

import { supabase } from '../lib/supabase';
import useAppStore from '../store/appStore';
import { classifyPatient } from '../data/flaggingRules';
import { DEMO_STUDIES, DEMO_PATIENTS, DEMO_PROVIDERS, DEMO_NOTES } from '../data/sampleData';
import { detectContactPathway } from '../data/contactPathway';
import { inferCategory } from '../data/studyCategories';
import { runRulesForStudy, runAllRules } from './rulesEngine.js';

const getState = () => useAppStore.getState();
const setState = (u) => useAppStore.setState(u);

// ── Fields that live in top-level patient columns (not study_data) ────────────
const PATIENT_COMMON_KEYS = new Set([
  'id', '_sbId', 'studyId', 'age', 'sex', 'gender', 'lga', 'tribe',
  'language', 'contactPathway', 'phone', 'email', 'manualFlag',
]);

// ── Data transformers ─────────────────────────────────────────────────────────

function dbStudyToStore(row) {
  return {
    id:               row.id,
    name:             row.name,
    shortName:        row.id,
    description:      row.description ?? '',
    category:         inferCategory(row.id),
    columnDefinitions: row.column_definitions ?? [],
    headers:          (row.column_definitions ?? []).map(c => c.key),
    createdAt:        row.created_at,
  };
}

function dbProviderToStore(row) {
  return {
    id:               row.id,      // UUID — used as app ID too
    _sbId:            row.id,
    name:             row.name,
    specialty:        row.specialty ?? '',
    facility:         row.facility ?? '',
    phone:            row.phone ?? '',
    email:            row.email ?? '',
    preferredContact: row.preferred_contact_method ?? 'Email',
  };
}

function dbPatientToRaw(row) {
  return {
    id:             row.myafrodna_id,  // display ID e.g. "CTR 001"
    _sbId:          row.id,            // Supabase UUID
    studyId:        row.study_id,
    age:            row.age,
    gender:         row.gender,
    lga:            row.lga,
    tribe:          row.tribe,
    language:       row.language,
    contactPathway: row.contact_pathway,
    phone:          row.phone,
    email:          row.email,
    ...(row.study_data ?? {}),         // flatten study-specific fields
  };
}

function dbEventToCase(row, appPatientId, providersByUuid) {
  const stageOrder = [
    'flagged', 'under_review', 'provider_notified',
    'patient_contacted', 'followup_complete', 'closed',
  ];
  const history = [];
  let prev = null;
  for (const stage of stageOrder) {
    const ts = row[`${stage}_at`];
    if (ts) {
      history.push({
        from: prev, to: stage, timestamp: ts,
        note: stage === 'flagged'
          ? (row.flagged_by === 'manual' ? row.reason : 'Auto-flagged based on CYP2C19 genotype.')
          : null,
        providerAssigned: null, notificationMethod: null, notificationDate: null,
        contactDate: null, contactNote: null, clinicalAction: null,
        clinicalNote: null, closingNote: null,
      });
      prev = stage;
    }
  }
  if (history.length === 0) {
    history.push({
      from: null, to: row.status, timestamp: row.created_at,
      note: row.flagged_by === 'manual'
        ? (row.reason ?? 'Manually flagged for recontact.')
        : 'Auto-flagged based on CYP2C19 genotype.',
      providerAssigned: null, notificationMethod: null, notificationDate: null,
      contactDate: null, contactNote: null, clinicalAction: null,
      clinicalNote: null, closingNote: null,
    });
  }
  const provider = row.assigned_provider_id ? providersByUuid[row.assigned_provider_id] : null;
  return {
    patientId:        appPatientId,
    _sbId:            row.id,
    stage:            row.status,
    stageEnteredAt:   row[`${row.status}_at`] ?? row.created_at,
    assignedProvider: provider?.name ?? null,
    flaggedBy:        row.flagged_by,
    flagReason:       row.reason ?? null,
    priority:         row.priority ?? 'Medium',
    history,
  };
}

function dbNoteToStore(row) {
  return {
    id:        row.id,
    text:      row.text,
    timestamp: row.created_at,
    type:      row.note_type,
  };
}

// ── Helpers to look up Supabase UUIDs from app-level IDs ─────────────────────

function getPatientSbId(appId) {
  return getState().rawPatients.find(p => p.id === appId)?._sbId ?? null;
}

function getProviderSbId(providerName) {
  return getState().providers.find(p => p.name === providerName)?._sbId ?? null;
}

function getEventSbId(appPatientId) {
  return getState().recontactCases[appPatientId]?._sbId ?? null;
}

// ── Raw patient → Supabase insert shape ──────────────────────────────────────

function rawPatientToDbRow(p) {
  const { id, _sbId, studyId, age, sex, gender, lga, tribe, language,
          contactPathway, phone, email, manualFlag, ...rest } = p;
  return {
    myafrodna_id:  id,
    study_id:      studyId,
    age:           age ?? null,
    gender:        gender ?? sex ?? null,
    lga:           lga ?? null,
    tribe:         tribe ?? null,
    language:      language ?? null,
    contact_pathway: contactPathway ?? null,
    phone:         phone ?? null,
    email:         email ?? null,
    study_data:    rest,
  };
}

// ── Auth ──────────────────────────────────────────────────────────────────────

export function initAuth() {
  // Check for existing session immediately
  supabase.auth.getSession().then(({ data: { session } }) => {
    if (session?.user) {
      setState({ user: session.user });
      loadFromSupabase();
    } else {
      setState({ loading: false });
    }
  });

  // Listen for future auth changes
  supabase.auth.onAuthStateChange((event, session) => {
    if (event === 'SIGNED_IN' && session?.user) {
      setState({ user: session.user });
      loadFromSupabase();
    } else if (event === 'SIGNED_OUT') {
      setState({
        user: null, userRole: null, loading: false,
        rawPatients: [], studies: {}, providers: [], profiles: [],
        recontactCases: {}, providerAssignments: {},
        emailedPatients: new Set(), patientNotes: {},
      });
    }
  });
}

export async function signOut() {
  try { localStorage.removeItem('myafrodna_userRole'); } catch {}
  await supabase.auth.signOut();
}

// ── Refresh recontact events from Supabase into the cache ────────────────────

export async function refreshRecontactEvents() {
  const { data, error } = await supabase.from('recontact_events').select('*');
  if (error) { console.error('[refreshRecontactEvents]', error.message); return; }

  const providersByUuid = Object.fromEntries(getState().providers.map(p => [p._sbId, p]));
  const uuidToAppId = Object.fromEntries(getState().rawPatients.map(p => [p._sbId, p.id]));

  const recontactCases = {};
  for (const row of (data ?? [])) {
    const appId = uuidToAppId[row.patient_id];
    if (appId) {
      const existing = getState().recontactCases[appId];
      const updated = dbEventToCase(row, appId, providersByUuid);
      // Preserve local history that hasn't been synced yet
      recontactCases[appId] = { ...updated, history: existing?.history ?? updated.history };
    }
  }
  setState({ recontactCases });
}

// ── Bootstrap: load all data from Supabase into the store ────────────────────

export async function loadFromSupabase() {
  setState({ loading: true });

  let profilesData;
  const [
    { data: studiesData,   error: e1 },
    { data: patientsData,  error: e2 },
    { data: providersData, error: e3 },
    { data: eventsData,    error: e4 },
    { data: notesData,     error: e5 },
    { data: rulesData,     error: e6 },
    { data: _profilesData, error: e7 },
  ] = await Promise.all([
    supabase.from('studies').select('*').order('id'),
    supabase.from('patients').select('*').order('myafrodna_id'),
    supabase.from('providers').select('*').order('name'),
    supabase.from('recontact_events').select('*'),
    supabase.from('notes').select('*').order('created_at', { ascending: false }),
    supabase.from('recontact_rules').select('*').order('study_id').order('created_at'),
    supabase.from('profiles').select('*').order('created_at'),
  ]);

  profilesData = _profilesData ?? [];

  for (const err of [e1, e2, e3, e4, e5, e6, e7]) {
    if (err) console.error('[dataService] load error:', err.message);
  }

  // Determine current user's role from profiles.
  const currentUserId = getState().user?.id;
  let myProfile = profilesData.find(p => p.id === currentUserId);

  if (!myProfile && currentUserId) {
    const { data: selfRow } = await supabase
      .from('profiles').select('*').eq('id', currentUserId).maybeSingle();
    if (selfRow) {
      myProfile = selfRow;
      profilesData.push(selfRow);
    }
  }

  // If RLS blocks all reads, fall back to localStorage cache
  let userRole = myProfile?.role ?? null;
  if (userRole) {
    try { localStorage.setItem('myafrodna_userRole', userRole); } catch {}
  } else {
    try { userRole = localStorage.getItem('myafrodna_userRole'); } catch {}
  }

  // Studies
  const studies = Object.fromEntries(
    (studiesData ?? []).map(s => [s.id, dbStudyToStore(s)])
  );

  // Providers — keyed by UUID for event lookup
  const providers = (providersData ?? []).map(dbProviderToStore);
  const providersByUuid = Object.fromEntries(providers.map(p => [p._sbId, p]));

  // Patients — build UUID→appId map for downstream joins
  const uuidToAppId = {};
  const rawPatients = (patientsData ?? []).map(row => {
    const raw = dbPatientToRaw(row);
    uuidToAppId[row.id] = raw.id;
    return raw;
  });

  // Provider assignments: patients.assigned_provider_id → providerAssignments map
  const providerAssignments = {};
  for (const row of (patientsData ?? [])) {
    if (row.assigned_provider_id) {
      const prov = providersByUuid[row.assigned_provider_id];
      if (prov) providerAssignments[uuidToAppId[row.id]] = prov.name;
    }
  }

  // Recontact events
  const recontactCases = {};
  for (const row of (eventsData ?? [])) {
    const appId = uuidToAppId[row.patient_id];
    if (appId) recontactCases[appId] = dbEventToCase(row, appId, providersByUuid);
  }

  // Annotate patients from their recontact event so classifyPatient works
  const annotatedPatients = rawPatients.map(p => {
    const ev = recontactCases[p.id];
    if (!ev) return p;
    if (ev.flaggedBy === 'manual') {
      return { ...p, manualFlag: { reason: ev.flagReason, priority: ev.priority ?? 'Medium', flaggedDate: ev.stageEnteredAt, notes: '' } };
    }
    // auto-flagged: annotate with _ruleMatch for classifyPatient
    return { ...p, _ruleMatch: { priority: ev.priority ?? 'Medium', reason: ev.flagReason } };
  });

  // Notes
  const patientNotes = {};
  for (const row of (notesData ?? [])) {
    const appId = uuidToAppId[row.patient_id];
    if (appId) {
      patientNotes[appId] = [...(patientNotes[appId] ?? []), dbNoteToStore(row)];
    }
  }

  setState({
    studies, providers, providerAssignments, recontactCases, patientNotes,
    rawPatients: annotatedPatients,
    rules: rulesData ?? [],
    profiles: profilesData ?? [],
    userRole,
    loading: false,
  });
}

// ── Studies ───────────────────────────────────────────────────────────────────

export async function getStudies() {
  return Object.values(getState().studies);
}

export async function getStudy(studyId) {
  return getState().studies[studyId] ?? null;
}

export async function createStudy(studyData) {
  const { data, error } = await supabase.from('studies').insert({
    id:                 studyData.id,
    name:               studyData.name,
    description:        studyData.description ?? null,
    column_definitions: studyData.columnDefinitions ?? [],
  }).select().single();
  if (error) throw error;
  const study = dbStudyToStore(data);
  setState(s => ({ studies: { ...s.studies, [study.id]: study } }));
  return study;
}

export async function updateStudy(studyId, updates) {
  const { data, error } = await supabase.from('studies')
    .update({ name: updates.name, description: updates.description, column_definitions: updates.columnDefinitions })
    .eq('id', studyId).select().single();
  if (error) throw error;
  const study = dbStudyToStore(data);
  setState(s => ({ studies: { ...s.studies, [studyId]: study } }));
  return study;
}

export async function setActiveStudy(studyId) {
  setState({ activeStudyId: studyId ?? null });
}

// ── Patients ──────────────────────────────────────────────────────────────────

export async function getPatients(filters) {
  let results = getState().rawPatients.map(classifyPatient);
  if (filters?.studyId)       results = results.filter(p => p.studyId === filters.studyId);
  if (filters?.flagged !== undefined) results = results.filter(p => p.flagged === filters.flagged);
  if (filters?.priority)      results = results.filter(p => p.priority === filters.priority);
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

export async function getMasterPatientList(filters) {
  return getPatients(filters);
}

export async function createPatient(patientData) {
  const row = rawPatientToDbRow({ ...patientData, contactPathway: patientData.contactPathway ?? detectContactPathway(patientData) });
  const { data, error } = await supabase.from('patients')
    .upsert(row, { onConflict: 'study_id,myafrodna_id' })
    .select().single();
  if (error) throw error;
  const raw = dbPatientToRaw(data);
  setState(s => ({
    rawPatients: [...s.rawPatients.filter(p => p.id !== raw.id), raw],
  }));
  return classifyPatient(raw);
}

export async function updatePatient(patientId, updates) {
  const sbId = getPatientSbId(patientId);
  if (!sbId) return null;

  // Snapshot existing values so we can log field-level changes after the write.
  const existing = getState().rawPatients.find(p => p.id === patientId);
  const oldValues = {};
  if (existing) {
    for (const k of Object.keys(updates)) oldValues[k] = existing[k];
  }

  // Separate common fields from study_data updates
  const { age, gender, sex, lga, tribe, language, contactPathway, phone, email, manualFlag, ...studyUpdates } = updates;
  const commonUpdates = Object.fromEntries(
    Object.entries({ age, gender: gender ?? sex, lga, tribe, language, contact_pathway: contactPathway, phone, email })
      .filter(([, v]) => v !== undefined)
  );

  // Merge study_data with existing
  const currentStudyData = {};
  if (existing) {
    for (const [k, v] of Object.entries(existing)) {
      if (!PATIENT_COMMON_KEYS.has(k)) currentStudyData[k] = v;
    }
  }

  const { data, error } = await supabase.from('patients')
    .update({ ...commonUpdates, study_data: { ...currentStudyData, ...studyUpdates } })
    .eq('id', sbId).select().single();
  if (error) throw error;
  const raw = dbPatientToRaw(data);
  setState(s => ({
    rawPatients: s.rawPatients.map(p => p.id === patientId ? raw : p),
  }));

  // Log each changed field as a system note (audit trail). Best-effort; a
  // failure to insert a note should not fail the update itself.
  try {
    await logFieldChanges(patientId, sbId, oldValues, updates);
  } catch (err) {
    console.warn('[updatePatient] could not log edit history:', err.message);
  }

  return classifyPatient(raw);
}

// Format a value for the audit log
function formatForLog(v) {
  if (v === null || v === undefined || v === '') return '(empty)';
  if (typeof v === 'boolean') return v ? 'Yes' : 'No';
  return String(v);
}

async function logFieldChanges(appPatientId, patientSbId, oldValues, newValues) {
  const rows = [];
  for (const [field, newVal] of Object.entries(newValues)) {
    const oldVal = oldValues[field];
    // Only log real changes
    if (oldVal === newVal) continue;
    if (oldVal == null && (newVal == null || newVal === '')) continue;
    rows.push({
      patient_id: patientSbId,
      text:       `${field} changed from "${formatForLog(oldVal)}" to "${formatForLog(newVal)}"`,
      note_type:  'system',
    });
  }
  if (rows.length === 0) return;
  const { data, error } = await supabase.from('notes').insert(rows).select();
  if (error) throw error;

  // Push the new notes into the store so the Patient modal shows them immediately
  const notes = (data ?? []).map(dbNoteToStore);
  setState(s => ({
    patientNotes: {
      ...s.patientNotes,
      [appPatientId]: [...notes, ...(s.patientNotes[appPatientId] ?? [])],
    },
  }));
}

// Bulk update — one field to the same value across many patients. Uses
// Promise.all of individual updates so the existing audit log / study_data
// merge logic runs for each patient.
export async function bulkUpdatePatients(patientIds, updates) {
  const results = await Promise.allSettled(
    patientIds.map(id => updatePatient(id, updates))
  );
  const failed = results.filter(r => r.status === 'rejected');
  if (failed.length > 0) {
    const first = failed[0].reason;
    throw new Error(
      `${failed.length} of ${patientIds.length} update${patientIds.length !== 1 ? 's' : ''} failed: ${first?.message ?? 'unknown error'}`
    );
  }
  return results.length - failed.length;
}

// Add a new column definition to a study. Appends to column_definitions and
// refreshes the study in the local cache.
export async function addStudyColumn(studyId, { key, label, type }) {
  const { data: studyRow, error: readErr } = await supabase
    .from('studies').select('column_definitions').eq('id', studyId).single();
  if (readErr) throw readErr;

  const existing = Array.isArray(studyRow?.column_definitions) ? studyRow.column_definitions : [];
  if (existing.some(c => c.key === key)) {
    throw new Error(`Column "${key}" already exists in this study.`);
  }
  const next = [...existing, { key, label, type: type ?? 'text' }];

  const { data, error } = await supabase.from('studies')
    .update({ column_definitions: next })
    .eq('id', studyId)
    .select()
    .single();
  if (error) throw error;

  const study = dbStudyToStore(data);
  setState(s => ({ studies: { ...s.studies, [studyId]: study } }));
  return study;
}

export async function importPatients(studyId, rows) {
  const incoming = rows.map(r => ({
    ...r,
    studyId: studyId ?? r.studyId,
    contactPathway: r.contactPathway ?? detectContactPathway(r),
  }));

  const dbRows = incoming.map(rawPatientToDbRow);
  const { data, error } = await supabase.from('patients')
    .upsert(dbRows, { onConflict: 'study_id,myafrodna_id' })
    .select();
  if (error) throw error;

  const rawPatients = (data ?? []).map(dbPatientToRaw);
  setState(s => ({
    rawPatients: [
      ...s.rawPatients.filter(p => p.studyId !== studyId),
      ...rawPatients,
    ],
  }));
  return rawPatients.map(classifyPatient);
}

export async function importFullWorkbook(studiesData) {
  for (const { studyId, studyMeta, rows } of studiesData) {
    const category = studyMeta.category ?? inferCategory(studyId);
    // Upsert study
    await supabase.from('studies').upsert({
      id: studyId, name: studyMeta.name ?? studyId,
      description: studyMeta.description ?? null,
      column_definitions: studyMeta.columnDefinitions ?? [],
    }, { onConflict: 'id' });
    // Upsert patients
    await importPatients(studyId, rows);
  }
  // Run active rules for newly imported studies and return results
  const ruleResults = {};
  for (const { studyId } of studiesData) {
    ruleResults[studyId] = await runRulesForStudy(studyId);
  }

  // Full refresh so dashboard and sidebar reflect all newly imported studies/patients
  await loadFromSupabase();

  return ruleResults;
}

// ── Providers ─────────────────────────────────────────────────────────────────

export async function getProviders() {
  return [...getState().providers];
}

export async function getProvider(providerId) {
  return getState().providers.find(p => p.id === providerId) ?? null;
}

export async function createProvider(providerData) {
  const { data, error } = await supabase.from('providers').insert({
    name:                    providerData.name,
    specialty:               providerData.specialty ?? null,
    facility:                providerData.facility ?? null,
    phone:                   providerData.phone ?? null,
    email:                   providerData.email ?? null,
    preferred_contact_method: providerData.preferredContact ?? 'Email',
  }).select().single();
  if (error) throw error;
  const provider = dbProviderToStore(data);
  setState(s => ({ providers: [...s.providers, provider] }));
  return provider;
}

export async function updateProvider(providerId, updates) {
  const { data, error } = await supabase.from('providers').update({
    name:                    updates.name,
    specialty:               updates.specialty,
    facility:                updates.facility,
    phone:                   updates.phone,
    email:                   updates.email,
    preferred_contact_method: updates.preferredContact,
  }).eq('id', providerId).select().single();
  if (error) throw error;
  const provider = dbProviderToStore(data);
  setState(s => ({ providers: s.providers.map(p => p.id === providerId ? provider : p) }));
  return provider;
}

export async function removeProvider(providerId) {
  const { error } = await supabase.from('providers').delete().eq('id', providerId);
  if (error) throw error;
  setState(s => ({ providers: s.providers.filter(p => p.id !== providerId) }));
}

export async function assignProvider(patientId, providerName) {
  const patientSbId  = getPatientSbId(patientId);
  const providerSbId = providerName ? getProviderSbId(providerName) : null;
  if (!patientSbId) return;

  await supabase.from('patients')
    .update({ assigned_provider_id: providerSbId })
    .eq('id', patientSbId);

  const eventSbId = getEventSbId(patientId);
  if (eventSbId) {
    await supabase.from('recontact_events')
      .update({ assigned_provider_id: providerSbId })
      .eq('id', eventSbId);
  }

  setState(s => {
    const providerAssignments = { ...s.providerAssignments };
    if (providerName === null) delete providerAssignments[patientId];
    else providerAssignments[patientId] = providerName;
    const recontactCases = s.recontactCases[patientId]
      ? { ...s.recontactCases, [patientId]: { ...s.recontactCases[patientId], assignedProvider: providerName } }
      : s.recontactCases;
    return { providerAssignments, recontactCases };
  });
}

// ── Recontact workflow ────────────────────────────────────────────────────────

export async function getRecontactEvents(filters) {
  let results = Object.values(getState().recontactCases);
  if (filters?.patientId) results = results.filter(c => c.patientId === filters.patientId);
  if (filters?.stage)     results = results.filter(c => c.stage === filters.stage);
  return results;
}

export async function createRecontactEvent(eventData) {
  const { patientId } = eventData;
  if (getState().recontactCases[patientId]) return getState().recontactCases[patientId];

  const patientSbId = getPatientSbId(patientId);
  const patient = getState().rawPatients.find(p => p.id === patientId);
  if (!patientSbId || !patient) return null;

  const now = new Date().toISOString();
  const { data, error } = await supabase.from('recontact_events').upsert({
    patient_id: patientSbId,
    study_id:   patient.studyId,
    status:     'flagged',
    flagged_by: eventData.flaggedBy ?? 'auto',
    reason:     eventData.flagReason ?? null,
    flagged_at: now,
  }, { onConflict: 'patient_id' }).select().single();
  if (error) { console.error('[createRecontactEvent]', error.message); return null; }

  const providersByUuid = Object.fromEntries(getState().providers.map(p => [p._sbId, p]));
  const caseRecord = dbEventToCase(data, patientId, providersByUuid);
  setState(s => ({ recontactCases: { ...s.recontactCases, [patientId]: caseRecord } }));
  return caseRecord;
}

export async function updateRecontactStatus(patientId, toStage, payload) {
  const eventSbId = getEventSbId(patientId);
  if (!eventSbId) return null;

  const now = new Date().toISOString();
  const providerSbId = payload.providerAssigned ? getProviderSbId(payload.providerAssigned) : null;

  const updates = {
    status: toStage,
    [`${toStage}_at`]: now,
    ...(providerSbId ? { assigned_provider_id: providerSbId } : {}),
  };
  const { data, error } = await supabase.from('recontact_events')
    .update(updates).eq('id', eventSbId).select().single();
  if (error) throw error;

  // Add a system note for the transition
  const patientSbId = getPatientSbId(patientId);
  if (patientSbId && payload.note) {
    await supabase.from('notes').insert({
      patient_id: patientSbId,
      text:       payload.note,
      note_type:  'system',
    });
  }

  const providersByUuid = Object.fromEntries(getState().providers.map(p => [p._sbId, p]));
  const existing = getState().recontactCases[patientId];
  const newProvider = payload.providerAssigned || existing?.assignedProvider;
  const historyEntry = {
    from: existing?.stage, to: toStage, timestamp: now,
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

  const updated = dbEventToCase(data, patientId, providersByUuid);
  const merged = {
    ...updated,
    assignedProvider: newProvider,
    history: [...(existing?.history ?? []), historyEntry],
  };

  setState(s => {
    const providerAssignments = payload.providerAssigned
      ? { ...s.providerAssignments, [patientId]: payload.providerAssigned }
      : s.providerAssignments;
    return {
      recontactCases: { ...s.recontactCases, [patientId]: merged },
      providerAssignments,
    };
  });

  // Re-sync all recontact events from Supabase so counts stay accurate everywhere
  refreshRecontactEvents();

  return merged;
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
  return { contactPathway: patient.contactPathway ?? null, contactDetails: patient.contactDetails ?? null };
}

export async function updateContactDetails(patientId, details) {
  const current = getState().rawPatients.find(p => p.id === patientId);
  const updates = { ...details };
  if (current?.contactPathway === 'none' && (details.phone || details.email)) {
    updates.contactPathway = 'direct';
  }
  return updatePatient(patientId, updates);
}

// ── Manual flagging ───────────────────────────────────────────────────────────

export async function manuallyFlagPatients(patientIds, { reason, priority = 'Medium', notes: noteText = '' }) {
  const now = new Date().toISOString();

  for (const appId of patientIds) {
    const patientSbId = getPatientSbId(appId);
    const patient = getState().rawPatients.find(p => p.id === appId);
    if (!patientSbId || !patient) continue;

    const { data, error } = await supabase.from('recontact_events').upsert({
      patient_id: patientSbId,
      study_id:   patient.studyId,
      status:     'flagged',
      reason,
      priority,
      flagged_by: 'manual',
      flagged_at: now,
      notes:      noteText || null,
    }, { onConflict: 'patient_id' }).select().single();
    if (error) { console.error('[manuallyFlagPatients]', error.message); continue; }

    if (noteText) {
      await supabase.from('notes').insert({
        patient_id: patientSbId,
        text:       noteText,
        note_type:  'manual',
      });
    }

    const providersByUuid = Object.fromEntries(getState().providers.map(p => [p._sbId, p]));
    const caseRecord = dbEventToCase(data, appId, providersByUuid);

    setState(s => ({
      rawPatients: s.rawPatients.map(p => {
        if (p.id !== appId) return p;
        return { ...p, manualFlag: { reason, priority, notes: noteText, flaggedDate: now } };
      }),
      recontactCases: { ...s.recontactCases, [appId]: caseRecord },
    }));
  }
}

export async function removeManualFlag(patientId) {
  const eventSbId = getEventSbId(patientId);
  if (eventSbId) {
    await supabase.from('recontact_events')
      .update({ flagged_by: 'auto', reason: null })
      .eq('id', eventSbId);
  }
  setState(s => ({
    rawPatients: s.rawPatients.map(p => {
      if (p.id !== patientId) return p;
      const { manualFlag: _, ...rest } = p;
      return rest;
    }),
  }));
}

// ── Bulk provider assignment ──────────────────────────────────────────────────

export async function bulkAssignProvider(patientIds, providerName) {
  await Promise.all(patientIds.map(id => assignProvider(id, providerName)));
}

// ── Patient notes ─────────────────────────────────────────────────────────────

export async function addPatientNote(patientId, text, type = 'manual') {
  const patientSbId = getPatientSbId(patientId);
  if (!patientSbId) {
    // Fallback: in-memory only (e.g. demo mode)
    const note = { id: crypto.randomUUID(), text, timestamp: new Date().toISOString(), type };
    setState(s => ({
      patientNotes: { ...s.patientNotes, [patientId]: [note, ...(s.patientNotes[patientId] ?? [])] },
    }));
    return note;
  }

  const { data, error } = await supabase.from('notes').insert({
    patient_id: patientSbId,
    text,
    note_type: type,
  }).select().single();
  if (error) throw error;

  const note = dbNoteToStore(data);
  setState(s => ({
    patientNotes: { ...s.patientNotes, [patientId]: [note, ...(s.patientNotes[patientId] ?? [])] },
  }));
  return note;
}

export async function getPatientNotes(patientId) {
  return getState().patientNotes[patientId] ?? [];
}

// ── Column visibility ─────────────────────────────────────────────────────────

export async function setVisibleColumns(columns) {
  setState({ visibleColumns: columns });
}

// ── Email tracking (in-memory only) ──────────────────────────────────────────

export async function markEmailed(patientId) {
  setState(s => ({ emailedPatients: new Set([...s.emailedPatients, patientId]) }));
}

// ── Reports ───────────────────────────────────────────────────────────────────

export async function getReportData(filters) {
  const [patients, providers, recontactEvents] = await Promise.all([
    getPatients(filters), getProviders(), getRecontactEvents(filters),
  ]);
  return { patients, providers, recontactCases: recontactEvents, providerAssignments: { ...getState().providerAssignments } };
}

// ── Demo data — seeds Supabase then reloads ───────────────────────────────────

export async function loadDemoData() {
  setState({ loading: true });

  // 0. Ensure the current user has the admin role so RLS allows all writes below.
  //    "profiles: self manage" allows each user to upsert their own row.
  const { user } = getState();
  if (user?.id) {
    const { error: profileErr } = await supabase
      .from('profiles')
      .upsert({ id: user.id, role: 'admin' }, { onConflict: 'id' });
    if (profileErr) console.error('[loadDemoData] profile upsert:', profileErr.message);
  }

  // 1. Upsert studies
  const studyRows = Object.values(DEMO_STUDIES).map(s => ({
    id:                 s.id,
    name:               s.name,
    description:        s.description ?? null,
    column_definitions: (s.headers ?? []).map(k => ({ key: k, label: k, type: 'text' })),
  }));
  const { error: studiesErr } = await supabase.from('studies').upsert(studyRows, { onConflict: 'id' });
  if (studiesErr) console.error('[loadDemoData] studies upsert:', studiesErr.message);

  // 2. Upsert providers
  const { data: provRows } = await supabase.from('providers').upsert(
    DEMO_PROVIDERS.map(p => ({
      name:                    p.name,
      specialty:               p.specialty ?? null,
      facility:                p.facility ?? null,
      phone:                   p.phone ?? null,
      email:                   p.email ?? null,
      preferred_contact_method: p.preferredContact ?? 'Email',
    })),
    { onConflict: 'name' }
  ).select();
  const providersByName = Object.fromEntries((provRows ?? []).map(p => [p.name, p.id]));

  // 3. Upsert patients
  const patientRows = DEMO_PATIENTS.map(p => ({
    ...rawPatientToDbRow({
      ...p,
      contactPathway: p.contactPathway ?? detectContactPathway(p),
    }),
  }));
  const { data: patRows } = await supabase.from('patients')
    .upsert(patientRows, { onConflict: 'study_id,myafrodna_id' })
    .select('id, myafrodna_id');
  const patientUuidByAppId = Object.fromEntries((patRows ?? []).map(r => [r.myafrodna_id, r.id]));

  // 4. Upsert recontact events for flagged demo patients
  const flaggedDemo = DEMO_PATIENTS.map(p => classifyPatient({ ...p, contactPathway: p.contactPathway ?? detectContactPathway(p) })).filter(p => p.flagged);
  const now = new Date().toISOString();
  const eventRows = flaggedDemo.map(p => {
    const patSbId = patientUuidByAppId[p.id];
    if (!patSbId) return null;
    return {
      patient_id: patSbId,
      study_id:   p.studyId,
      status:     'flagged',
      flagged_by: p.flaggedBy ?? 'auto',
      reason:     p.manualFlag?.reason ?? null,
      priority:   p.priority ?? 'Medium',
      flagged_at: now,
    };
  }).filter(Boolean);

  if (eventRows.length > 0) {
    await supabase.from('recontact_events').upsert(eventRows, { onConflict: 'patient_id' });
  }

  // 5. Insert pre-seeded notes
  const noteRows = [];
  for (const [appId, notes] of Object.entries(DEMO_NOTES)) {
    const patSbId = patientUuidByAppId[appId];
    if (!patSbId) continue;
    for (const n of notes) {
      noteRows.push({ patient_id: patSbId, text: n.text, note_type: n.type });
    }
  }
  if (noteRows.length > 0) {
    await supabase.from('notes').upsert(noteRows, { ignoreDuplicates: true });
  }

  // 6. Seed default rules (no-op if already exist)
  await seedDefaultRules();

  // 7. Reload everything from DB
  await loadFromSupabase();

  // 8. Ensure admin role is set — loadFromSupabase may fail to read it due to RLS
  setState({ userRole: 'admin' });
  try { localStorage.setItem('myafrodna_userRole', 'admin'); } catch {}

  // 9. Run rules to auto-flag matching patients
  await runAllRules();
}

// ── Legacy helpers (kept for compatibility) ───────────────────────────────────

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

export async function getGenotypingResults(patientId) {
  const patient = await getPatient(patientId);
  if (!patient) return null;
  return { genotype: patient.genotype, genotypingComplete: patient.genotypingComplete, genotypingDate: patient.genotypingDate, phenotype: patient.phenotype, priority: patient.priority, flagged: patient.flagged };
}

export async function updateGenotypingResult(patientId, result) {
  return updatePatient(patientId, result);
}

// ── Rules CRUD ────────────────────────────────────────────────────────────────

export async function getRules(studyId) {
  const q = supabase.from('recontact_rules').select('*').order('study_id').order('created_at');
  if (studyId) q.eq('study_id', studyId);
  const { data, error } = await q;
  if (error) throw error;
  setState({ rules: data ?? [] });
  return data ?? [];
}

export async function createRule(ruleData) {
  const { data, error } = await supabase.from('recontact_rules').insert({
    study_id:        ruleData.study_id,
    column_name:     ruleData.column_name,
    operator:        ruleData.operator,
    value:           ruleData.value ?? null,
    priority:        ruleData.priority ?? 'Medium',
    reason_template: ruleData.reason_template,
    is_active:       ruleData.is_active ?? true,
  }).select().single();
  if (error) throw error;
  setState(s => ({ rules: [...s.rules, data] }));
  return data;
}

export async function updateRule(ruleId, updates) {
  const { data, error } = await supabase.from('recontact_rules')
    .update({
      column_name:     updates.column_name,
      operator:        updates.operator,
      value:           updates.value ?? null,
      priority:        updates.priority,
      reason_template: updates.reason_template,
      is_active:       updates.is_active,
      study_id:        updates.study_id,
    })
    .eq('id', ruleId).select().single();
  if (error) throw error;
  setState(s => ({ rules: s.rules.map(r => r.id === ruleId ? data : r) }));
  return data;
}

export async function deleteRule(ruleId) {
  const { error } = await supabase.from('recontact_rules').delete().eq('id', ruleId);
  if (error) throw error;
  setState(s => ({ rules: s.rules.filter(r => r.id !== ruleId) }));
}

export async function toggleRule(ruleId, isActive) {
  return updateRule(ruleId, { ...getState().rules.find(r => r.id === ruleId), is_active: isActive });
}

// Seeds default CYP2C19 rules for CLOP1 and CLOP-2.
// Checks per-study so it won't skip if the user has added rules for other studies.
export async function seedDefaultRules() {
  const CLOP_STUDIES = ['CLOP1', 'CLOP-2'];

  // Find which of the two CLOP studies already have at least one rule
  const { data: existing } = await supabase
    .from('recontact_rules')
    .select('study_id')
    .in('study_id', CLOP_STUDIES);
  const alreadySeeded = new Set((existing ?? []).map(r => r.study_id));

  const ALL_DEFAULTS = [
    { study_id: 'CLOP1',  column_name: 'genotype', operator: 'eq', value: '*17/*17',                   priority: 'High',   reason_template: 'Ultra-rapid metabolizer (*17/*17) — likely needs alternative drug or dose increase',              is_active: true },
    { study_id: 'CLOP1',  column_name: 'genotype', operator: 'eq', value: '*2/*2',                     priority: 'High',   reason_template: 'Poor metabolizer (*2/*2) — clopidogrel likely ineffective, needs alternative',                    is_active: true },
    { study_id: 'CLOP1',  column_name: 'genotype', operator: 'in', value: '*1/*17, *2/*17',            priority: 'Medium', reason_template: 'Rapid/variable metabolizer — monitor, may need dose adjustment',                                  is_active: true },
    { study_id: 'CLOP1',  column_name: 'genotype', operator: 'in', value: '*1/*2, *1/*3',              priority: 'Medium', reason_template: 'Intermediate metabolizer — reduced efficacy possible, monitor',                                   is_active: true },
    { study_id: 'CLOP-2', column_name: 'genotype', operator: 'eq', value: '*17/*17',                   priority: 'High',   reason_template: 'Ultra-rapid metabolizer (*17/*17) — actionable CYP2C19 variant, clinical review required',       is_active: true },
    { study_id: 'CLOP-2', column_name: 'genotype', operator: 'eq', value: '*2/*2',                     priority: 'High',   reason_template: 'Poor metabolizer (*2/*2) — actionable CYP2C19 variant, clinical review required',                is_active: true },
    { study_id: 'CLOP-2', column_name: 'genotype', operator: 'in', value: '*1/*17, *1/*2, *1/*3, *2/*17', priority: 'Medium', reason_template: 'CYP2C19 variant detected — monitoring recommended',                                       is_active: true },
  ];

  const toInsert = ALL_DEFAULTS.filter(r => !alreadySeeded.has(r.study_id));
  if (toInsert.length === 0) return;

  const { error } = await supabase.from('recontact_rules').insert(toInsert);
  if (error) {
    console.error('[seedDefaultRules]', error.message);
    return;
  }
  const { data } = await supabase.from('recontact_rules').select('*').order('study_id').order('created_at');
  setState({ rules: data ?? [] });
}

// ── Reset — wipe all data from Supabase and clear local cache ────────────────

// ── User management ──────────────────────────────────────────────────────────

export async function loadProfiles() {
  const { data, error } = await supabase.from('profiles').select('*').order('created_at');
  if (error) { console.error('[loadProfiles]', error.message); return []; }
  setState({ profiles: data ?? [] });
  return data ?? [];
}

export async function updateUserRole(userId, role) {
  const { data, error } = await supabase.from('profiles')
    .update({ role })
    .eq('id', userId)
    .select();
  if (error) throw error;
  const updated = data?.[0];
  if (!updated) throw new Error('Update returned no rows — check RLS policies on profiles table.');
  setState(s => ({
    profiles: s.profiles.map(p => p.id === userId ? updated : p),
  }));
  return updated;
}

export async function updateUserStudies(userId, assignedStudies) {
  const { data, error } = await supabase.from('profiles')
    .update({ assigned_studies: assignedStudies })
    .eq('id', userId)
    .select();
  if (error) throw error;
  const updated = data?.[0];
  if (!updated) throw new Error('Update returned no rows — check RLS policies on profiles table.');
  setState(s => ({
    profiles: s.profiles.map(p => p.id === userId ? updated : p),
  }));
  return updated;
}

export async function createUserAccount(email, name, password) {
  const { data, error } = await supabase.auth.signUp({ email, password });
  if (error) throw error;

  // Create profile row for the new user
  if (data?.user?.id) {
    await supabase.from('profiles').upsert({
      id: data.user.id,
      email,
      name: name || null,
      role: 'provider',
    }, { onConflict: 'id' });
    await loadProfiles();
  }

  return { user: data.user, email, password };
}

// ── Delete a single study and all its dependent data ────────────────────────

export async function deleteStudy(studyId) {
  // 1. Get patient UUIDs for this study (needed for notes/events cascade)
  const { data: patRows, error: patErr } = await supabase
    .from('patients').select('id').eq('study_id', studyId);
  if (patErr) throw patErr;
  const patientIds = (patRows ?? []).map(p => p.id);

  // 2. Delete in FK order: notes → events → patients → rules → study
  if (patientIds.length > 0) {
    const { error: noteErr } = await supabase.from('notes').delete().in('patient_id', patientIds);
    if (noteErr) throw noteErr;
    const { error: evErr } = await supabase.from('recontact_events').delete().in('patient_id', patientIds);
    if (evErr) throw evErr;
    const { error: pDelErr } = await supabase.from('patients').delete().eq('study_id', studyId);
    if (pDelErr) throw pDelErr;
  }
  const { error: ruleErr } = await supabase.from('recontact_rules').delete().eq('study_id', studyId);
  if (ruleErr) throw ruleErr;
  const { error: studyErr } = await supabase.from('studies').delete().eq('id', studyId);
  if (studyErr) throw studyErr;

  // 3. Refresh local cache
  await loadFromSupabase();
}

// ── Reset — wipe all data from Supabase and clear local cache ────────────────

export async function resetAllData() {
  // Delete children before parents (FK order)
  await supabase.from('notes').delete().gte('created_at', '1970-01-01');
  await supabase.from('recontact_events').delete().gte('created_at', '1970-01-01');
  await supabase.from('patients').delete().gte('created_at', '1970-01-01');
  await supabase.from('providers').delete().gte('created_at', '1970-01-01');
  await supabase.from('recontact_rules').delete().gte('created_at', '1970-01-01');
  await supabase.from('studies').delete().gte('created_at', '1970-01-01');

  setState({
    rawPatients: [], studies: {}, providers: [],
    recontactCases: {}, providerAssignments: {},
    emailedPatients: new Set(), patientNotes: {}, rules: [],
    loading: false,
  });
}
