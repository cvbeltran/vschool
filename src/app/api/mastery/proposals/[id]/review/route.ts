import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { reviewMasteryProposal } from "@/lib/mastery";

/**
 * Helper to verify access and get user
 */
async function verifyAccess(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    return { user: null, error: "Unauthorized" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    return { user: null, error: "Unauthorized" };
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

  if (authError || !user) {
    return { user: null, error: "Unauthorized" };
  }

  return { user, error: null };
}

/**
 * POST /api/mastery/proposals/[id]/review
 * Review a mastery proposal (approve, request changes, or override)
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await verifyAccess(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 15+
    const { id } = await params;

    const body = await request.json();
    const { action, reviewer_notes, override_level_id, override_justification } = body;

    console.log(`[review API] Reviewing proposal ${id} with action: ${action}`);

    if (!action || !["approve", "request_changes", "override"].includes(action)) {
      return NextResponse.json(
        { error: "Invalid action. Must be: approve, request_changes, or override" },
        { status: 400 }
      );
    }

    if (action === "override" && (!override_level_id || !override_justification)) {
      return NextResponse.json(
        { error: "Override requires override_level_id and override_justification" },
        { status: 400 }
      );
    }

    // Create a user-specific Supabase client with their access token for RLS
    const authHeader = request.headers.get("authorization");
    const accessToken = authHeader?.replace("Bearer ", "") || null;
    
    if (!accessToken) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;
    
    const { createClient } = await import("@supabase/supabase-js");
    const userSupabase = createClient(supabaseUrl, supabaseAnonKey, {
      global: {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
    });
    
    // Set the session manually for RLS
    await userSupabase.auth.setSession({
      access_token: accessToken,
      refresh_token: "",
    } as any);

    const proposal = await reviewMasteryProposal({
      snapshot_id: id,
      action,
      reviewer_notes,
      override_level_id,
      override_justification,
    }, userSupabase, user.id);

    console.log(`[review API] Successfully reviewed proposal ${id}`);
    return NextResponse.json({ proposal });
  } catch (error: any) {
    console.error(`[review API] Error reviewing proposal:`, error);
    logError("Error reviewing mastery proposal", error);
    return NextResponse.json(
      { error: error.message || "Failed to review proposal" },
      { status: 500 }
    );
  }
}
