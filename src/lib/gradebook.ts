/**
 * Gradebook Computation Phase Data Access Layer
 * 
 * All functions respect RLS policies and filter by organization_id.
 * Computed grades are NOT official until Phase 4 confirms them.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface GradebookScheme {
  id: string;
  organization_id: string;
  school_id: string | null;
  program_id: string | null;
  scheme_type: "deped_k12" | "ched_hei";
  name: string;
  description: string | null;
  version: number;
  published_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  // Metadata JSONB for extensibility (rounding_mode, weight_policy, etc.)
  metadata?: {
    rounding_mode?: "floor" | "round" | "ceil";
    weight_policy?: "strict" | "normalize";
  } | null;
}

export interface GradebookComponent {
  id: string;
  organization_id: string;
  scheme_id: string;
  code: string;
  label: string;
  description: string | null;
  display_order: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface GradebookWeightProfile {
  id: string;
  organization_id: string;
  scheme_id: string;
  profile_key: string;
  profile_label: string;
  is_default: boolean;
  description: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface GradebookComponentWeight {
  id: string;
  organization_id: string;
  scheme_id: string;
  profile_id: string | null;
  component_id: string;
  weight_percent: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface GradebookTransmutationTable {
  id: string;
  organization_id: string;
  scheme_id: string;
  version: number;
  published_at: string | null;
  description: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface GradebookTransmutationRow {
  id: string;
  organization_id: string;
  transmutation_table_id: string;
  initial_grade: number;
  transmuted_grade: number;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
}

export interface GradebookGradedItem {
  id: string;
  organization_id: string;
  school_id: string | null;
  section_id: string;
  school_year_id: string;
  term_period: string;
  component_id: string;
  title: string;
  description: string | null;
  max_points: number;
  due_at: string | null;
  archived_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  // Joined fields
  component?: GradebookComponent;
}

export interface GradebookGradedScore {
  id: string;
  organization_id: string;
  graded_item_id: string;
  student_id: string;
  points_earned: number | null;
  status: "present" | "absent" | "excused" | "missing";
  entered_at: string;
  entered_by: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  student?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
  graded_item?: GradebookGradedItem;
}

export interface GradebookComputeRun {
  id: string;
  organization_id: string;
  school_id: string | null;
  section_id: string;
  school_year_id: string;
  term_period: string;
  scheme_id: string;
  scheme_version: number;
  weight_profile_id: string | null;
  transmutation_table_id: string | null;
  transmutation_version: number | null;
  as_of: string;
  run_by: string | null;
  status: "created" | "completed" | "failed";
  error_message: string | null;
  created_at: string;
  updated_at: string;
  // Joined fields
  scheme?: GradebookScheme;
  section?: {
    id: string;
    name: string;
    code: string;
  };
}

export interface GradebookComputedGrade {
  id: string;
  organization_id: string;
  compute_run_id: string;
  student_id: string;
  section_id: string;
  section_subject_offering_id?: string | null; // Added for offerings support
  school_year_id: string;
  term_period: string;
  initial_grade: number | null;
  final_numeric_grade: number;
  transmuted_grade: number | null;
  output_grade_value: string | null;
  breakdown: any; // JSONB
  created_at: string;
  // Joined fields
  student?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
}

export interface GradebookPhase4Link {
  id: string;
  organization_id: string;
  grade_entry_id: string;
  computed_grade_id: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

// ============================================================================
// Schemes
// ============================================================================

export async function listSchemes(organizationId: string | null): Promise<GradebookScheme[]> {
  let query = supabase
    .from("gradebook_schemes")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list schemes: ${error.message}`);
  return (data || []) as GradebookScheme[];
}

export async function getScheme(
  id: string,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookScheme | null> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("gradebook_schemes")
    .select("*")
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get scheme: ${error.message}`);
  }
  return data as GradebookScheme;
}

export async function createScheme(data: {
  organization_id: string;
  school_id?: string | null;
  program_id?: string | null;
  scheme_type: "deped_k12" | "ched_hei";
  name: string;
  description?: string | null;
  created_by?: string;
}): Promise<GradebookScheme> {
  const { data: result, error } = await supabase
    .from("gradebook_schemes")
    .insert([{ ...data, version: 1 }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create scheme: ${error.message}`);
  return result;
}

export async function publishScheme(id: string, userId: string): Promise<GradebookScheme> {
  const { data: result, error } = await supabase
    .from("gradebook_schemes")
    .update({ published_at: new Date().toISOString(), updated_by: userId })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish scheme: ${error.message}`);
  return result;
}

// ============================================================================
// Components
// ============================================================================

export async function listComponents(
  schemeId: string,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookComponent[]> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("gradebook_components")
    .select("*")
    .eq("scheme_id", schemeId)
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  if (error) throw new Error(`Failed to list components: ${error.message}`);
  return (data || []) as GradebookComponent[];
}

export async function createComponent(data: {
  organization_id: string;
  scheme_id: string;
  code: string;
  label: string;
  description?: string | null;
  display_order?: number;
  created_by?: string;
}): Promise<GradebookComponent> {
  const { data: result, error } = await supabase
    .from("gradebook_components")
    .insert([data])
    .select()
    .single();

  if (error) throw new Error(`Failed to create component: ${error.message}`);
  return result;
}

export async function updateComponent(
  id: string,
  data: {
    code?: string;
    label?: string;
    description?: string | null;
    display_order?: number;
    updated_by?: string;
  }
): Promise<GradebookComponent> {
  const { data: result, error } = await supabase
    .from("gradebook_components")
    .update(data)
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update component: ${error.message}`);
  return result;
}

export async function archiveComponent(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("gradebook_components")
    .update({ archived_at: new Date().toISOString(), updated_by: userId })
    .eq("id", id);

  if (error) throw new Error(`Failed to archive component: ${error.message}`);
}

// ============================================================================
// Weight Profiles
// ============================================================================

export async function listWeightProfiles(schemeId: string): Promise<GradebookWeightProfile[]> {
  const { data, error } = await supabase
    .from("gradebook_weight_profiles")
    .select("*")
    .eq("scheme_id", schemeId)
    .is("archived_at", null)
    .order("is_default", { ascending: false })
    .order("profile_key", { ascending: true });

  if (error) throw new Error(`Failed to list weight profiles: ${error.message}`);
  return (data || []) as GradebookWeightProfile[];
}

export async function createWeightProfile(data: {
  organization_id: string;
  scheme_id: string;
  profile_key: string;
  profile_label: string;
  is_default?: boolean;
  description?: string | null;
  created_by?: string;
}): Promise<GradebookWeightProfile> {
  const { data: result, error } = await supabase
    .from("gradebook_weight_profiles")
    .insert([data])
    .select()
    .single();

  if (error) throw new Error(`Failed to create weight profile: ${error.message}`);
  return result;
}

export async function updateWeightProfile(
  id: string,
  data: {
    profile_key?: string;
    profile_label?: string;
    description?: string | null;
    is_default?: boolean;
    updated_by?: string;
  }
): Promise<GradebookWeightProfile> {
  const { data: result, error } = await supabase
    .from("gradebook_weight_profiles")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to update weight profile: ${error.message}`);
  return result;
}

export async function deleteWeightProfile(
  id: string,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<void> {
  const client = supabaseClient || supabase;
  
  // First, soft delete (archive) all component weights associated with this profile
  const { error: weightsError } = await client
    .from("gradebook_component_weights")
    .update({ archived_at: new Date().toISOString() })
    .eq("profile_id", id)
    .is("archived_at", null);

  if (weightsError) {
    throw new Error(`Failed to archive component weights: ${weightsError.message}`);
  }

  // Then soft delete (archive) the profile itself
  const { error } = await client
    .from("gradebook_weight_profiles")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id)
    .is("archived_at", null);

  if (error) {
    throw new Error(`Failed to archive weight profile: ${error.message}`);
  }
}

/**
 * Resolve weight profile ID from section's primary_classification
 * This is the canonical way to select grading weights based on section classification
 * 
 * @param sectionId - Section ID to get classification from
 * @param schemeId - Scheme ID to find matching profile
 * @param supabaseClient - Optional Supabase client (for server-side use)
 * @returns Object with weight_profile_id, classification_used, classification_source, and fallback flag
 */
