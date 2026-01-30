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
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { user, error: authError } = await verifyAccess(request);
    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Await params in Next.js 15+
    const { id } = await params;

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

    console.log(`[submit API] Submitting proposal ${id} for user ${user.id}`);
    
    const proposal = await submitMasteryProposal(id, userSupabase, user.id);

    console.log(`[submit API] Successfully submitted proposal ${id}`);
    return NextResponse.json({ proposal });
  } catch (error: any) {
    console.error(`[submit API] Error submitting proposal:`, error);
    logError("Error submitting mastery proposal", error);
    return NextResponse.json(
      { error: error.message || "Failed to submit proposal" },
      { status: 500 }
    );
  }
}
