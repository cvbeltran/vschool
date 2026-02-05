import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";
import { listSchemes, createScheme, publishScheme } from "@/lib/gradebook";
import { logError } from "@/lib/logger";

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
 * GET /api/gradebook/schemes
 * List schemes
 */
export async function GET(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const schemes = await listSchemes(profile.organization_id);
    return NextResponse.json({ schemes });
  } catch (error: any) {
    logError("gradebook_schemes_list", error, { message: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to list schemes" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/gradebook/schemes
 * Create scheme
 */
export async function POST(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Only admin/registrar can create schemes
    if (!["admin", "principal", "registrar"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { scheme_type, name, description, school_id, program_id } = body;

    if (!scheme_type || !name) {
      return NextResponse.json(
        { error: "Missing required fields: scheme_type, name" },
        { status: 400 }
      );
    }

    const scheme = await createScheme({
      organization_id: profile.organization_id,
      school_id: school_id || null,
      program_id: program_id || null,
      scheme_type,
      name,
      description: description || null,
      created_by: user.id,
    });

    return NextResponse.json({ scheme });
  } catch (error: any) {
    logError("gradebook_schemes_create", error, { message: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to create scheme" },
      { status: 500 }
    );
  }
}

/**
 * PATCH /api/gradebook/schemes
 * Publish scheme
 */
export async function PATCH(request: NextRequest) {
  try {
    const { user, profile, error: authError } = await verifyAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    if (!["admin", "principal", "registrar"].includes(profile.role)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json();
    const { id, action } = body;

    if (!id || action !== "publish") {
      return NextResponse.json(
        { error: "Missing required fields: id, action=publish" },
        { status: 400 }
      );
    }

    const scheme = await publishScheme(id, user.id);
    return NextResponse.json({ scheme });
  } catch (error: any) {
    logError("gradebook_schemes_publish", error, { message: error.message });
    return NextResponse.json(
      { error: error.message || "Failed to publish scheme" },
      { status: 500 }
    );
  }
}