export async function resolveWeightProfileFromSection(
  sectionId: string,
  schemeId: string,
  supabaseClient?: any
): Promise<{
  weight_profile_id: string | null;
  classification_used: string | null;
  classification_source: string | null;
  is_fallback: boolean;
  error?: string;
}> {
  const client = supabaseClient || supabase;

  // Get section with classification
  const { data: section, error: sectionError } = await client
    .from("sections")
    .select("id, primary_classification, classification_source, organization_id")
    .eq("id", sectionId)
    .is("archived_at", null)
    .single();

  if (sectionError || !section) {
    return {
      weight_profile_id: null,
      classification_used: null,
      classification_source: null,
      is_fallback: false,
      error: `Section not found: ${sectionError?.message || "Unknown error"}`,
    };
  }

  // Try canonical classification first
  if (section.primary_classification) {
    // Find weight profile matching the classification
    const { data: profile, error: profileError } = await client
      .from("gradebook_weight_profiles")
      .select("id, profile_key")
      .eq("scheme_id", schemeId)
      .eq("profile_key", section.primary_classification)
      .is("archived_at", null)
      .single();

    if (!profileError && profile) {
      return {
        weight_profile_id: profile.id,
        classification_used: section.primary_classification,
        classification_source: section.classification_source || "canonical",
        is_fallback: false,
      };
    }
  }

  // Fallback: Try to infer from syllabus (if classification is NULL)
  // This is a transition period fallback - mark it explicitly
  if (!section.primary_classification) {
    // Try to get syllabus subject for this section's program
    const { data: sectionWithProgram } = await client
      .from("sections")
      .select("program_id, organization_id")
      .eq("id", sectionId)
      .single();

    if (sectionWithProgram) {
      // Find most common subject from syllabi for this program
      const { data: syllabi } = await client
        .from("syllabi")
        .select("subject")
        .eq("program_id", sectionWithProgram.program_id)
        .eq("organization_id", sectionWithProgram.organization_id)
        .not("subject", "is", null)
        .is("archived_at", null)
        .limit(10);

      if (syllabi && syllabi.length > 0) {
        // Try to match subject to profile_key (best effort)
        const subjects = syllabi.map((s: any) => s.subject?.toLowerCase().trim());
        const mostCommonSubject = subjects[0]; // Simplified - could use mode

        // Try to find matching profile
        const { data: fallbackProfile } = await client
          .from("gradebook_weight_profiles")
          .select("id, profile_key")
          .eq("scheme_id", schemeId)
          .ilike("profile_key", `%${mostCommonSubject}%`)
          .is("archived_at", null)
          .limit(1)
          .single();

        if (fallbackProfile) {
          return {
            weight_profile_id: fallbackProfile.id,
            classification_used: fallbackProfile.profile_key,
            classification_source: "syllabus_fallback",
            is_fallback: true,
          };
        }
      }
    }
  }

  // Final fallback: Use default profile for scheme
  const { data: defaultProfile } = await client
    .from("gradebook_weight_profiles")
    .select("id, profile_key")
    .eq("scheme_id", schemeId)
    .eq("is_default", true)
    .is("archived_at", null)
    .single();

  if (defaultProfile) {
    return {
      weight_profile_id: defaultProfile.id,
      classification_used: defaultProfile.profile_key,
      classification_source: "default_fallback",
      is_fallback: true,
    };
  }

  // No profile found - this is an error condition
  return {
    weight_profile_id: null,
    classification_used: section.primary_classification || null,
    classification_source: section.classification_source || null,
    is_fallback: false,
    error: "Missing primary classification for section; set it before computing. No default profile available.",
  };
}

