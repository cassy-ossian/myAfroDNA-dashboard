import { Users, FlaskConical, Dna, AlertTriangle, ChevronRight, Phone, Building2, GitMerge } from 'lucide-react';
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell
} from 'recharts';
import ProviderPicker from './ProviderPicker';

function StatCard({ icon: Icon, label, value, highlight }) {
  return (
    <div className={`rounded-xl p-5 shadow-sm border ${highlight ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm text-gray-500 font-medium">{label}</p>
          <p className={`text-3xl font-bold mt-1 ${highlight ? 'text-amber-700' : 'text-gray-900'}`}>{value}</p>
        </div>
        <div className={`p-2 rounded-lg ${highlight ? 'bg-amber-100' : 'bg-teal-50'}`}>
          <Icon size={22} className={highlight ? 'text-amber-600' : 'text-teal-700'} />
        </div>
      </div>
    </div>
  );
}

const STATUS_COLORS = {
  'Not Collected':       '#94a3b8',
  'Awaiting Genotyping': '#60a5fa',
  'Normal Result':       '#34d399',
  'Actionable Variant':  '#f59e0b',
};

const CustomTooltip = ({ active, payload, label }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-white border border-gray-200 rounded-lg p-3 shadow-md text-sm">
        <p className="font-medium text-gray-800">{label}</p>
        <p className="text-gray-600">{payload[0].value} patients</p>
      </div>
    );
  }
  return null;
};

export default function Dashboard({ patients, flaggedPatients, providerAssignments, providers, onNavigate, onSelectPatient, onAssignProvider, onAddProvider }) {
  const total = patients.length;
  const collected = patients.filter(p => p.sampleCollected).length;
  const genotyped = patients.filter(p => p.genotypingComplete).length;
  const flaggedCount = flaggedPatients.length;
  const highPriority = flaggedPatients.filter(p => p.priority === 'High');

  const directCount    = patients.filter(p => p.contactPathway === 'direct' || p.contactPathway === 'both').length;
  const providerCount  = patients.filter(p => p.contactPathway === 'provider' || p.contactPathway === 'both').length;
  const noContactCount = patients.filter(p => p.contactPathway === 'none').length;

  const chartData = [
    { name: 'Not Collected',       count: total - collected },
    { name: 'Awaiting Genotyping', count: collected - genotyped },
    { name: 'Normal Result',       count: patients.filter(p => p.genotypingComplete && !p.flagged).length },
    { name: 'Actionable Variant',  count: patients.filter(p => p.genotypingComplete && p.flagged).length },
  ];

  return (
    <div className="p-4 md:p-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-500 text-sm mt-1">
          MyAfroDNA Clopidogrel Metabolism Study — overview
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard icon={Users}         label="Enrolled Patients"      value={total} />
        <StatCard icon={FlaskConical}  label="Samples Collected"      value={collected} />
        <StatCard icon={Dna}           label="Genotyped"              value={genotyped} />
        <StatCard icon={AlertTriangle} label="Flagged for Recontact"  value={flaggedCount} highlight />
      </div>

      {/* Contact pathway breakdown */}
      {total > 0 && (
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 flex items-start gap-3">
            <div className="p-1.5 bg-blue-100 rounded-lg shrink-0">
              <Phone size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-blue-700">Direct Contact Available</p>
              <p className="text-2xl font-bold text-blue-800 mt-0.5">{directCount}</p>
            </div>
          </div>
          <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 flex items-start gap-3">
            <div className="p-1.5 bg-teal-100 rounded-lg shrink-0">
              <Building2 size={16} className="text-teal-600" />
            </div>
            <div>
              <p className="text-xs font-medium text-teal-700">Provider-Mediated</p>
              <p className="text-2xl font-bold text-teal-800 mt-0.5">{providerCount}</p>
            </div>
          </div>
          <div className={`border rounded-xl p-4 flex items-start gap-3 ${noContactCount > 0 ? 'bg-amber-50 border-amber-200' : 'bg-gray-50 border-gray-200'}`}>
            <div className={`p-1.5 rounded-lg shrink-0 ${noContactCount > 0 ? 'bg-amber-100' : 'bg-gray-100'}`}>
              <AlertTriangle size={16} className={noContactCount > 0 ? 'text-amber-600' : 'text-gray-400'} />
            </div>
            <div>
              <p className={`text-xs font-medium ${noContactCount > 0 ? 'text-amber-700' : 'text-gray-500'}`}>No Contact Method</p>
              <p className={`text-2xl font-bold mt-0.5 ${noContactCount > 0 ? 'text-amber-800' : 'text-gray-600'}`}>{noContactCount}</p>
            </div>
          </div>
        </div>
      )}

      {/* Charts + attention section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Bar chart */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <h2 className="text-base font-semibold text-gray-800 mb-1">Genotyping Status Breakdown</h2>
          <p className="text-xs text-gray-500 mb-5">All {total} enrolled patients</p>
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
              <XAxis
                dataKey="name"
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tick={{ fontSize: 11, fill: '#6b7280' }}
                tickLine={false}
                axisLine={false}
                allowDecimals={false}
              />
              <Tooltip content={<CustomTooltip />} cursor={{ fill: '#f9fafb' }} />
              <Bar dataKey="count" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {chartData.map((entry) => (
                  <Cell key={entry.name} fill={STATUS_COLORS[entry.name]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
          {/* Legend */}
          <div className="flex flex-wrap gap-3 mt-4">
            {chartData.map((d) => (
              <div key={d.name} className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-sm inline-block" style={{ background: STATUS_COLORS[d.name] }} />
                <span className="text-xs text-gray-500">{d.name}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Requires Attention */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-800">Requires Attention</h2>
            <button
              onClick={() => onNavigate('flagged')}
              className="text-xs text-teal-700 hover:text-teal-900 font-medium flex items-center gap-0.5"
            >
              View all <ChevronRight size={14} />
            </button>
          </div>
          <p className="text-xs text-gray-500 mb-4">High-priority patients needing recontact</p>

          {highPriority.length === 0 ? (
            <div className="text-center py-10 text-gray-400">
              <AlertTriangle size={32} className="mx-auto mb-2 opacity-30" />
              <p className="text-sm">No high-priority flags at this time</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {highPriority.map(p => (
                <li key={p.id}>
                  <div className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors border border-transparent hover:border-gray-200">
                    <button
                      onClick={() => onSelectPatient(p)}
                      className="w-9 h-9 rounded-full bg-red-100 flex items-center justify-center shrink-0"
                    >
                      <AlertTriangle size={15} className="text-red-600" />
                    </button>
                    <button
                      onClick={() => onSelectPatient(p)}
                      className="min-w-0 flex-1 text-left"
                    >
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-semibold text-sm text-gray-900">{p.id}</span>
                        <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded font-medium">
                          {p.genotype}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 truncate mt-0.5">{p.phenotype} · {p.site}</p>
                    </button>
                    <div className="shrink-0">
                      <ProviderPicker
                        currentProvider={providerAssignments[p.id] || null}
                        providers={providers}
                        onAssign={(name) => onAssignProvider(p.id, name)}
                        onAddProvider={onAddProvider}
                      />
                    </div>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}
