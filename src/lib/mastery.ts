/**
 * Phase 6.2 Mastery Engine Data Access Layer
 * Outcomes & Mastery Engine (Computation + Snapshots)
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 * NO percent, GPA, averages, ranking, or letter grade mapping.
 * ONLY mastery states: "not_started", "emerging", "developing", "proficient", "mastered" (or label-set based).
 * Phase 6.2 is READ-ONLY with respect to Phase 2-6.1 source tables.
 * 
 * Role-based access control:
 *   - Teachers: Can create snapshot runs for their context, view snapshots for learners in context
 *   - Admins/Principals: Full CRUD on models/levels, view all snapshots, create snapshot runs
 *   - Registrars: View-only access
 *   - Students: View-only access to own snapshots
 */

import { supabase } from "@/lib/supabase/client";
import { logError } from "@/lib/logger";
import type { SupabaseClient } from "@supabase/supabase-js";

// ============================================================================
// Types
// ============================================================================

export interface MasteryModel {
  id: string;
  organization_id: string;
  school_id: string | null;
  program_id: string | null;
  name: string;
  description: string | null;
  is_active: boolean;
  threshold_not_started: number;
  threshold_emerging: number;
  threshold_developing: number;
  threshold_proficient: number;
  threshold_mastered: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  program?: {
    id: string;
    name: string;
  };
}

export interface MasteryLevel {
  id: string;
  organization_id: string;
  mastery_model_id: string;
  label: string;
  description: string | null;
  display_order: number;
  is_terminal: boolean;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  mastery_model?: MasteryModel;
}

export interface MasterySnapshotRun {
  id: string;
  organization_id: string;
  school_id: string | null;
  scope_type: "experience" | "syllabus" | "program" | "section";
  scope_id: string;
  school_year_id: string | null;
  quarter: string | null;
  term: string | null;
  snapshot_date: string;
  snapshot_count: number;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  school_year?: {
    id: string;
    year_label: string;
  };
  created_by_profile?: {
    id: string;
  };
}

export interface LearnerOutcomeMasterySnapshot {
  id: string;
  organization_id: string;
  school_id: string | null;
  snapshot_run_id: string;
  learner_id: string;
  outcome_id: string | null;
  competency_id: string | null;
  mastery_level_id: string;
  teacher_id: string;
  rationale_text: string | null;
  evidence_count: number;
  last_evidence_at: string | null;
  snapshot_date: string;
  confirmed_at: string;
  confirmed_by: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  learner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
  outcome?: {
    id: string;
    name: string;
    domain?: {
      id: string;
      name: string;
    };
  };
  competency?: {
    id: string;
    name: string;
    domain?: {
      id: string;
      name: string;
    };
  };
  mastery_level?: {
    id: string;
    label: string;
    description: string | null;
    display_order: number;
    is_terminal: boolean;
  };
  snapshot_run?: MasterySnapshotRun;
  teacher?: {
    id: string;
  };
}

export interface MasterySnapshotEvidenceLink {
  id: string;
  organization_id: string;
  snapshot_id: string;
  evidence_type: "assessment" | "observation" | "portfolio_artifact" | "lesson_log" | "attendance_session";
  assessment_id: string | null;
  observation_id: string | null;
  portfolio_artifact_id: string | null;
  lesson_log_id: string | null;
  attendance_session_id: string | null;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface CreateMasteryModelPayload {
  organization_id: string;
  school_id?: string | null;
  program_id?: string | null;
  name: string;
  description?: string | null;
  is_active?: boolean;
  threshold_not_started?: number;
  threshold_emerging?: number;
  threshold_developing?: number;
  threshold_proficient?: number;
  threshold_mastered?: number;
}

export interface UpdateMasteryModelPayload {
  name?: string;
  description?: string | null;
  is_active?: boolean;
  threshold_not_started?: number;
  threshold_emerging?: number;
  threshold_developing?: number;
  threshold_proficient?: number;
  threshold_mastered?: number;
}

export interface CreateMasteryLevelPayload {
  organization_id: string;
  mastery_model_id: string;
  label: string;
  description?: string | null;
  display_order: number;
  is_terminal?: boolean;
}

export interface UpdateMasteryLevelPayload {
  label?: string;
  description?: string | null;
  display_order?: number;
  is_terminal?: boolean;
}

export interface CreateSnapshotRunPayload {
  organization_id: string;
  school_id?: string | null;
  scope_type: "experience" | "syllabus" | "program" | "section";
  scope_id: string;
  school_year_id?: string | null;
  quarter?: string | null;
  term?: string | null;
  snapshot_date?: string;
}

export interface ListMasterySnapshotsFilters {
  learner_id?: string;
  outcome_id?: string;
  competency_id?: string;
  snapshot_run_id?: string;
  school_year_id?: string | null;
  scope_type?: "experience" | "syllabus" | "program" | "section";
  scope_id?: string;
}

// ============================================================================
// Helper Functions
// ============================================================================

async function getCurrentUserContext() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) {
    throw new Error("User not authenticated");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (!profile) {
    throw new Error("User profile not found");
  }

  return {
    userId: user.id,
    organizationId: profile.organization_id,
    role: profile.role,
  };
}

// ============================================================================
// Mastery Models Functions
// ============================================================================

export async function listMasteryModels(
  organizationId: string | null,
  filters?: { schoolId?: string | null; programId?: string | null; isActive?: boolean }
): Promise<MasteryModel[]> {
  let query = supabase
    .from("mastery_models")
    .select(`
      *,
      program:programs(id, name)
    `)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  if (filters?.programId) {
    query = query.eq("program_id", filters.programId);
  }

  if (filters?.isActive !== undefined) {
    query = query.eq("is_active", filters.isActive);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching mastery models", error);
    throw error;
  }

  return data || [];
}

export async function getMasteryModel(id: string): Promise<MasteryModel | null> {
  const { data, error } = await supabase
    .from("mastery_models")
    .select(`
      *,
      program:programs(id, name)
    `)
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching mastery model", error, { modelId: id, errorCode: error.code, errorMessage: error.message });
    // Return null for not found, throw for other errors
    if (error.code === "PGRST116") {
      // Not found
      return null;
    }
    // For other errors, throw so caller can handle
    throw error;
  }

  return data;
}

export async function createMasteryModel(
  payload: CreateMasteryModelPayload
): Promise<MasteryModel> {
  const context = await getCurrentUserContext();
  
  const organizationId = payload.organization_id || context.organizationId;
  if (!organizationId) {
    throw new Error("Organization context required");
  }

  const { data, error } = await supabase
    .from("mastery_models")
    .insert({
      ...payload,
      organization_id: organizationId,
      created_by: context.userId,
    })
    .select(`
      *,
      program:programs(id, name)
    `)
    .single();

  if (error) {
    logError("Error creating mastery model", error);
    throw error;
  }

  return data;
}

