import { useState, useMemo } from 'react';
import { AlertTriangle, FileText, Info, Mail, Users, X, Filter } from 'lucide-react';
import ReportBuilder from './ReportBuilder';
import ProviderPicker from './ProviderPicker';
import EmailCompose from './EmailCompose';
import BulkEmailPreview from './BulkEmailPreview';
import StudyBadge from './StudyBadge';
import PathwayBadge from './PathwayBadge';
import { PHENOTYPE_EXPLANATIONS } from '../data/flaggingRules';
import useAppStore from '../store/appStore';

const PRIORITY_STYLES = {
  High:   { card: 'border-red-200',   dot: 'bg-red-500',   badge: 'bg-red-100 text-red-800',   label: 'High Priority — Recontact Required' },
  Medium: { card: 'border-amber-200', dot: 'bg-amber-400', badge: 'bg-amber-100 text-amber-800', label: 'Medium Priority — Monitoring Recommended' },
};

function PhenotypeInfo({ phenotype }) {
  const [show, setShow] = useState(false);
  const explanation = PHENOTYPE_EXPLANATIONS[phenotype];
  if (!explanation) return <span>{phenotype}</span>;
  return (
    <span className="relative inline-flex items-center gap-1">
      {phenotype}
      <button onClick={e => { e.stopPropagation(); setShow(s => !s); }} className="text-gray-400 hover:text-teal-600">
        <Info size={13} />
      </button>
      {show && (
        <span className="absolute z-10 top-full left-0 mt-1 w-64 bg-gray-900 text-white text-xs rounded-lg p-2.5 shadow-xl">
          {explanation}
        </span>
      )}
    </span>
  );
}

const EMPTY_FILTERS = { pathway: 'all', study: '', provider: '', priority: 'all', flagType: 'all' };

