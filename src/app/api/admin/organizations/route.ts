import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Helper to verify super admin access
 */
async function verifySuperAdmin(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) {
    console.error("No authorization header");
    return { user: null, error: "Unauthorized" };
  }

  const token = authHeader.replace("Bearer ", "");
  if (!token) {
    console.error("No token in authorization header");
    return { user: null, error: "Unauthorized" };
  }

  const { data: { user }, error: authError } = await supabaseServer.auth.getUser(token);

  if (authError) {
    console.error("Auth error:", authError);
    return { user: null, error: "Unauthorized" };
  }

  if (!user) {
    console.error("No user found");
    return { user: null, error: "Unauthorized" };
  }

  // Check if user is super admin
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("is_super_admin")
    .eq("id", user.id)
    .single();

  if (profileError) {
    console.error("Profile error:", profileError);
    return { user: null, error: "User profile not found" };
  }

  if (!profile) {
    console.error("No profile found for user:", user.id);
    return { user: null, error: "User profile not found" };
  }

  if (!profile.is_super_admin) {
    console.log("User is not super admin:", user.id);
    return { user: null, error: "Forbidden: Super admin access required" };
  }

  return { user, error: null };
}

/**
 * GET /api/admin/organizations
 * Fetch all organizations with statistics (super admin only)
 */
export async function GET(request: NextRequest) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    // Fetch organizations with statistics
    const { data: organizations, error: orgError } = await supabaseServer
      .from("organizations")
      .select("*")
      .order("created_at", { ascending: false });

    if (orgError) {
      throw orgError;
    }

    // Fetch statistics for each organization
    const organizationsWithStats = await Promise.all(
      (organizations || []).map(async (org) => {
        const [usersResult, studentsResult, schoolsResult] = await Promise.all([
          supabaseServer
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id),
          supabaseServer
            .from("students")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id),
          supabaseServer
            .from("schools")
            .select("id", { count: "exact", head: true })
            .eq("organization_id", org.id),
        ]);

        return {
          ...org,
          user_count: usersResult.count || 0,
          student_count: studentsResult.count || 0,
          school_count: schoolsResult.count || 0,
        };
      })
    );

    return NextResponse.json(organizationsWithStats);
  } catch (error) {
    console.error("Error fetching organizations:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}

/**
 * POST /api/admin/organizations
 * Create a new organization (super admin only)
 */
export async function POST(request: NextRequest) {
  try {
    const { user, error } = await verifySuperAdmin(request);
    if (error || !user) {
      const status = error === "Unauthorized" ? 401 : error === "Forbidden: Super admin access required" ? 403 : 404;
      return NextResponse.json({ error }, { status });
    }

    const body = await request.json();
    const {
      name,
      email,
      contact_number,
      registered_business_address,
      website,
      logo_url,
      tax_id,
      registration_number,
      phone,
      fax,
      description,
      timezone = "Asia/Manila",
      currency = "PHP",
      is_active = true,
    } = body;

    // Validate required fields
    if (!name || !email || !registered_business_address) {
      return NextResponse.json(
        { error: "Missing required fields: name, email, registered_business_address" },
        { status: 400 }
      );
    }

    // Create organization
    const { data: newOrg, error: createError } = await supabaseServer
      .from("organizations")
      .insert({
        name,
        email,
        contact_number,
        registered_business_address,
        website,
        logo_url,
        tax_id,
        registration_number,
        phone,
        fax,
        description,
        timezone,
        currency,
        is_active,
      })
      .select()
      .single();

    if (createError) {
      console.error("Error creating organization:", createError);
      return NextResponse.json(
        { error: createError.message || "Failed to create organization" },
        { status: 400 }
      );
    }

    return NextResponse.json(newOrg, { status: 201 });
  } catch (error) {
    console.error("Error creating organization:", error);
    return NextResponse.json(
      { error: "Internal server error" },
      { status: 500 }
    );
  }
}
