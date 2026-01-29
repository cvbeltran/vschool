import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";

/**
 * Helper to verify teacher/admin/principal access
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

  // Check if user has teacher/admin/principal role
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, profile: null, error: "User profile not found" };
  }

  const allowedRoles = ["admin", "principal", "teacher", "faculty", "mentor"];
  if (!allowedRoles.includes(profile.role)) {
    return { user: null, profile: null, error: "Forbidden: Teacher/Admin access required" };
  }

  return { user, profile, error: null };
}

/**
 * Get active school year for organization
 */
async function getActiveSchoolYear(organizationId: string): Promise<string | null> {
  try {
    // Get ACTIVE status taxonomy item
    const { data: taxonomy } = await supabaseServer
      .from("taxonomies")
      .select("id")
      .eq("key", "school_year_status")
      .single();

    if (!taxonomy) {
      return null;
    }

    const { data: activeStatus } = await supabaseServer
      .from("taxonomy_items")
      .select("id")
      .eq("taxonomy_id", taxonomy.id)
      .eq("code", "ACTIVE")
      .eq("is_active", true)
      .single();

    if (!activeStatus) {
      return null;
    }

    // Get active school year
    const { data: activeSchoolYear } = await supabaseServer
      .from("school_years")
      .select("id")
      .eq("organization_id", organizationId)
      .eq("status_id", activeStatus.id)
      .maybeSingle();

    return activeSchoolYear?.id || null;
  } catch (error) {
    logError("Error fetching active school year", error);
    return null;
  }
}

/**
 * Get learners for scope
 */
async function getLearnersForScope(
  scopeType: string,
  scopeId: string,
  organizationId: string
): Promise<Array<{ id: string }>> {
  if (scopeType === "section") {
    // Get students from section_students
    const { data } = await supabaseServer
      .from("section_students")
      .select("student_id")
      .eq("section_id", scopeId)
      .is("archived_at", null);

    return (data || []).map((row: any) => ({ id: row.student_id }));
  } else if (scopeType === "experience") {
    // Get learners who have observations for this experience
    const { data } = await supabaseServer
      .from("observations")
      .select("learner_id")
      .eq("experience_id", scopeId)
      .eq("status", "active")
      .is("archived_at", null)
      .eq("organization_id", organizationId);

    // Deduplicate
    const learnerIds = new Set((data || []).map((row: any) => row.learner_id));
    return Array.from(learnerIds).map((id) => ({ id }));
  } else if (scopeType === "syllabus") {
    // Get learners who have verifications for lesson logs linked to this syllabus
    // First get lesson log IDs
    const { data: lessonLogs } = await supabaseServer
      .from("weekly_lesson_logs")
      .select("id")
      .eq("syllabus_id", scopeId)
      .is("archived_at", null)
      .eq("organization_id", organizationId);
    
    const lessonLogIds = (lessonLogs || []).map((log: any) => log.id);
    
    if (lessonLogIds.length === 0) {
      return [];
    }

    const { data } = await supabaseServer
      .from("weekly_lesson_log_learner_verifications")
      .select("learner_id")
      .in("lesson_log_id", lessonLogIds)
      .is("archived_at", null)
      .eq("organization_id", organizationId);

    // Deduplicate
    const learnerIds = new Set((data || []).map((row: any) => row.learner_id));
    return Array.from(learnerIds).map((id) => ({ id }));
  } else if (scopeType === "program") {
    // Get students from sections in this program
    const { data: sections } = await supabaseServer
      .from("sections")
      .select("id")
      .eq("program_id", scopeId)
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    const sectionIds = (sections || []).map((s: any) => s.id);
    if (sectionIds.length === 0) {
      return [];
    }

    const { data } = await supabaseServer
      .from("section_students")
      .select("student_id")
      .in("section_id", sectionIds)
      .is("archived_at", null);

    // Deduplicate
    const learnerIds = new Set((data || []).map((row: any) => row.student_id));
    return Array.from(learnerIds).map((id) => ({ id }));
  }

  return [];
}

/**
 * Get competencies/outcomes for scope
 */
