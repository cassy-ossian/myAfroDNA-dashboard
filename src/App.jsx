import { useState, useMemo, useEffect, useCallback } from 'react';
import { Check, Loader2 } from 'lucide-react';
import logoImg from './assets/myafrodna-logo.png';
import Layout from './components/Layout';
import LoginPage from './components/LoginPage';
import BiobankDashboard from './components/BiobankDashboard';
import MasterPatientList from './components/MasterPatientList';
import Patients from './components/Patients';
import FlaggedPatients from './components/FlaggedPatients';
import RecontactWorkflow from './components/RecontactWorkflow';
import RulesPage from './components/RulesPage';
import PatientModal from './components/PatientModal';
import StudyView from './components/StudyView';
import WorkbookImport from './components/WorkbookImport';
import UserManagement from './components/UserManagement';
import { classifyPatient } from './data/flaggingRules';
import useAppStore from './store/appStore';
import {
  initAuth,
  loadDemoData,
  importPatients,
  assignProvider,
  createProvider,
  removeProvider,
  updateRecontactStatus,
  createRecontactEvent,
  markEmailed,
  updateContactPathway,
  updateContactDetails,
  setActiveStudy,
  manuallyFlagPatients,
  bulkAssignProvider,
  addPatientNote,
} from './services/dataService';
import './index.css';

// ── Full-page loading spinner ─────────────────────────────────────────────────

function AppLoader() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center gap-4">
      <img src={logoImg} alt="MyAfroDNA" className="h-16" />
      <div className="flex items-center gap-2 text-gray-500 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Loading biobank data…
      </div>
    </div>
  );
}

// ── Main app ──────────────────────────────────────────────────────────────────

export default function App() {
  // Subscribe to auth + loading state
  const user    = useAppStore(s => s.user);
  const loading = useAppStore(s => s.loading);

  // Kick off auth listener once on mount
  useEffect(() => { initAuth(); }, []);

  // Show loading spinner until auth is resolved
  if (loading) return <AppLoader />;

  // Show login page if not authenticated
  if (!user) return <LoginPage />;

  return <AuthenticatedApp />;
}

// ── Authenticated app (only mounts after login) ───────────────────────────────

