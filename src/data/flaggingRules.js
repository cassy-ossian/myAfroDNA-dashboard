// CYP2C19 genomic medicine flagging rules for clopidogrel metabolism study.
// Each rule maps a genotype to its phenotype classification, clinical implication,
// suggested action, and priority level. Priority null = no action needed.
// Add new rules here to extend for new variants or studies — do not hardcode in UI.

export const CYP2C19_RULES = [
  {
    genotype: '*1/*1',
    phenotype: 'Normal Metabolizer',
    phenotypeShort: 'Normal',
    implication: 'Clopidogrel is activated at normal levels. Standard dosing is expected to be effective.',
    suggestedAction: null,
    priority: null,
    flagged: false,
  },
  {
    genotype: '*1/*17',
    phenotype: 'Rapid Metabolizer',
    phenotypeShort: 'Rapid',
    implication: 'Clopidogrel is activated faster than normal, which may increase bleeding risk or slightly reduce platelet inhibition depending on the patient.',
    suggestedAction: 'Monitor patient for signs of reduced efficacy or bleeding. Consider dose review at next cardiology appointment.',
    priority: 'Medium',
    flagged: true,
  },
  {
    genotype: '*17/*17',
    phenotype: 'Ultra-Rapid Metabolizer',
    phenotypeShort: 'Ultra-Rapid',
    implication: 'Clopidogrel is activated at a very high rate. Standard dosing may lead to excessive platelet inhibition with bleeding risk, or paradoxical reduced efficacy.',
    suggestedAction: 'Recontact through provider urgently. Patient likely needs an alternative antiplatelet agent (e.g., ticagrelor or prasugrel) or significant dose adjustment.',
    priority: 'High',
    flagged: true,
  },
  {
    genotype: '*1/*2',
    phenotype: 'Intermediate Metabolizer',
    phenotypeShort: 'Intermediate',
    implication: 'Clopidogrel is activated at a reduced rate. Drug efficacy may be diminished, increasing cardiovascular risk.',
    suggestedAction: 'Monitor patient closely. Consider enhanced platelet function testing or dose escalation discussion with the treating cardiologist.',
    priority: 'Medium',
    flagged: true,
  },
  {
    genotype: '*2/*2',
    phenotype: 'Poor Metabolizer',
    phenotypeShort: 'Poor',
    implication: 'Clopidogrel cannot be properly activated. The drug is likely not working. This is a clinically significant finding for cardiovascular risk.',
    suggestedAction: 'Recontact through provider urgently. Patient needs an alternative antiplatelet drug — clopidogrel is not effective for this genotype.',
    priority: 'High',
    flagged: true,
  },
  {
    genotype: '*1/*3',
    phenotype: 'Intermediate Metabolizer',
    phenotypeShort: 'Intermediate',
    implication: 'Clopidogrel activation is reduced. Similar to *1/*2 carriers, efficacy may be diminished.',
    suggestedAction: 'Monitor patient. Discuss potential dose adjustment or alternative therapy with treating cardiologist.',
    priority: 'Medium',
    flagged: true,
  },
  {
    genotype: '*2/*17',
    phenotype: 'Variable Metabolizer',
    phenotypeShort: 'Variable',
    implication: 'This genotype has mixed effects — the *2 loss-of-function allele and *17 gain-of-function allele may partially offset each other, but outcome is unpredictable.',
    suggestedAction: 'Review case individually with clinical pharmacologist or cardiologist. Platelet function testing recommended.',
    priority: 'Medium',
    flagged: true,
  },
];

// Tooltip explanations for non-geneticist users
export const PHENOTYPE_EXPLANATIONS = {
  'Normal Metabolizer': 'The body processes clopidogrel at the expected rate. Standard dosing should work.',
  'Rapid Metabolizer': 'The body processes clopidogrel faster than normal. Dosing may need review.',
  'Ultra-Rapid Metabolizer': 'The body processes clopidogrel much faster than normal. Alternative medication is likely needed.',
  'Intermediate Metabolizer': 'The body processes clopidogrel more slowly than normal. The drug may be less effective.',
  'Poor Metabolizer': 'The body cannot properly process clopidogrel. The drug is unlikely to work for this patient.',
  'Variable Metabolizer': 'The effect on drug processing is unpredictable and requires individual clinical review.',
};

// Look up the rule for a given genotype string. Returns null if not found.
export function getRuleForGenotype(genotypeStr) {
  if (!genotypeStr) return null;
  const normalized = genotypeStr.trim();
  return CYP2C19_RULES.find(
    (r) => r.genotype.toLowerCase() === normalized.toLowerCase()
  ) || null;
}

// Apply all rules to a patient object and return enriched patient with flagging info.
// Manual flags (patient.manualFlag) override auto-classification.
export function classifyPatient(patient) {
  // 1. Manual flag takes priority
  if (patient.manualFlag) {
    const mf      = patient.manualFlag;
    const display = getRuleForGenotype(patient.genotype);
    return {
      ...patient,
      phenotype:       display?.phenotype      ?? (patient.genotype ? 'Unknown Variant' : null),
      phenotypeShort:  display?.phenotypeShort ?? null,
      implication:     display?.implication    ?? null,
      flagged:         true,
      priority:        mf.priority || 'Medium',
      suggestedAction: mf.reason || 'Manually flagged for recontact.',
      flaggedBy:       'manual',
    };
  }

  // 2. Rules engine auto-flag (_ruleMatch is set by loadFromSupabase / runRulesForStudy)
  if (patient._ruleMatch) {
    const { priority, reason } = patient._ruleMatch;
    const display = getRuleForGenotype(patient.genotype);
    return {
      ...patient,
      phenotype:       display?.phenotype      ?? (patient.genotype ? 'Unknown Variant' : null),
      phenotypeShort:  display?.phenotypeShort ?? null,
      implication:     display?.implication    ?? null,
      flagged:         true,
      priority:        priority || 'Medium',
      suggestedAction: reason   || 'Flagged by recontact rule.',
      flaggedBy:       'auto',
    };
  }

  // 3. Not flagged — still show phenotype info for display
  const display = getRuleForGenotype(patient.genotype);
  return {
    ...patient,
    phenotype:       display?.phenotype      ?? (patient.genotype ? 'Unknown Variant' : null),
    phenotypeShort:  display?.phenotypeShort ?? null,
    implication:     display?.implication    ?? (patient.genotype ? 'Not in current rules set. Manual review required.' : null),
    flagged:         false,
    priority:        null,
    suggestedAction: display?.suggestedAction ?? (patient.genotype ? 'Contact study genomic medicine team for classification.' : null),
    flaggedBy:       null,
  };
}