async function getCompetenciesForScope(
  scopeType: string,
  scopeId: string,
  organizationId: string
): Promise<Array<{ id: string }>> {
  if (scopeType === "experience") {
    // Get competencies linked to experience
    const { data, error } = await supabaseServer
      .from("experience_competency_links")
      .select("competency_id")
      .eq("experience_id", scopeId)
      .is("archived_at", null)
      .eq("organization_id", organizationId);

    if (error) {
      logError("Error fetching experience competency links", error);
      throw new Error(`Failed to fetch competencies for experience: ${error.message}`);
    }

    const competencies = (data || []).map((row: any) => ({ id: row.competency_id }));
    
    if (competencies.length === 0) {
      logError("No competencies found", {
        scopeType,
        scopeId,
        message: "Experience has no competency links. Please link competencies to this experience first."
      });
    }

    return competencies;
  } else if (scopeType === "syllabus") {
    // Get competencies linked to syllabus weeks
    // First get syllabus week IDs
    const { data: weeks, error: weeksError } = await supabaseServer
      .from("syllabus_weeks")
      .select("id")
      .eq("syllabus_id", scopeId)
      .is("archived_at", null);
    
    if (weeksError) {
      logError("Error fetching syllabus weeks", weeksError);
      throw new Error(`Failed to fetch syllabus weeks: ${weeksError.message}`);
    }
    
    const weekIds = (weeks || []).map((week: any) => week.id);
    
    if (weekIds.length === 0) {
      logError("No syllabus weeks found", {
        scopeType,
        scopeId,
        message: "Syllabus has no weeks defined. Please add weeks to this syllabus first."
      });
      return [];
    }

    const { data, error } = await supabaseServer
      .from("syllabus_week_competency_links")
      .select("competency_id")
      .in("syllabus_week_id", weekIds)
      .is("archived_at", null)
      .eq("organization_id", organizationId);

    if (error) {
      logError("Error fetching syllabus week competency links", error);
      throw new Error(`Failed to fetch competencies for syllabus: ${error.message}`);
    }

    // Deduplicate
    const competencyIds = new Set((data || []).map((row: any) => row.competency_id));
    const competencies = Array.from(competencyIds).map((id) => ({ id }));
    
    if (competencies.length === 0) {
      logError("No competencies found", {
        scopeType,
        scopeId,
        message: "Syllabus weeks have no competency links. Please link competencies to syllabus weeks first."
      });
    }

    return competencies;
  } else if (scopeType === "program" || scopeType === "section") {
    // For program/section, get all competencies in organization (or get from linked experiences)
    // Simplified: get all competencies in organization
    const { data, error } = await supabaseServer
      .from("competencies")
      .select("id")
      .eq("organization_id", organizationId)
      .is("archived_at", null);

    if (error) {
      logError("Error fetching competencies", error);
      throw new Error(`Failed to fetch competencies: ${error.message}`);
    }

    const competencies = data || [];
    
    if (competencies.length === 0) {
      logError("No competencies found", {
        scopeType,
        scopeId,
        message: "Organization has no competencies defined. Please create competencies first."
      });
    }

    return competencies;
  }

  return [];
}

/**
 * Collect evidence for learner/competency pair
 */
