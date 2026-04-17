import { useState } from 'react';
import {
  LayoutDashboard, AlertTriangle, GitMerge, Menu, X,
  ChevronDown, ChevronRight, Database, LogOut, BookOpen, Trash2, Users,
} from 'lucide-react';
import { getCategoryStyle } from '../data/studyCategories';
import useAppStore from '../store/appStore';
import { signOut, resetAllData } from '../services/dataService';
import ConfirmModal from './ConfirmModal';
import logoImg from '../assets/myafrodna-logo.png';

const BIOBANK_NAV = [
  { key: 'dashboard', label: 'Biobank Overview',      Icon: LayoutDashboard },
  { key: 'master',    label: 'All Patients',           Icon: Database },
  { key: 'flagged',   label: 'Flagged for Recontact',  Icon: AlertTriangle },
  { key: 'recontact', label: 'Recontact Workflow',     Icon: GitMerge },
  { key: 'rules',     label: 'Recontact Rules',        Icon: BookOpen },
];

function StudiesSection({ studies, activeScreen, activeStudyId, patientCounts, onNavigate, onClose }) {
  const [open, setOpen] = useState(true);
  // Alphabetical order
  const studyList = Object.values(studies).sort((a, b) => a.id.localeCompare(b.id));

  if (studyList.length === 0) return null;

  return (
    <div className="mt-1">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-2 px-3 py-1.5 text-teal-400 hover:text-teal-200 text-xs font-semibold uppercase tracking-wider transition-colors"
      >
        {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
        Studies
        <span className="ml-auto text-teal-500 font-normal normal-case tracking-normal">{studyList.length}</span>
      </button>

      {open && (
        <div className="mt-1">
          {studyList.map(study => {
            const isActive = activeScreen === 'study' && activeStudyId === study.id;
            const catStyle = getCategoryStyle(study.category ?? 'Other');
            return (
              <button
                key={study.id}
                onClick={() => { onNavigate('study', study.id); onClose?.(); }}
                className={`w-full flex items-center gap-2.5 pl-5 pr-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'bg-teal-600 text-white'
                    : 'text-teal-200 hover:bg-teal-800 hover:text-white'
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${catStyle.dot}`} />
                <span className="flex-1 text-left font-mono">{study.shortName || study.id}</span>
                <span className={`text-[10px] tabular-nums ${isActive ? 'text-teal-200' : 'text-teal-500'}`}>
                  {patientCounts?.[study.id] ?? '—'}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

function NavContent({ activeScreen, activeStudyId, onNavigate, flaggedCount, studies, patientCounts, onClose, onResetData, userRole }) {
  return (
    <nav className="flex flex-col h-full">
      {/* Brand — clickable, navigates to Dashboard */}
      <div className="px-4 py-5 border-b border-teal-800">
        <button
          type="button"
          onClick={() => { onNavigate('dashboard'); onClose?.(); }}
          className="block w-full cursor-pointer text-center"
        >
          <img src={logoImg} alt="MyAfroDNA" className="h-10 w-auto mx-auto" />
          <p className="text-teal-400 text-[10px] mt-1">Genomic Medicine Platform</p>
        </button>
      </div>

      {/* Scrollable nav area */}
      <div className="flex-1 overflow-y-auto py-3 px-3 space-y-0.5">
        {/* Biobank-level navigation */}
        {BIOBANK_NAV.map(({ key, label, Icon }) => {
          const active = activeScreen === key && (key !== 'study');
          return (
            <button
              key={key}
              onClick={() => { onNavigate(key); onClose?.(); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-teal-600 text-white'
                  : 'text-teal-100 hover:bg-teal-800 hover:text-white'
              }`}
            >
              <Icon size={17} className="shrink-0" />
              <span className="flex-1 text-left">{label}</span>
              {key === 'flagged' && flaggedCount > 0 && (
                <span className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${
                  active ? 'bg-teal-500 text-white' : 'bg-amber-400 text-amber-900'
                }`}>
                  {flaggedCount}
                </span>
              )}
            </button>
          );
        })}

        {/* Admin-only: User Management */}
        {userRole === 'admin' && (
          <button
            onClick={() => { onNavigate('users'); onClose?.(); }}
            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              activeScreen === 'users'
                ? 'bg-teal-600 text-white'
                : 'text-teal-100 hover:bg-teal-800 hover:text-white'
            }`}
          >
            <Users size={17} className="shrink-0" />
            <span className="flex-1 text-left">User Management</span>
          </button>
        )}

        {/* Per-study section */}
        <div className="border-t border-teal-800 mt-2 pt-2">
          <StudiesSection
            studies={studies}
            patientCounts={patientCounts}
            activeScreen={activeScreen}
            activeStudyId={activeStudyId}
            onNavigate={onNavigate}
            onClose={onClose}
          />
        </div>
      </div>

      {/* Footer: studies count + sign out */}
      <div className="px-4 py-4 border-t border-teal-800 space-y-2">
        <p className="text-xs text-teal-400 font-medium px-1">
          {Object.values(studies).length} stud{Object.values(studies).length !== 1 ? 'ies' : 'y'} loaded
        </p>
        {userRole === 'admin' && (
          <button
            onClick={onResetData}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-red-400 hover:bg-red-900/30 hover:text-red-300 transition-colors">
            <Trash2 size={14} />
            Reset All Data
          </button>
        )}
        <button
          onClick={() => signOut()}
          className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-teal-300 hover:bg-teal-800 hover:text-white transition-colors"
        >
          <LogOut size={14} />
          Sign out
        </button>
      </div>
    </nav>
  );
}

export default function Layout({ activeScreen, onNavigate, flaggedCount, activeStudyId, children }) {
  const [mobileOpen,    setMobileOpen]    = useState(false);
  const [resetStep,     setResetStep]     = useState(0); // 0=closed, 1=warn, 2=type RESET
  const [resetInput,    setResetInput]    = useState('');
  const [resetting,     setResetting]     = useState(false);
  const studies     = useAppStore(s => s.studies);
  const rawPatients = useAppStore(s => s.rawPatients);
  const userRole    = useAppStore(s => s.userRole);

  const handleReset = async () => {
    setResetting(true);
    await resetAllData();
    setResetting(false);
    setResetStep(0);
    setResetInput('');
  };
  const patientCounts = Object.fromEntries(
    Object.keys(studies).map(id => [id, rawPatients.filter(p => p.studyId === id).length])
  );

  const activeName = activeScreen === 'study' && activeStudyId
    ? (studies[activeStudyId]?.name ?? activeStudyId)
    : BIOBANK_NAV.find(n => n.key === activeScreen)?.label ?? '';

  return (
    <div className="flex h-screen overflow-hidden bg-gray-50">
      {/* Desktop sidebar */}
      <aside className="hidden md:flex flex-col w-60 bg-teal-900 shrink-0">
        <NavContent
          activeScreen={activeScreen}
          activeStudyId={activeStudyId}
          onNavigate={onNavigate}
          flaggedCount={flaggedCount}
          studies={studies}
          patientCounts={patientCounts}
          onResetData={() => setResetStep(1)}
          userRole={userRole}
        />
      </aside>

      {/* Mobile sidebar overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-black/50" onClick={() => setMobileOpen(false)} />
          <aside className="absolute left-0 top-0 bottom-0 w-64 bg-teal-900 z-50 flex flex-col">
            <div className="flex justify-end p-3">
              <button onClick={() => setMobileOpen(false)} className="p-2 text-teal-300 hover:text-white">
                <X size={20} />
              </button>
            </div>
            <NavContent
              activeScreen={activeScreen}
              activeStudyId={activeStudyId}
              onNavigate={onNavigate}
              flaggedCount={flaggedCount}
              studies={studies}
              patientCounts={patientCounts}
              onClose={() => setMobileOpen(false)}
              onResetData={() => setResetStep(1)}
              userRole={userRole}
            />
          </aside>
        </div>
      )}

      {/* Main area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Mobile top bar */}
        <div className="md:hidden flex items-center gap-3 px-4 py-3 bg-teal-900 border-b border-teal-800">
          <button onClick={() => setMobileOpen(true)} className="p-1.5 text-teal-200 hover:text-white">
            <Menu size={22} />
          </button>
          <div className="flex items-center gap-2">
            <img src={logoImg} alt="MyAfroDNA" className="h-6 w-auto" />
          </div>
          {activeName && (
            <span className="text-teal-300 text-sm ml-auto truncate max-w-32">{activeName}</span>
          )}
        </div>

        {/* Content scroll area */}
        <main className="flex-1 overflow-y-auto">
          {children}
        </main>
      </div>

      {resetStep === 1 && (
        <ConfirmModal
          title="Reset All Data"
          message="This will permanently delete ALL studies, patients, and recontact data. Are you sure?"
          confirmLabel="Continue"
          danger
          onConfirm={() => { setResetStep(2); setResetInput(''); }}
          onCancel={() => setResetStep(0)}
        />
      )}
      {resetStep === 2 && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md p-6 space-y-4">
            <h2 className="text-lg font-bold text-red-700">Final Confirmation</h2>
            <p className="text-sm text-gray-600">
              This action is irreversible. Type <strong className="font-mono text-red-700">RESET</strong> to confirm.
            </p>
            <input
              type="text"
              value={resetInput}
              onChange={e => setResetInput(e.target.value)}
              placeholder="Type RESET"
              autoFocus
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-red-500"
            />
            <div className="flex gap-2 pt-2">
              <button
                onClick={() => { setResetStep(0); setResetInput(''); }}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleReset}
                disabled={resetInput !== 'RESET' || resetting}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                {resetting ? 'Resetting…' : 'Delete Everything'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