function AuthenticatedApp() {
  // UI-only state
  const [activeScreen,      setActiveScreen]     = useState('dashboard');
  const [activeStudyId,     setActiveStudyIdState] = useState(null);
  const [selectedPatientId, setSelectedPatientId] = useState(null);
  const [toasts,            setToasts]           = useState([]);
  const [showImport,        setShowImport]       = useState(false);

  // Subscribe to data store
  const rawPatients         = useAppStore(s => s.rawPatients);
  const recontactCases      = useAppStore(s => s.recontactCases);
  const providers           = useAppStore(s => s.providers);
  const providerAssignments = useAppStore(s => s.providerAssignments);
  const emailedPatients     = useAppStore(s => s.emailedPatients);
  const studies             = useAppStore(s => s.studies);

  const patients        = useMemo(() => rawPatients.map(classifyPatient), [rawPatients]);
  const flaggedPatients = useMemo(() => patients.filter(p => p.flagged), [patients]);

  // Count only patients whose recontact event is still in 'flagged' stage
  const activelyFlaggedCount = useMemo(
    () => flaggedPatients.filter(p => recontactCases[p.id]?.stage === 'flagged').length,
    [flaggedPatients, recontactCases]
  );

  const selectedPatient = useMemo(
    () => selectedPatientId ? patients.find(p => p.id === selectedPatientId) ?? null : null,
    [selectedPatientId, patients]
  );

  const studyPatients = useMemo(
    () => activeStudyId ? patients.filter(p => p.studyId === activeStudyId) : [],
    [activeStudyId, patients]
  );

  // Auto-initialise newly flagged patients into the recontact workflow
  useEffect(() => {
    flaggedPatients.forEach(p => {
      createRecontactEvent({
        patientId:  p.id,
        flaggedBy:  p.flaggedBy  ?? 'auto',
        flagReason: p.manualFlag?.reason ?? null,
      });
    });
  }, [flaggedPatients]);

  // ── Toast helper ───────────────────────────────────────────────────────────
  const showToast = useCallback((message) => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, message }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3000);
  }, []);

  // ── Navigation ─────────────────────────────────────────────────────────────
  const handleNavigate = useCallback((screen, studyId = null) => {
    setActiveScreen(screen);
    setActiveStudyIdState(studyId);
    setActiveStudy(studyId);
  }, []);

  // ── Handlers ───────────────────────────────────────────────────────────────
  const handleAssignProvider = useCallback(async (patientId, providerName) => {
    await assignProvider(patientId, providerName);
    showToast(providerName ? `${providerName} assigned to ${patientId}` : `Provider removed from ${patientId}`);
  }, [showToast]);

  const handleLoadDemo = async () => {
    await loadDemoData();
    showToast('Demo data loaded');
    setActiveScreen('dashboard');
  };

  const handlePatientsImported = async (imported) => {
    await importPatients(activeStudyId, imported);
  };

  const handleSelectPatient = (patient) => setSelectedPatientId(patient?.id ?? null);

  const handleMovePatient = async (patientId, toStage, payload) => {
    await updateRecontactStatus(patientId, toStage, payload);
  };

  const handleAddProvider    = async (prov) => createProvider(prov);
  const handleRemoveProvider = async (id)   => removeProvider(id);

  const handleMarkEmailed = useCallback(async (patientId) => {
    await markEmailed(patientId);
  }, []);

  const handleUpdateContactPathway = useCallback(async (patientId, pathway) => {
    await updateContactPathway(patientId, pathway);
  }, []);

  const handleUpdateContactDetails = useCallback(async (patientId, details) => {
    await updateContactDetails(patientId, details);
  }, []);

  return (
    <>
      <Layout
        activeScreen={activeScreen}
        onNavigate={handleNavigate}
        flaggedCount={activelyFlaggedCount}
        activeStudyId={activeStudyId}
      >
        {activeScreen === 'dashboard' && (
          <BiobankDashboard
            patients={patients}
            flaggedPatients={flaggedPatients}
            recontactCases={recontactCases}
            studies={studies}
            onNavigate={handleNavigate}
            onImportWorkbook={() => setShowImport(true)}
            onLoadDemo={handleLoadDemo}
          />
        )}

        {activeScreen === 'master' && (
          <MasterPatientList
            patients={patients}
            studies={studies}
            providers={providers}
            onSelectPatient={handleSelectPatient}
            onNavigate={handleNavigate}
          />
        )}

        {activeScreen === 'study' && activeStudyId && (
          <StudyView
            study={studies[activeStudyId] ?? null}
            patients={studyPatients}
            studies={studies}
            providers={providers}
            onSelectPatient={handleSelectPatient}
            onNavigate={handleNavigate}
          />
        )}

        {activeScreen === 'patients' && (
          <Patients
            patients={patients}
            providerAssignments={providerAssignments}
            providers={providers}
            emailedPatients={emailedPatients}
            onPatientsImported={handlePatientsImported}
            onSelectPatient={handleSelectPatient}
            onLoadDemo={handleLoadDemo}
            onAssignProvider={handleAssignProvider}
            onAddProvider={handleAddProvider}
            onMarkEmailed={handleMarkEmailed}
            onUpdateContactPathway={handleUpdateContactPathway}
          />
        )}

        {activeScreen === 'flagged' && (
          <FlaggedPatients
            flaggedPatients={flaggedPatients}
            recontactCases={recontactCases}
            providerAssignments={providerAssignments}
            providers={providers}
            emailedPatients={emailedPatients}
            onSelectPatient={handleSelectPatient}
            onAssignProvider={handleAssignProvider}
            onAddProvider={handleAddProvider}
            onMarkEmailed={handleMarkEmailed}
          />
        )}

        {activeScreen === 'rules' && (
          <RulesPage onNavigate={handleNavigate} />
        )}

        {activeScreen === 'users' && (
          <UserManagement />
        )}

        {activeScreen === 'recontact' && (
          <RecontactWorkflow
            flaggedPatients={flaggedPatients}
            recontactCases={recontactCases}
            providerAssignments={providerAssignments}
            providers={providers}
            emailedPatients={emailedPatients}
            onMovePatient={handleMovePatient}
            onAddProvider={handleAddProvider}
            onRemoveProvider={handleRemoveProvider}
            onAssignProvider={handleAssignProvider}
            onMarkEmailed={handleMarkEmailed}
          />
        )}
      </Layout>

      {selectedPatient && (
        <PatientModal
          patient={selectedPatient}
          onClose={() => setSelectedPatientId(null)}
          onUpdateContactPathway={handleUpdateContactPathway}
          onUpdateContactDetails={handleUpdateContactDetails}
        />
      )}

      {showImport && (
        <WorkbookImport
          onClose={() => setShowImport(false)}
          onImported={() => { setShowImport(false); setActiveScreen('dashboard'); }}
        />
      )}

      {/* Toast stack */}
      <div className="fixed bottom-5 right-5 z-[100] flex flex-col gap-2 pointer-events-none">
        {toasts.map(t => (
          <div
            key={t.id}
            className="flex items-center gap-2 bg-gray-900 text-white text-sm px-4 py-3 rounded-xl shadow-2xl"
          >
            <Check size={14} className="text-teal-400 shrink-0" />
            {t.message}
          </div>
        ))}
      </div>
    </>
  );
}