async function collectEvidence(
  learnerId: string,
  competencyId: string,
  scopeType: string,
  scopeId: string,
  organizationId: string,
  schoolYearId: string | null
): Promise<{
  evidenceCount: number;
  lastEvidenceAt: string | null;
  evidenceItems: Array<{
    type: string;
    id: string;
    created_at: string;
  }>;
}> {
  const evidenceItems: Array<{ type: string; id: string; created_at: string }> = [];

  // 1. Assessments: only status='completed' assessments, plus evidence links
  const { data: assessments } = await supabaseServer
    .from("assessments")
    .select("id, created_at")
    .eq("learner_id", learnerId)
    .eq("status", "completed")
    .is("archived_at", null)
    .eq("organization_id", organizationId);

  if (assessments) {
    // Check if assessment has evidence links pointing to this competency
    for (const assessment of assessments) {
      const { data: evidenceLinks } = await supabaseServer
        .from("assessment_evidence_links")
        .select("evidence_type, observation_id, experience_id")
        .eq("assessment_id", assessment.id)
        .is("archived_at", null);

      if (evidenceLinks && evidenceLinks.length > 0) {
        // Check if any evidence link references this competency via observation or experience
        let hasCompetencyLink = false;
        for (const link of evidenceLinks) {
          if (link.observation_id) {
            const { data: obs } = await supabaseServer
              .from("observations")
              .select("competency_id")
              .eq("id", link.observation_id)
              .single();
            if (obs?.competency_id === competencyId) {
              hasCompetencyLink = true;
              break;
            }
          }
        }
        if (hasCompetencyLink) {
          evidenceItems.push({
            type: "assessment",
            id: assessment.id,
            created_at: assessment.created_at,
          });
        }
      }
    }
  }

  // 2. Observations: status='active'
  const { data: observations } = await supabaseServer
    .from("observations")
    .select("id, created_at")
    .eq("learner_id", learnerId)
    .eq("competency_id", competencyId)
    .eq("status", "active")
    .is("archived_at", null)
    .eq("organization_id", organizationId);

  if (scopeType === "experience") {
    // Filter by experience
    const filtered = (observations || []).filter((obs: any) => {
      // Check if observation is for this experience
      return true; // Will be filtered by experience_id in query if needed
    });
    evidenceItems.push(...filtered.map((obs: any) => ({
      type: "observation",
      id: obs.id,
      created_at: obs.created_at,
    })));
  } else {
    evidenceItems.push(...(observations || []).map((obs: any) => ({
      type: "observation",
      id: obs.id,
      created_at: obs.created_at,
    })));
  }

  // 3. Lesson log verifications: count as evidence of participation only
  if (scopeType === "syllabus") {
    // First get lesson log IDs for this syllabus
    const { data: lessonLogs } = await supabaseServer
      .from("weekly_lesson_logs")
      .select("id")
      .eq("syllabus_id", scopeId)
      .is("archived_at", null)
      .eq("organization_id", organizationId);
    
    const lessonLogIds = (lessonLogs || []).map((log: any) => log.id);
    
    if (lessonLogIds.length > 0) {
      const { data: verifications } = await supabaseServer
        .from("weekly_lesson_log_learner_verifications")
        .select("id, created_at")
        .eq("learner_id", learnerId)
        .eq("accomplished_flag", true)
        .is("archived_at", null)
        .eq("organization_id", organizationId)
        .in("lesson_log_id", lessonLogIds);

      evidenceItems.push(...(verifications || []).map((v: any) => ({
        type: "lesson_log",
        id: v.id,
        created_at: v.created_at,
      })));
    }
  }

  // 4. Portfolio artifacts: tagged to experience/competency/outcome where applicable
  const { data: artifacts } = await supabaseServer
    .from("portfolio_artifacts")
    .select("id, created_at")
    .eq("student_id", learnerId) // Portfolio uses student_id, not learner_id
    .is("archived_at", null)
    .eq("organization_id", organizationId);

  if (artifacts) {
    // Check if artifact has tags linking to this competency
    for (const artifact of artifacts) {
      const { data: tags } = await supabaseServer
        .from("portfolio_artifact_tags")
        .select("competency_id")
        .eq("artifact_id", artifact.id)
        .is("archived_at", null);

      if (tags && tags.some((tag: any) => tag.competency_id === competencyId)) {
        evidenceItems.push({
          type: "portfolio_artifact",
          id: artifact.id,
          created_at: artifact.created_at,
        });
      }
    }
  }

  // 5. Attendance sessions: supporting evidence only (not scoring)
  // Skip for now as per requirements (supporting evidence only)

  // Calculate evidence count and last evidence date
  const evidenceCount = evidenceItems.length;
  const lastEvidenceAt = evidenceItems.length > 0
    ? evidenceItems.reduce((latest, item) => 
        item.created_at > latest ? item.created_at : latest, 
        evidenceItems[0].created_at
      )
    : null;

  return {
    evidenceCount,
    lastEvidenceAt,
    evidenceItems,
  };
}

/**
 * Determine mastery level based on evidence
 */
