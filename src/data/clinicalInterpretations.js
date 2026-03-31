// Static clinical report text keyed by CYP2C19 genotype.
// Used in provider reports and recontact letters.
// These are intentionally conservative, plain-language summaries.

export const CLINICAL_INTERPRETATIONS = {
  '*17/*17': {
    reportSummary: 'This patient carries two copies of the CYP2C19*17 gain-of-function allele, making them an ultra-rapid metabolizer of clopidogrel. The drug is converted to its active form much faster than normal, which can lead to excessive platelet inhibition and elevated bleeding risk. Clinical guidelines (CPIC) recommend considering a dose reduction or switching to an alternative antiplatelet agent such as ticagrelor or prasugrel.',
    clinicalSignificance: 'Ultra-rapid conversion of clopidogrel — elevated bleeding risk or reduced efficacy',
    recommendedAction: 'Dose reduction or alternative antiplatelet agent (e.g., ticagrelor, prasugrel)',
  },
  '*2/*2': {
    reportSummary: 'This patient carries two non-functional CYP2C19*2 alleles and is a poor metabolizer. Clopidogrel cannot be adequately converted to its active metabolite, meaning the drug is effectively non-functional for this patient. This represents a clinically urgent finding — the patient is likely receiving no meaningful antiplatelet protection. CPIC guidelines recommend an alternative antiplatelet agent.',
    clinicalSignificance: 'Clopidogrel is inactive in this patient — no antiplatelet protection expected',
    recommendedAction: 'Switch to an alternative antiplatelet agent urgently (e.g., ticagrelor or prasugrel)',
  },
  '*1/*17': {
    reportSummary: 'This patient carries one copy of the CYP2C19*17 gain-of-function allele (rapid metabolizer). Clopidogrel is activated slightly faster than average, which may increase active metabolite levels. Most patients with this genotype respond well to standard doses, but monitoring for signs of increased bleeding is advisable, particularly in high-risk surgical settings.',
    clinicalSignificance: 'Mildly increased clopidogrel activation — possible increased bleeding risk',
    recommendedAction: 'Monitor for bleeding signs; consider platelet function testing if clinically indicated',
  },
  '*1/*2': {
    reportSummary: 'This patient carries one non-functional CYP2C19*2 allele (intermediate metabolizer). Clopidogrel activation is reduced, which may result in diminished antiplatelet efficacy. The clinical impact varies — some patients maintain adequate platelet inhibition, while others may not. Enhanced monitoring or dose adjustment may be warranted depending on clinical risk.',
    clinicalSignificance: 'Reduced clopidogrel activation — potential for diminished antiplatelet efficacy',
    recommendedAction: 'Consider platelet function testing; discuss potential dose adjustment with cardiologist',
  },
  '*1/*3': {
    reportSummary: 'This patient carries one CYP2C19*3 loss-of-function allele (intermediate metabolizer). Similar to *1/*2 carriers, clopidogrel activation may be reduced. Clinical significance is comparable to *1/*2 status, though *3 is less common. Monitoring for signs of inadequate platelet inhibition is recommended.',
    clinicalSignificance: 'Reduced clopidogrel activation — potential for diminished antiplatelet efficacy',
    recommendedAction: 'Monitor efficacy; consider platelet function testing if clinically indicated',
  },
  '*2/*17': {
    reportSummary: 'This patient carries both a loss-of-function (*2) and a gain-of-function (*17) CYP2C19 allele. These opposing effects may partially cancel out, but the clinical outcome is unpredictable. Individual platelet function testing is the most reliable way to assess drug response in this patient.',
    clinicalSignificance: 'Unpredictable clopidogrel metabolism — opposing allele effects',
    recommendedAction: 'Platelet function testing recommended; individual clinical review with pharmacologist',
  },
  '*1/*1': {
    reportSummary: 'This patient has a normal CYP2C19 genotype and is expected to metabolize clopidogrel at the standard rate. No dose adjustment is required based on pharmacogenomic findings.',
    clinicalSignificance: 'Normal clopidogrel metabolism expected',
    recommendedAction: 'Standard dosing — no pharmacogenomic-based changes required',
  },
};

export function getInterpretation(genotype) {
  if (!genotype) return null;
  return CLINICAL_INTERPRETATIONS[genotype.trim()] || {
    reportSummary: `This patient carries a CYP2C19 variant (${genotype}) that is not in the current interpretation database. Manual review by a clinical pharmacologist is recommended.`,
    clinicalSignificance: 'Variant not in current database — manual review required',
    recommendedAction: 'Refer to clinical pharmacologist for individual assessment',
  };
}
