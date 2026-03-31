import { supabase } from '../lib/supabase';
import useAppStore from '../store/appStore';

const getState = () => useAppStore.getState();
const setState = (u) => useAppStore.setState(u);

// ── Evaluation helpers ────────────────────────────────────────────────────────

function getFieldValue(patient, columnName) {
  if (columnName in patient) return patient[columnName];
  const lower = columnName.toLowerCase();
  for (const [k, v] of Object.entries(patient)) {
    if (k.toLowerCase() === lower) return v;
  }
  return undefined;
}

function evaluateRule(patient, rule) {
  const raw      = getFieldValue(patient, rule.column_name);
  const fieldStr = String(raw ?? '').trim().toLowerCase();
  const ruleVal  = String(rule.value ?? '').trim();

  switch (rule.operator) {
    case 'eq':        return fieldStr === ruleVal.toLowerCase();
    case 'neq':       return fieldStr !== ruleVal.toLowerCase();
    case 'contains':  return fieldStr.includes(ruleVal.toLowerCase());
    case 'gt':        { const n = parseFloat(raw); return !isNaN(n) && n > parseFloat(ruleVal); }
    case 'lt':        { const n = parseFloat(raw); return !isNaN(n) && n < parseFloat(ruleVal); }
    case 'in':        return ruleVal.split(',').map(v => v.trim().toLowerCase()).includes(fieldStr);
    case 'not_empty': return raw !== null && raw !== undefined && String(raw).trim() !== '';
    case 'is_empty':  return raw === null || raw === undefined || String(raw).trim() === '';
    default:          return false;
  }
}

// Returns matched rules for a patient: [{ ruleId, priority, reason }]
export function evaluatePatient(patient, rules) {
  return rules
    .filter(r => r.is_active !== false)
    .filter(r => evaluateRule(patient, r))
    .map(r => ({ ruleId: r.id, priority: r.priority, reason: r.reason_template }));
}

// Fetch active rules for a study
export async function getRulesForStudy(studyId) {
  const { data, error } = await supabase
    .from('recontact_rules')
    .select('*')
    .eq('study_id', studyId)
    .order('created_at');
  if (error) { console.error('[getRulesForStudy]', error.message); return []; }
  return data ?? [];
}

// Fetch all rules (for rules management page)
export async function getAllRules() {
  const { data, error } = await supabase
    .from('recontact_rules')
    .select('*')
    .order('study_id')
    .order('created_at');
  if (error) { console.error('[getAllRules]', error.message); return []; }
  return data ?? [];
}

// Get unique column names available for a study (from loaded patients)
export function getStudyColumns(studyId) {
  const SKIP = new Set(['id', '_sbId', 'studyId', 'manualFlag', '_ruleMatch',
    'flagged', 'priority', 'phenotype', 'phenotypeShort', 'implication',
    'suggestedAction', 'flaggedBy', 'contactPathway', 'contactDetails']);
  const patients = getState().rawPatients.filter(p => p.studyId === studyId);
  const keys = new Set();
  for (const p of patients.slice(0, 30)) {
    for (const k of Object.keys(p)) {
      if (!SKIP.has(k) && !k.startsWith('_')) keys.add(k);
    }
  }
  const ALWAYS = ['age', 'gender', 'sex', 'lga', 'tribe', 'language', 'phone', 'email'];
  return [...new Set([...ALWAYS, ...[...keys].sort()])];
}

// Run all active rules for a study against all patients.
// Creates recontact_events for newly matched patients (skips existing).
// Returns { newlyFlagged, alreadyFlagged, noMatch }
export async function runRulesForStudy(studyId) {
  const rules = await getRulesForStudy(studyId);
  const activeRules = rules.filter(r => r.is_active);
  if (activeRules.length === 0) return { newlyFlagged: 0, alreadyFlagged: 0, noMatch: 0 };

  const patients      = getState().rawPatients.filter(p => p.studyId === studyId);
  const existingCases = getState().recontactCases;

  let newlyFlagged = 0, alreadyFlagged = 0, noMatch = 0;
  const toInsert       = [];
  const newAnnotations = {}; // appPatientId → _ruleMatch

  for (const patient of patients) {
    if (existingCases[patient.id]) { alreadyFlagged++; continue; }

    const matches = evaluatePatient(patient, activeRules);
    if (matches.length === 0) { noMatch++; continue; }

    const best = matches.find(m => m.priority === 'High') ?? matches[0];
    toInsert.push({
      patient_id: patient._sbId,
      study_id:   studyId,
      status:     'flagged',
      flagged_by: 'auto',
      reason:     best.reason,
      priority:   best.priority,
      flagged_at: new Date().toISOString(),
      notes:      `rule_id:${best.ruleId}`,
    });
    newAnnotations[patient.id] = { priority: best.priority, reason: best.reason };
    newlyFlagged++;
  }

  if (toInsert.length > 0) {
    const { data, error } = await supabase
      .from('recontact_events')
      .insert(toInsert)
      .select();

    if (error) {
      console.error('[runRulesForStudy insert]', error.message);
    } else {
      const uuidToAppId = Object.fromEntries(
        getState().rawPatients.map(p => [p._sbId, p.id])
      );
      setState(s => {
        const newCases = { ...s.recontactCases };
        for (const row of (data ?? [])) {
          const appId = uuidToAppId[row.patient_id];
          if (!appId) continue;
          newCases[appId] = {
            patientId:       appId,
            _sbId:           row.id,
            stage:           'flagged',
            stageEnteredAt:  row.flagged_at ?? row.created_at,
            assignedProvider: null,
            flaggedBy:       'auto',
            flagReason:      row.reason,
            priority:        row.priority,
            history: [{
              from: null, to: 'flagged', timestamp: row.created_at,
              note: row.reason ?? 'Auto-flagged by rules engine.',
              providerAssigned: null, notificationMethod: null, notificationDate: null,
              contactDate: null, contactNote: null, clinicalAction: null,
              clinicalNote: null, closingNote: null,
            }],
          };
        }
        const updatedPatients = s.rawPatients.map(p =>
          newAnnotations[p.id] ? { ...p, _ruleMatch: newAnnotations[p.id] } : p
        );
        return { recontactCases: newCases, rawPatients: updatedPatients };
      });
    }
  }

  return { newlyFlagged, alreadyFlagged, noMatch };
}

// Run rules across all studies
export async function runAllRules() {
  const studies = getState().studies;
  const totals  = { newlyFlagged: 0, alreadyFlagged: 0, noMatch: 0, total: 0 };
  for (const studyId of Object.keys(studies)) {
    const r = await runRulesForStudy(studyId);
    totals.newlyFlagged  += r.newlyFlagged;
    totals.alreadyFlagged += r.alreadyFlagged;
    totals.noMatch        += r.noMatch;
    totals.total          += r.newlyFlagged + r.alreadyFlagged + r.noMatch;
  }
  return totals;
}
