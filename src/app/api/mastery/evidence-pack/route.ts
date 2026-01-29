import { NextRequest, NextResponse } from "next/server";
import { supabaseServer, getAuthenticatedUser } from "@/lib/supabase/server";
import { createClient } from "@supabase/supabase-js";
import { logError } from "@/lib/logger";
import { getEvidencePack } from "@/lib/mastery";

/**
 * GET /api/mastery/evidence-pack
 * Get evidence pack for a learner/competency pair
 */
export async function GET(request: NextRequest) {
  try {
    // Get authenticated user from Authorization header or cookies
    const { user, error: authError } = await getAuthenticatedUser(request);
    
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { data: profile } = await supabaseServer
      .from("profiles")
      .select("organization_id")
      .eq("id", user.id)
      .single();

    if (!profile) {
      return NextResponse.json({ error: "Profile not found" }, { status: 404 });
    }

    const searchParams = request.nextUrl.searchParams;
    const learnerId = searchParams.get("learner_id");
    const competencyId = searchParams.get("competency_id");

    if (!learnerId || !competencyId) {
      return NextResponse.json(
        { error: "Missing required parameters: learner_id, competency_id" },
        { status: 400 }
      );
    }

    // Create a Supabase client with the user's access token for RLS
    // This ensures RLS policies work correctly when querying from server-side
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "") || null;
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    // Create client with user's token for proper RLS
    // Use the service role client but set the user context via auth header
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: accessToken ? {
          Authorization: `Bearer ${accessToken}`,
        } : {},
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
      },
    });
    
    // Set the session manually for RLS
    if (accessToken) {
      await userSupabase.auth.setSession({
        access_token: accessToken,
        refresh_token: "", // Not needed for server-side
      } as any);
    }

    const evidencePack = await getEvidencePack(
      learnerId,
      competencyId,
      profile.organization_id,
      userSupabase
    );

    // Debug: Also return some diagnostic info in development
    let debugInfo: any = null;
    if (process.env.NODE_ENV === "development") {
      // Check what assessments exist (any status)
      const { data: allAssessments } = await supabaseServer
        .from("assessments")
        .select("id, status, learner_id")
        .eq("learner_id", learnerId)
        .is("archived_at", null);
      
      // Check what portfolio artifacts exist
      const { data: allArtifacts } = await supabaseServer
        .from("portfolio_artifacts")
        .select("id, student_id")
        .eq("student_id", learnerId)
        .is("archived_at", null);
      
      debugInfo = {
        learnerId,
        competencyId,
        organizationId: profile.organization_id,
        evidenceCount: evidencePack.length,
        evidenceTypes: evidencePack.reduce((acc: any, item: any) => {
          acc[item.type] = (acc[item.type] || 0) + 1;
          return acc;
        }, {}),
        assessments: {
          total: allAssessments?.length || 0,
          byStatus: allAssessments?.reduce((acc: any, a: any) => {
            acc[a.status] = (acc[a.status] || 0) + 1;
            return acc;
          }, {}) || {},
        },
        portfolioArtifacts: {
          total: allArtifacts?.length || 0,
        },
      };
    }

    return NextResponse.json({ 
      evidence: evidencePack,
      ...(debugInfo && { debug: debugInfo })
    });
  } catch (error: any) {
    logError("Error fetching evidence pack", error);
    return NextResponse.json(
      { error: error.message || "Failed to fetch evidence pack" },
      { status: 500 }
    );
  }
}
