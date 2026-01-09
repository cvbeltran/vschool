import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email, first_name, middle_name, last_name, suffix, position_title_id, organization_id } = body;

    // Get organization_id from request body (passed from client)
    // RLS policies will ensure users can only create staff in their own organization
    const creatorOrganizationId = organization_id;

    // Validate required fields
    if (!email || !first_name || !last_name || !position_title_id) {
      return NextResponse.json(
        { error: "Missing required fields: email, first_name, last_name, position_title_id" },
        { status: 400 }
      );
    }

    // Check if staff with this email already exists
    const { data: existingStaff } = await supabaseServer
      .from("staff")
      .select("user_id")
      .eq("email_address", email)
      .single();

    let userId: string;
    let isNewAccount = false;

    if (existingStaff?.user_id) {
      // Staff record exists - use existing user_id
      userId = existingStaff.user_id;
    } else {
      // Use inviteUserByEmail() which automatically sends an invitation email
      // When user clicks the link, they'll be logged in and redirected to set-password page
      const { data: inviteData, error: inviteError } = await supabaseServer.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/sis/auth/login?type=invite`,
          data: {
            first_name: first_name,
            last_name: last_name,
          },
        }
      );

      if (inviteError) {
        // Check if error is because user already exists
        const errorMessage = inviteError.message?.toLowerCase() || "";
        const isUserExistsError = 
          errorMessage.includes("already registered") || 
          errorMessage.includes("already exists") ||
          errorMessage.includes("user already registered");

        if (isUserExistsError) {
          // User exists in auth but not in staff table - find them via listUsers
          const { data: usersList } = await supabaseServer.auth.admin.listUsers();
          const foundUser = usersList?.users?.find((user: any) => user.email === email);
          
          if (foundUser) {
            userId = foundUser.id;
          } else {
            return NextResponse.json(
              { error: "User account exists but could not be retrieved. Please contact administrator." },
              { status: 400 }
            );
          }
        } else {
          // Different error - return it
          console.error("Error inviting user:", inviteError);
          return NextResponse.json(
            { error: inviteError.message || "Failed to send invitation email" },
            { status: 400 }
          );
        }
      } else {
        // User invited successfully
        if (!inviteData || !inviteData.user) {
          return NextResponse.json(
            { error: "Failed to create user account" },
            { status: 500 }
          );
        }

        userId = inviteData.user.id;
        isNewAccount = true;
      }
    }

    // Get position title code for role sync
    const { data: positionTitle } = await supabaseServer
      .from("taxonomy_items")
      .select("code")
      .eq("id", position_title_id)
      .single();

    // Map position title to auth role
    let authRole = "teacher"; // default
    if (positionTitle) {
      const roleMap: Record<string, string> = {
        PRINCIPAL: "principal",
        ADMIN: "admin",
        REGISTRAR: "registrar",
        TEACHER: "teacher",
      };
      authRole = roleMap[positionTitle.code] || "teacher";
    }

    // Create or update profiles record with organization_id
    const { error: profileError } = await supabaseServer
      .from("profiles")
      .upsert({
        id: userId,
        role: authRole,
        organization_id: creatorOrganizationId, // Staff belongs to same org as creator
      }, {
        onConflict: "id",
      });

    if (profileError) {
      console.error("Error creating/updating profile:", profileError);
      // Continue anyway - profile might already exist
    }

    // Generate staff_id (employee number)
    const { data: lastStaff } = await supabaseServer
      .from("staff")
      .select("staff_id")
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    let staffId = "STF001";
    if (lastStaff && lastStaff.staff_id) {
      const lastNumber = parseInt(lastStaff.staff_id.replace("STF", ""));
      staffId = `STF${String(lastNumber + 1).padStart(3, "0")}`;
    }

    if (!creatorOrganizationId) {
      return NextResponse.json(
        { error: "Unable to determine organization context. Please ensure you are logged in." },
        { status: 400 }
      );
    }

    // Create staff record with organization_id
    const { data: staffData, error: staffError } = await supabaseServer
      .from("staff")
      .insert({
        user_id: userId,
        staff_id: staffId,
        email_address: email,
        first_name,
        middle_name: middle_name || null,
        last_name,
        suffix: suffix || null,
        organization_id: creatorOrganizationId,
      })
      .select()
      .single();

    if (staffError) {
      console.error("Error creating staff:", staffError);
      
      // If staff creation failed and we created a new account, we should clean up
      if (isNewAccount) {
        await supabaseServer.auth.admin.deleteUser(userId);
      }
      
      return NextResponse.json(
        { error: staffError.message || "Failed to create staff record" },
        { status: 400 }
      );
    }

    // Return response
    const response: any = {
      success: true,
      staff: staffData,
      isNewAccount,
      message: isNewAccount 
        ? "Staff invitation email sent successfully. The staff member will receive an email with a link to set up their account and password."
        : "Staff record created and linked to existing account.",
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("Error in staff creation:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}

