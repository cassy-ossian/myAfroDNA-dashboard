import { create } from 'zustand';

const useAppStore = create((set, get) => ({
  // ── Auth ──────────────────────────────────────────────────
  user:     null,
  userRole: null,
  loading:  true,

  // ── Data ──────────────────────────────────────────────────
  profiles:            [],
  rawPatients:         [],
  studies:             {},
  activeStudyId:       null,
  providers:           [],
  recontactCases:      {},
  providerAssignments: {},
  emailedPatients:     new Set(),
  patientNotes:        {},
  visibleColumns:      null,
  rules:               [],   // all recontact_rules from Supabase
}));

export default useAppStore;
