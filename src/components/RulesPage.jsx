import { useState, useEffect, useCallback } from 'react';
import { Plus, Play, Pencil, Trash2, ToggleLeft, ToggleRight, AlertTriangle, Loader2, BookOpen } from 'lucide-react';
import StudyBadge from './StudyBadge';
import RuleModal from './RuleModal';
import { getAllRules, runAllRules } from '../services/rulesEngine';
import { createRule, updateRule, deleteRule, toggleRule } from '../services/dataService';
import useAppStore from '../store/appStore';

const OPERATOR_LABELS = {
  eq: 'equals', neq: 'does not equal', contains: 'contains',
  gt: '>', lt: '<', in: 'is one of',
  not_empty: 'is not empty', is_empty: 'is empty',
};

function RuleCard({ rule, studies, onEdit, onDelete, onToggle }) {
  const [deleting,  setDeleting]  = useState(false);
  const [toggling,  setToggling]  = useState(false);

  const handleDelete = async () => {
    if (!confirm('Delete this rule?')) return;
    setDeleting(true);
    await onDelete(rule.id);
  };

  const handleToggle = async () => {
    setToggling(true);
    await onToggle(rule.id, !rule.is_active);
    setToggling(false);
  };

  const valueDisplay = rule.value
    ? rule.operator === 'in'
      ? `[${rule.value.split(',').map(v => v.trim()).join(', ')}]`
      : `"${rule.value}"`
    : '';

  return (
    <div className={`bg-white rounded-xl border p-4 transition-opacity ${!rule.is_active ? 'opacity-60' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2 flex-wrap min-w-0">
          <StudyBadge study={rule.study_id} studies={studies} size="xs" />
          <span className="text-xs text-gray-500 font-mono bg-gray-100 px-2 py-0.5 rounded">
            {rule.column_name}
          </span>
          <span className="text-xs text-gray-500">{OPERATOR_LABELS[rule.operator] ?? rule.operator}</span>
          {valueDisplay && (
            <span className="text-xs font-mono text-teal-700 bg-teal-50 px-2 py-0.5 rounded">{valueDisplay}</span>
          )}
          <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${
            rule.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
          }`}>
            {rule.priority}
          </span>
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={handleToggle} disabled={toggling}
            className="p-1.5 rounded-lg text-gray-400 hover:text-teal-600 hover:bg-teal-50 transition-colors"
            title={rule.is_active ? 'Deactivate' : 'Activate'}>
            {toggling ? <Loader2 size={15} className="animate-spin" />
              : rule.is_active ? <ToggleRight size={15} className="text-teal-600" /> : <ToggleLeft size={15} />}
          </button>
          <button onClick={() => onEdit(rule)}
            className="p-1.5 rounded-lg text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors">
            <Pencil size={14} />
          </button>
          <button onClick={handleDelete} disabled={deleting}
            className="p-1.5 rounded-lg text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors">
            {deleting ? <Loader2 size={14} className="animate-spin" /> : <Trash2 size={14} />}
          </button>
        </div>
      </div>
      <p className="text-sm text-gray-600 mt-2 ml-0.5">→ {rule.reason_template}</p>
    </div>
  );
}

