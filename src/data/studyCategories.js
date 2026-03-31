// Category definitions and inference rules for study classification.

export const CATEGORIES = {
  Cardiovascular:       { bg: 'bg-red-100',    text: 'text-red-800',    border: 'border-red-200',    dot: 'bg-red-500',    sidebarBg: 'bg-red-500/20',    sidebarText: 'text-red-200' },
  Ophthalmology:        { bg: 'bg-blue-100',   text: 'text-blue-800',   border: 'border-blue-200',   dot: 'bg-blue-500',   sidebarBg: 'bg-blue-500/20',   sidebarText: 'text-blue-200' },
  Nephrology:           { bg: 'bg-purple-100', text: 'text-purple-800', border: 'border-purple-200', dot: 'bg-purple-500', sidebarBg: 'bg-purple-500/20', sidebarText: 'text-purple-200' },
  Oncology:             { bg: 'bg-orange-100', text: 'text-orange-800', border: 'border-orange-200', dot: 'bg-orange-500', sidebarBg: 'bg-orange-500/20', sidebarText: 'text-orange-200' },
  Audiology:            { bg: 'bg-teal-100',   text: 'text-teal-800',   border: 'border-teal-200',   dot: 'bg-teal-600',   sidebarBg: 'bg-teal-500/20',   sidebarText: 'text-teal-200' },
  'Infectious Disease': { bg: 'bg-green-100',  text: 'text-green-800',  border: 'border-green-200',  dot: 'bg-green-500',  sidebarBg: 'bg-green-500/20',  sidebarText: 'text-green-200' },
  Other:                { bg: 'bg-gray-100',   text: 'text-gray-700',   border: 'border-gray-200',   dot: 'bg-gray-400',   sidebarBg: 'bg-gray-500/20',   sidebarText: 'text-gray-300' },
};

const CATEGORY_PATTERNS = [
  [/CLOP/i,                 'Cardiovascular'],
  [/AMD|NAMD/i,             'Ophthalmology'],
  [/UPTH-2|RSUTH/i,         'Nephrology'],
  [/UBTH-PC/i,              'Oncology'],
  [/ENTH|ENT/i,             'Audiology'],
  [/RVPHC|RHC|CHST|RVPF/i, 'Infectious Disease'],
];

export function inferCategory(studyId = '') {
  for (const [pattern, cat] of CATEGORY_PATTERNS) {
    if (pattern.test(studyId)) return cat;
  }
  return 'Other';
}

export function getCategoryStyle(category) {
  return CATEGORIES[category] ?? CATEGORIES.Other;
}

// Group an array of study objects by category, preserving category display order.
export function groupStudiesByCategory(studies) {
  const ORDER = Object.keys(CATEGORIES);
  const groups = {};
  for (const study of studies) {
    const cat = study.category ?? 'Other';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(study);
  }
  // Sort groups by canonical order
  return ORDER.filter(cat => groups[cat]).map(cat => ({ category: cat, studies: groups[cat] }));
}
