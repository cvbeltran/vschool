import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      email,
      password,
      organizationName,
      organizationEmail,
      contactNumber,
      registeredBusinessAddress,
    } = body;

    // Validation
    if (!email || !password || !organizationName || !organizationEmail || !registeredBusinessAddress) {
      return NextResponse.json(
        { error: "Missing required fields" },
        { status: 400 }
      );
    }

    if (password.length < 8) {
      return NextResponse.json(
        { error: "Password must be at least 8 characters long" },
        { status: 400 }
      );
    }

    // Check if organization email already exists
    const { data: existingOrg, error: orgCheckError } = await supabaseServer
      .from("organizations")
      .select("id")
      .eq("email", organizationEmail)
      .maybeSingle();

    if (orgCheckError && orgCheckError.code !== "PGRST116") {
      // PGRST116 is "not found" which is fine, but other errors are not
      console.error("Error checking organization:", orgCheckError);
      return NextResponse.json(
        { error: "Failed to verify organization email. Please try again." },
        { status: 500 }
      );
    }

    if (existingOrg) {
      return NextResponse.json(
        { error: "An organization with this email already exists" },
        { status: 400 }
      );
    }

    // Check if user email already exists
    try {
      const { data: existingUser, error: userCheckError } = await supabaseServer.auth.admin.getUserByEmail(email);
      
      // If user exists, return error
      if (existingUser?.user) {
        return NextResponse.json(
          { error: "An account with this email already exists" },
          { status: 400 }
        );
      }
      
      // If there's an error, it might be "user not found" which is fine
      // We'll catch duplicate email errors during user creation
      if (userCheckError) {
        // Log but continue - we'll catch duplicate errors during creation
        console.warn("Warning checking user existence (may be 'not found'):", userCheckError.message);
      }
    } catch (userCheckErr: any) {
      // If getUserByEmail throws, continue - we'll catch it during user creation
      console.warn("Warning checking user existence:", userCheckErr?.message || userCheckErr);
    }

    // Create organization first
    const { data: organization, error: orgError } = await supabaseServer
      .from("organizations")
      .insert([
        {
          name: organizationName,
          email: organizationEmail,
          contact_number: contactNumber || null,
          registered_business_address: registeredBusinessAddress,
        },
      ])
      .select()
      .single();

    if (orgError || !organization) {
      console.error("Error creating organization:", {
        error: orgError,
        message: orgError?.message,
        code: orgError?.code,
        details: orgError?.details,
        hint: orgError?.hint,
      });
      return NextResponse.json(
        { 
          error: "Failed to create organization. Please try again.",
          details: orgError?.message || "Unknown error"
        },
        { status: 500 }
      );
    }

    // Create user account via Supabase Auth Admin API
    const { data: userData, error: userError } = await supabaseServer.auth.admin.createUser({
      email,
      password,
      email_confirm: true, // Auto-confirm email for sign-up
    });

    if (userError || !userData?.user) {
      console.error("Error creating user:", {
        error: userError,
        message: userError?.message,
        status: userError?.status,
      });
      // Rollback: delete organization if user creation fails
      await supabaseServer
        .from("organizations")
        .delete()
        .eq("id", organization.id);
      
      return NextResponse.json(
        { 
          error: userError?.message || "Failed to create user account. Please try again.",
          details: userError?.message
        },
        { status: 500 }
      );
    }

    // Create profile with organization_id and admin role
    const { error: profileError } = await supabaseServer
      .from("profiles")
      .insert([
        {
          id: userData.user.id,
          organization_id: organization.id,
          role: "admin", // Sign-up user becomes organization admin/owner
        },
      ]);

    if (profileError) {
      console.error("Error creating profile:", {
        error: profileError,
        message: profileError?.message,
        code: profileError?.code,
        details: profileError?.details,
        hint: profileError?.hint,
      });
      // Rollback: delete user and organization
      await supabaseServer.auth.admin.deleteUser(userData.user.id);
      await supabaseServer
        .from("organizations")
        .delete()
        .eq("id", organization.id);
      
      return NextResponse.json(
        { 
          error: "Failed to create user profile. Please try again.",
          details: profileError?.message || "Unknown error"
        },
        { status: 500 }
      );
    }

    return NextResponse.json(
      {
        message: "Account created successfully",
        userId: userData.user.id,
        organizationId: organization.id,
      },
      { status: 201 }
    );
  } catch (error: any) {
    console.error("Unexpected error in signup:", {
      error,
      message: error?.message,
      stack: error?.stack,
    });
    return NextResponse.json(
      { 
        error: "An unexpected error occurred. Please try again.",
        details: error?.message || "Unknown error"
      },
      { status: 500 }
    );
  }
}