export default function RulesPage({ onNavigate }) {
  const studies   = useAppStore(s => s.studies);
  const storeRules = useAppStore(s => s.rules);

  const [rules,      setRules]      = useState([]);
  const [loading,    setLoading]    = useState(true);
  const [running,    setRunning]    = useState(false);
  const [runResult,  setRunResult]  = useState(null);
  const [modal,      setModal]      = useState(null); // null | { rule } | { preselectedStudyId }
  const [filterStudy, setFilterStudy] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    const data = await getAllRules();
    setRules(data);
    setLoading(false);
  }, []);

  useEffect(() => { load(); }, [load]);

  // Also sync from store when rules are created/updated elsewhere
  useEffect(() => { setRules(storeRules); }, [storeRules]);

  const handleRunAll = async () => {
    setRunning(true);
    setRunResult(null);
    const result = await runAllRules();
    setRunResult(result);
    setRunning(false);
  };

  const handleSave = async (formData) => {
    if (modal?.rule) {
      await updateRule(modal.rule.id, formData);
    } else {
      await createRule(formData);
    }
    await load();
    setModal(null);
  };

  const handleDelete = async (ruleId) => {
    await deleteRule(ruleId);
    setRules(r => r.filter(x => x.id !== ruleId));
  };

  const handleToggle = async (ruleId, isActive) => {
    await toggleRule(ruleId, isActive);
    setRules(r => r.map(x => x.id === ruleId ? { ...x, is_active: isActive } : x));
  };

  const displayed = filterStudy ? rules.filter(r => r.study_id === filterStudy) : rules;

  // Group by study
  const grouped = {};
  for (const r of displayed) {
    if (!grouped[r.study_id]) grouped[r.study_id] = [];
    grouped[r.study_id].push(r);
  }

  const studyList = Object.values(studies).sort((a, b) => a.id.localeCompare(b.id));

  return (
    <div className="p-4 md:p-8 space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Recontact Rules</h1>
          <p className="text-gray-500 text-sm mt-1">
            {rules.filter(r => r.is_active).length} active rule{rules.filter(r => r.is_active).length !== 1 ? 's' : ''} across {Object.keys(grouped).length} stud{Object.keys(grouped).length !== 1 ? 'ies' : 'y'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          <button onClick={handleRunAll} disabled={running || rules.length === 0}
            className="flex items-center gap-2 px-3 py-2 border border-gray-300 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors">
            {running ? <Loader2 size={14} className="animate-spin" /> : <Play size={14} />}
            Run All Rules
          </button>
          <button onClick={() => setModal({})}
            className="flex items-center gap-2 px-4 py-2 bg-teal-700 text-white rounded-xl text-sm font-semibold hover:bg-teal-800 transition-colors">
            <Plus size={15} /> Add Rule
          </button>
        </div>
      </div>

      {/* Run result banner */}
      {runResult && (
        <div className="bg-teal-50 border border-teal-200 rounded-xl p-4 text-sm text-teal-800 flex items-start justify-between gap-3">
          <div>
            <span className="font-semibold">Rules run complete. </span>
            Evaluated {runResult.total} patients across all studies —{' '}
            <strong>{runResult.newlyFlagged}</strong> newly flagged,{' '}
            <strong>{runResult.alreadyFlagged}</strong> already flagged,{' '}
            <strong>{runResult.noMatch}</strong> no match.
          </div>
          <button onClick={() => setRunResult(null)} className="text-teal-600 hover:text-teal-800 shrink-0 text-xs underline">Dismiss</button>
        </div>
      )}

      {/* Filter by study */}
      {studyList.length > 1 && (
        <div className="flex flex-wrap gap-2">
          <button onClick={() => setFilterStudy('')}
            className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${!filterStudy ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
            All studies
          </button>
          {studyList.map(s => (
            <button key={s.id} onClick={() => setFilterStudy(f => f === s.id ? '' : s.id)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition-colors ${filterStudy === s.id ? 'bg-teal-700 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              {s.shortName || s.id}
            </button>
          ))}
        </div>
      )}

      {/* Loading */}
      {loading && (
        <div className="flex items-center justify-center py-16 gap-3 text-gray-400">
          <Loader2 size={20} className="animate-spin" />
          <span>Loading rules…</span>
        </div>
      )}

      {/* Empty state */}
      {!loading && rules.length === 0 && (
        <div className="bg-white rounded-xl border border-gray-200 p-16 text-center">
          <BookOpen size={40} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500 font-medium">No rules configured</p>
          <p className="text-gray-400 text-sm mt-1 max-w-xs mx-auto">
            Create recontact rules to automatically flag patients based on their data.
          </p>
          <button onClick={() => setModal({})}
            className="mt-4 px-4 py-2 bg-teal-700 text-white rounded-xl text-sm font-semibold hover:bg-teal-800 transition-colors">
            Add First Rule
          </button>
        </div>
      )}

      {/* Rules grouped by study */}
      {!loading && Object.keys(grouped).length > 0 && (
        <div className="space-y-6">
          {Object.entries(grouped).map(([studyId, studyRules]) => (
            <div key={studyId}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <StudyBadge study={studyId} studies={studies} />
                  <span className="text-sm text-gray-500">
                    {studyRules.filter(r => r.is_active).length} active / {studyRules.length} total
                  </span>
                </div>
                <button onClick={() => setModal({ preselectedStudyId: studyId })}
                  className="flex items-center gap-1 text-xs text-teal-600 hover:text-teal-800 font-medium">
                  <Plus size={12} /> Add rule
                </button>
              </div>
              <div className="space-y-2">
                {studyRules.map(r => (
                  <RuleCard key={r.id} rule={r} studies={studies}
                    onEdit={rule => setModal({ rule })}
                    onDelete={handleDelete}
                    onToggle={handleToggle} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {modal !== null && (
        <RuleModal
          rule={modal.rule ?? null}
          preselectedStudyId={modal.preselectedStudyId ?? null}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
