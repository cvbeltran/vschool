/**
 * Student Portal Shared Utilities
 * Helper functions for student portal pages
 */

import { supabase } from "@/lib/supabase/client";
import { getMyStudentRow } from "./student/student-data";

/**
 * Get current student's organization ID
 */
export async function getCurrentStudentOrganizationId(): Promise<string | null> {
  const student = await getMyStudentRow();
  return student?.organization_id || null;
}

/**
 * Get current student's ID
 */
export async function getCurrentStudentId(): Promise<string | null> {
  const student = await getMyStudentRow();
  return student?.id || null;
}

/**
 * Require student authentication - throws if not authenticated or not a student
 */
export async function requireStudent(): Promise<{ studentId: string; organizationId: string }> {
  const { data: { session } } = await supabase.auth.getSession();
  
  if (!session) {
    throw new Error("Not authenticated");
  }

  const student = await getMyStudentRow();
  
  if (!student) {
    throw new Error("Student record not found");
  }

  if (!student.organization_id) {
    throw new Error("Student organization not found");
  }

  return {
    studentId: student.id,
    organizationId: student.organization_id,
  };
}

/**
 * Format student display name
 */
export function formatStudentName(student: {
  preferred_name?: string | null;
  legal_first_name?: string | null;
  legal_last_name?: string | null;
}): string {
  if (student.preferred_name) {
    return student.preferred_name;
  }
  
  if (student.legal_first_name && student.legal_last_name) {
    return `${student.legal_first_name} ${student.legal_last_name}`;
  }
  
  return "Student";
}

/**
 * Get the active school year for an organization
 * Returns null if no active school year exists
 */
export async function getActiveSchoolYear(organizationId: string): Promise<{ id: string; year_label: string } | null> {
  try {
    // First, get the ACTIVE status taxonomy item
    const { data: taxonomy } = await supabase
      .from("taxonomies")
      .select("id")
      .eq("key", "school_year_status")
      .single();

    if (!taxonomy) {
      return null;
    }

    const { data: activeStatus } = await supabase
      .from("taxonomy_items")
      .select("id")
      .eq("taxonomy_id", taxonomy.id)
      .eq("code", "ACTIVE")
      .eq("is_active", true)
      .single();

    if (!activeStatus) {
      return null;
    }

    // Get the active school year for this organization
    const { data: activeSchoolYear } = await supabase
      .from("school_years")
      .select("id, year_label")
      .eq("organization_id", organizationId)
      .eq("status_id", activeStatus.id)
      .maybeSingle();

    return activeSchoolYear || null;
  } catch (error) {
    console.error("Error fetching active school year:", error);
    return null;
  }
}
