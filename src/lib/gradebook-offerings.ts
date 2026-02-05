/**
 * Gradebook Offerings Helper Functions
 * 
 * Functions to work with section_subject_offerings and related entities
 */

import { supabase } from "@/lib/supabase/client";

export interface SectionSubjectOffering {
  id: string;
  organization_id: string;
  school_id: string | null;
  school_year_id: string;
  section_id: string;
  subject_id: string;
  term_period: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  // Joined fields
  section?: {
    id: string;
    name: string;
    code: string;
    school_id: string;
    program_id: string;
    batch_id: string | null;
  };
  subject?: {
    id: string;
    code: string;
    name: string;
    grade_level: string | null;
  };
  school_year?: {
    id: string;
    year_label: string;
  };
  school?: {
    id: string;
    name: string;
  };
  teachers?: Array<{
    id: string;
    staff_id: string;
    role: "primary" | "co";
    staff?: {
      id: string;
      first_name: string | null;
      last_name: string | null;
    };
  }>;
}

export interface OfferingContext {
  offering_id: string;
  section_id: string;
  section_code: string;
  section_name: string;
  subject_id: string;
  subject_code: string;
  subject_name: string;
  school_id: string;
  school_name: string;
  school_year_id: string;
  school_year_label: string;
  term_period: string;
  grade_level: string | null;
  teachers: Array<{
    staff_id: string;
    role: "primary" | "co";
    name: string;
  }>;
}

/**
 * Get full context for an offering
 */
export async function getOfferingContext(offeringId: string): Promise<OfferingContext | null> {
  const { data, error } = await supabase
    .from("section_subject_offerings")
    .select(`
      id,
      section_id,
      subject_id,
      school_id,
      school_year_id,
      term_period,
      section:sections(
        id,
        code,
        name,
        school_id,
        program_id,
        batch_id,
        schools:school_id(id, name),
        programs:program_id(id, name, code),
        batches:batch_id(id, name)
      ),
      subject:subjects(
        id,
        code,
        name,
        grade_level
      ),
      school_years(id, year_label),
      schools:school_id(id, name)
    `)
    .eq("id", offeringId)
    .is("archived_at", null)
    .single();

  if (error || !data) {
    console.error("Failed to fetch offering context:", error);
    return null;
  }

  const section = data.section as any;
  const subject = data.subject as any;
  const schoolYear = data.school_years as any;
  const school = data.schools || section?.schools || null;
  const program = section?.programs || null;
  const batch = section?.batches || null;

  // Get teachers assigned to this offering
  const { data: teachersData } = await supabase
    .from("section_subject_teachers")
    .select(`
      id,
      staff_id,
      role,
      staff:staff_id(id, first_name, last_name)
    `)
    .eq("section_subject_offering_id", offeringId)
    .is("archived_at", null)
    .is("end_date", null);

  const teachers = (teachersData || []).map((t: any) => ({
    staff_id: t.staff_id,
    role: t.role,
    name: t.staff
      ? `${t.staff.first_name || ""} ${t.staff.last_name || ""}`.trim()
      : "Unknown",
  }));

  return {
    offering_id: data.id,
    section_id: section.id,
    section_code: section.code,
    section_name: section.name,
    subject_id: subject.id,
    subject_code: subject.code,
    subject_name: subject.name,
    school_id: school?.id || section.school_id,
    school_name: school?.name || "Unknown School",
    school_year_id: data.school_year_id,
    school_year_label: schoolYear?.year_label || "Unknown Year",
    term_period: data.term_period,
    grade_level: batch?.name || program?.name || null,
    teachers,
  };
}

/**
 * List offerings for a section
 */
export async function listSectionOfferings(
  sectionId: string,
  schoolYearId?: string,
  termPeriod?: string
): Promise<SectionSubjectOffering[]> {
  let query = supabase
    .from("section_subject_offerings")
    .select(`
      *,
      section:sections(id, name, code, school_id, program_id, batch_id),
      subject:subjects(id, code, name, grade_level),
      school_years(id, year_label),
      schools:school_id(id, name)
    `)
    .eq("section_id", sectionId)
    .eq("is_active", true)
    .is("archived_at", null)
    .order("term_period", { ascending: true })
    .order("created_at", { ascending: false });

  if (schoolYearId) {
    query = query.eq("school_year_id", schoolYearId);
  }

  if (termPeriod) {
    query = query.eq("term_period", termPeriod);
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(`Failed to list section offerings: ${error.message}`);
  }

  // Fetch teachers for each offering
  const offerings = (data || []) as SectionSubjectOffering[];
  if (offerings.length > 0) {
    const offeringIds = offerings.map((o) => o.id);
    const { data: teachersData } = await supabase
      .from("section_subject_teachers")
      .select(`
        id,
        section_subject_offering_id,
        staff_id,
        role,
        staff:staff_id(id, first_name, last_name)
      `)
      .in("section_subject_offering_id", offeringIds)
      .is("archived_at", null)
      .is("end_date", null);

    // Group teachers by offering
    const teachersByOffering = new Map<string, any[]>();
    (teachersData || []).forEach((t: any) => {
      if (!teachersByOffering.has(t.section_subject_offering_id)) {
        teachersByOffering.set(t.section_subject_offering_id, []);
      }
      teachersByOffering.get(t.section_subject_offering_id)!.push({
        id: t.id,
        staff_id: t.staff_id,
        role: t.role,
        staff: t.staff,
      });
    });

    // Attach teachers to offerings
    offerings.forEach((offering) => {
      offering.teachers = teachersByOffering.get(offering.id) || [];
    });
  }

  return offerings;
}

/**
 * Create a new offering
 */
export async function createOffering(data: {
  organization_id: string;
  school_id?: string | null;
  school_year_id: string;
  section_id: string;
  subject_id: string;
  term_period: string;
  is_active?: boolean;
}): Promise<SectionSubjectOffering> {
  const { data: result, error } = await supabase
    .from("section_subject_offerings")
    .insert([{
      ...data,
      is_active: data.is_active ?? true,
    }])
    .select(`
      *,
      section:sections(id, name, code, school_id, program_id, batch_id),
      subject:subjects(id, code, name, grade_level),
      school_years(id, year_label),
      schools:school_id(id, name)
    `)
    .single();

  if (error) {
    throw new Error(`Failed to create offering: ${error.message}`);
  }

  return result as SectionSubjectOffering;
}

/**
 * Assign teacher to offering
 */
export async function assignTeacherToOffering(data: {
  organization_id: string;
  school_id?: string | null;
  section_subject_offering_id: string;
  staff_id: string;
  role?: "primary" | "co";
}): Promise<void> {
  const { error } = await supabase
    .from("section_subject_teachers")
    .insert([{
      ...data,
      role: data.role || "primary",
    }]);

  if (error) {
    throw new Error(`Failed to assign teacher: ${error.message}`);
  }
}
