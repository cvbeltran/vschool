import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

/**
 * Helper to verify access
 */
async function verifyAccess(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

  if (authError || !user) {
    return { user: null, profile: null, error: "Unauthorized" };
  }

  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, profile: null, error: "User profile not found" };
  }

  return { user, profile, error: null };
}

/**
 * POST /api/gradebook/compute-runs/[id]/send-to-phase4
 * Create Phase 4 grade_entries and link rows for computed grades
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/registrar/teacher can send to Phase 4
    if (!["admin", "principal", "registrar", "teacher", "mentor"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const { id } = await params;
    
    // Use server-side client to bypass RLS
    const { data: run, error: runError } = await supabaseServer
      .from("gradebook_compute_runs")
      .select(`
        *,
        scheme:gradebook_schemes(*),
        section:sections(
          id,
          name,
          code,
          school_id,
          program_id,
          batch_id,
          primary_classification,
          classification_source,
          schools:school_id(id, name),
          programs:program_id(id, name, code),
          batches:batch_id(id, name)
        ),
        offering:section_subject_offerings(
          id,
          subject_id,
          subject:subjects(id, code, name)
        )
      `)
      .eq("id", id)
      .single();

    if (runError || !run) {
      return NextResponse.json({ error: "Compute run not found" }, { status: 404 });
    }

    if (run.status !== "completed") {
      return NextResponse.json(
        { error: "Compute run must be completed before sending to Phase 4" },
        { status: 400 }
      );
    }

    // Check organization access
    if (run.organization_id !== profile.organization_id && profile.role !== "super_admin") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch computed grades using server-side client
    const { data: gradesData, error: gradesError } = await supabaseServer
      .from("gradebook_computed_grades")
      .select(`
        *,
        student:students(id, first_name, last_name, student_number)
      `)
      .eq("compute_run_id", id);

    if (gradesError) {
      throw new Error(`Failed to list computed grades: ${gradesError.message}`);
    }

    // Sort by student last_name manually since Supabase doesn't support nested ordering
    const computedGrades = (gradesData || []).sort((a: any, b: any) => {
      const aLastName = a.student?.last_name || "";
      const bLastName = b.student?.last_name || "";
      return aLastName.localeCompare(bLastName);
    });
    const createdLinks: any[] = [];
    const skippedLinks: any[] = [];
    const errors: string[] = [];

    // Get scheme for traceability metadata
    const { data: scheme } = await supabaseServer
      .from("gradebook_schemes")
      .select("id, name, version, scheme_type")
      .eq("id", run.scheme_id)
      .single();

    // For each computed grade, create Phase 4 grade_entry and link (idempotent)
    for (const computedGrade of computedGrades) {
      try {
        // Check if link already exists (idempotency check) using server-side client
        const { data: existingLinks } = await supabaseServer
          .from("gradebook_phase4_links")
          .select("*")
          .eq("computed_grade_id", computedGrade.id)
          .is("archived_at", null);

        if (existingLinks && existingLinks.length > 0) {
          // Already linked - skip but track
          skippedLinks.push({
            computed_grade_id: computedGrade.id,
            grade_entry_id: existingLinks[0].grade_entry_id,
            student_id: computedGrade.student_id,
            reason: "already_linked",
          });
          continue;
        }

        // Find or create student_grade for this student/term
        // First, try to find existing draft grade
        const { data: existingGrade } = await supabaseServer
          .from("student_grades")
          .select("id")
          .eq("student_id", computedGrade.student_id)
          .eq("school_year_id", computedGrade.school_year_id)
          .eq("term_period", computedGrade.term_period)
          .eq("status", "draft")
          .is("archived_at", null)
          .single();

        let studentGradeId: string;

        if (existingGrade) {
          studentGradeId = existingGrade.id;
        } else {
          // Require draft student_grade to exist (Phase 4 requirement)
          errors.push(
            `Student ${computedGrade.student?.first_name} ${computedGrade.student?.last_name}: No draft student_grade found. Please create a draft grade in Phase 4 first.`
          );
          continue;
        }

        // Get section context for traceability
        const section = run.section as any;
        const school = section?.schools || null;
        const program = section?.programs || null;
        const batch = section?.batches || null;

        // Try to get subject from subjects table if primary_classification exists
        let subject_id: string | null = null;
        let subject_code: string | null = null;
        let subject_name: string | null = null;

        if (section?.primary_classification) {
          const { data: subjectData } = await supabaseServer
            .from("subjects")
            .select("id, code, name")
            .eq("code", section.primary_classification.toUpperCase())
            .is("archived_at", null)
            .single();

          if (subjectData) {
            subject_id = subjectData.id;
            subject_code = subjectData.code;
            subject_name = subjectData.name;
          } else {
            subject_code = section.primary_classification;
            subject_name = section.primary_classification;
          }
        }

        // Build traceability metadata for entry_text (includes section context)
        const traceabilityMetadata = {
          source: "gradebook_computation_phase",
          compute_run_id: run.id,
          scheme_id: run.scheme_id,
          scheme_name: scheme?.name || "Unknown",
          scheme_version: run.scheme_version,
          scheme_type: scheme?.scheme_type || "unknown",
          transmutation_table_id: run.transmutation_table_id || null,
          as_of: run.as_of,
          computed_grade_id: computedGrade.id,
          initial_grade: computedGrade.initial_grade,
          final_numeric_grade: computedGrade.final_numeric_grade,
          transmuted_grade: computedGrade.transmuted_grade,
          rounding_mode: computedGrade.breakdown?.rounding_mode || null,
          weight_policy: computedGrade.breakdown?.weight_policy || null,
          // Section context (canonical academic anchors)
          section_id: section?.id || null,
          section_code: section?.code || null,
          section_name: section?.name || null,
          school_id: section?.school_id || null,
          school_name: school?.name || null,
          program_id: section?.program_id || null,
          program_name: program?.name || null,
          program_code: program?.code || null,
          batch_id: section?.batch_id || null,
          batch_name: batch?.name || null,
          grade_level: batch?.name || program?.name || null, // Derived grade level
          subject_id: subject_id,
          subject_code: subject_code,
          subject_name: subject_name,
          primary_classification: section?.primary_classification || null,
          classification_source: section?.classification_source || null,
        };

        const breakdownText = JSON.stringify(computedGrade.breakdown, null, 2);
        const entryText = `Computed grade from Gradebook Computation Phase

Traceability Metadata:
${JSON.stringify(traceabilityMetadata, null, 2)}

Computation Breakdown:
${breakdownText}`;

        // Create Phase 4 grade_entry with full traceability using server-side client
        const { data: gradeEntry, error: entryError } = await supabaseServer
          .from("grade_entries")
          .insert([{
            organization_id: computedGrade.organization_id,
            student_grade_id: studentGradeId,
            entry_type: "manual_note",
            entry_text: entryText,
            created_by: user.id,
          }])
          .select(`
            *,
            observation:observations(id, notes, observed_at),
            competency:competencies(id, name),
            domain:domains(id, name)
          `)
          .single();

        if (entryError || !gradeEntry) {
          throw new Error(`Failed to create grade entry: ${entryError?.message || "Unknown error"}`);
        }

        // Create link (idempotent - already checked above) using server-side client
        const { data: link, error: linkError } = await supabaseServer
          .from("gradebook_phase4_links")
          .insert([{
            organization_id: computedGrade.organization_id,
            grade_entry_id: gradeEntry.id,
            computed_grade_id: computedGrade.id,
            created_by: user.id,
          }])
          .select()
          .single();

        if (linkError || !link) {
          throw new Error(`Failed to create Phase 4 link: ${linkError?.message || "Unknown error"}`);
        }

        createdLinks.push({
          computed_grade_id: computedGrade.id,
          grade_entry_id: gradeEntry.id,
          student_id: computedGrade.student_id,
        });
      } catch (error: any) {
        errors.push(
          `Failed to link computed grade for student ${computedGrade.student?.first_name} ${computedGrade.student?.last_name}: ${error.message}`
        );
      }
    }

    return NextResponse.json({
      success: true,
      linksCreated: createdLinks.length,
      linksSkipped: skippedLinks.length,
      totalGrades: computedGrades.length,
      links: createdLinks,
      skipped: skippedLinks.length > 0 ? skippedLinks : undefined,
      errors: errors.length > 0 ? errors : undefined,
    });
  } catch (error: any) {
    logError("gradebook_send_to_phase4", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to send to Phase 4" },
      { status: 500 }
    );
  }
}