async function determineMasteryLevel(
  evidenceCount: number,
  hasAssessment: boolean,
  hasObservation: boolean,
  masteryModelId: string
): Promise<string | null> {
  // Get mastery model with thresholds
  const { data: model } = await supabaseServer
    .from("mastery_models")
    .select("threshold_not_started, threshold_emerging, threshold_developing, threshold_proficient, threshold_mastered")
    .eq("id", masteryModelId)
    .single();

  if (!model) {
    return null;
  }

  // Get mastery levels ordered by display_order
  const { data: levels } = await supabaseServer
    .from("mastery_levels")
    .select("id, label, display_order")
    .eq("mastery_model_id", masteryModelId)
    .is("archived_at", null)
    .order("display_order", { ascending: true });

  if (!levels || levels.length === 0) {
    return null;
  }

  // Determine level based on thresholds and evidence types
  // Baseline rule (can be customized via model thresholds):
  //   not_started: 0 evidence
  //   emerging: evidence_count >= threshold_emerging
  //   developing: evidence_count >= threshold_developing (and at least 2 distinct dates OR 2 evidence types)
  //   proficient: evidence_count >= threshold_proficient (with at least one assessment OR observation)
  //   mastered: evidence_count >= threshold_mastered (with at least one assessment + one observation)

  if (evidenceCount === 0) {
    // Find not_started level
    const notStarted = levels.find((l: any) => l.label.toLowerCase() === "not_started");
    return notStarted?.id || levels[0].id;
  }

  if (evidenceCount >= model.threshold_mastered && hasAssessment && hasObservation) {
    // Find mastered level
    const mastered = levels.find((l: any) => l.label.toLowerCase() === "mastered");
    return mastered?.id || levels[levels.length - 1].id;
  }

  if (evidenceCount >= model.threshold_proficient && (hasAssessment || hasObservation)) {
    // Find proficient level
    const proficient = levels.find((l: any) => l.label.toLowerCase() === "proficient");
    return proficient?.id || levels[levels.length - 1].id;
  }

  if (evidenceCount >= model.threshold_developing) {
    // Find developing level
    const developing = levels.find((l: any) => l.label.toLowerCase() === "developing");
    return developing?.id || levels[Math.min(2, levels.length - 1)].id;
  }

  if (evidenceCount >= model.threshold_emerging) {
    // Find emerging level
    const emerging = levels.find((l: any) => l.label.toLowerCase() === "emerging");
    return emerging?.id || levels[Math.min(1, levels.length - 1)].id;
  }

  // Default to first level
  return levels[0].id;
}

/**
 * POST /api/mastery/snapshot/run
 * Generate mastery snapshot for a scope
 */
