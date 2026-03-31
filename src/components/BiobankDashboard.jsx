import { useMemo } from 'react';
import { Users, AlertTriangle, Dna, FlaskConical, ChevronRight, Database, Upload } from 'lucide-react';
import { getCategoryStyle } from '../data/studyCategories';
import StudyBadge from './StudyBadge';

function StatCard({ label, value, sub, Icon, color = 'teal', onClick }) {
  const colors = {
    teal:   'bg-teal-50 border-teal-200 text-teal-700',
    red:    'bg-red-50 border-red-200 text-red-700',
    amber:  'bg-amber-50 border-amber-200 text-amber-700',
    blue:   'bg-blue-50 border-blue-200 text-blue-700',
    purple: 'bg-purple-50 border-purple-200 text-purple-700',
  };
  return (
    <div
      onClick={onClick}
      className={`rounded-xl border p-5 ${colors[color]} ${onClick ? 'cursor-pointer hover:shadow-md transition-shadow' : ''}`}
    >
      <div className="flex items-center justify-between mb-2">
        <p className="text-sm font-medium opacity-75">{label}</p>
        <Icon size={18} className="opacity-50" />
      </div>
      <p className="text-3xl font-bold">{value}</p>
      {sub && <p className="text-xs mt-1 opacity-60">{sub}</p>}
    </div>
  );
}

function SampleBar({ collected, total }) {
  if (!total) return null;
  const pct = Math.round((collected / total) * 100);
  return (
    <div>
      <div className="flex justify-between text-[11px] text-gray-400 mb-1">
        <span>{collected} / {total} samples</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
        <div className="h-full bg-teal-500 rounded-full" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}

export default function BiobankDashboard({ patients, flaggedPatients, recontactCases, studies, onNavigate, onImportWorkbook, onLoadDemo }) {
  const studyList = useMemo(() => Object.values(studies).sort((a, b) => a.id.localeCompare(b.id)), [studies]);

  // flagged = patients with an active recontact event in 'flagged' stage
  const activeFlaggedByStudy = useMemo(() => {
    const byStudy = {};
    for (const p of flaggedPatients) {
      const stage = recontactCases[p.id]?.stage;
      if (stage === 'flagged') {
        byStudy[p.studyId] = (byStudy[p.studyId] ?? 0) + 1;
      }
    }
    return byStudy;
  }, [flaggedPatients, recontactCases]);

  const stats = useMemo(() => {
    const total     = patients.length;
    const collected = patients.filter(p => p.sampleCollected).length;
    const genotyped = patients.filter(p => p.genotypingComplete).length;
    const flagged   = Object.values(activeFlaggedByStudy).reduce((s, n) => s + n, 0);
    return { total, collected, genotyped, flagged };
  }, [patients, activeFlaggedByStudy]);

  // Per-study stats
  const studyStats = useMemo(() => {
    const out = {};
    for (const p of patients) {
      if (!p.studyId) continue;
      if (!out[p.studyId]) out[p.studyId] = { total: 0, collected: 0, genotyped: 0, flagged: 0 };
      out[p.studyId].total++;
      if (p.sampleCollected)    out[p.studyId].collected++;
      if (p.genotypingComplete) out[p.studyId].genotyped++;
      out[p.studyId].flagged = activeFlaggedByStudy[p.studyId] ?? 0;
    }
    return out;
  }, [patients, activeFlaggedByStudy]);

  if (studyList.length === 0) {
    return (
      <div className="p-4 md:p-8 space-y-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biobank Overview</h1>
          <p className="text-gray-500 text-sm mt-1">No studies loaded yet.</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <Dna size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No data loaded</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
            Load the demo dataset or import your own Excel workbook.
          </p>
          <div className="mt-4 flex flex-wrap justify-center gap-3">
            {onLoadDemo && (
              <button onClick={onLoadDemo} className="px-4 py-2 bg-teal-700 text-white rounded-xl text-sm font-semibold hover:bg-teal-800 transition-colors">
                Load Demo
              </button>
            )}
            {onImportWorkbook && (
              <button onClick={onImportWorkbook} className="flex items-center gap-2 px-4 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-semibold hover:bg-gray-50 transition-colors">
                <Upload size={14} /> Import Workbook
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-4 md:p-8 space-y-8">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Biobank Overview</h1>
          <p className="text-gray-500 text-sm mt-1">
            {studyList.length} stud{studyList.length !== 1 ? 'ies' : 'y'} · {stats.total} participants enrolled
          </p>
        </div>
        {onImportWorkbook && (
          <button onClick={onImportWorkbook} className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 transition-colors shrink-0">
            <Upload size={14} /> Import Workbook
          </button>
        )}
      </div>

      {/* Summary stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Total Participants" value={stats.total} sub={`across ${studyList.length} studies`} Icon={Users} color="teal" onClick={() => onNavigate('master')} />
        <StatCard label="Flagged for Recontact" value={stats.flagged} sub="actionable or monitored variants" Icon={AlertTriangle} color={stats.flagged > 0 ? 'red' : 'teal'} onClick={stats.flagged > 0 ? () => onNavigate('flagged') : undefined} />
        <StatCard label="Samples Collected" value={stats.collected} sub={`${stats.total - stats.collected} pending`} Icon={FlaskConical} color="blue" />
        <StatCard label="Genotyped" value={stats.genotyped} sub={`${stats.collected - stats.genotyped} awaiting results`} Icon={Dna} color="purple" />
      </div>

      {/* Flat study grid — alphabetical */}
      <div>
        <h2 className="text-sm font-semibold text-gray-500 uppercase tracking-wider mb-4">Studies</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {studyList.map(study => {
            const s   = studyStats[study.id] ?? { total: 0, collected: 0, genotyped: 0, flagged: 0 };
            const cat = getCategoryStyle(study.category ?? 'Other');
            return (
              <button
                key={study.id}
                onClick={() => onNavigate('study', study.id)}
                className={`text-left bg-white rounded-xl border ${cat.border} p-5 hover:shadow-md transition-shadow group`}
              >
                <div className="flex items-start justify-between gap-2 mb-2">
                  <StudyBadge study={study} />
                  <ChevronRight size={14} className="text-gray-400 group-hover:text-gray-600 mt-0.5 shrink-0" />
                </div>
                <p className="text-sm font-semibold text-gray-900 leading-snug mb-0.5">{study.name}</p>
                <p className="text-xs text-gray-400 mb-3">{study.category}</p>

                <SampleBar collected={s.collected} total={s.total} />

                <div className="mt-3 flex items-center gap-4 text-xs text-gray-500">
                  <span><strong className="text-gray-900">{s.total}</strong> enrolled</span>
                  {s.flagged > 0 && (
                    <span className="flex items-center gap-0.5 text-red-600 font-medium">
                      <AlertTriangle size={10} /> {s.flagged} flagged
                    </span>
                  )}
                  {study.hasCYP2C19 && (
                    <span className="flex items-center gap-0.5 text-teal-600 font-medium">
                      <Dna size={10} /> CYP2C19
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Master list link */}
      <button onClick={() => onNavigate('master')} className="flex items-center gap-2 text-sm font-medium text-teal-700 hover:text-teal-900 transition-colors">
        <Database size={15} />
        View master patient list ({stats.total} patients)
        <ChevronRight size={14} />
      </button>
    </div>
  );
}