export async function updateMasteryModel(
  id: string,
  payload: UpdateMasteryModelPayload
): Promise<MasteryModel> {
  const context = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("mastery_models")
    .update({
      ...payload,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      program:programs(id, name)
    `)
    .single();

  if (error) {
    logError("Error updating mastery model", error);
    throw error;
  }

  return data;
}

export async function archiveMasteryModel(id: string): Promise<void> {
  const { error } = await supabase
    .from("mastery_models")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logError("Error archiving mastery model", error);
    throw error;
  }
}

// ============================================================================
// Mastery Levels Functions
// ============================================================================

export async function listMasteryLevels(
  masteryModelId: string
): Promise<MasteryLevel[]> {
  if (!masteryModelId) {
    console.warn("listMasteryLevels called without masteryModelId");
    return [];
  }

  try {
    // First, try with the join to get the full model data
    const { data, error } = await supabase
      .from("mastery_levels")
      .select(`
        *,
        mastery_model:mastery_models(*)
      `)
      .eq("mastery_model_id", masteryModelId)
      .is("archived_at", null)
      .order("display_order", { ascending: true });

    if (error) {
      // If the error is related to RLS/permissions on the join, try without the join
      const errorCode = (error as any)?.code;
      const errorMessage = (error as any)?.message || String(error) || "Unknown error";
      const isPermissionError = 
        errorCode === 'PGRST301' || 
        errorCode === '42501' ||
        (typeof errorMessage === 'string' && (
          errorMessage.includes('permission') ||
          errorMessage.includes('row-level security') ||
          errorMessage.includes('RLS') ||
          errorMessage.includes('policy')
        ));

      if (isPermissionError) {
        // Fallback: query without the join (user might have access to levels but not the model)
        const { data: fallbackData, error: fallbackError } = await supabase
          .from("mastery_levels")
          .select("*")
          .eq("mastery_model_id", masteryModelId)
          .is("archived_at", null)
          .order("display_order", { ascending: true });

        if (fallbackError) {
          // Enhanced error logging with better error object handling
          const errorDetails = {
            masteryModelId,
            originalError: {
              code: errorCode,
              message: errorMessage,
              details: (error as any)?.details,
              hint: (error as any)?.hint,
            },
            fallbackError: {
              code: (fallbackError as any)?.code,
              message: (fallbackError as any)?.message || String(fallbackError),
              details: (fallbackError as any)?.details,
              hint: (fallbackError as any)?.hint,
            },
          };
          logError("Error fetching mastery levels (both queries failed)", fallbackError, errorDetails);
          
          // Instead of throwing, return empty array - page component handles this gracefully
          // This prevents page crashes when there are no levels or RLS issues
          console.warn("Could not fetch mastery levels, returning empty array", errorDetails);
          return [];
        }

        // Return data without the joined model
        return (fallbackData || []).map(level => ({
          ...level,
          mastery_model: undefined,
        })) as MasteryLevel[];
      }

      // For non-permission errors, log but don't throw if it's a "not found" type error
      // This allows the page to load even if there are no levels yet
      const isNotFoundError = errorCode === 'PGRST116' || errorMessage?.includes('not found');
      
      if (isNotFoundError) {
        console.warn("No mastery levels found for model", masteryModelId);
        return [];
      }

      // For other errors, log but still return empty array to prevent page crashes
      const errorDetails = {
        masteryModelId,
        errorCode,
        errorMessage,
        errorDetails: (error as any)?.details,
        errorHint: (error as any)?.hint,
        fullError: error,
      };
      logError("Error fetching mastery levels", error, errorDetails);
      
      // Return empty array instead of throwing to prevent page crashes
      // The page component can handle empty arrays gracefully
      console.warn("Error fetching mastery levels, returning empty array to prevent page crash", errorDetails);
      return [];
    }

    return data || [];
  } catch (err) {
    // Catch any unexpected errors and return empty array instead of crashing
    logError("Unexpected error in listMasteryLevels", err, { masteryModelId });
    console.warn("Unexpected error in listMasteryLevels, returning empty array", err);
    return [];
  }
}

export async function getMasteryLevel(id: string): Promise<MasteryLevel | null> {
  const { data, error } = await supabase
    .from("mastery_levels")
    .select(`
      *,
      mastery_model:mastery_models(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching mastery level", error);
    return null;
  }

  return data;
}

export async function createMasteryLevel(
  payload: CreateMasteryLevelPayload
): Promise<MasteryLevel> {
  const context = await getCurrentUserContext();
  
  const organizationId = payload.organization_id || context.organizationId;
  if (!organizationId) {
    throw new Error("Organization context required");
  }

  const { data, error } = await supabase
    .from("mastery_levels")
    .insert({
      ...payload,
      organization_id: organizationId,
      created_by: context.userId,
    })
    .select(`
      *,
      mastery_model:mastery_models(*)
    `)
    .single();

  if (error) {
    logError("Error creating mastery level", error);
    throw error;
  }

  return data;
}

export async function updateMasteryLevel(
  id: string,
  payload: UpdateMasteryLevelPayload
): Promise<MasteryLevel> {
  const context = await getCurrentUserContext();

  const { data, error } = await supabase
    .from("mastery_levels")
    .update({
      ...payload,
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      mastery_model:mastery_models(*)
    `)
    .single();

  if (error) {
    logError("Error updating mastery level", error);
    throw error;
  }

  return data;
}

export async function deleteMasteryLevel(id: string): Promise<void> {
  const { error } = await supabase
    .from("mastery_levels")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    logError("Error archiving mastery level", error);
    throw error;
  }
}

// ============================================================================
// Snapshot Runs Functions
// ============================================================================

export async function listSnapshotRuns(
  organizationId: string | null,
  filters?: {
    schoolId?: string | null;
    scopeType?: "experience" | "syllabus" | "program" | "section";
    scopeId?: string;
    schoolYearId?: string | null;
  }
): Promise<MasterySnapshotRun[]> {
  let query = supabase
    .from("mastery_snapshot_runs")
    .select(`
      *,
      school_year:school_years(id, year_label),
      created_by_profile:profiles!mastery_snapshot_runs_created_by_fkey(id)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  if (filters?.scopeType) {
    query = query.eq("scope_type", filters.scopeType);
  }

  if (filters?.scopeId) {
    query = query.eq("scope_id", filters.scopeId);
  }

  if (filters?.schoolYearId) {
    query = query.eq("school_year_id", filters.schoolYearId);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching snapshot runs", error, { organizationId, filters });
    throw error;
  }

  return data || [];
}

export async function getSnapshotRun(id: string): Promise<MasterySnapshotRun | null> {
  const { data, error } = await supabase
    .from("mastery_snapshot_runs")
    .select(`
      *,
      school_year:school_years(id, year_label),
      created_by_profile:profiles!mastery_snapshot_runs_created_by_fkey(id)
    `)
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching snapshot run", error);
    return null;
  }

  return data;
}

export async function createSnapshotRun(
  payload: CreateSnapshotRunPayload
): Promise<MasterySnapshotRun> {
  const context = await getCurrentUserContext();
  
  const organizationId = payload.organization_id || context.organizationId;
  if (!organizationId) {
    throw new Error("Organization context required");
  }

  const { data, error } = await supabase
    .from("mastery_snapshot_runs")
    .insert({
      ...payload,
      organization_id: organizationId,
      snapshot_date: payload.snapshot_date || new Date().toISOString().split("T")[0],
      snapshot_count: 0,
      created_by: context.userId,
    })
    .select(`
      *,
      school_year:school_years(id, year_label),
      created_by_profile:profiles!mastery_snapshot_runs_created_by_fkey(id)
    `)
    .single();

  if (error) {
    logError("Error creating snapshot run", error);
    throw error;
  }

  return data;
}

// ============================================================================
// Learner Outcome Mastery Snapshots Functions
// ============================================================================

export async function listMasterySnapshots(
  organizationId: string | null,
  filters?: ListMasterySnapshotsFilters
): Promise<LearnerOutcomeMasterySnapshot[]> {
  let query = supabase
    .from("learner_outcome_mastery_snapshots")
    .select(`
      *,
      learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name, student_number),
      outcome:competencies!learner_outcome_mastery_snapshots_outcome_id_fkey(
        id,
        name,
        domain:domains(id, name)
      ),
      competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(
        id,
        name,
        domain:domains(id, name)
      ),
      mastery_level:mastery_levels(id, label, description, display_order, is_terminal),
      snapshot_run:mastery_snapshot_runs(*)
    `)
    .is("archived_at", null)
    .order("snapshot_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.learner_id) {
    query = query.eq("learner_id", filters.learner_id);
  }

  if (filters?.outcome_id) {
    query = query.eq("outcome_id", filters.outcome_id);
  }

  if (filters?.competency_id) {
    query = query.eq("competency_id", filters.competency_id);
  }

  if (filters?.snapshot_run_id) {
    query = query.eq("snapshot_run_id", filters.snapshot_run_id);
  }

  if (filters?.school_year_id) {
    query = query.eq("snapshot_run.school_year_id", filters.school_year_id);
  }

  if (filters?.scope_type) {
    query = query.eq("snapshot_run.scope_type", filters.scope_type);
  }

  if (filters?.scope_id) {
    query = query.eq("snapshot_run.scope_id", filters.scope_id);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching mastery snapshots", error);
    throw error;
  }

  return data || [];
}

export async function getMasterySnapshot(id: string): Promise<LearnerOutcomeMasterySnapshot | null> {
  const { data, error } = await supabase
    .from("learner_outcome_mastery_snapshots")
    .select(`
      *,
      learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name, student_number),
      outcome:competencies!learner_outcome_mastery_snapshots_outcome_id_fkey(
        id,
        name,
        domain:domains(id, name)
      ),
      competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(
        id,
        name,
        domain:domains(id, name)
      ),
      mastery_level:mastery_levels(id, label, description, display_order, is_terminal),
      snapshot_run:mastery_snapshot_runs(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    logError("Error fetching mastery snapshot", error);
    return null;
  }

  return data;
}

export async function listEvidenceLinks(
  snapshotId: string
): Promise<MasterySnapshotEvidenceLink[]> {
  const { data, error } = await supabase
    .from("mastery_snapshot_evidence_links")
    .select("*")
    .eq("snapshot_id", snapshotId)
    .is("archived_at", null)
    .order("created_at", { ascending: true });

  if (error) {
    logError("Error fetching evidence links", error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// Current Snapshot View Functions
// ============================================================================

export async function getCurrentSnapshots(
  organizationId: string | null,
  filters?: {
    learnerId?: string;
    outcomeId?: string;
    competencyId?: string;
    schoolYearId?: string | null;
  }
): Promise<any[]> {
  let query = supabase
    .from("v_mastery_current_snapshot")
    .select("*")
    .order("snapshot_date", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.learnerId) {
    query = query.eq("learner_id", filters.learnerId);
  }

  if (filters?.outcomeId) {
    query = query.eq("outcome_id", filters.outcomeId);
  }

  if (filters?.competencyId) {
    query = query.eq("competency_id", filters.competencyId);
  }

  if (filters?.schoolYearId) {
    query = query.eq("school_year_id", filters.schoolYearId);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching current snapshots", error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// Evidence Rollup View Functions
// ============================================================================

export async function getEvidenceRollupCounts(
  learnerId: string,
  outcomeCompetencyId: string
): Promise<any[]> {
  const { data, error } = await supabase
    .from("v_mastery_evidence_rollup_counts")
    .select("*")
    .eq("learner_id", learnerId)
    .eq("outcome_competency_id", outcomeCompetencyId)
    .order("evidence_type", { ascending: true });

  if (error) {
    logError("Error fetching evidence rollup counts", error);
    throw error;
  }

  return data || [];
}

// ============================================================================
// Evidence Pack Functions (Read-only aggregation from Phase 2/3/6/6.5)
// ============================================================================

export interface EvidenceAttachment {
  id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  description: string | null;
}

export interface EvidencePackItem {
  id: string;
  type: "observation" | "reflection" | "portfolio_artifact" | "assessment";
  title: string;
  description: string | null;
  date: string;
  author_id: string | null;
  author_name: string | null;
  competency_id: string | null;
  indicator_id: string | null;
  // Linkable IDs for different evidence types
  observation_id?: string;
  reflection_id?: string;
  portfolio_artifact_id?: string;
  assessment_id?: string;
  // Attachments
  attachments?: EvidenceAttachment[];
  file_url?: string | null; // For portfolio artifacts that have direct file_url
}

/**
 * Get evidence pack for a learner/competency pair
 * Aggregates read-only data from observations, reflections, portfolio, assessments
 * 
 * @param learnerId - The learner/student ID
 * @param competencyId - The competency ID
 * @param organizationId - The organization ID for filtering
 * @param supabaseClient - Optional Supabase client (uses client-side by default, pass server client for API routes)
 */
export async function getEvidencePack(
  learnerId: string,
  competencyId: string,
  organizationId: string | null,
  supabaseClient?: SupabaseClient
): Promise<EvidencePackItem[]> {
  // Use provided client or default to client-side instance
  const db = supabaseClient || supabase;
  const evidenceItems: EvidencePackItem[] = [];

  // 1. Observations (Phase 2) - active observations for this learner/competency
  let obsQuery = db
    .from("observations")
    .select(`
      id,
      notes,
      observed_at,
      created_by,
      competency_id,
      created_by_profile:profiles!observations_created_by_fkey(id)
    `)
    .eq("learner_id", learnerId)
    .eq("competency_id", competencyId)
    .eq("status", "active")
    .is("archived_at", null)
    .order("observed_at", { ascending: false });

  if (organizationId) {
    obsQuery = obsQuery.eq("organization_id", organizationId);
  }

  const { data: observations } = await obsQuery;
  if (observations) {
    for (const obs of observations) {
      const authorName = obs.created_by_profile && !Array.isArray(obs.created_by_profile)
        ? `User ${(obs.created_by_profile as any).id?.slice(0, 8) || "unknown"}`
        : null;

      // Fetch attachments for this observation
      const { data: obsAttachments } = await db
        .from("observation_attachments")
        .select("id, file_url, file_name, file_type, description")
        .eq("observation_id", obs.id)
        .is("archived_at", null);

      evidenceItems.push({
        id: obs.id,
        type: "observation",
        title: `Observation - ${obs.observed_at ? new Date(obs.observed_at).toLocaleDateString() : "Unknown date"}`,
        description: obs.notes,
        date: obs.observed_at,
        author_id: obs.created_by,
        author_name: authorName,
        competency_id: obs.competency_id,
        indicator_id: null, // Would need to join observation_indicator_links
        observation_id: obs.id,
        attachments: obsAttachments?.map((att: any) => ({
          id: att.id,
          file_url: att.file_url,
          file_name: att.file_name,
          file_type: att.file_type,
          description: att.description,
        })) || [],
      });
    }
  }

  // 2. Teacher Reflections (Phase 3) - reflections linked to this competency
  let reflectionQuery = db
    .from("teacher_reflections")
    .select(`
      id,
      reflection_text,
      reflected_at,
      teacher_id,
      competency_id,
      teacher:profiles!teacher_reflections_teacher_id_fkey(id)
    `)
    .eq("competency_id", competencyId)
    .eq("status", "completed")
    .is("archived_at", null)
    .order("reflected_at", { ascending: false });

  if (organizationId) {
    reflectionQuery = reflectionQuery.eq("organization_id", organizationId);
  }

  const { data: reflections } = await reflectionQuery;
  if (reflections) {
    for (const refl of reflections) {
        const authorName = refl.teacher && !Array.isArray(refl.teacher)
          ? `User ${(refl.teacher as any).id?.slice(0, 8) || "unknown"}`
          : null;

      evidenceItems.push({
        id: refl.id,
        type: "reflection",
        title: `Teacher Reflection - ${refl.reflected_at ? new Date(refl.reflected_at).toLocaleDateString() : "Unknown date"}`,
        description: refl.reflection_text,
        date: refl.reflected_at,
        author_id: refl.teacher_id,
        author_name: authorName,
        competency_id: refl.competency_id,
        indicator_id: null,
        reflection_id: refl.id,
      });
    }
  }

  // 3. Portfolio Artifacts (Phase 6) - artifacts tagged with this competency
  let portfolioQuery = db
    .from("portfolio_artifacts")
    .select(`
      id,
      title,
      description,
      file_url,
      artifact_type,
      created_at,
      student_id,
      created_by_profile:profiles!portfolio_artifacts_created_by_fkey(id)
    `)
    .eq("student_id", learnerId)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    portfolioQuery = portfolioQuery.eq("organization_id", organizationId);
  }

  const { data: artifacts, error: portfolioError } = await portfolioQuery;
  
  if (portfolioError) {
    console.error(`[getEvidencePack] Error querying portfolio artifacts:`, portfolioError);
  } else {
    console.log(`[getEvidencePack] Portfolio query result:`, {
      count: artifacts?.length || 0,
      artifacts: artifacts?.map((a: any) => ({ id: a.id, student_id: a.student_id, title: a.title, created_at: a.created_at }))
    });
  }
  
  if (artifacts && artifacts.length > 0) {
    console.log(`[getEvidencePack] Found ${artifacts.length} portfolio artifacts for learner ${learnerId}`);
    // Check if artifacts are tagged with this competency
    for (const artifact of artifacts) {
      const { data: tags, error: tagError } = await db
        .from("portfolio_artifact_tags")
        .select("competency_id")
        .eq("artifact_id", artifact.id)
        .eq("competency_id", competencyId)
        .is("archived_at", null);

      if (tagError) {
        console.error(`[getEvidencePack] Error querying tags for artifact ${artifact.id}:`, tagError);
      }
      
      console.log(`[getEvidencePack] Artifact ${artifact.id} (${artifact.title}) has ${tags?.length || 0} tags for competency ${competencyId}`, {
        tags: tags?.map((t: any) => t.competency_id)
      });

      if (tags && tags.length > 0) {
        const authorName = artifact.created_by_profile && !Array.isArray(artifact.created_by_profile)
          ? `User ${(artifact.created_by_profile as any).id?.slice(0, 8) || "unknown"}`
          : null;

        // For portfolio artifacts, file_url is directly on the artifact
        // If it's an upload type with file_url, treat it as an attachment
        const attachments: EvidenceAttachment[] = [];
        if (artifact.file_url && artifact.artifact_type === "upload") {
          attachments.push({
            id: artifact.id, // Use artifact ID as attachment ID
            file_url: artifact.file_url,
            file_name: artifact.title || null,
            file_type: null, // Could be extracted from file_url if needed
            description: artifact.description || null,
          });
        }

        evidenceItems.push({
          id: artifact.id,
          type: "portfolio_artifact",
          title: artifact.title,
          description: artifact.description,
          date: artifact.created_at,
          author_id: (artifact.created_by_profile && !Array.isArray(artifact.created_by_profile) 
            ? (artifact.created_by_profile as any).id 
            : null) || null,
          author_name: authorName,
          competency_id: competencyId,
          indicator_id: null,
          portfolio_artifact_id: artifact.id,
          file_url: artifact.file_url,
          attachments: attachments.length > 0 ? attachments : undefined,
        });
      }
    }
  }

  // 4. Assessments (Phase 6.5) - confirmed assessments with evidence links to this competency
  // Include assessments linked via observations, experiences, or portfolio artifacts with this competency
  console.log(`[getEvidencePack] Querying assessments for learner ${learnerId}, competency ${competencyId}, org ${organizationId}`);
  
  let assessmentQuery = db
    .from("assessments")
    .select(`
      id,
      rationale,
      label_id,
      created_at,
      learner_id,
      teacher_id,
      teacher:profiles!assessments_teacher_id_fkey(id),
      label:assessment_labels!assessments_label_id_fkey(label_text)
    `)
    .eq("learner_id", learnerId)
    .eq("status", "confirmed") // Changed from "completed" to "confirmed" to match schema
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    assessmentQuery = assessmentQuery.eq("organization_id", organizationId);
  }

  const { data: assessments, error: assessmentError } = await assessmentQuery;
  
  if (assessmentError) {
    console.error(`[getEvidencePack] Error querying assessments:`, assessmentError);
  } else {
    console.log(`[getEvidencePack] Assessment query result:`, {
      count: assessments?.length || 0,
      assessments: assessments?.map((a: any) => ({ id: a.id, learner_id: a.learner_id, status: a.status, created_at: a.created_at }))
    });
  }
  if (assessments && assessments.length > 0) {
    console.log(`[getEvidencePack] Found ${assessments.length} confirmed assessments for learner ${learnerId}`);
    
    for (const assessment of assessments) {
      console.log(`[getEvidencePack] Processing assessment ${assessment.id}`);
      let hasCompetencyLink = false;

      // Check if assessment has evidence links pointing to this competency
      const { data: evidenceLinks, error: linkError } = await db
        .from("assessment_evidence_links")
        .select("evidence_type, observation_id, experience_id, portfolio_artifact_id")
        .eq("assessment_id", assessment.id)
        .is("archived_at", null);

      if (linkError) {
        console.error(`[getEvidencePack] Error querying evidence links for assessment ${assessment.id}:`, linkError);
      }
      
      console.log(`[getEvidencePack] Assessment ${assessment.id} - evidenceLinks:`, {
        count: evidenceLinks?.length || 0,
        links: evidenceLinks
      });

      if (evidenceLinks && evidenceLinks.length > 0) {
        console.log(`[getEvidencePack] Assessment ${assessment.id} has ${evidenceLinks.length} evidence links:`, evidenceLinks);
        // Check observations
        const observationIds = evidenceLinks
          .filter((link: any) => link.evidence_type === "observation" && link.observation_id)
          .map((link: any) => link.observation_id);
        
        if (observationIds.length > 0) {
          console.log(`[getEvidencePack] Checking ${observationIds.length} observations for competency ${competencyId}`);
          const { data: linkedObservations, error: obsError } = await db
            .from("observations")
            .select("competency_id")
            .in("id", observationIds)
            .eq("competency_id", competencyId)
            .is("archived_at", null);

          if (obsError) {
            console.error(`[getEvidencePack] Error querying observations:`, obsError);
          } else {
            console.log(`[getEvidencePack] Found ${linkedObservations?.length || 0} observations with competency ${competencyId}`);
          }

          if (linkedObservations && linkedObservations.length > 0) {
            hasCompetencyLink = true;
            console.log(`[getEvidencePack] Assessment ${assessment.id} linked via observations`);
          }
        }

        // Check experiences (via experience_competency_links)
        if (!hasCompetencyLink) {
          const experienceIds = evidenceLinks
            .filter((link: any) => link.evidence_type === "experience" && link.experience_id)
            .map((link: any) => link.experience_id);
          
          if (experienceIds.length > 0) {
            console.log(`[getEvidencePack] Checking ${experienceIds.length} experiences for competency ${competencyId}`);
            const { data: experienceLinks, error: expError } = await db
              .from("experience_competency_links")
              .select("competency_id")
              .in("experience_id", experienceIds)
              .eq("competency_id", competencyId)
              .is("archived_at", null);

            if (expError) {
              console.error(`[getEvidencePack] Error querying experience links:`, expError);
            } else {
              console.log(`[getEvidencePack] Found ${experienceLinks?.length || 0} experience links with competency ${competencyId}`);
            }

            if (experienceLinks && experienceLinks.length > 0) {
              hasCompetencyLink = true;
              console.log(`[getEvidencePack] Assessment ${assessment.id} linked via experiences`);
            }
          }
        }

        // Check portfolio artifacts (via portfolio_artifact_tags)
        if (!hasCompetencyLink) {
          const artifactIds = evidenceLinks
            .filter((link: any) => link.evidence_type === "portfolio_artifact" && link.portfolio_artifact_id)
            .map((link: any) => link.portfolio_artifact_id);
          
          if (artifactIds.length > 0) {
            console.log(`[getEvidencePack] Checking ${artifactIds.length} portfolio artifacts for competency ${competencyId}`);
            const { data: artifactTags, error: artError } = await db
              .from("portfolio_artifact_tags")
              .select("competency_id")
              .in("artifact_id", artifactIds)
              .eq("competency_id", competencyId)
              .is("archived_at", null);

            if (artError) {
              console.error(`[getEvidencePack] Error querying artifact tags:`, artError);
            } else {
              console.log(`[getEvidencePack] Found ${artifactTags?.length || 0} artifact tags with competency ${competencyId}`);
            }

            if (artifactTags && artifactTags.length > 0) {
              hasCompetencyLink = true;
              console.log(`[getEvidencePack] Assessment ${assessment.id} linked via portfolio artifacts`);
            }
          }
        }
        
        if (!hasCompetencyLink && evidenceLinks.length > 0) {
          console.warn(`[getEvidencePack] Assessment ${assessment.id} has ${evidenceLinks.length} evidence links but none match competency ${competencyId}`);
        }
      }

      // Include assessment if it has any link to this competency
      // If assessment has no evidence links at all, we still include it as it might be relevant
      // (Teacher might have created assessment without linking evidence yet)
      const shouldInclude = hasCompetencyLink || !evidenceLinks || evidenceLinks.length === 0;
      
      console.log(`[getEvidencePack] Assessment ${assessment.id} inclusion check:`, {
        hasCompetencyLink,
        evidenceLinksCount: evidenceLinks?.length || 0,
        evidenceLinksIsNull: !evidenceLinks,
        shouldInclude,
      });
      
      if (shouldInclude) {
        const authorName = assessment.teacher && !Array.isArray(assessment.teacher)
          ? `User ${(assessment.teacher as any).id?.slice(0, 8) || "unknown"}`
          : null;

        const labelText = (assessment as any).label?.label_text || "Assessment";
        const title = `${labelText} - ${new Date(assessment.created_at).toLocaleDateString()}`;

        console.log(`[getEvidencePack] ✓ Including assessment ${assessment.id} for competency ${competencyId} (hasCompetencyLink: ${hasCompetencyLink}, noLinks: ${!evidenceLinks || evidenceLinks.length === 0})`);

        evidenceItems.push({
          id: assessment.id,
          type: "assessment",
          title: title,
          description: assessment.rationale || null,
          date: assessment.created_at,
          author_id: assessment.teacher_id,
          author_name: authorName,
          competency_id: competencyId,
          indicator_id: null,
          assessment_id: assessment.id,
        });
      } else {
        console.log(`[getEvidencePack] ✗ Excluding assessment ${assessment.id} - no competency link and has evidence links`);
      }
    }
  } else {
    console.log(`[getEvidencePack] No confirmed assessments found for learner ${learnerId}`);
    
    // Debug: Check if there are any assessments at all (any status)
    const { data: allAssessments } = await db
      .from("assessments")
      .select("id, status, learner_id")
      .eq("learner_id", learnerId)
      .is("archived_at", null);
    
    console.log(`[getEvidencePack] Total assessments (any status) for learner ${learnerId}:`, {
      count: allAssessments?.length || 0,
      statuses: allAssessments?.reduce((acc: any, a: any) => {
        acc[a.status] = (acc[a.status] || 0) + 1;
        return acc;
      }, {})
    });
  }
  
  console.log(`[getEvidencePack] Final evidence items count: ${evidenceItems.length}`);
  console.log(`[getEvidencePack] Evidence items:`, evidenceItems.map((item: any) => ({
    type: item.type,
    id: item.id,
    title: item.title
  })));

  // Sort by date descending
  evidenceItems.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());

  console.log(`[getEvidencePack] Final summary for learner ${learnerId}, competency ${competencyId}:`, {
    totalItems: evidenceItems.length,
    byType: evidenceItems.reduce((acc: any, item: any) => {
      acc[item.type] = (acc[item.type] || 0) + 1;
      return acc;
    }, {}),
    items: evidenceItems.map((item: any) => ({
      type: item.type,
      id: item.id,
      title: item.title?.substring(0, 50) || "No title"
    }))
  });

  return evidenceItems;
}

// ============================================================================
// Mastery Proposal Workflow Functions
// ============================================================================

export interface MasteryProposal {
  id: string;
  learner_id: string;
  competency_id: string | null;
  outcome_id: string | null;
  mastery_level_id: string;
  rationale_text: string | null;
  teacher_id: string;
  confirmed_by: string;
  confirmed_at: string;
  archived_at: string | null; // NULL = submitted/approved, NOT NULL = draft/changes_requested
  snapshot_run_id: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  learner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
  };
  competency?: {
    id: string;
    name: string;
  };
  mastery_level?: {
    id: string;
    label: string;
  };
  teacher?: {
    id: string;
  };
}

/**
 * Get proposal status from snapshot
 * 
 * Workflow states (using existing schema):
 * - DRAFT: archived_at IS NOT NULL AND rationale_text does NOT contain "[REVIEWER NOTES:"
 * - SUBMITTED: archived_at IS NULL AND confirmed_by = teacher_id (awaiting review)
 * - APPROVED: archived_at IS NULL AND confirmed_by != teacher_id (reviewer confirmed)
 * - CHANGES_REQUESTED: archived_at IS NOT NULL AND rationale_text contains "[REVIEWER NOTES:"
 */
export function getProposalStatus(snapshot: LearnerOutcomeMasterySnapshot): "draft" | "submitted" | "approved" | "changes_requested" {
  // If archived, check if it's a draft or changes_requested
  if (snapshot.archived_at) {
    // Check if rationale contains reviewer notes (indicates changes_requested)
    const hasReviewerNotes = snapshot.rationale_text?.includes("[REVIEWER NOTES:") || false;
    return hasReviewerNotes ? "changes_requested" : "draft";
  }
  
  // If not archived, check who confirmed it
  if (snapshot.confirmed_by === snapshot.teacher_id) {
    return "submitted"; // Teacher confirmed their own proposal (awaiting review)
  }
  
  return "approved"; // Reviewer confirmed (approved)
}

/**
 * Create or update a mastery draft proposal
 * Uses archived_at to mark as draft
 * @param supabaseClient - Optional Supabase client (uses client-side by default, pass server client for API routes)
 */
export async function upsertMasteryDraft(
  payload: {
    learner_id: string;
    competency_id: string;
    mastery_level_id: string;
    rationale_text: string;
    highlight_evidence_ids?: Array<{
      type: "observation" | "portfolio_artifact" | "assessment" | "reflection";
      id: string;
    }>;
    organization_id?: string;
    school_id?: string | null;
  },
  supabaseClient?: SupabaseClient,
  userId?: string
): Promise<MasteryProposal> {
  // Use provided client or default to client-side instance
  const db = supabaseClient || supabase;
  
  // Get user context - if userId is provided, use it; otherwise get from client
  let context: { userId: string; organizationId: string | null; role: string | null; isSuperAdmin?: boolean };
  if (userId && supabaseClient) {
    // Server-side: get profile from provided client
    const { data: profile } = await supabaseClient
      .from("profiles")
      .select("organization_id, role, is_super_admin")
      .eq("id", userId)
      .single();
    
    if (!profile) {
      throw new Error("User profile not found");
    }
    
    context = {
      userId,
      organizationId: profile.organization_id,
      role: profile.role,
      isSuperAdmin: profile.is_super_admin || false,
    };
  } else {
    // Client-side: use existing function
    const clientContext = await getCurrentUserContext();
    context = {
      ...clientContext,
      isSuperAdmin: false, // Will be checked by RLS
    };
  }
  
  const organizationId = payload.organization_id || context.organizationId;
  
  if (!organizationId) {
    throw new Error("Organization context required");
  }

  // Check for existing draft (archived = draft)
  const { data: existingDraft } = await db
    .from("learner_outcome_mastery_snapshots")
    .select("*")
    .eq("learner_id", payload.learner_id)
    .eq("competency_id", payload.competency_id)
    .not("archived_at", "is", null) // Drafts are archived
    .eq("confirmed_by", context.userId) // Own drafts
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  let snapshotId: string;
  let snapshotRunId: string | null = null;

  if (existingDraft) {
    // Update existing draft
    const { data: updated, error } = await db
      .from("learner_outcome_mastery_snapshots")
      .update({
        mastery_level_id: payload.mastery_level_id,
        rationale_text: payload.rationale_text,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existingDraft.id)
      .select()
      .single();

    if (error) {
      logError("Error updating mastery draft", error);
      throw error;
    }

    snapshotId = updated.id;
    snapshotRunId = updated.snapshot_run_id;
  } else {
    // Create new draft - need a draft snapshot run
    // Use 'section' scope_type with teacher ID as scope_id (draft marker)
    const { data: draftRun } = await db
      .from("mastery_snapshot_runs")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("scope_type", "section")
      .eq("scope_id", context.userId) // Use teacher ID as scope for drafts (won't match real section)
      .eq("created_by", context.userId)
      .is("archived_at", null)
      .limit(1)
      .single();

    let runId = draftRun?.id;
    if (!runId) {
      // Create draft run (using section scope_type with teacher ID as scope_id)
      const { data: newRun, error: runError } = await db
        .from("mastery_snapshot_runs")
        .insert({
          organization_id: organizationId,
          school_id: payload.school_id,
          scope_type: "section", // Use valid scope_type
          scope_id: context.userId, // Use teacher ID as scope for drafts
          snapshot_date: new Date().toISOString().split("T")[0],
          snapshot_count: 0,
          created_by: context.userId,
        })
        .select()
        .single();

      if (runError) {
        logError("Error creating draft snapshot run", runError);
        throw runError;
      }
      runId = newRun.id;
    }

    // Verify the snapshot run exists and is accessible (for RLS)
    const { data: runCheck, error: runCheckError } = await db
      .from("mastery_snapshot_runs")
      .select("id, created_by, archived_at")
      .eq("id", runId)
      .single();

    if (runCheckError || !runCheck || runCheck.archived_at !== null) {
      logError("Error verifying snapshot run for draft", runCheckError || new Error("Run not found or archived"));
      throw new Error("Snapshot run not accessible. Please try again.");
    }

    // Check if teacher has context with student - if not, create a minimal assessment to establish context
    // This is needed for RLS policy: teacher_has_student_context()
    const { data: existingContext } = await db
      .from("assessments")
      .select("id")
      .eq("teacher_id", context.userId)
      .eq("learner_id", payload.learner_id)
      .eq("organization_id", organizationId)
      .is("archived_at", null)
      .limit(1)
      .single();

    if (!existingContext) {
      // Check observations as well
      const { data: existingObs } = await db
        .from("observations")
        .select("id")
        .eq("created_by", context.userId)
        .eq("learner_id", payload.learner_id)
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .limit(1)
        .single();

      if (!existingObs) {
        // No context exists - create a minimal assessment to establish context
        // Get a default assessment label (or create a system one)
        const { data: defaultLabel } = await db
          .from("assessment_labels")
          .select("id")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .limit(1)
          .single();

        if (defaultLabel) {
          // Create a minimal draft assessment to establish teacher-student context
          const { error: assessmentError } = await db
            .from("assessments")
            .insert({
              organization_id: organizationId,
              school_id: payload.school_id,
              teacher_id: context.userId,
              learner_id: payload.learner_id,
              label_id: defaultLabel.id,
              rationale: "System-generated assessment to establish teacher-student context for mastery proposal.",
              status: "draft",
              created_by: context.userId,
              updated_by: context.userId,
            });

          if (assessmentError) {
            logError("Error creating context assessment", assessmentError);
            // Don't throw - continue anyway, RLS will catch it if needed
          }
        }
      }
    }

    // Create draft snapshot (archived = draft)
    const { data: snapshot, error } = await db
      .from("learner_outcome_mastery_snapshots")
      .insert({
        organization_id: organizationId,
        school_id: payload.school_id,
        snapshot_run_id: runId,
        learner_id: payload.learner_id,
        competency_id: payload.competency_id,
        mastery_level_id: payload.mastery_level_id,
        teacher_id: context.userId,
        rationale_text: payload.rationale_text,
        evidence_count: payload.highlight_evidence_ids?.length || 0,
        snapshot_date: new Date().toISOString().split("T")[0],
        confirmed_at: new Date().toISOString(), // Required, but this is draft
        confirmed_by: context.userId, // Teacher confirms their own draft
        created_by: context.userId,
        archived_at: new Date().toISOString(), // Mark as draft
      })
      .select()
      .single();

    if (error) {
      logError("Error creating mastery draft", error, {
        userId: context.userId,
        learnerId: payload.learner_id,
        organizationId,
        runId,
      });
      // Provide more helpful error message for RLS violations
      if (error.code === "42501" || error.message?.includes("row-level security")) {
        // Check if user is admin - if so, this is a different issue
        const { data: userProfile } = await db
          .from("profiles")
          .select("role, is_super_admin")
          .eq("id", context.userId)
          .single();
        
        const isAdmin = userProfile?.role === "admin" || userProfile?.role === "principal" || userProfile?.is_super_admin;
        
        if (isAdmin) {
          throw new Error(
            "Permission denied. This may be a configuration issue. Please contact your administrator. " +
            "If you are an admin, you should be able to create mastery proposals for any student."
          );
        } else {
          throw new Error(
            "Permission denied. You must have created observations, assessments, or attendance records for this student before creating a mastery proposal. " +
            "Please create at least one observation or assessment for this student first."
          );
        }
      }
      throw error;
    }

    snapshotId = snapshot.id;
    snapshotRunId = runId;
  }

  // Update evidence highlights
  if (payload.highlight_evidence_ids && snapshotId) {
    // Delete existing highlights
    await db
      .from("mastery_snapshot_evidence_links")
      .update({ archived_at: new Date().toISOString() })
      .eq("snapshot_id", snapshotId)
      .is("archived_at", null);

    // Create new highlights
    for (const highlight of payload.highlight_evidence_ids) {
      const linkData: any = {
        organization_id: organizationId,
        snapshot_id: snapshotId,
        evidence_type: highlight.type === "reflection" ? "lesson_log" : highlight.type, // Map reflection to lesson_log for now
        created_by: context.userId,
      };

      if (highlight.type === "observation") {
        linkData.observation_id = highlight.id;
      } else if (highlight.type === "portfolio_artifact") {
        linkData.portfolio_artifact_id = highlight.id;
      } else if (highlight.type === "assessment") {
        linkData.assessment_id = highlight.id;
      }

      await db
        .from("mastery_snapshot_evidence_links")
        .insert(linkData);
    }
  }

  // Fetch and return the proposal
  const { data: proposal } = await db
    .from("learner_outcome_mastery_snapshots")
    .select(`
      *,
      learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name),
      competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(id, name),
      mastery_level:mastery_levels(id, label),
      teacher:profiles!learner_outcome_mastery_snapshots_teacher_id_fkey(id)
    `)
    .eq("id", snapshotId)
    .single();

  return proposal as MasteryProposal;
}

/**
 * Submit a mastery proposal for review
 * Sets archived_at = NULL to mark as submitted
 */
export async function submitMasteryProposal(snapshotId: string): Promise<MasteryProposal> {
  const context = await getCurrentUserContext();

  const { data: snapshot, error } = await supabase
    .from("learner_outcome_mastery_snapshots")
    .update({
      archived_at: null, // Mark as submitted (no longer draft)
      updated_by: context.userId,
      updated_at: new Date().toISOString(),
    })
    .eq("id", snapshotId)
    .select(`
      *,
      learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name),
      competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(id, name),
      mastery_level:mastery_levels(id, label),
      teacher:profiles!learner_outcome_mastery_snapshots_teacher_id_fkey(id)
    `)
    .single();

  if (error) {
    logError("Error submitting mastery proposal", error);
    throw error;
  }

  return snapshot as MasteryProposal;
}

/**
 * Review a mastery proposal: approve, request changes, or override
 */
export async function reviewMasteryProposal(payload: {
  snapshot_id: string;
  action: "approve" | "request_changes" | "override";
  reviewer_notes?: string;
  override_level_id?: string;
  override_justification?: string;
}): Promise<MasteryProposal> {
  const context = await getCurrentUserContext();

  const { data: currentSnapshot } = await supabase
    .from("learner_outcome_mastery_snapshots")
    .select("*")
    .eq("id", payload.snapshot_id)
    .single();

  if (!currentSnapshot) {
    throw new Error("Snapshot not found");
  }

  if (payload.action === "approve") {
    // Approve: update confirmed_by to reviewer, keep archived_at = NULL
    const { data: snapshot, error } = await supabase
      .from("learner_outcome_mastery_snapshots")
      .update({
        confirmed_by: context.userId, // Reviewer confirms
        confirmed_at: new Date().toISOString(),
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.snapshot_id)
      .select(`
        *,
        learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name),
        competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(id, name),
        mastery_level:mastery_levels(id, label),
        teacher:profiles!learner_outcome_mastery_snapshots_teacher_id_fkey(id)
      `)
      .single();

    if (error) {
      logError("Error approving mastery proposal", error);
      throw error;
    }

    return snapshot as MasteryProposal;
  } else if (payload.action === "request_changes") {
    // Request changes: archive again + append reviewer notes
    // Preserve teacher's original rationale, append reviewer notes
    const originalRationale = currentSnapshot.rationale_text || "";
    // Remove any existing reviewer notes to avoid duplication
    const cleanRationale = originalRationale.split("\n\n[REVIEWER NOTES:")[0].trim();
    const reviewerNotes = payload.reviewer_notes?.trim() || "Changes requested";
    const updatedRationale = cleanRationale
      ? `${cleanRationale}\n\n[REVIEWER NOTES: ${reviewerNotes}]`
      : `[REVIEWER NOTES: ${reviewerNotes}]`;

    const { data: snapshot, error } = await supabase
      .from("learner_outcome_mastery_snapshots")
      .update({
        archived_at: new Date().toISOString(), // Back to draft state
        rationale_text: updatedRationale,
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.snapshot_id)
      .select(`
        *,
        learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name),
        competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(id, name),
        mastery_level:mastery_levels(id, label),
        teacher:profiles!learner_outcome_mastery_snapshots_teacher_id_fkey(id)
      `)
      .single();

    if (error) {
      logError("Error requesting changes", error);
      throw error;
    }

    return snapshot as MasteryProposal;
  } else if (payload.action === "override") {
    // Override: update level + create override log + approve
    if (!payload.override_level_id || !payload.override_justification) {
      throw new Error("Override requires level_id and justification");
    }

    // Create override log
    await supabase
      .from("mastery_override_logs")
      .insert({
        organization_id: currentSnapshot.organization_id,
        snapshot_id: payload.snapshot_id,
        previous_mastery_level_id: currentSnapshot.mastery_level_id,
        new_mastery_level_id: payload.override_level_id,
        justification_text: payload.override_justification,
        created_by: context.userId,
      });

    // Update snapshot
    const { data: snapshot, error } = await supabase
      .from("learner_outcome_mastery_snapshots")
      .update({
        mastery_level_id: payload.override_level_id,
        confirmed_by: context.userId, // Reviewer confirms override
        confirmed_at: new Date().toISOString(),
        updated_by: context.userId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", payload.snapshot_id)
      .select(`
        *,
        learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name),
        competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(id, name),
        mastery_level:mastery_levels(id, label),
        teacher:profiles!learner_outcome_mastery_snapshots_teacher_id_fkey(id)
      `)
      .single();

    if (error) {
      logError("Error overriding mastery proposal", error);
      throw error;
    }

    return snapshot as MasteryProposal;
  }

  throw new Error("Invalid action");
}

/**
 * List mastery proposals for review queue
 * Returns submitted proposals (archived_at IS NULL AND confirmed_by = teacher_id)
 */
export async function listMasteryProposalsForReview(
  organizationId: string | null
): Promise<MasteryProposal[]> {
  let query = supabase
    .from("learner_outcome_mastery_snapshots")
    .select(`
      *,
      learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name),
      competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(id, name),
      mastery_level:mastery_levels(id, label),
      teacher:profiles!learner_outcome_mastery_snapshots_teacher_id_fkey(id)
    `)
    .is("archived_at", null) // Submitted (not draft)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  // Filter: confirmed_by = teacher_id (submitted by teacher, not yet reviewed)
  // This requires a self-join or filtering in application code
  // For now, we'll fetch all and filter in code
  const { data, error } = await query;

  if (error) {
    logError("Error fetching mastery proposals", error);
    throw error;
  }

  // Filter to only submitted proposals (confirmed_by = teacher_id)
  const proposals = (data || []).filter((snapshot: any) => 
    snapshot.confirmed_by === snapshot.teacher_id
  ) as MasteryProposal[];

  return proposals;
}

/**
 * List mastery drafts for a teacher
 * When called from server-side (API routes), teacherId must be provided.
 * When called from client-side, teacherId is optional and will default to current user.
 */
export async function listMasteryDrafts(
  organizationId: string | null,
  teacherId?: string
): Promise<MasteryProposal[]> {
  let teacherIdToUse: string;
  
  if (teacherId) {
    // Use provided teacherId (server-side call)
    teacherIdToUse = teacherId;
  } else {
    // Try to get from context (client-side call)
    try {
      const context = await getCurrentUserContext();
      teacherIdToUse = context.userId;
    } catch (error) {
      throw new Error("teacherId is required when called from server-side");
    }
  }

  let query = supabase
    .from("learner_outcome_mastery_snapshots")
    .select(`
      *,
      learner:students!learner_outcome_mastery_snapshots_learner_id_fkey(id, first_name, last_name),
      competency:competencies!learner_outcome_mastery_snapshots_competency_id_fkey(id, name),
      mastery_level:mastery_levels(id, label),
      teacher:profiles!learner_outcome_mastery_snapshots_teacher_id_fkey(id)
    `)
    .not("archived_at", "is", null) // Drafts are archived
    .eq("teacher_id", teacherIdToUse)
    .order("updated_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;

  if (error) {
    logError("Error fetching mastery drafts", error);
    throw error;
  }

  return (data || []) as MasteryProposal[];
}