// ============================================================================
// Component Weights
// ============================================================================

export async function listComponentWeights(
  schemeId: string,
  profileId?: string | null,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookComponentWeight[]> {
  const client = supabaseClient || supabase;
  let query = client
    .from("gradebook_component_weights")
    .select("*")
    .eq("scheme_id", schemeId)
    .is("archived_at", null);

  if (profileId !== undefined) {
    if (profileId === null) {
      query = query.is("profile_id", null);
    } else {
      query = query.eq("profile_id", profileId);
    }
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list component weights: ${error.message}`);
  return (data || []) as GradebookComponentWeight[];
}

export async function upsertComponentWeights(
  weights: Array<{
    organization_id: string;
    scheme_id: string;
    profile_id?: string | null;
    component_id: string;
    weight_percent: number;
    created_by?: string;
  }>
): Promise<GradebookComponentWeight[]> {
  if (weights.length === 0) return [];

  const firstWeight = weights[0];
  
  // First, archive existing weights for the same scheme/profile combination
  // This avoids unique constraint violations
  let archiveQuery = supabase
    .from("gradebook_component_weights")
    .update({ archived_at: new Date().toISOString() })
    .eq("scheme_id", firstWeight.scheme_id)
    .is("archived_at", null);

  if (firstWeight.profile_id === null || firstWeight.profile_id === undefined) {
    archiveQuery = archiveQuery.is("profile_id", null);
  } else {
    archiveQuery = archiveQuery.eq("profile_id", firstWeight.profile_id);
  }

  const { error: archiveError } = await archiveQuery;
  if (archiveError) {
    throw new Error(`Failed to archive existing weights: ${archiveError.message}`);
  }

  // Insert new weights
  const { data, error } = await supabase
    .from("gradebook_component_weights")
    .insert(weights)
    .select();

  if (error) throw new Error(`Failed to upsert component weights: ${error.message}`);
  return (data || []) as GradebookComponentWeight[];
}

// ============================================================================
// Transmutation Tables
// ============================================================================

export async function listTransmutationTables(schemeId: string): Promise<GradebookTransmutationTable[]> {
  const { data, error } = await supabase
    .from("gradebook_transmutation_tables")
    .select("*")
    .eq("scheme_id", schemeId)
    .is("archived_at", null)
    .order("version", { ascending: false });

  if (error) throw new Error(`Failed to list transmutation tables: ${error.message}`);
  return (data || []) as GradebookTransmutationTable[];
}

export async function createTransmutationTable(data: {
  organization_id: string;
  scheme_id: string;
  version?: number;
  description?: string | null;
  created_by?: string;
}): Promise<GradebookTransmutationTable> {
  const { data: result, error } = await supabase
    .from("gradebook_transmutation_tables")
    .insert([{ ...data, version: data.version || 1 }])
    .select()
    .single();

  if (error) throw new Error(`Failed to create transmutation table: ${error.message}`);
  return result;
}

export async function publishTransmutationTable(id: string, userId: string): Promise<GradebookTransmutationTable> {
  const { data: result, error } = await supabase
    .from("gradebook_transmutation_tables")
    .update({ published_at: new Date().toISOString(), updated_by: userId })
    .eq("id", id)
    .select()
    .single();

  if (error) throw new Error(`Failed to publish transmutation table: ${error.message}`);
  return result;
}

export async function archiveTransmutationTable(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("gradebook_transmutation_tables")
    .update({ archived_at: new Date().toISOString(), updated_by: userId })
    .eq("id", id);

  if (error) throw new Error(`Failed to archive transmutation table: ${error.message}`);
}

// ============================================================================
// Transmutation Rows
// ============================================================================

export async function listTransmutationRows(
  tableId: string,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookTransmutationRow[]> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("gradebook_transmutation_rows")
    .select("*")
    .eq("transmutation_table_id", tableId)
    .is("archived_at", null)
    .order("initial_grade", { ascending: true });

  if (error) throw new Error(`Failed to list transmutation rows: ${error.message}`);
  return (data || []) as GradebookTransmutationRow[];
}

export async function upsertTransmutationRows(
  rows: Array<{
    organization_id: string;
    transmutation_table_id: string;
    initial_grade: number;
    transmuted_grade: number;
    created_by?: string;
  }>,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookTransmutationRow[]> {
  if (rows.length === 0) {
    return [];
  }

  const client = supabaseClient || supabase;
  const tableId = rows[0].transmutation_table_id;

  // Validate: check for duplicate initial_grade values in the input array
  const initialGrades = rows.map((r) => r.initial_grade);
  const duplicates = initialGrades.filter((grade, index) => initialGrades.indexOf(grade) !== index);
  if (duplicates.length > 0) {
    throw new Error(
      `Duplicate initial_grade values found: ${[...new Set(duplicates)].join(", ")}. Each initial_grade must be unique per table.`
    );
  }

  // Archive existing rows for this table (soft delete - RLS allows UPDATE but not DELETE)
  const { error: archiveError } = await client
    .from("gradebook_transmutation_rows")
    .update({ archived_at: new Date().toISOString() })
    .eq("transmutation_table_id", tableId)
    .is("archived_at", null);

  if (archiveError) {
    throw new Error(`Failed to archive existing transmutation rows: ${archiveError.message}`);
  }

  // Insert new rows
  const { data, error } = await client
    .from("gradebook_transmutation_rows")
    .insert(rows)
    .select();

  if (error) {
    // Provide a more helpful error message for duplicate key violations
    if (error.code === "23505" || error.message.includes("duplicate key")) {
      throw new Error(
        `Failed to upsert transmutation rows: Duplicate initial_grade values detected. Each initial_grade must be unique per transmutation table. ${error.message}`
      );
    }
    throw new Error(`Failed to upsert transmutation rows: ${error.message}`);
  }
  return (data || []) as GradebookTransmutationRow[];
}

// ============================================================================
// Graded Items
// ============================================================================

export async function listGradedItems(
  filters: {
    section_id?: string;
    section_subject_offering_id?: string; // Preferred for new workflows
    term_period?: string;
    component_id?: string;
  },
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookGradedItem[]> {
  const client = supabaseClient || supabase;
  let query = client
    .from("gradebook_graded_items")
    .select(`
      *,
      component:gradebook_components(*)
    `)
    .is("archived_at", null);

  // Prefer offering_id filter (new workflow), fallback to section_id (legacy)
  if (filters.section_subject_offering_id) {
    query = query.eq("section_subject_offering_id", filters.section_subject_offering_id);
  } else if (filters.section_id) {
    query = query.eq("section_id", filters.section_id);
  } else {
    throw new Error("Either section_id or section_subject_offering_id must be provided");
  }

  query = query.order("due_at", { ascending: true, nullsFirst: true })
    .order("created_at", { ascending: false });

  if (filters.term_period) {
    query = query.eq("term_period", filters.term_period);
  }

  if (filters.component_id) {
    query = query.eq("component_id", filters.component_id);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list graded items: ${error.message}`);
  return (data || []) as GradebookGradedItem[];
}

export async function createGradedItem(data: {
  organization_id: string;
  school_id?: string | null;
  section_id?: string; // Legacy support
  section_subject_offering_id?: string; // Preferred for new workflows
  school_year_id: string;
  term_period: string;
  component_id: string;
  title: string;
  description?: string | null;
  max_points: number;
  due_at?: string | null;
  created_by?: string;
}): Promise<GradebookGradedItem> {
  // Require at least one of section_id or section_subject_offering_id
  if (!data.section_subject_offering_id && !data.section_id) {
    throw new Error("Either section_id or section_subject_offering_id must be provided");
  }

  const { data: result, error } = await supabase
    .from("gradebook_graded_items")
    .insert([data])
    .select(`
      *,
      component:gradebook_components(*)
    `)
    .single();

  if (error) throw new Error(`Failed to create graded item: ${error.message}`);
  return result;
}

export async function updateGradedItem(
  id: string,
  data: {
    component_id?: string;
    term_period?: string;
    title?: string;
    description?: string | null;
    max_points?: number;
    due_at?: string | null;
    updated_by?: string;
  }
): Promise<GradebookGradedItem> {
  const { data: result, error } = await supabase
    .from("gradebook_graded_items")
    .update(data)
    .eq("id", id)
    .select(`
      *,
      component:gradebook_components(*)
    `)
    .single();

  if (error) throw new Error(`Failed to update graded item: ${error.message}`);
  return result;
}

export async function archiveGradedItem(id: string, userId: string): Promise<void> {
  const { error } = await supabase
    .from("gradebook_graded_items")
    .update({ archived_at: new Date().toISOString(), updated_by: userId })
    .eq("id", id);

  if (error) throw new Error(`Failed to archive graded item: ${error.message}`);
}

// ============================================================================
// Graded Scores
// ============================================================================

export async function listGradedScores(
  gradedItemId: string,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookGradedScore[]> {
  const client = supabaseClient || supabase;
  // Select only the fields we need, avoiding any fields that might trigger users table access
  const { data: scoresData, error: scoresError } = await client
    .from("gradebook_graded_scores")
    .select(`
      id,
      organization_id,
      graded_item_id,
      student_id,
      points_earned,
      status,
      entered_at,
      created_at,
      updated_at,
      archived_at
    `)
    .eq("graded_item_id", gradedItemId)
    .is("archived_at", null);

  if (scoresError) throw new Error(`Failed to list graded scores: ${scoresError.message}`);
  if (!scoresData || scoresData.length === 0) return [];

  // Get unique student IDs
  const studentIds = [...new Set(scoresData.map((s: any) => s.student_id))];

  // Fetch students separately
  const { data: studentsData, error: studentsError } = await client
    .from("students")
    .select("id, first_name, last_name, student_number")
    .in("id", studentIds);

  if (studentsError) throw new Error(`Failed to fetch students: ${studentsError.message}`);

  // Create a map of student data
  const studentMap = new Map((studentsData || []).map((s: any) => [s.id, s]));

  // Combine scores with student data
  const combined = (scoresData || []).map((score: any) => ({
    ...score,
    entered_by: null, // Set to null to match interface
    created_by: null,
    updated_by: null,
    student: studentMap.get(score.student_id) || null,
  }));

  // Sort by student last_name
  const sorted = combined.sort((a, b) => {
    const aLastName = (a as any).student?.last_name || "";
    const bLastName = (b as any).student?.last_name || "";
    return aLastName.localeCompare(bLastName);
  });

  return sorted as GradebookGradedScore[];
}

export async function upsertGradedScore(data: {
  organization_id: string;
  graded_item_id: string;
  student_id: string;
  points_earned?: number | null;
  status?: "present" | "absent" | "excused" | "missing";
  entered_by?: string;
}): Promise<GradebookGradedScore> {
  // Check if score exists
  const { data: existing } = await supabase
    .from("gradebook_graded_scores")
    .select("id")
    .eq("graded_item_id", data.graded_item_id)
    .eq("student_id", data.student_id)
    .is("archived_at", null)
    .single();

  if (existing) {
    // Update
    const { data: result, error } = await supabase
      .from("gradebook_graded_scores")
      .update({
        points_earned: data.points_earned,
        status: data.status || "present",
        entered_by: data.entered_by,
        entered_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select(`
        *,
        student:students(id, first_name, last_name, student_number)
      `)
      .single();

    if (error) throw new Error(`Failed to update graded score: ${error.message}`);
    return result;
  } else {
    // Insert
    const { data: result, error } = await supabase
      .from("gradebook_graded_scores")
      .insert([{
        ...data,
        status: data.status || "present",
        entered_at: new Date().toISOString(),
      }])
      .select(`
        *,
        student:students(id, first_name, last_name, student_number)
      `)
      .single();

    if (error) throw new Error(`Failed to create graded score: ${error.message}`);
    return result;
  }
}

export async function bulkUpsertGradedScores(
  scores: Array<{
    organization_id: string;
    graded_item_id: string;
    student_id: string;
    points_earned?: number | null;
    status?: "present" | "absent" | "excused" | "missing";
    entered_by?: string;
  }>
): Promise<GradebookGradedScore[]> {
  // Get existing scores for this item
  if (scores.length === 0) return [];

  const { data: existing } = await supabase
    .from("gradebook_graded_scores")
    .select("id, student_id")
    .eq("graded_item_id", scores[0].graded_item_id)
    .is("archived_at", null);

  const existingMap = new Map((existing || []).map((s) => [s.student_id, s.id]));

  const toUpdate: Array<{ id: string; data: any }> = [];
  const toInsert: any[] = [];

  for (const score of scores) {
    const existingId = existingMap.get(score.student_id);
    if (existingId) {
      toUpdate.push({
        id: existingId,
        data: {
          points_earned: score.points_earned,
          status: score.status || "present",
          entered_by: score.entered_by,
          entered_at: new Date().toISOString(),
        },
      });
    } else {
      toInsert.push({
        ...score,
        status: score.status || "present",
        entered_at: new Date().toISOString(),
      });
    }
  }

  // Update existing
  for (const update of toUpdate) {
    await supabase
      .from("gradebook_graded_scores")
      .update(update.data)
      .eq("id", update.id);
  }

  // Insert new
  if (toInsert.length > 0) {
    await supabase.from("gradebook_graded_scores").insert(toInsert);
  }

  // Return all scores
  return listGradedScores(scores[0].graded_item_id);
}

// ============================================================================
// Compute Runs
// ============================================================================

export async function listComputeRuns(filters?: {
  organization_id?: string;
  section_id?: string;
  term_period?: string;
  status?: string;
}): Promise<GradebookComputeRun[]> {
  let query = supabase
    .from("gradebook_compute_runs")
    .select(`
      *,
      scheme:gradebook_schemes(*),
      section:sections(id, name, code)
    `)
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (filters?.organization_id) {
    query = query.eq("organization_id", filters.organization_id);
  }

  if (filters?.section_id) {
    query = query.eq("section_id", filters.section_id);
  }

  if (filters?.term_period) {
    query = query.eq("term_period", filters.term_period);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list compute runs: ${error.message}`);
  return (data || []) as GradebookComputeRun[];
}

export async function getComputeRun(id: string): Promise<GradebookComputeRun | null> {
  const { data, error } = await supabase
    .from("gradebook_compute_runs")
    .select(`
      *,
      scheme:gradebook_schemes(*),
      section:sections(id, name, code)
    `)
    .eq("id", id)
    .is("archived_at", null)
    .single();

  if (error) {
    if (error.code === "PGRST116") return null;
    throw new Error(`Failed to get compute run: ${error.message}`);
  }
  return data as GradebookComputeRun;
}

export async function createComputeRun(data: {
  organization_id: string;
  school_id?: string | null;
  section_id?: string; // Legacy support
  section_subject_offering_id?: string; // Preferred for new workflows
  school_year_id: string;
  term_period: string;
  scheme_id: string;
  scheme_version: number;
  weight_profile_id?: string | null;
  transmutation_table_id?: string | null;
  transmutation_version?: number | null;
  as_of: string;
  run_by?: string;
}): Promise<GradebookComputeRun> {
  // Require at least one of section_id or section_subject_offering_id
  if (!data.section_subject_offering_id && !data.section_id) {
    throw new Error("Either section_id or section_subject_offering_id must be provided");
  }

  const { data: result, error } = await supabase
    .from("gradebook_compute_runs")
    .insert([{ ...data, status: "created" }])
    .select(`
      *,
      scheme:gradebook_schemes(*),
      section:sections(id, name, code)
    `)
    .single();

  if (error) throw new Error(`Failed to create compute run: ${error.message}`);
  return result;
}

export async function updateComputeRunStatus(
  id: string,
  status: "completed" | "failed",
  errorMessage?: string | null,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookComputeRun> {
  const client = supabaseClient || supabase;
  const { data: result, error } = await client
    .from("gradebook_compute_runs")
    .update({
      status,
      error_message: errorMessage || null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select(`
      *,
      scheme:gradebook_schemes(*),
      section:sections(id, name, code)
    `)
    .single();

  if (error) throw new Error(`Failed to update compute run: ${error.message}`);
  return result;
}

// ============================================================================
// Computed Grades
// ============================================================================

export async function listComputedGrades(computeRunId: string): Promise<GradebookComputedGrade[]> {
  const { data, error } = await supabase
    .from("gradebook_computed_grades")
    .select(`
      *,
      student:students(id, first_name, last_name, student_number)
    `)
    .eq("compute_run_id", computeRunId);

  if (error) throw new Error(`Failed to list computed grades: ${error.message}`);
  
  // Sort by student last_name manually since Supabase doesn't support nested ordering
  const sorted = (data || []).sort((a, b) => {
    const aLastName = (a as any).student?.last_name || "";
    const bLastName = (b as any).student?.last_name || "";
    return aLastName.localeCompare(bLastName);
  });
  
  return sorted as GradebookComputedGrade[];
}

export async function createComputedGrade(data: {
  organization_id: string;
  compute_run_id: string;
  student_id: string;
  section_id: string;
  school_year_id: string;
  term_period: string;
  initial_grade: number | null;
  final_numeric_grade: number;
  transmuted_grade?: number | null;
  output_grade_value?: string | null;
  breakdown: any;
}): Promise<GradebookComputedGrade> {
  const { data: result, error } = await supabase
    .from("gradebook_computed_grades")
    .insert([data])
    .select(`
      *,
      student:students(id, first_name, last_name, student_number)
    `)
    .single();

  if (error) throw new Error(`Failed to create computed grade: ${error.message}`);
  return result;
}

export async function bulkCreateComputedGrades(
  grades: Array<{
    organization_id: string;
    compute_run_id: string;
    student_id: string;
    section_id: string;
    school_year_id: string;
    term_period: string;
    initial_grade: number | null;
    final_numeric_grade: number;
    transmuted_grade?: number | null;
    output_grade_value?: string | null;
    breakdown: any;
  }>,
  supabaseClient?: any // Optional Supabase client (for server-side use)
): Promise<GradebookComputedGrade[]> {
  const client = supabaseClient || supabase;
  const { data, error } = await client
    .from("gradebook_computed_grades")
    .insert(grades)
    .select(`
      *,
      student:students(id, first_name, last_name, student_number)
    `);

  if (error) throw new Error(`Failed to create computed grades: ${error.message}`);
  return (data || []) as GradebookComputedGrade[];
}

// ============================================================================
// Phase 4 Links
// ============================================================================

export async function listPhase4Links(computedGradeId?: string, gradeEntryId?: string): Promise<GradebookPhase4Link[]> {
  let query = supabase
    .from("gradebook_phase4_links")
    .select("*")
    .is("archived_at", null);

  if (computedGradeId) {
    query = query.eq("computed_grade_id", computedGradeId);
  }

  if (gradeEntryId) {
    query = query.eq("grade_entry_id", gradeEntryId);
  }

  const { data, error } = await query;
  if (error) throw new Error(`Failed to list Phase 4 links: ${error.message}`);
  return (data || []) as GradebookPhase4Link[];
}

export async function createPhase4Link(data: {
  organization_id: string;
  grade_entry_id: string;
  computed_grade_id: string;
  created_by?: string;
}): Promise<GradebookPhase4Link> {
  const { data: result, error } = await supabase
    .from("gradebook_phase4_links")
    .insert([data])
    .select()
    .single();

  if (error) throw new Error(`Failed to create Phase 4 link: ${error.message}`);
  return result;
}

// ============================================================================
// Computation Logic
// ============================================================================

/**
 * Score Status Handling Policy (MVP Defaults)
 * 
 * - present: counts points_earned and max_points normally
 * - missing: counts max_points, points_earned = 0
 * - absent: counts max_points, points_earned = 0
 * - excused: EXCLUDE from denominator (do not count max_points)
 */
type ScoreStatus = "present" | "missing" | "absent" | "excused";

interface ScoreContribution {
  points: number;
  maxPoints: number;
  status: ScoreStatus;
}

/**
 * Compute grades for a section/term based on graded scores
 * This is the core computation engine
 * 
 * Hardening rules:
 * - DepEd transmutation uses floor rounding by default (configurable via scheme.metadata.rounding_mode)
 * - Score status policy: excused excludes from denominator, missing/absent = 0 points
 * - Weight validation: fails if weights don't sum to 100 (strict mode) or normalizes (normalize mode)
 */
export async function computeGradesForRun(
  runId: string,
  run?: GradebookComputeRun | null,
  supabaseClient?: any, // Optional Supabase client (for server-side use)
  classificationMetadata?: {
    classification_used: string | null;
    classification_source: string | null;
    is_fallback: boolean;
  } // Optional classification metadata to store in breakdown
): Promise<{
  success: boolean;
  error?: string;
  computedGrades: GradebookComputedGrade[];
}> {
  try {
    // Get compute run (use provided run or fetch it)
    let computeRun = run;
    if (!computeRun) {
      computeRun = await getComputeRun(runId);
    }
    if (!computeRun) {
      return { success: false, error: "Compute run not found", computedGrades: [] };
    }

    if (computeRun.status !== "created") {
      return { success: false, error: "Compute run already processed", computedGrades: [] };
    }

    // Get scheme
    const scheme = await getScheme(computeRun.scheme_id, supabaseClient);
    if (!scheme) {
      await updateComputeRunStatus(runId, "failed", "Scheme not found", supabaseClient);
      return { success: false, error: "Scheme not found", computedGrades: [] };
    }

    // Get rounding mode (default: floor for DepEd, round for CHED)
    const roundingMode = scheme.metadata?.rounding_mode || 
      (scheme.scheme_type === "deped_k12" ? "floor" : "round");
    
    // Get weight policy (default: strict - fail if weights != 100)
    const weightPolicy = scheme.metadata?.weight_policy || "strict";

    // Get components and weights
    const components = await listComponents(computeRun.scheme_id, supabaseClient);
    const weights = await listComponentWeights(computeRun.scheme_id, computeRun.weight_profile_id || null, supabaseClient);

    // Build weight map and validate weights
    const weightMap = new Map<string, number>();
    let totalWeight = 0;
    for (const weight of weights) {
      weightMap.set(weight.component_id, weight.weight_percent);
      totalWeight += weight.weight_percent;
    }

    // Validate weights sum to 100 (if strict policy)
    if (weightPolicy === "strict" && Math.abs(totalWeight - 100) > 0.01) {
      const errorMsg = `Component weights sum to ${totalWeight}% but must equal 100% (strict mode)`;
      await updateComputeRunStatus(runId, "failed", errorMsg, supabaseClient);
      return { success: false, error: errorMsg, computedGrades: [] };
    }

    // Get transmutation table if DepEd or CHED
    let transmutationRows: GradebookTransmutationRow[] = [];
    if (scheme.scheme_type === "deped_k12" || scheme.scheme_type === "ched_hei") {
      if (!computeRun.transmutation_table_id) {
        const errorMsg = `${scheme.scheme_type === "deped_k12" ? "DepEd K-12" : "CHED"} scheme requires transmutation_table_id`;
        await updateComputeRunStatus(runId, "failed", errorMsg, supabaseClient);
        return { success: false, error: errorMsg, computedGrades: [] };
      }
      transmutationRows = await listTransmutationRows(computeRun.transmutation_table_id, supabaseClient);
      if (transmutationRows.length === 0) {
        const errorMsg = "Transmutation table has no rows";
        await updateComputeRunStatus(runId, "failed", errorMsg, supabaseClient);
        return { success: false, error: errorMsg, computedGrades: [] };
      }
    }

    // Get all graded items for this offering/term (prefer offering_id, fallback to section_id for legacy)
    const items = await listGradedItems({
      section_subject_offering_id: computeRun.section_subject_offering_id || undefined,
      section_id: computeRun.section_subject_offering_id ? undefined : computeRun.section_id,
      term_period: computeRun.term_period,
    }, supabaseClient);

    // Get all scores for these items (filtered by as_of timestamp)
    const allScores: GradebookGradedScore[] = [];
    for (const item of items) {
      const scores = await listGradedScores(item.id, supabaseClient);
      // Filter by as_of timestamp (only scores created <= as_of)
      const filteredScores = scores.filter(
        (s) => new Date(s.created_at) <= new Date(computeRun.as_of)
      );
      allScores.push(...filteredScores);
    }

    // Get students in section
    const client = supabaseClient || supabase;
    const { data: sectionStudents } = await client
      .from("section_students")
      .select("student_id")
      .eq("section_id", computeRun.section_id)
      .eq("status", "active")
      .is("end_date", null);

    const studentIds = (sectionStudents || []).map((s) => s.student_id);

    // Compute per student
    const computedGrades: Array<{
      organization_id: string;
      compute_run_id: string;
      student_id: string;
      section_id: string;
      school_year_id: string;
      term_period: string;
      initial_grade: number | null;
      final_numeric_grade: number;
      transmuted_grade: number | null;
      output_grade_value: string | null;
      breakdown: any;
    }> = [];

    for (const studentId of studentIds) {
      // Group scores by component with status handling
      const componentScores = new Map<string, ScoreContribution[]>();
      const componentStatusCounts = new Map<string, Record<ScoreStatus, number>>();

      for (const item of items) {
        const score = allScores.find(
          (s) => s.student_id === studentId && s.graded_item_id === item.id
        );

        const componentId = item.component_id;
        
        // Initialize status counts for component
        if (!componentStatusCounts.has(componentId)) {
          componentStatusCounts.set(componentId, {
            present: 0,
            missing: 0,
            absent: 0,
            excused: 0,
          });
        }

        if (score) {
          const statusCounts = componentStatusCounts.get(componentId)!;
          statusCounts[score.status] = (statusCounts[score.status] || 0) + 1;

          // Apply status handling policy
          if (score.status === "present") {
            // Normal: count points and max_points
            if (!componentScores.has(componentId)) {
              componentScores.set(componentId, []);
            }
            componentScores.get(componentId)!.push({
              points: score.points_earned || 0,
              maxPoints: item.max_points,
              status: "present",
            });
          } else if (score.status === "missing" || score.status === "absent") {
            // Count max_points, points = 0
            if (!componentScores.has(componentId)) {
              componentScores.set(componentId, []);
            }
            componentScores.get(componentId)!.push({
              points: 0,
              maxPoints: item.max_points,
              status: score.status,
            });
          }
          // excused: EXCLUDE from denominator (do not add to componentScores)
        }
      }

      // Compute component totals
      const componentBreakdown: any[] = [];
      let totalWeightedScore = 0;
      let totalWeightUsed = 0;

      for (const component of components) {
        const scores = componentScores.get(component.id) || [];
        const statusCounts = componentStatusCounts.get(component.id) || {
          present: 0,
          missing: 0,
          absent: 0,
          excused: 0,
        };

        // Calculate totals (excused items excluded from denominator)
        const rawTotal = scores.reduce((sum, s) => sum + s.points, 0);
        const maxTotal = scores.reduce((sum, s) => sum + s.maxPoints, 0);
        const percent = maxTotal > 0 ? (rawTotal / maxTotal) * 100 : 0;
        const weightPercent = weightMap.get(component.id) || 0;
        const weightedScore = (percent * weightPercent) / 100;

        componentBreakdown.push({
          component_id: component.id,
          component_code: component.code,
          component_label: component.label,
          raw_total: rawTotal,
          max_total: maxTotal,
          percent: percent,
          weight_percent: weightPercent,
          weighted_score: weightedScore,
          status_counts: statusCounts,
          excluded_denominator_points: 0, // Would be sum of excused item max_points if tracked
        });

        totalWeightedScore += weightedScore;
        totalWeightUsed += weightPercent;
      }

      // Initial grade calculation
      // If weights don't sum to 100 and normalize mode, normalize ONCE
      let initialGrade: number;
      if (weightPolicy === "normalize" && totalWeightUsed > 0 && Math.abs(totalWeightUsed - 100) > 0.01) {
        // Normalize: multiply by (100 / totalWeightUsed)
        initialGrade = (totalWeightedScore / totalWeightUsed) * 100;
      } else {
        // Strict mode or weights sum to 100: use weighted sum directly
        initialGrade = totalWeightUsed > 0 ? (totalWeightedScore / totalWeightUsed) * 100 : 0;
      }

      // Transmutation (DepEd and CHED)
      let transmutedGrade: number | null = null;
      let finalNumericGrade = initialGrade;
      let initialGradeKey: number | null = null;

      if ((scheme.scheme_type === "deped_k12" || scheme.scheme_type === "ched_hei") && transmutationRows.length > 0) {
        // Find the closest lower initial_grade from transmutation table
        // Sort transmutation rows by initial_grade descending
        const sortedRows = [...transmutationRows].sort((a, b) => b.initial_grade - a.initial_grade);
        
        // Find the highest initial_grade that is <= actual grade
        const row = sortedRows.find((r) => r.initial_grade <= initialGrade);
        
        if (!row) {
          const errorMsg = `Transmutation row not found for initial_grade=${initialGrade.toFixed(2)}. No row with initial_grade <= ${initialGrade.toFixed(2)} exists in the transmutation table.`;
          await updateComputeRunStatus(runId, "failed", errorMsg, supabaseClient);
          return { success: false, error: errorMsg, computedGrades: [] };
        }

        initialGradeKey = row.initial_grade;
        transmutedGrade = row.transmuted_grade;
        finalNumericGrade = row.transmuted_grade;
      }

      // Get offering context if available
      let offeringContext: {
        offering_id: string | null;
        subject_id: string | null;
        subject_code: string | null;
        subject_name: string | null;
      } = {
        offering_id: computeRun.section_subject_offering_id || null,
        subject_id: null,
        subject_code: null,
        subject_name: null,
      };

      if (computeRun.section_subject_offering_id) {
        const client = supabaseClient || supabase;
        const { data: offering } = await client
          .from("section_subject_offerings")
          .select(`
            id,
            subject_id,
            subject:subjects(id, code, name)
          `)
          .eq("id", computeRun.section_subject_offering_id)
          .single();

        if (offering) {
          const subject = offering.subject as any;
          offeringContext.subject_id = subject?.id || null;
          offeringContext.subject_code = subject?.code || null;
          offeringContext.subject_name = subject?.name || null;
        }
      }

      // Build breakdown JSONB with full traceability
      // Include classification metadata and offering context for auditability
      const breakdown: any = {
        components: componentBreakdown,
        initial_grade_raw: initialGrade,
        initial_grade_key: initialGradeKey,
        initial_grade: initialGrade,
        transmuted_grade: transmutedGrade,
        rounding_mode: roundingMode,
        weight_policy: weightPolicy,
        total_weight: totalWeightUsed,
        computation_method: scheme.scheme_type,
        scheme_version: computeRun.scheme_version,
        as_of: computeRun.as_of,
        // Classification metadata (for audit trail)
        classification_used: classificationMetadata?.classification_used || null,
        classification_source: classificationMetadata?.classification_source || null,
        classification_is_fallback: classificationMetadata?.is_fallback || false,
        weight_profile_id: computeRun.weight_profile_id || null,
        // Section and offering context (canonical academic anchors)
        section_id: computeRun.section_id,
        section_subject_offering_id: offeringContext.offering_id,
        subject_id: offeringContext.subject_id,
        subject_code: offeringContext.subject_code,
        subject_name: offeringContext.subject_name,
        school_year_id: computeRun.school_year_id,
        term_period: computeRun.term_period,
      };

      // If classification metadata not provided, try to get it from section
      if (!classificationMetadata) {
        const client = supabaseClient || supabase;
        const { data: section } = await client
          .from("sections")
          .select("primary_classification, classification_source")
          .eq("id", computeRun.section_id)
          .single();

        if (section) {
          breakdown.classification_used = section.primary_classification;
          breakdown.classification_source = section.classification_source;
          breakdown.classification_is_fallback = false;
        }
      }

      computedGrades.push({
        organization_id: computeRun.organization_id,
        compute_run_id: runId,
        student_id: studentId,
        section_id: computeRun.section_id,
        school_year_id: computeRun.school_year_id,
        term_period: computeRun.term_period,
        initial_grade: initialGrade,
        final_numeric_grade: finalNumericGrade,
        transmuted_grade: transmutedGrade,
        output_grade_value: null, // CHED mapping can be added later
        breakdown,
      });
    }

    // Bulk insert computed grades
    const created = await bulkCreateComputedGrades(computedGrades, supabaseClient);

    // Update run status
    await updateComputeRunStatus(runId, "completed", null, supabaseClient);

    return { success: true, computedGrades: created };
  } catch (error: any) {
    await updateComputeRunStatus(runId, "failed", error.message, supabaseClient);
    return { success: false, error: error.message, computedGrades: [] };
  }
}