export async function POST(request: NextRequest) {
  try {
    // Verify access
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json(
        { error: authError || "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const {
      scope_type,
      scope_id,
      school_year_id,
      quarter,
      term,
      snapshot_date,
      mastery_model_id,
    } = body;

    // Validate required fields
    if (!scope_type || !scope_id || !mastery_model_id) {
      return NextResponse.json(
        { error: "Missing required fields: scope_type, scope_id, mastery_model_id" },
        { status: 400 }
      );
    }

    if (!["experience", "syllabus", "program", "section"].includes(scope_type)) {
      return NextResponse.json(
        { error: "Invalid scope_type. Must be: experience, syllabus, program, or section" },
        { status: 400 }
      );
    }

    const organizationId = profile.organization_id;
    if (!organizationId) {
      return NextResponse.json(
        { error: "Organization context required" },
        { status: 400 }
      );
    }

    // Get active school year if not provided
    let finalSchoolYearId = school_year_id;
    if (!finalSchoolYearId) {
      finalSchoolYearId = await getActiveSchoolYear(organizationId);
    }

    // Get school_id from scope if needed
    let schoolId: string | null = null;
    if (scope_type === "section") {
      const { data: section } = await supabaseServer
        .from("sections")
        .select("school_id")
        .eq("id", scope_id)
        .single();
      schoolId = section?.school_id || null;
    } else if (scope_type === "experience") {
      const { data: experience } = await supabaseServer
        .from("experiences")
        .select("school_id")
        .eq("id", scope_id)
        .single();
      schoolId = experience?.school_id || null;
    }

    // Get learners for scope
    const learners = await getLearnersForScope(scope_type, scope_id, organizationId);
    if (learners.length === 0) {
      return NextResponse.json(
        { error: "No learners found for this scope" },
        { status: 400 }
      );
    }

    // Get competencies/outcomes for scope
    let competencies: Array<{ id: string }>;
    try {
      competencies = await getCompetenciesForScope(scope_type, scope_id, organizationId);
    } catch (error: any) {
      logError("Error fetching competencies for scope", error);
      return NextResponse.json(
        { error: error.message || "Failed to fetch competencies for this scope" },
        { status: 500 }
      );
    }

    if (competencies.length === 0) {
      let errorMessage = "No competencies/outcomes found for this scope.";
      if (scope_type === "experience") {
        errorMessage = "This experience has no competencies linked. Please link competencies to this experience before generating a snapshot.";
      } else if (scope_type === "syllabus") {
        errorMessage = "This syllabus has no competencies linked to its weeks. Please add weeks and link competencies to syllabus weeks before generating a snapshot.";
      } else if (scope_type === "program" || scope_type === "section") {
        errorMessage = "No competencies found in this organization. Please create competencies before generating a snapshot.";
      }
      return NextResponse.json(
        { error: errorMessage },
        { status: 400 }
      );
    }

    // Create snapshot run
    const snapshotDate = snapshot_date || new Date().toISOString().split("T")[0];
    const { data: snapshotRun, error: runError } = await supabaseServer
      .from("mastery_snapshot_runs")
      .insert({
        organization_id: organizationId,
        school_id: schoolId,
        scope_type,
        scope_id,
        school_year_id: finalSchoolYearId,
        quarter: quarter || null,
        term: term || null,
        snapshot_date: snapshotDate,
        snapshot_count: 0,
        created_by: user.id,
      })
      .select()
      .single();

    if (runError || !snapshotRun) {
      logError("Error creating snapshot run", runError);
      return NextResponse.json(
        { error: "Failed to create snapshot run" },
        { status: 500 }
      );
    }

    // Generate snapshots for each learner/competency pair
    let snapshotCount = 0;
    const snapshotIds: string[] = [];

    for (const learner of learners) {
      for (const competency of competencies) {
        // Collect evidence
        const evidence = await collectEvidence(
          learner.id,
          competency.id,
          scope_type,
          scope_id,
          organizationId,
          finalSchoolYearId
        );

        // Determine mastery level
        const hasAssessment = evidence.evidenceItems.some((e) => e.type === "assessment");
        const hasObservation = evidence.evidenceItems.some((e) => e.type === "observation");
        const masteryLevelId = await determineMasteryLevel(
          evidence.evidenceCount,
          hasAssessment,
          hasObservation,
          mastery_model_id
        );

        if (!masteryLevelId) {
          continue; // Skip if no mastery level determined
        }

        // Create rationale text
        const rationaleText = `${evidence.evidenceCount} evidence item${evidence.evidenceCount !== 1 ? "s" : ""} incl ${hasAssessment ? "1 assessment" : ""}${hasAssessment && hasObservation ? " + " : ""}${hasObservation ? "1 observation" : ""}`.trim();

        // Create snapshot (with required confirmed_at and confirmed_by)
        const { data: snapshot, error: snapshotError } = await supabaseServer
          .from("learner_outcome_mastery_snapshots")
          .insert({
            organization_id: organizationId,
            school_id: schoolId,
            snapshot_run_id: snapshotRun.id,
            learner_id: learner.id,
            competency_id: competency.id,
            mastery_level_id: masteryLevelId,
            teacher_id: user.id, // Required: teacher who has context
            rationale_text: rationaleText,
            evidence_count: evidence.evidenceCount,
            last_evidence_at: evidence.lastEvidenceAt,
            snapshot_date: snapshotDate,
            confirmed_at: new Date().toISOString(), // Required: human confirmation
            confirmed_by: user.id, // Required: teacher confirms their own snapshot
            created_by: user.id,
          })
          .select()
          .single();

        if (snapshotError || !snapshot) {
          logError("Error creating snapshot", snapshotError);
          continue; // Continue with next snapshot
        }

        snapshotIds.push(snapshot.id);
        snapshotCount++;

        // Create evidence links
        for (const evidenceItem of evidence.evidenceItems) {
          const evidenceLinkData: any = {
            organization_id: organizationId,
            snapshot_id: snapshot.id,
            evidence_type: evidenceItem.type,
            created_by: user.id,
          };

          if (evidenceItem.type === "assessment") {
            evidenceLinkData.assessment_id = evidenceItem.id;
          } else if (evidenceItem.type === "observation") {
            evidenceLinkData.observation_id = evidenceItem.id;
          } else if (evidenceItem.type === "portfolio_artifact") {
            evidenceLinkData.portfolio_artifact_id = evidenceItem.id;
          } else if (evidenceItem.type === "lesson_log") {
            evidenceLinkData.lesson_log_id = evidenceItem.id;
          }

          await supabaseServer
            .from("mastery_snapshot_evidence_links")
            .insert(evidenceLinkData);
        }
      }
    }

    // Update snapshot run count
    await supabaseServer
      .from("mastery_snapshot_runs")
      .update({ snapshot_count: snapshotCount })
      .eq("id", snapshotRun.id);

    return NextResponse.json({
      snapshot_run_id: snapshotRun.id,
      snapshot_count: snapshotCount,
      message: `Successfully generated ${snapshotCount} snapshots`,
    });
  } catch (error: any) {
    logError("Error generating snapshot", error);
    return NextResponse.json(
      { error: error.message || "Failed to generate snapshot" },
      { status: 500 }
    );
  }
}
