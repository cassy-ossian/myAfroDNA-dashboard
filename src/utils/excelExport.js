import XLSXStyle from 'xlsx-js-style';
import { getInterpretation } from '../data/clinicalInterpretations';

// ── Palette ───────────────────────────────────────────────────────────────────

const C = {
  titleBg:    '0F766E', titleFg:    'FFFFFF',  // teal-700
  thBg:       'DBEAFE', thFg:       '1E3A8A',  // blue-100/900
  highBg:     'FEE2E2', highFg:     '991B1B',  // red-100/800
  medBg:      'FEF3C7', medFg:      '92400E',  // amber-100/800
  altRow:     'F8FAFC',                         // slate-50
  noteBg:     'EFF6FF',                         // blue-50
  border:     'CBD5E1',                         // slate-300
};

// ── Cell helpers ──────────────────────────────────────────────────────────────

function s(opts = {}) {
  return {
    font: {
      name: 'Calibri',
      sz:   opts.sz   ?? 11,
      bold: opts.bold ?? false,
      ...(opts.fg ? { color: { rgb: opts.fg } } : {}),
    },
    ...(opts.bg ? { fill: { patternType: 'solid', fgColor: { rgb: opts.bg } } } : {}),
    alignment: {
      horizontal: opts.align ?? 'left',
      vertical:   'center',
      wrapText:   opts.wrap  ?? false,
    },
    ...(opts.border ? {
      border: {
        top:    { style: 'thin', color: { rgb: C.border } },
        bottom: { style: 'thin', color: { rgb: C.border } },
        left:   { style: 'thin', color: { rgb: C.border } },
        right:  { style: 'thin', color: { rgb: C.border } },
      },
    } : {}),
  };
}

function cell(ws, r, c, v, style) {
  const ref = XLSXStyle.utils.encode_cell({ r, c });
  ws[ref] = { v: v ?? '', t: typeof v === 'number' ? 'n' : 's', s: style };
}

function merge(list, r1, c1, r2, c2) {
  list.push({ s: { r: r1, c: c1 }, e: { r: r2, c: c2 } });
}

function finalize(ws, merges, maxRow, maxCol, colWidths) {
  ws['!ref']  = XLSXStyle.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: maxRow, c: maxCol } });
  ws['!merges'] = merges;
  ws['!cols'] = colWidths.map(w => ({ wch: w }));
  return ws;
}

