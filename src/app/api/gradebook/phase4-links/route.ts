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
 * GET /api/gradebook/phase4-links
 * Get Phase 4 links with related computed grades and grade entries
 */
export async function GET(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/registrar can view Phase 4 links
    if (!["admin", "principal", "registrar"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // Fetch links with related data using server-side client
    const { data: linksData, error: linksError } = await supabaseServer
      .from("gradebook_phase4_links")
      .select(`
        id,
        organization_id,
        computed_grade_id,
        grade_entry_id,
        created_at,
        created_by,
        archived_at
      `)
      .eq("organization_id", profile.organization_id)
      .is("archived_at", null)
      .order("created_at", { ascending: false });

    if (linksError) {
      throw new Error(`Failed to fetch links: ${linksError.message}`);
    }

    if (!linksData || linksData.length === 0) {
      return NextResponse.json({ links: [] });
    }

    // Fetch computed grades with related data
    const computedGradeIds = linksData.map((l) => l.computed_grade_id);
    const { data: computedGradesData, error: gradesError } = await supabaseServer
      .from("gradebook_computed_grades")
      .select(`
        id,
        student_id,
        compute_run_id,
        initial_grade,
        final_numeric_grade,
        transmuted_grade,
        breakdown
      `)
      .in("id", computedGradeIds);

    if (gradesError) {
      throw new Error(`Failed to fetch computed grades: ${gradesError.message}`);
    }

    // Fetch students
    const studentIds = [...new Set((computedGradesData || []).map((g) => g.student_id).filter(Boolean))];
    let studentsData: any[] = [];
    if (studentIds.length > 0) {
      const { data } = await supabaseServer
        .from("students")
        .select("id, first_name, last_name, student_number")
        .in("id", studentIds);
      studentsData = data || [];
    }

    // Fetch compute runs
    const runIds = [...new Set((computedGradesData || []).map((g) => g.compute_run_id).filter(Boolean))];
    let runsData: any[] = [];
    if (runIds.length > 0) {
      const { data } = await supabaseServer
        .from("gradebook_compute_runs")
        .select("id, section_id, term_period, scheme_id, as_of")
        .in("id", runIds);
      runsData = data || [];
    }

    // Fetch sections
    const sectionIds = [...new Set(runsData.map((r) => r.section_id).filter(Boolean))];
    let sectionsData: any[] = [];
    if (sectionIds.length > 0) {
      const { data } = await supabaseServer
        .from("sections")
        .select("id, name, code")
        .in("id", sectionIds);
      sectionsData = data || [];
    }

    // Fetch schemes
    const schemeIds = [...new Set(runsData.map((r) => r.scheme_id).filter(Boolean))];
    let schemesData: any[] = [];
    if (schemeIds.length > 0) {
      const { data } = await supabaseServer
        .from("gradebook_schemes")
        .select("id, name, scheme_type")
        .in("id", schemeIds);
      schemesData = data || [];
    }

    // Fetch grade entries
    const gradeEntryIds = linksData.map((l) => l.grade_entry_id);
    const { data: gradeEntriesData, error: entriesError } = await supabaseServer
      .from("grade_entries")
      .select("id, student_grade_id, entry_type, entry_text, created_at")
      .in("id", gradeEntryIds);

    if (entriesError) {
      throw new Error(`Failed to fetch grade entries: ${entriesError.message}`);
    }

    // Combine data
    const studentsMap = new Map(studentsData.map((s) => [s.id, s]));
    const runsMap = new Map(runsData.map((r) => [r.id, r]));
    const sectionsMap = new Map(sectionsData.map((s) => [s.id, s]));
    const schemesMap = new Map(schemesData.map((s) => [s.id, s]));
    const computedGradesMap = new Map(
      (computedGradesData || []).map((g) => [
        g.id,
        {
          ...g,
          student: studentsMap.get(g.student_id) || null,
          compute_run: runsMap.get(g.compute_run_id)
            ? {
                ...runsMap.get(g.compute_run_id)!,
                section: sectionsMap.get(runsMap.get(g.compute_run_id)!.section_id) || null,
                scheme: schemesMap.get(runsMap.get(g.compute_run_id)!.scheme_id) || null,
              }
            : null,
        },
      ])
    );
    const gradeEntriesMap = new Map((gradeEntriesData || []).map((e) => [e.id, e]));

    const links = linksData.map((link) => ({
      ...link,
      computed_grade: computedGradesMap.get(link.computed_grade_id) || null,
      grade_entry: gradeEntriesMap.get(link.grade_entry_id) || null,
    }));

    return NextResponse.json({ links });
  } catch (error: any) {
    logError("gradebook_phase4_links_get", error, {
      message: error.message,
    });
    return NextResponse.json(
      { error: error.message || "Failed to get Phase 4 links" },
      { status: 500 }
    );
  }
}
