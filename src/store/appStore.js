import { create } from 'zustand';

// Central in-memory store — single source of truth for all app data.
// All reads and writes go through src/services/dataService.js.
// Components subscribe here for reactivity; the service is the only writer.
//
// When swapping to Supabase: the store becomes a local cache layer and the
// service functions change to use supabase.from(...) instead of setState.

const useAppStore = create((set, get) => ({
  rawPatients: [],        // raw imported patient rows (pre-classification)
  studies: {},            // { [studyId]: StudyRecord } — study metadata map
  activeStudyId: null,    // currently selected study in the sidebar (null = biobank view)
  providers: [],          // [{ id, name, facility, phone, email, preferredContact }]
  recontactCases: {},     // { patientId: { patientId, stage, stageEnteredAt, assignedProvider, flaggedBy, flagReason, history[] } }
  providerAssignments: {},// { patientId: providerName }
  emailedPatients: new Set(), // Set<patientId>
  patientNotes: {},       // { patientId: [{ id, text, timestamp, type: 'manual'|'system' }] }
  visibleColumns: null,   // null = use defaults; string[] = explicit column list
}));

export default useAppStore;
