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
  { params }: { params: { id: string } }
) {
  try {
    const { user, error: authError } = await verifyAccess(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { action, reviewer_notes, override_level_id, override_justification } = body;

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

    const proposal = await reviewMasteryProposal({
      snapshot_id: params.id,
      action,
      reviewer_notes,
      override_level_id,
      override_justification,
    });

    return NextResponse.json({ proposal });
  } catch (error: any) {
    logError("Error reviewing mastery proposal", error);
    return NextResponse.json(
      { error: error.message || "Failed to review proposal" },
      { status: 500 }
    );
  }
}
