// Contact pathway system.
// Every patient has a contactPathway that determines how the biobank will reach them.
// Set automatically on import based on available fields; can be manually overridden.

export const PATHWAY = {
  DIRECT:   'direct',    // biobank contacts patient directly (phone/email/address on file)
  PROVIDER: 'provider',  // contact must go through the patient's healthcare provider
  BOTH:     'both',      // both channels — notify provider AND contact patient directly
  NONE:     'none',      // no contact method available (warning)
};

export const PATHWAY_LABELS = {
  direct:   'Direct Contact Available',
  provider: 'Provider-Mediated Only',
  both:     'Both (Direct + Provider)',
  none:     'No Contact Method',
};

export const PATHWAY_OPTIONS = [
  { value: PATHWAY.DIRECT,   label: 'Direct Contact Available' },
  { value: PATHWAY.PROVIDER, label: 'Provider-Mediated Only' },
  { value: PATHWAY.BOTH,     label: 'Both (Direct + Provider)' },
  { value: PATHWAY.NONE,     label: 'No Contact Method' },
];

// Auto-detect contact pathway from patient fields populated on import.
// Per-patient detection — even within a single study, some patients may have
// contact info and others may not.
export function detectContactPathway(patient) {
  const hasContact  = !!(patient.phone || patient.email || patient.address);
  const hasProvider = !!(patient.providerCode || patient.providerName);
  if (hasContact && hasProvider) return PATHWAY.BOTH;
  if (hasContact)                return PATHWAY.DIRECT;
  if (hasProvider)               return PATHWAY.PROVIDER;
  return PATHWAY.NONE;
}

// Normalize phone number to international format for tel: / wa.me links.
// Handles Nigerian formats: +234-XXX-XXX-XXXX, 0XXX-XXX-XXXX, 234XXXXXXXXXX, etc.
// Returns the original string if the format is unrecognizable.
export function normalizePhone(raw) {
  if (!raw) return null;
  const digits = String(raw).replace(/\D/g, '');
  if (digits.startsWith('234') && digits.length >= 13) return '+' + digits;
  if (digits.startsWith('0') && digits.length === 11)  return '+234' + digits.slice(1);
  // Unknown format — return trimmed original and let the user correct it
  return String(raw).trim();
}

// Message templates for direct patient outreach.
// Stored here so they can be updated centrally rather than hardcoded in UI.
export const MESSAGE_TEMPLATES = {
  sms: (patientId, studyName = 'the MyAfroDNA study') =>
    `Dear Patient ${patientId},\n\nThis is the MyAfroDNA Study Team from ${studyName} you participated in. We have important results from your genetic testing that may affect your treatment.\n\nPlease contact us at your earliest convenience.\n\nThank you,\nMyAfroDNA Study Team`,

  whatsapp: (patientId, studyName = 'the MyAfroDNA study') =>
    `Dear Patient ${patientId},\n\nThis is the MyAfroDNA Study Team from ${studyName}. We have important genetic test results that may affect your treatment.\n\nPlease contact us at your earliest convenience.\n\nThank you,\nMyAfroDNA Study Team`,

  emailSubject: (studyName = 'MyAfroDNA Study') =>
    `Important Results from Your ${studyName} Participation`,

  emailBody: (patientId, studyName = 'the MyAfroDNA study') =>
    `Dear Participant,\n\nWe are reaching out regarding your participation in ${studyName} (ID: ${patientId}).\n\nOur genetic testing has identified findings that may be relevant to your ongoing care. We would like to discuss these results with you and your healthcare provider.\n\nPlease contact us at your earliest convenience to schedule a follow-up appointment.\n\nKind regards,\nMyAfroDNA Study Team`,
};
