/**
 * AMS (Assessment Management System) Data Access Layer
 * Phase 2: Experiences & Observations
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface Experience {
  id: string;
  organization_id: string;
  school_id: string | null;
  name: string;
  description: string | null;
  experience_type: string | null;
  program_id: string | null;
  section_id: string | null;
  batch_id: string | null;
  term_id: string | null;
  start_at: string | null;
  end_at: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface ExperienceCompetencyLink {
  id: string;
  organization_id: string;
  experience_id: string;
  competency_id: string;
  emphasis: "Primary" | "Secondary" | "Contextual";
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  competency?: {
    id: string;
    name: string;
    domain?: {
      id: string;
      name: string;
    };
  };
}

export interface Observation {
  id: string;
  organization_id: string;
  school_id: string | null;
  learner_id: string;
  experience_id: string;
  competency_id: string;
  competency_level_id: string;
  notes: string | null;
  observed_at: string;
  status: "active" | "withdrawn";
  withdrawn_at: string | null;
  withdrawn_reason: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  learner?: {
    id: string;
    first_name: string;
    last_name: string;
  };
  experience?: Experience;
  competency?: {
    id: string;
    name: string;
    domain?: {
      id: string;
      name: string;
    };
  };
  competency_level?: {
    id: string;
    label: string;
  };
  indicators?: Array<{
    id: string;
    description: string;
  }>;
}

export interface ObservationIndicatorLink {
  id: string;
  observation_id: string;
  indicator_id: string;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
}

export interface ObservationAttachment {
  id: string;
  observation_id: string;
  file_url: string;
  file_name: string | null;
  file_type: string | null;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

// ============================================================================
// Experience Functions
// ============================================================================

export async function getExperiences(
  organizationId: string | null,
  filters?: {
    experienceType?: string | null;
    programId?: string | null;
    sectionId?: string | null;
    batchId?: string | null;
    schoolId?: string | null;
  }
): Promise<Experience[]> {
  let query = supabase
    .from("experiences")
    .select("*")
    .is("archived_at", null)
    .order("created_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.experienceType) {
    query = query.eq("experience_type", filters.experienceType);
  }

  if (filters?.programId) {
    query = query.eq("program_id", filters.programId);
  }

  if (filters?.sectionId) {
    query = query.eq("section_id", filters.sectionId);
  }

  if (filters?.batchId) {
    query = query.eq("batch_id", filters.batchId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching experiences:", error);
    throw error;
  }

  return data || [];
}

export async function getExperience(id: string): Promise<Experience | null> {
  const { data, error } = await supabase
    .from("experiences")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching experience:", error);
    return null;
  }

  return data;
}

export async function createExperience(data: {
  organization_id: string;
  school_id?: string | null;
  name: string;
  description?: string | null;
  experience_type?: string | null;
  program_id?: string | null;
  section_id?: string | null;
  batch_id?: string | null;
  term_id?: string | null;
  start_at?: string | null;
  end_at?: string | null;
  created_by?: string;
}): Promise<Experience> {
  const { data: result, error } = await supabase
    .from("experiences")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating experience:", error);
    throw error;
  }

  return result;
}

export async function updateExperience(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    experience_type?: string | null;
    program_id?: string | null;
    section_id?: string | null;
    batch_id?: string | null;
    term_id?: string | null;
    start_at?: string | null;
    end_at?: string | null;
    updated_by?: string;
  }
): Promise<Experience> {
  const { data: result, error } = await supabase
    .from("experiences")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating experience:", error);
    throw error;
  }

  return result;
}

export async function archiveExperience(id: string): Promise<void> {
  const { error } = await supabase
    .from("experiences")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving experience:", error);
    throw error;
  }
}

// ============================================================================
// Experience Competency Link Functions
// ============================================================================

export async function getExperienceCompetencyLinks(
  experienceId: string
): Promise<ExperienceCompetencyLink[]> {
  const { data, error } = await supabase
    .from("experience_competency_links")
    .select(`
      *,
      competency:competencies(
        id,
        name,
        domain:domains(
          id,
          name
        )
      )
    `)
    .eq("experience_id", experienceId)
    .is("archived_at", null)
    .order("emphasis", { ascending: true });

  if (error) {
    console.error("Error fetching experience competency links:", error);
    throw error;
  }

  return data || [];
}

export async function linkCompetencyToExperience(
  experienceId: string,
  competencyId: string,
  emphasis: "Primary" | "Secondary" | "Contextual",
  organizationId: string,
  createdBy?: string
): Promise<ExperienceCompetencyLink> {
  // First, get the experience to ensure it exists and get organization_id
  const experience = await getExperience(experienceId);
  if (!experience) {
    throw new Error("Experience not found");
  }

  const { data: result, error } = await supabase
    .from("experience_competency_links")
    .insert([
      {
        organization_id: organizationId,
        experience_id: experienceId,
        competency_id: competencyId,
        emphasis,
        created_by: createdBy,
      },
    ])
    .select()
    .single();

  if (error) {
    console.error("Error linking competency to experience:", error);
    throw error;
  }

  return result;
}

export async function unlinkCompetencyFromExperience(
  experienceId: string,
  competencyId: string
): Promise<void> {
  const { error } = await supabase
    .from("experience_competency_links")
    .update({ archived_at: new Date().toISOString() })
    .eq("experience_id", experienceId)
    .eq("competency_id", competencyId)
    .is("archived_at", null);

  if (error) {
    console.error("Error unlinking competency from experience:", error);
    throw error;
  }
}

export async function updateCompetencyLinkEmphasis(
  experienceId: string,
  competencyId: string,
  emphasis: "Primary" | "Secondary" | "Contextual",
  updatedBy?: string
): Promise<ExperienceCompetencyLink> {
  const { data: result, error } = await supabase
    .from("experience_competency_links")
    .update({
      emphasis,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("experience_id", experienceId)
    .eq("competency_id", competencyId)
    .is("archived_at", null)
    .select()
    .single();

  if (error) {
    console.error("Error updating competency link emphasis:", error);
    throw error;
  }

  return result;
}

// ============================================================================
// Observation Functions
// ============================================================================

export async function getObservations(
  organizationId: string | null,
  filters?: {
    learnerId?: string | null;
    experienceId?: string | null;
    competencyId?: string | null;
    domainId?: string | null;
    status?: "active" | "withdrawn" | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }
): Promise<Observation[]> {
  let query = supabase
    .from("observations")
    .select(`
      *,
      learner:students(id, first_name, last_name),
      experience:experiences(*),
      competency:competencies(
        id,
        name,
        domain:domains(id, name)
      ),
      competency_level:competency_levels(id, label)
    `)
    .order("observed_at", { ascending: false });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.learnerId) {
    query = query.eq("learner_id", filters.learnerId);
  }

  if (filters?.experienceId) {
    query = query.eq("experience_id", filters.experienceId);
  }

  if (filters?.competencyId) {
    query = query.eq("competency_id", filters.competencyId);
  }

  if (filters?.status) {
    query = query.eq("status", filters.status);
  } else {
    // Default to active only unless explicitly requesting withdrawn
    query = query.eq("status", "active");
  }

  if (filters?.dateFrom) {
    query = query.gte("observed_at", filters.dateFrom);
  }

  if (filters?.dateTo) {
    query = query.lte("observed_at", filters.dateTo);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching observations:", error);
    throw error;
  }

  // Fetch indicators for each observation
  const observations = (data || []) as Observation[];
  for (const obs of observations) {
    const { data: indicatorLinks } = await supabase
      .from("observation_indicator_links")
      .select(`
        indicator_id,
        indicators(id, description)
      `)
      .eq("observation_id", obs.id)
      .is("archived_at", null);

    obs.indicators =
      indicatorLinks?.map((link: any) => link.indicators).filter(Boolean) ||
      [];
  }

  return observations;
}

export async function getObservation(id: string): Promise<Observation | null> {
  const { data, error } = await supabase
    .from("observations")
    .select(`
      *,
      learner:students(id, first_name, last_name),
      experience:experiences(*),
      competency:competencies(
        id,
        name,
        domain:domains(id, name)
      ),
      competency_level:competency_levels(id, label)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching observation:", error);
    return null;
  }

  // Fetch indicators
  const { data: indicatorLinks } = await supabase
    .from("observation_indicator_links")
    .select(`
      indicator_id,
      indicators(id, description)
    `)
    .eq("observation_id", id)
    .is("archived_at", null);

  const observation = data as Observation;
  observation.indicators =
    indicatorLinks?.map((link: any) => link.indicators).filter(Boolean) || [];

  return observation;
}

export async function createObservation(data: {
  organization_id: string;
  school_id?: string | null;
  learner_id: string;
  experience_id: string;
  competency_id: string;
  competency_level_id: string;
  notes?: string | null;
  observed_at?: string;
  indicator_ids?: string[];
  attachments?: Array<{
    file_url: string;
    file_name?: string;
    file_type?: string;
    description?: string;
  }>;
  created_by?: string;
}): Promise<Observation> {
  // Create observation
  const { data: observation, error: obsError } = await supabase
    .from("observations")
    .insert([
      {
        organization_id: data.organization_id,
        school_id: data.school_id,
        learner_id: data.learner_id,
        experience_id: data.experience_id,
        competency_id: data.competency_id,
        competency_level_id: data.competency_level_id,
        notes: data.notes,
        observed_at: data.observed_at || new Date().toISOString(),
        created_by: data.created_by,
      },
    ])
    .select()
    .single();

  if (obsError) {
    console.error("Error creating observation:", obsError);
    throw obsError;
  }

  // Create indicator links
  if (data.indicator_ids && data.indicator_ids.length > 0) {
    const indicatorLinks = data.indicator_ids.map((indicatorId) => ({
      organization_id: data.organization_id,
      observation_id: observation.id,
      indicator_id: indicatorId,
      created_by: data.created_by,
    }));

    const { error: linksError } = await supabase
      .from("observation_indicator_links")
      .insert(indicatorLinks);

    if (linksError) {
      console.error("Error creating indicator links:", linksError);
      // Note: We don't throw here - observation is created, links can be added later
    }
  }

  // Create attachments
  if (data.attachments && data.attachments.length > 0) {
    const attachments = data.attachments.map((att) => ({
      organization_id: data.organization_id,
      observation_id: observation.id,
      file_url: att.file_url,
      file_name: att.file_name,
      file_type: att.file_type,
      description: att.description,
      created_by: data.created_by,
    }));

    const { error: attError } = await supabase
      .from("observation_attachments")
      .insert(attachments);

    if (attError) {
      console.error("Error creating attachments:", attError);
      // Note: We don't throw here - observation is created, attachments can be added later
    }
  }

  // Fetch complete observation with relations
  const completeObservation = await getObservation(observation.id);
  if (!completeObservation) {
    throw new Error("Failed to fetch created observation");
  }

  return completeObservation;
}

export async function updateObservation(
  id: string,
  data: {
    competency_level_id?: string;
    notes?: string | null;
    indicator_ids?: string[];
    updated_by?: string;
  }
): Promise<Observation> {
  // Update observation
  const updateData: any = {
    updated_at: new Date().toISOString(),
    updated_by: data.updated_by,
  };

  if (data.competency_level_id !== undefined) {
    updateData.competency_level_id = data.competency_level_id;
  }

  if (data.notes !== undefined) {
    updateData.notes = data.notes;
  }

  const { error: updateError } = await supabase
    .from("observations")
    .update(updateData)
    .eq("id", id);

  if (updateError) {
    console.error("Error updating observation:", updateError);
    throw updateError;
  }

  // Update indicator links if provided
  if (data.indicator_ids !== undefined) {
    // Archive all existing links
    await supabase
      .from("observation_indicator_links")
      .update({ archived_at: new Date().toISOString() })
      .eq("observation_id", id)
      .is("archived_at", null);

    // Create new links
    if (data.indicator_ids.length > 0) {
      const observation = await getObservation(id);
      if (observation) {
        const indicatorLinks = data.indicator_ids.map((indicatorId) => ({
          organization_id: observation.organization_id,
          observation_id: id,
          indicator_id: indicatorId,
          created_by: data.updated_by,
        }));

        const { error: linksError } = await supabase
          .from("observation_indicator_links")
          .insert(indicatorLinks);

        if (linksError) {
          console.error("Error updating indicator links:", linksError);
        }
      }
    }
  }

  // Fetch updated observation
  const updatedObservation = await getObservation(id);
  if (!updatedObservation) {
    throw new Error("Failed to fetch updated observation");
  }

  return updatedObservation;
}

export async function withdrawObservation(
  id: string,
  reason: string | null,
  updatedBy?: string
): Promise<Observation> {
  const { data: result, error } = await supabase
    .from("observations")
    .update({
      status: "withdrawn",
      withdrawn_at: new Date().toISOString(),
      withdrawn_reason: reason,
      updated_by: updatedBy,
      updated_at: new Date().toISOString(),
    })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error withdrawing observation:", error);
    throw error;
  }

  // Fetch complete observation
  const completeObservation = await getObservation(id);
  if (!completeObservation) {
    throw new Error("Failed to fetch withdrawn observation");
  }

  return completeObservation;
}

export async function getLearnerObservations(
  learnerId: string,
  filters?: {
    experienceId?: string | null;
    competencyId?: string | null;
    domainId?: string | null;
    dateFrom?: string | null;
    dateTo?: string | null;
  }
): Promise<Observation[]> {
  return getObservations(null, {
    learnerId,
    ...filters,
    status: "active", // Only show active observations for learners
  });
}
