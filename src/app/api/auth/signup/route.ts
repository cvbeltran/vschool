import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
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

    // Check if user email already exists by listing users and filtering
    // Note: getUserByEmail doesn't exist in admin API, so we'll catch duplicate errors during creation

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

    // Create user account using regular signUp() method
    // This automatically sends confirmation email (if SMTP is configured)
    const supabaseClient = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data: userData, error: userError } = await supabaseClient.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/sis/auth/confirm`,
      },
    });

    if (userError || !userData?.user) {
      console.error("Error creating user:", {
        error: userError,
        message: userError?.message,
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

    // signUp() automatically sends confirmation email if SMTP is configured
    // No need to manually generate links or trigger email sending

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
      // Use admin API to delete user since we need service role key
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