export default function FlaggedPatients({
  flaggedPatients, recontactCases, providerAssignments, providers,
  emailedPatients, onSelectPatient, onAssignProvider, onAddProvider, onMarkEmailed,
}) {
  const studies = useAppStore(s => s.studies);
  const [showReport,    setShowReport]    = useState(false);
  const [showBulkEmail, setShowBulkEmail] = useState(false);
  const [composeFor,    setComposeFor]    = useState(null);
  const [filters,       setFilters]       = useState(EMPTY_FILTERS);

  const setFilter = (key, value) => setFilters(f => ({ ...f, [key]: value }));

  // Unique studies + providers in the flagged set
  const flaggedStudyIds = useMemo(() => {
    const ids = new Set(flaggedPatients.map(p => p.studyId).filter(Boolean));
    return [...ids].sort();
  }, [flaggedPatients]);

  const flaggedProviders = useMemo(() => {
    const names = new Set(
      flaggedPatients.map(p => providerAssignments[p.id]).filter(Boolean)
    );
    return [...names].sort();
  }, [flaggedPatients, providerAssignments]);

  // Apply all filters
  const displayed = useMemo(() => {
    let list = flaggedPatients;
    if (filters.pathway !== 'all') {
      if (filters.pathway === 'none') list = list.filter(p => !p.contactPathway || p.contactPathway === 'none');
      else list = list.filter(p => p.contactPathway === filters.pathway || p.contactPathway === 'both');
    }
    if (filters.study) list = list.filter(p => p.studyId === filters.study);
    if (filters.provider) {
      list = list.filter(p => providerAssignments[p.id] === filters.provider);
    }
    if (filters.priority !== 'all') list = list.filter(p => p.priority === filters.priority);
    if (filters.flagType !== 'all') list = list.filter(p => p.flaggedBy === filters.flagType);
    return list;
  }, [flaggedPatients, filters, providerAssignments]);

  const byPriority = useMemo(() => [
    ...displayed.filter(p => p.priority === 'High'),
    ...displayed.filter(p => p.priority !== 'High'),
  ], [displayed]);

  const activeFilterCount = useMemo(() =>
    Object.entries(filters).filter(([k, v]) => v !== 'all' && v !== '').length,
    [filters]
  );

  const assignedCount = flaggedPatients.filter(p => !!providerAssignments[p.id]).length;

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Flagged for Recontact</h1>
          <p className="text-gray-500 text-sm mt-1">
            {activeFilterCount > 0
              ? <>Showing <strong>{displayed.length}</strong> of {flaggedPatients.length} flagged patient{flaggedPatients.length !== 1 ? 's' : ''} <span className="text-gray-400">({activeFilterCount} filter{activeFilterCount !== 1 ? 's' : ''} active)</span> <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-teal-600 hover:underline ml-1">Clear all</button></>
              : <>{flaggedPatients.length} patient{flaggedPatients.length !== 1 ? 's' : ''} with actionable or monitored variants</>
            }
          </p>
        </div>
        {flaggedPatients.length > 0 && (
          <div className="flex flex-wrap gap-2 shrink-0">
            <button
              onClick={() => setShowBulkEmail(true)}
              title={assignedCount === 0 ? 'Assign providers to patients first' : undefined}
              className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl font-medium text-sm hover:bg-gray-50 transition-colors"
            >
              <Users size={15} />
              Email All Providers
            </button>
            <button
              onClick={() => setShowReport(true)}
              className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-xl font-semibold text-sm hover:bg-teal-800 transition-colors shadow-sm"
            >
              <FileText size={15} />
              Generate Report
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      {flaggedPatients.length > 0 && (
        <div className="bg-white border border-gray-200 rounded-xl p-4 space-y-3">
          <div className="flex items-center gap-2 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            <Filter size={13} />
            Filters
            {activeFilterCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-teal-700 text-white rounded-full font-bold">{activeFilterCount}</span>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {/* Pathway */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Contact Pathway</label>
              <select value={filters.pathway} onChange={e => setFilter('pathway', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="all">All pathways</option>
                <option value="direct">Direct</option>
                <option value="provider">Provider-mediated</option>
                <option value="both">Both</option>
                <option value="none">None set</option>
              </select>
            </div>
            {/* Study */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Study</label>
              <select value={filters.study} onChange={e => setFilter('study', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="">All studies</option>
                {flaggedStudyIds.map(id => (
                  <option key={id} value={id}>{studies[id]?.shortName || id}</option>
                ))}
              </select>
            </div>
            {/* Provider */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Provider</label>
              <select value={filters.provider} onChange={e => setFilter('provider', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="">All providers</option>
                {flaggedProviders.map(name => <option key={name} value={name}>{name}</option>)}
                {flaggedPatients.some(p => !providerAssignments[p.id]) && (
                  <option value="__unassigned__">Unassigned</option>
                )}
              </select>
            </div>
            {/* Priority */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Priority</label>
              <select value={filters.priority} onChange={e => setFilter('priority', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="all">All priorities</option>
                <option value="High">High — recontact required</option>
                <option value="Medium">Medium — monitoring</option>
              </select>
            </div>
            {/* Flag type */}
            <div>
              <label className="block text-xs text-gray-500 font-medium mb-1">Flag Type</label>
              <select value={filters.flagType} onChange={e => setFilter('flagType', e.target.value)}
                className="w-full text-sm border border-gray-300 rounded-lg px-2 py-1.5 focus:outline-none focus:ring-2 focus:ring-teal-500 bg-white">
                <option value="all">All flags</option>
                <option value="auto">Auto-flagged (CYP2C19)</option>
                <option value="manual">Manually flagged</option>
              </select>
            </div>
          </div>
          {activeFilterCount > 0 && (
            <div className="flex justify-end">
              <button onClick={() => setFilters(EMPTY_FILTERS)}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 transition-colors">
                <X size={12} /> Clear all filters
              </button>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {flaggedPatients.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <AlertTriangle size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No flagged patients</p>
          <p className="text-gray-400 text-sm mt-1">
            Patients with actionable CYP2C19 variants will appear here once genotyping is complete.
          </p>
        </div>
      )}

      {flaggedPatients.length > 0 && displayed.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-10 text-center">
          <p className="text-gray-400 text-sm">No patients match the current filters.</p>
          <button onClick={() => setFilters(EMPTY_FILTERS)} className="text-teal-600 text-sm hover:underline mt-2 block mx-auto">
            Clear all filters
          </button>
        </div>
      )}

      {/* Patient cards */}
      <div className="space-y-3">
        {byPriority.map(p => {
          const style           = PRIORITY_STYLES[p.priority] || PRIORITY_STYLES.Medium;
          const hasProvider     = !!providerAssignments[p.id];
          const wasEmailed      = emailedPatients.has(p.id);
          const recontactCase   = recontactCases[p.id];
          const flagReason      = recontactCase?.flagReason || p.manualFlag?.reason || p.suggestedAction;
          const flagTypeLabel   = p.flaggedBy === 'manual' ? 'Manual' : p.flaggedBy === 'auto' ? 'Auto' : null;

          return (
            <div key={p.id} className={`bg-white rounded-xl border ${style.card} shadow-sm p-5 hover:shadow-md transition-shadow`}>
              {/* Card header */}
              <div className="flex items-start justify-between gap-3 mb-3">
                <button onClick={() => onSelectPatient(p)} className="flex items-center gap-3 text-left min-w-0 flex-wrap">
                  <div className={`w-2.5 h-2.5 rounded-full shrink-0 mt-0.5 ${style.dot}`} />
                  <span className="font-mono font-bold text-gray-900 text-lg">{p.id}</span>
                  <StudyBadge study={p.studyId} studies={studies} size="xs" />
                  {p.contactPathway && p.contactPathway !== 'none' && (
                    <PathwayBadge pathway={p.contactPathway} size="xs" />
                  )}
                  <span className={`px-2 py-0.5 rounded-full text-xs font-semibold ${style.badge}`}>{style.label}</span>
                  {flagTypeLabel && (
                    <span className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p.flaggedBy === 'manual'
                        ? 'bg-purple-100 text-purple-700'
                        : 'bg-blue-100 text-blue-700'
                    }`}>
                      {flagTypeLabel}
                    </span>
                  )}
                  {wasEmailed && (
                    <span className="flex items-center gap-0.5 text-[11px] text-teal-600 font-medium">
                      <Mail size={11} /> Emailed
                    </span>
                  )}
                </button>
                <div className="flex items-center gap-2 shrink-0">
                  <ProviderPicker
                    currentProvider={providerAssignments[p.id] || null}
                    providers={providers}
                    onAssign={name => onAssignProvider(p.id, name)}
                    onAddProvider={onAddProvider}
                  />
                  <button
                    onClick={() => setComposeFor(p)}
                    disabled={!hasProvider}
                    title={hasProvider ? `Email ${providerAssignments[p.id]}` : 'Assign a provider first'}
                    className={`p-1.5 rounded-lg transition-colors ${
                      hasProvider
                        ? 'text-gray-500 hover:text-teal-700 hover:bg-teal-50'
                        : 'text-gray-300 cursor-not-allowed'
                    }`}
                  >
                    <Mail size={15} />
                  </button>
                  <span className="font-mono text-sm text-gray-500">{p.genotype}</span>
                </div>
              </div>

              {/* Card body */}
              <div onClick={() => onSelectPatient(p)} className="cursor-pointer grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-sm ml-5">
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-0.5">Site</p>
                  <p className="text-gray-700">{p.site || '—'}</p>
                </div>
                <div>
                  <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-0.5">Phenotype</p>
                  <p className="text-gray-700 font-medium"><PhenotypeInfo phenotype={p.phenotype} /></p>
                </div>
                {p.implication && (
                  <div className="sm:col-span-2">
                    <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-0.5">Clinical Implication</p>
                    <p className="text-gray-600">{p.implication}</p>
                  </div>
                )}
                {flagReason && (
                  <div className="sm:col-span-2 lg:col-span-4">
                    <p className="text-xs text-gray-400 uppercase font-medium tracking-wide mb-0.5">
                      {p.flaggedBy === 'manual' ? 'Recontact Reason' : 'Suggested Action'}
                    </p>
                    <p className="text-gray-800 font-medium">{flagReason}</p>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* Modals */}
      {showReport && (
        <ReportBuilder
          flaggedPatients={flaggedPatients}
          recontactCases={recontactCases}
          providerAssignments={providerAssignments}
          providers={providers}
          emailedPatients={emailedPatients}
          onMarkEmailed={onMarkEmailed}
          onClose={() => setShowReport(false)}
        />
      )}

      {showBulkEmail && (
        <BulkEmailPreview
          patients={flaggedPatients}
          providers={providers}
          providerAssignments={providerAssignments}
          emailedPatients={emailedPatients}
          onMarkEmailed={onMarkEmailed}
          onClose={() => setShowBulkEmail(false)}
        />
      )}

      {composeFor && (
        <EmailCompose
          patient={composeFor}
          providers={providers}
          providerAssignments={providerAssignments}
          onMarkEmailed={onMarkEmailed}
          onClose={() => setComposeFor(null)}
        />
      )}
    </div>
  );
}
