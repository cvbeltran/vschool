/**
 * Gradebook Section Context Helper
 * 
 * Provides canonical context for sections: school, grade level, subject
 * All values come from section joins (not syllabus tags or manual selections)
 */

import { supabase } from "@/lib/supabase/client";

export interface SectionContext {
  section_id: string;
  section_code: string;
  section_name: string;
  school_id: string;
  school_name: string;
  program_id: string;
  program_name: string;
  program_code: string;
  batch_id: string | null;
  batch_name: string | null;
  grade_level: string | null; // Derived from batch name or program
  subject_id: string | null; // From subjects table if linked
  subject_code: string | null;
  subject_name: string | null;
  primary_classification: string | null; // From sections.primary_classification
  classification_source: string | null;
}

/**
 * Get full context for a section
 * Joins: sections -> schools, programs, batches, subjects (if linked)
 */
export async function getSectionContext(sectionId: string): Promise<SectionContext | null> {
  const { data, error } = await supabase
    .from("sections")
    .select(`
      id,
      code,
      name,
      school_id,
      program_id,
      batch_id,
      primary_classification,
      classification_source,
      schools:school_id (
        id,
        name
      ),
      programs:program_id (
        id,
        name,
        code
      ),
      batches:batch_id (
        id,
        name
      )
    `)
    .eq("id", sectionId)
    .is("archived_at", null)
    .single();

  if (error || !data) {
    console.error("Failed to fetch section context:", error);
    return null;
  }

  const school = (data.schools as any) || null;
  const program = (data.programs as any) || null;
  const batch = (data.batches as any) || null;

  // Try to get subject from subjects table if primary_classification matches
  let subject_id: string | null = null;
  let subject_code: string | null = null;
  let subject_name: string | null = null;

  if (data.primary_classification) {
    // Try to find subject by code matching primary_classification
    const { data: subjectData } = await supabase
      .from("subjects")
      .select("id, code, name")
      .eq("code", data.primary_classification.toUpperCase())
      .is("archived_at", null)
      .single();

    if (subjectData) {
      subject_id = subjectData.id;
      subject_code = subjectData.code;
      subject_name = subjectData.name;
    } else {
      // Fallback: use primary_classification as subject code/name
      subject_code = data.primary_classification;
      subject_name = data.primary_classification; // Could be improved with weight profile lookup
    }
  }

  return {
    section_id: data.id,
    section_code: data.code,
    section_name: data.name,
    school_id: data.school_id,
    school_name: school?.name || "Unknown School",
    program_id: data.program_id,
    program_name: program?.name || "Unknown Program",
    program_code: program?.code || "",
    batch_id: data.batch_id,
    batch_name: batch?.name || null,
    grade_level: batch?.name || program?.name || null, // Use batch name as grade level indicator
    subject_id,
    subject_code,
    subject_name,
    primary_classification: data.primary_classification,
    classification_source: data.classification_source,
  };
}

/**
 * Get context for multiple sections (for list views)
 */
export async function getSectionsContext(sectionIds: string[]): Promise<Map<string, SectionContext>> {
  const contextMap = new Map<string, SectionContext>();
  
  // Fetch all sections in one query
  const { data: sections, error } = await supabase
    .from("sections")
    .select(`
      id,
      code,
      name,
      school_id,
      program_id,
      batch_id,
      primary_classification,
      classification_source,
      schools:school_id (
        id,
        name
      ),
      programs:program_id (
        id,
        name,
        code
      ),
      batches:batch_id (
        id,
        name
      )
    `)
    .in("id", sectionIds)
    .is("archived_at", null);

  if (error || !sections) {
    console.error("Failed to fetch sections context:", error);
    return contextMap;
  }

  // Get unique classification codes to batch-fetch subjects
  const classificationCodes = [...new Set(
    sections
      .map((s: any) => s.primary_classification)
      .filter((c: string | null): c is string => c !== null)
  )];

  const subjectMap = new Map<string, { id: string; code: string; name: string }>();
  
  if (classificationCodes.length > 0) {
    const { data: subjects } = await supabase
      .from("subjects")
      .select("id, code, name")
      .in("code", classificationCodes.map(c => c.toUpperCase()))
      .is("archived_at", null);

    if (subjects) {
      subjects.forEach((s) => {
        subjectMap.set(s.code.toUpperCase(), s);
      });
    }
  }

  // Build context for each section
  sections.forEach((section: any) => {
    const school = section.schools || null;
    const program = section.programs || null;
    const batch = section.batches || null;

    let subject_id: string | null = null;
    let subject_code: string | null = null;
    let subject_name: string | null = null;

    if (section.primary_classification) {
      const subject = subjectMap.get(section.primary_classification.toUpperCase());
      if (subject) {
        subject_id = subject.id;
        subject_code = subject.code;
        subject_name = subject.name;
      } else {
        subject_code = section.primary_classification;
        subject_name = section.primary_classification;
      }
    }

    contextMap.set(section.id, {
      section_id: section.id,
      section_code: section.code,
      section_name: section.name,
      school_id: section.school_id,
      school_name: school?.name || "Unknown School",
      program_id: section.program_id,
      program_name: program?.name || "Unknown Program",
      program_code: program?.code || "",
      batch_id: section.batch_id,
      batch_name: batch?.name || null,
      grade_level: batch?.name || program?.name || null,
      subject_id,
      subject_code,
      subject_name,
      primary_classification: section.primary_classification,
      classification_source: section.classification_source,
    });
  });

  return contextMap;
}
