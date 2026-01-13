/**
 * OBS (Outcome-Based System) Data Access Layer
 * Phase 2: Structure of Meaning
 * 
 * All functions respect RLS policies and filter by organization_id unless super admin.
 */

import { supabase } from "@/lib/supabase/client";

// ============================================================================
// Types
// ============================================================================

export interface Domain {
  id: string;
  organization_id: string;
  school_id: string | null;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

export interface Competency {
  id: string;
  organization_id: string;
  school_id: string | null;
  domain_id: string;
  name: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  domain?: Domain;
}

export interface Indicator {
  id: string;
  organization_id: string;
  school_id: string | null;
  competency_id: string;
  description: string;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
  // Joined fields
  competency?: Competency;
  domain?: Domain;
}

export interface CompetencyLevel {
  id: string;
  organization_id: string;
  school_id: string | null;
  label: string;
  description: string | null;
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
  archived_at: string | null;
}

// ============================================================================
// Domain Functions
// ============================================================================

export async function getDomains(
  organizationId: string | null,
  filters?: { schoolId?: string | null }
): Promise<Domain[]> {
  let query = supabase
    .from("domains")
    .select("*")
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching domains:", error);
    throw error;
  }

  return data || [];
}

export async function getDomain(id: string): Promise<Domain | null> {
  const { data, error } = await supabase
    .from("domains")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching domain:", error);
    return null;
  }

  return data;
}

export async function createDomain(data: {
  organization_id: string;
  school_id?: string | null;
  name: string;
  description?: string | null;
  created_by?: string;
}): Promise<Domain> {
  const { data: result, error } = await supabase
    .from("domains")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating domain:", error);
    throw error;
  }

  return result;
}

export async function updateDomain(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    updated_by?: string;
  }
): Promise<Domain> {
  const { data: result, error } = await supabase
    .from("domains")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating domain:", error);
    throw error;
  }

  return result;
}

export async function archiveDomain(id: string): Promise<void> {
  const { error } = await supabase
    .from("domains")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving domain:", error);
    throw error;
  }
}

// ============================================================================
// Competency Functions
// ============================================================================

export async function getCompetencies(
  organizationId: string | null,
  filters?: { domainId?: string | null; schoolId?: string | null }
): Promise<Competency[]> {
  let query = supabase
    .from("competencies")
    .select(`
      *,
      domain:domains(*)
    `)
    .is("archived_at", null)
    .order("name", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.domainId) {
    query = query.eq("domain_id", filters.domainId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching competencies:", error);
    throw error;
  }

  return data || [];
}

export async function getCompetency(id: string): Promise<Competency | null> {
  const { data, error } = await supabase
    .from("competencies")
    .select(`
      *,
      domain:domains(*)
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching competency:", error);
    return null;
  }

  return data;
}

export async function createCompetency(data: {
  organization_id: string;
  school_id?: string | null;
  domain_id: string;
  name: string;
  description?: string | null;
  created_by?: string;
}): Promise<Competency> {
  const { data: result, error } = await supabase
    .from("competencies")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating competency:", error);
    throw error;
  }

  return result;
}

export async function updateCompetency(
  id: string,
  data: {
    name?: string;
    description?: string | null;
    domain_id?: string;
    updated_by?: string;
  }
): Promise<Competency> {
  const { data: result, error } = await supabase
    .from("competencies")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating competency:", error);
    throw error;
  }

  return result;
}

export async function archiveCompetency(id: string): Promise<void> {
  const { error } = await supabase
    .from("competencies")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving competency:", error);
    throw error;
  }
}

// ============================================================================
// Indicator Functions
// ============================================================================

export async function getIndicators(
  organizationId: string | null,
  filters?: {
    competencyId?: string | null;
    domainId?: string | null;
    schoolId?: string | null;
  }
): Promise<Indicator[]> {
  let query = supabase
    .from("indicators")
    .select(`
      *,
      competency:competencies(
        *,
        domain:domains(*)
      )
    `)
    .is("archived_at", null)
    .order("description", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.competencyId) {
    query = query.eq("competency_id", filters.competencyId);
  }

  if (filters?.domainId) {
    // Filter by domain via competency relationship
    query = query.eq("competency.domain_id", filters.domainId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching indicators:", error);
    throw error;
  }

  // Flatten the nested structure for easier use
  return (data || []).map((item: any) => ({
    ...item,
    domain: item.competency?.domain,
  }));
}

export async function getIndicator(id: string): Promise<Indicator | null> {
  const { data, error } = await supabase
    .from("indicators")
    .select(`
      *,
      competency:competencies(
        *,
        domain:domains(*)
      )
    `)
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching indicator:", error);
    return null;
  }

  if (data) {
    return {
      ...data,
      domain: data.competency?.domain,
    };
  }

  return null;
}

export async function createIndicator(data: {
  organization_id: string;
  school_id?: string | null;
  competency_id: string;
  description: string;
  created_by?: string;
}): Promise<Indicator> {
  const { data: result, error } = await supabase
    .from("indicators")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating indicator:", error);
    throw error;
  }

  return result;
}

export async function updateIndicator(
  id: string,
  data: {
    description?: string;
    competency_id?: string;
    updated_by?: string;
  }
): Promise<Indicator> {
  const { data: result, error } = await supabase
    .from("indicators")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating indicator:", error);
    throw error;
  }

  return result;
}

export async function archiveIndicator(id: string): Promise<void> {
  const { error } = await supabase
    .from("indicators")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving indicator:", error);
    throw error;
  }
}

// ============================================================================
// Competency Level Functions
// ============================================================================

export async function getCompetencyLevels(
  organizationId: string | null,
  filters?: { schoolId?: string | null }
): Promise<CompetencyLevel[]> {
  let query = supabase
    .from("competency_levels")
    .select("*")
    .is("archived_at", null)
    .order("label", { ascending: true });

  if (organizationId) {
    query = query.eq("organization_id", organizationId);
  }

  if (filters?.schoolId) {
    query = query.eq("school_id", filters.schoolId);
  }

  const { data, error } = await query;

  if (error) {
    console.error("Error fetching competency levels:", error);
    throw error;
  }

  return data || [];
}

export async function getCompetencyLevel(
  id: string
): Promise<CompetencyLevel | null> {
  const { data, error } = await supabase
    .from("competency_levels")
    .select("*")
    .eq("id", id)
    .single();

  if (error) {
    console.error("Error fetching competency level:", error);
    return null;
  }

  return data;
}

export async function createCompetencyLevel(data: {
  organization_id: string;
  school_id?: string | null;
  label: string;
  description?: string | null;
  created_by?: string;
}): Promise<CompetencyLevel> {
  const { data: result, error } = await supabase
    .from("competency_levels")
    .insert([data])
    .select()
    .single();

  if (error) {
    console.error("Error creating competency level:", error);
    throw error;
  }

  return result;
}

export async function updateCompetencyLevel(
  id: string,
  data: {
    label?: string;
    description?: string | null;
    updated_by?: string;
  }
): Promise<CompetencyLevel> {
  const { data: result, error } = await supabase
    .from("competency_levels")
    .update({ ...data, updated_at: new Date().toISOString() })
    .eq("id", id)
    .select()
    .single();

  if (error) {
    console.error("Error updating competency level:", error);
    throw error;
  }

  return result;
}

export async function archiveCompetencyLevel(id: string): Promise<void> {
  const { error } = await supabase
    .from("competency_levels")
    .update({ archived_at: new Date().toISOString() })
    .eq("id", id);

  if (error) {
    console.error("Error archiving competency level:", error);
    throw error;
  }
}
