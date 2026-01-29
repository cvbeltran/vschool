import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { logError } from "@/lib/logger";
import { submitMasteryProposal } from "@/lib/mastery";

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
 * POST /api/mastery/proposals/[id]/submit
 * Submit a mastery proposal for review
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

    const proposal = await submitMasteryProposal(params.id);

    return NextResponse.json({ proposal });
  } catch (error: any) {
    logError("Error submitting mastery proposal", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit proposal" },
      { status: 500 }
    );
  }
}
