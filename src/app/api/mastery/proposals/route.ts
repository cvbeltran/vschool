import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import {
  upsertMasteryDraft,
  submitMasteryProposal,
  reviewMasteryProposal,
  listMasteryProposalsForReview,
  listMasteryDrafts,
  getEvidencePack,
} from "@/lib/mastery";

/**
 * Helper to verify access and get user profile
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

  // Get user profile
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("organization_id, role")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, profile: null, error: "User profile not found" };
  }

  return { user, profile, error: null };
}

/**
 * GET /api/mastery/proposals
 * List proposals (for review queue or teacher drafts)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const searchParams = request.nextUrl.searchParams;
    const type = searchParams.get("type"); // "review" or "drafts"
    const teacherId = searchParams.get("teacher_id");

    if (type === "review") {
      // Reviewer queue: submitted proposals
      const proposals = await listMasteryProposalsForReview(profile.organization_id);
      return NextResponse.json({ proposals });
    } else {
      // Teacher drafts - query directly using server-side supabase
      // User is already authenticated via verifyAccess, and we filter by teacher_id and organization_id
      const teacherIdToUse = teacherId || user.id;
      
      // Query drafts using server-side supabase (service role bypasses RLS, but we filter correctly)
      let query = supabaseServer
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
        .eq("organization_id", profile.organization_id)
        .order("updated_at", { ascending: false });

      const { data: drafts, error: draftsError } = await query;

      if (draftsError) {
        logError("Error fetching mastery drafts", draftsError);
        return NextResponse.json(
          { error: draftsError.message || "Failed to fetch drafts" },
          { status: 500 }
        );
      }

      return NextResponse.json({ proposals: drafts || [] });
    }
  } catch (error: any) {
    logError("Error fetching mastery proposals", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch proposals" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/mastery/proposals
 * Create or update a mastery draft
 */
export async function POST(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get school_id if needed
    const { data: fullProfile } = await supabaseServer
      .from("profiles")
      .select("school_id")
      .eq("id", user.id)
      .single();

    const schoolId = fullProfile?.school_id || null;

    const body = await request.json();
    const {
      learner_id,
      competency_id,
      mastery_level_id,
      rationale_text,
      highlight_evidence_ids,
    } = body;

    if (!learner_id || !competency_id || !mastery_level_id || !rationale_text) {
      return NextResponse.json(
        { error: "Missing required fields: learner_id, competency_id, mastery_level_id, rationale_text" },
        { status: 400 }
      );
    }

    // Create a user-specific Supabase client with their access token for RLS
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "") || null;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Create client with user's token for proper RLS
    // The Authorization header will be automatically used by Supabase for RLS policies
    const { createClient } = await import("@supabase/supabase-js");
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`,
        } : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });

    const proposal = await upsertMasteryDraft(
      {
        learner_id,
        competency_id,
        mastery_level_id,
        rationale_text,
        highlight_evidence_ids,
        organization_id: profile.organization_id,
        school_id: schoolId,
      },
      userSupabase,
      user.id
    );

    return NextResponse.json({ proposal });
  } catch (error: any) {
    logError("Error creating mastery draft", error);
    return NextResponse.json(
      { error: error.message || "Failed to create draft" },
      { status: 500 }
    );
  }
}
