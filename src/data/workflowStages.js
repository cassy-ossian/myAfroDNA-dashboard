// Recontact workflow stage definitions.
// Stages are ordered — a patient moves left-to-right through these.
// The pathway determines which stages apply to each patient:
//   Provider / Both:  flagged → under_review → provider_notified → patient_contacted → followup_complete → closed
//   Direct:           flagged → under_review → patient_contacted → followup_scheduled → followup_complete → closed

export const STAGES = [
  {
    key: 'flagged',
    label: 'Flagged',
    description: 'Genotype result triggered a flag. No action taken yet.',
    color: 'red',
    bgClass: 'bg-red-50',
    borderClass: 'border-red-200',
    headerClass: 'bg-red-100 text-red-800',
    dotClass: 'bg-red-500',
    overdueAfterDays: 14,
  },
  {
    key: 'under_review',
    label: 'Under Review',
    description: 'Coordinator reviewing the case before notifying the provider or patient.',
    color: 'orange',
    bgClass: 'bg-orange-50',
    borderClass: 'border-orange-200',
    headerClass: 'bg-orange-100 text-orange-800',
    dotClass: 'bg-orange-500',
    overdueAfterDays: null,
  },
  {
    key: 'provider_notified',
    label: 'Provider Notified',
    description: 'Provider has been sent the recontact request. (Provider-mediated pathway.)',
    color: 'blue',
    bgClass: 'bg-blue-50',
    borderClass: 'border-blue-200',
    headerClass: 'bg-blue-100 text-blue-800',
    dotClass: 'bg-blue-500',
    overdueAfterDays: 7,
  },
  {
    key: 'patient_contacted',
    label: 'Patient Contacted',
    description: 'Patient has been contacted (directly or via provider).',
    color: 'purple',
    bgClass: 'bg-purple-50',
    borderClass: 'border-purple-200',
    headerClass: 'bg-purple-100 text-purple-800',
    dotClass: 'bg-purple-500',
    overdueAfterDays: null,
  },
  {
    key: 'followup_scheduled',
    label: 'Follow-Up Scheduled',
    description: 'Patient was directly contacted and a follow-up appointment is scheduled. (Direct pathway.)',
    color: 'violet',
    bgClass: 'bg-violet-50',
    borderClass: 'border-violet-200',
    headerClass: 'bg-violet-100 text-violet-800',
    dotClass: 'bg-violet-500',
    overdueAfterDays: null,
  },
  {
    key: 'followup_complete',
    label: 'Follow-Up Complete',
    description: 'Clinical follow-up action has been completed.',
    color: 'teal',
    bgClass: 'bg-teal-50',
    borderClass: 'border-teal-200',
    headerClass: 'bg-teal-100 text-teal-800',
    dotClass: 'bg-teal-500',
    overdueAfterDays: null,
  },
  {
    key: 'closed',
    label: 'Closed',
    description: 'Case resolved. No further action needed.',
    color: 'gray',
    bgClass: 'bg-gray-50',
    borderClass: 'border-gray-200',
    headerClass: 'bg-gray-100 text-gray-600',
    dotClass: 'bg-gray-400',
    overdueAfterDays: null,
  },
];

export const STAGE_KEYS = STAGES.map(s => s.key);

// Stage sequences per pathway
const PROVIDER_SEQUENCE = ['flagged','under_review','provider_notified','patient_contacted','followup_complete','closed'];
const DIRECT_SEQUENCE   = ['flagged','under_review','patient_contacted','followup_scheduled','followup_complete','closed'];

export function getStage(key) {
  return STAGES.find(s => s.key === key) || STAGES[0];
}

// Next stage using the full sequential list (used for drag-drop ordering checks).
export function getNextStage(key) {
  const idx = STAGE_KEYS.indexOf(key);
  if (idx < 0 || idx >= STAGES.length - 1) return null;
  return STAGES[idx + 1];
}

// Next stage for a specific contact pathway.
// Use this for "Move to next" buttons so that direct patients skip provider_notified
// and provider patients skip followup_scheduled.
export function getNextStageForPathway(key, pathway) {
  const seq = (pathway === 'direct') ? DIRECT_SEQUENCE : PROVIDER_SEQUENCE;
  const idx = seq.indexOf(key);
  if (idx < 0 || idx >= seq.length - 1) return null;
  return getStage(seq[idx + 1]);
}

// Stages that are valid for a given pathway (used to filter kanban columns).
export function getStagesForPathway(pathway) {
  const seq = (pathway === 'direct') ? DIRECT_SEQUENCE : PROVIDER_SEQUENCE;
  return seq.map(getStage);
}

export function isOverdue(stageKey, stageEnteredAt) {
  const stage = getStage(stageKey);
  if (!stage.overdueAfterDays || !stageEnteredAt) return false;
  const days = (Date.now() - new Date(stageEnteredAt).getTime()) / 86400000;
  return days > stage.overdueAfterDays;
}

export function daysSince(isoString) {
  if (!isoString) return 0;
  const diff = (Date.now() - new Date(isoString).getTime()) / 86400000;
  return Math.floor(diff);
}

export function durationLabel(isoString) {
  const days = daysSince(isoString);
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  return `${days} days`;
}