function fmtDate(isoOrYMD) {
  if (!isoOrYMD) return '';
  return new Date(isoOrYMD).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Sheet 1: Summary ──────────────────────────────────────────────────────────

function buildSummary(patients, groups, grouping, reportDate, customNote) {
  const ws  = {};
  const mrg = [];
  let   r   = 0;

  // Title rows
  cell(ws, r, 0, 'MyAfroDNA — Patient Recontact Report', s({ bold: true, sz: 14, bg: C.titleBg, fg: C.titleFg }));
  merge(mrg, r, 0, r, 5); r++;

  cell(ws, r, 0, `Report Date: ${fmtDate(reportDate)}`, s({ bold: true, bg: C.titleBg, fg: C.titleFg }));
  merge(mrg, r, 0, r, 5); r++;

  r++; // blank

  cell(ws, r, 0, 'Study:',     s({ bold: true }));
  cell(ws, r, 1, 'CYP2C19 Clopidogrel Metabolism Study', s({})); r++;

  const providerLabel =
    grouping === 'provider' && groups.length === 1 ? groups[0].label : 'All Providers';
  cell(ws, r, 0, 'Generated for:', s({ bold: true }));
  cell(ws, r, 1, providerLabel, s({})); r++;

  if (customNote) {
    cell(ws, r, 0, 'Note:', s({ bold: true }));
    cell(ws, r, 1, customNote, s({ wrap: true })); r++;
  }

  r++; // blank

  // Counts
  const highCount = patients.filter(p => p.priority === 'High').length;
  const medCount  = patients.filter(p => p.priority !== 'High').length;

  cell(ws, r, 0, 'SUMMARY', s({ bold: true, sz: 12 })); r++;
  cell(ws, r, 0, 'Total patients requiring recontact:', s({ bold: true }));
  cell(ws, r, 1, patients.length, s({})); r++;
  cell(ws, r, 0, 'High priority:',   s({ bold: true, fg: C.highFg }));
  cell(ws, r, 1, highCount,          s({ fg: C.highFg, bold: true })); r++;
  cell(ws, r, 0, 'Medium priority:', s({ bold: true, fg: C.medFg }));
  cell(ws, r, 1, medCount,           s({ fg: C.medFg, bold: true })); r++;

  r++; // blank

  // Table header
  const TH = ['MyAfroDNA ID', 'Genotype', 'Phenotype', 'Priority', 'Recommended Action', 'Assigned Provider'];
  TH.forEach((h, c) => cell(ws, r, c, h, s({ bold: true, bg: C.thBg, fg: C.thFg, border: true })));
  r++;

  // Data — high priority first
  const sorted = [
    ...patients.filter(p => p.priority === 'High'),
    ...patients.filter(p => p.priority !== 'High'),
  ];

  sorted.forEach((p, i) => {
    const rowBg = i % 2 === 1 ? C.altRow : undefined;
    const interp = getInterpretation(p.genotype);
    const values = [
      p.id,
      p.genotype            || '—',
      p.phenotype           || '—',
      p.priority            || '—',
      interp?.recommendedAction || p.suggestedAction || '—',
      p._provider           || '—',
    ];
    values.forEach((v, c) => {
      const style =
        c === 3 && p.priority === 'High'
          ? s({ bg: C.highBg, fg: C.highFg, bold: true, border: true })
          : c === 3
          ? s({ bg: C.medBg,  fg: C.medFg,  bold: true, border: true })
          : s({ bg: rowBg, border: true, wrap: c >= 4 });
      cell(ws, r, c, v, style);
    });
    r++;
  });

  return finalize(ws, mrg, r - 1, 5, [16, 12, 22, 14, 45, 25]);
}

// ── Sheet 2 & 3: Priority Detail ──────────────────────────────────────────────

function buildDetail(patients, title, actionBg) {
  const ws  = {};
  const mrg = [];
  let   r   = 0;

  cell(ws, r, 0, title, s({ bold: true, sz: 13, bg: C.titleBg, fg: C.titleFg }));
  merge(mrg, r, 0, r, 2); r++;
  r++; // blank

  patients.forEach((p, idx) => {
    const interp  = getInterpretation(p.genotype);
    const hdrBg   = p.priority === 'High' ? C.highBg : C.medBg;
    const hdrFg   = p.priority === 'High' ? C.highFg : C.medFg;

    // Patient header row
    cell(ws, r, 0, `Patient ${idx + 1}`, s({ bold: true, sz: 12, bg: hdrBg, fg: hdrFg }));
    cell(ws, r, 1, p.id,                 s({ bold: true, sz: 12, bg: hdrBg, fg: hdrFg }));
    cell(ws, r, 2, `${p.priority} Priority`, s({ bold: true, sz: 12, bg: hdrBg, fg: hdrFg }));
    r++;

    const rows = [
      ['Genotype',              p.genotype  || '—',                                            false],
      ['Phenotype',             p.phenotype || '—',                                            false],
      ['Clinical Significance', interp?.clinicalSignificance || p.implication || '—',          true ],
      ['Clinical Interpretation', interp?.reportSummary || '—',                                true ],
      ['Recommended Action',    interp?.recommendedAction   || p.suggestedAction || '—',       true, true /* highlight */],
      ['Assigned Provider',     p._provider   || '—',                                          false],
      ['Facility',              p._facility   || '—',                                          false],
    ];

    rows.forEach(([label, value, wrap, highlight]) => {
      cell(ws, r, 0, label, s({ bold: true, ...(highlight ? { bg: actionBg } : {}) }));
      cell(ws, r, 1, value, s({ wrap, ...(highlight ? { bg: actionBg, bold: true } : {}) }));
      r++;
    });

    r++; // blank separator
  });

  return finalize(ws, mrg, r, 2, [24, 65, 18]);
}

// ── Sheet 4: Direct Outreach List ─────────────────────────────────────────────

function buildDirectOutreachList(patients) {
  const ws  = {};
  const mrg = [];
  let   r   = 0;

  cell(ws, r, 0, 'Direct Outreach List — Coordinator Call Sheet', s({ bold: true, sz: 13, bg: C.titleBg, fg: C.titleFg }));
  merge(mrg, r, 0, r, 6); r++;
  cell(ws, r, 0, 'Patients who can be contacted directly (phone / SMS / WhatsApp / email)', s({ bg: C.noteBg }));
  merge(mrg, r, 0, r, 6); r++;
  r++;

  const directPats = patients.filter(p => p.contactPathway === 'direct' || p.contactPathway === 'both');

  if (directPats.length === 0) {
    cell(ws, r, 0, 'No patients with direct contact information in this report.', s({}));
    return finalize(ws, mrg, r, 6, [16, 18, 18, 18, 16, 45, 20]);
  }

  const TH = ['MyAfroDNA ID', 'Phone', 'Email', 'Preferred Method', 'Priority', 'Clinical Finding', 'Recommended Action'];
  TH.forEach((h, c) => cell(ws, r, c, h, s({ bold: true, bg: C.thBg, fg: C.thFg, border: true })));
  r++;

  const sorted = [
    ...directPats.filter(p => p.priority === 'High'),
    ...directPats.filter(p => p.priority !== 'High'),
  ];

  sorted.forEach((p, i) => {
    const rowBg  = i % 2 === 1 ? C.altRow : undefined;
    const isHigh = p.priority === 'High';
    const interp = getInterpretation(p.genotype);

    cell(ws, r, 0, p.id,                        s({ bold: true, border: true }));
    cell(ws, r, 1, p.phone    || '—',           s({ border: true, bg: rowBg }));
    cell(ws, r, 2, p.email    || '—',           s({ border: true, bg: rowBg }));
    cell(ws, r, 3, p.preferredContactMethod || '—', s({ border: true, bg: rowBg }));
    cell(ws, r, 4, p.priority || '—',           s({ bold: true, border: true, bg: isHigh ? C.highBg : C.medBg, fg: isHigh ? C.highFg : C.medFg }));
    cell(ws, r, 5, p.implication || '—',        s({ border: true, bg: rowBg, wrap: true }));
    cell(ws, r, 6, interp?.recommendedAction || p.suggestedAction || '—', s({ border: true, bg: rowBg, wrap: true }));
    r++;
  });

  return finalize(ws, mrg, r, 6, [16, 18, 24, 16, 14, 45, 45]);
}

// ── Sheet 5: Direct Call Log ───────────────────────────────────────────────────

function buildDirectCallLog(patients) {
  const ws  = {};
  const mrg = [];
  let   r   = 0;

  cell(ws, r, 0, 'Direct Call Log — Please complete and return to the MyAfroDNA study team', s({ bold: true, bg: C.noteBg, sz: 11 }));
  merge(mrg, r, 0, r, 7); r++;
  r++;

  const directPats = patients.filter(p => p.contactPathway === 'direct' || p.contactPathway === 'both');

  const TH = ['MyAfroDNA ID', 'Phone', 'Date Called', 'Method Used', 'Reached (Y/N)', 'Outcome', 'Follow-Up Date', 'Notes'];
  TH.forEach((h, c) => cell(ws, r, c, h, s({ bold: true, bg: C.thBg, fg: C.thFg, border: true })));
  r++;

  const sorted = [
    ...directPats.filter(p => p.priority === 'High'),
    ...directPats.filter(p => p.priority !== 'High'),
  ];

  sorted.forEach((p, i) => {
    const rowBg = i % 2 === 1 ? C.altRow : undefined;
    cell(ws, r, 0, p.id,               s({ bold: true, border: true }));
    cell(ws, r, 1, p.phone || '—',     s({ border: true, bg: rowBg }));
    [2, 3, 4, 5, 6, 7].forEach(c => cell(ws, r, c, '', s({ border: true, bg: rowBg })));
    r++;
  });

  return finalize(ws, mrg, r, 7, [16, 18, 14, 16, 16, 36, 16, 36]);
}

// ── Sheet 6: Provider Action Log ──────────────────────────────────────────────

function buildActionLog(patients) {
  const ws  = {};
  const mrg = [];
  let   r   = 0;

  cell(ws, r, 0,
    'Please complete this log and return to the MyAfroDNA study team',
    s({ bold: true, bg: C.noteBg, sz: 11 })
  );
  merge(mrg, r, 0, r, 6); r++;
  r++; // blank

  const TH = ['MyAfroDNA ID', 'Priority', 'Recommended Action',
               'Patient Contacted?', 'Date Contacted', 'Action Taken', 'Notes'];
  TH.forEach((h, c) => cell(ws, r, c, h, s({ bold: true, bg: C.thBg, fg: C.thFg, border: true })));
  r++;

  const sorted = [
    ...patients.filter(p => p.priority === 'High'),
    ...patients.filter(p => p.priority !== 'High'),
  ];

  sorted.forEach((p, i) => {
    const interp = getInterpretation(p.genotype);
    const rowBg  = i % 2 === 1 ? C.altRow : undefined;
    const isHigh = p.priority === 'High';

    cell(ws, r, 0, p.id,         s({ bold: true, border: true }));
    cell(ws, r, 1, p.priority,   s({ bold: true, border: true, bg: isHigh ? C.highBg : C.medBg, fg: isHigh ? C.highFg : C.medFg }));
    cell(ws, r, 2, interp?.recommendedAction || p.suggestedAction || '—', s({ border: true, bg: rowBg, wrap: true }));
    [3, 4, 5, 6].forEach(c => cell(ws, r, c, '', s({ border: true, bg: rowBg })));
    r++;
  });

  return finalize(ws, mrg, r, 6, [16, 14, 44, 20, 16, 32, 36]);
}

// ── Public API ────────────────────────────────────────────────────────────────

export function exportExcel({ groups, grouping, customNote, reportDate, providers, providerAssignments }) {
  const providerMap = Object.fromEntries(providers.map(p => [p.name, p]));

  const enrich = (p) => ({
    ...p,
    _provider: providerAssignments[p.id] || '—',
    _facility: providerMap[providerAssignments[p.id]]?.facility || '—',
  });

  const included    = groups.flatMap(g => g.patients).map(enrich);
  const highPats    = included.filter(p => p.priority === 'High');
  const medPats     = included.filter(p => p.priority !== 'High');

  const wb = XLSXStyle.utils.book_new();

  XLSXStyle.utils.book_append_sheet(
    wb, buildSummary(included, groups, grouping, reportDate, customNote), 'Summary'
  );
  if (highPats.length > 0) {
    XLSXStyle.utils.book_append_sheet(
      wb, buildDetail(highPats, 'High Priority — Detail', C.highBg), 'High Priority — Detail'
    );
  }
  if (medPats.length > 0) {
    XLSXStyle.utils.book_append_sheet(
      wb, buildDetail(medPats, 'Medium Priority — Detail', C.medBg), 'Medium Priority — Detail'
    );
  }
  XLSXStyle.utils.book_append_sheet(wb, buildActionLog(included), 'Provider Action Log');
  XLSXStyle.utils.book_append_sheet(wb, buildDirectOutreachList(included), 'Direct Outreach List');
  XLSXStyle.utils.book_append_sheet(wb, buildDirectCallLog(included), 'Direct Call Log');

  const dateStr = (reportDate || new Date().toISOString().split('T')[0]);
  const namePart =
    grouping === 'provider' && groups.length === 1
      ? groups[0].label.replace(/[^a-zA-Z0-9]/g, '_').slice(0, 30)
      : 'All';

  XLSXStyle.writeFile(wb, `MyAfroDNA_Recontact_Report_${namePart}_${dateStr}.xlsx`);
}
