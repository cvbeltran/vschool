import { NextRequest, NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/**
 * Helper to verify admin/principal/registrar access
 */
async function verifyAdminAccess(request: NextRequest) {
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

  // Check if user has admin/principal/registrar role
  const { data: profile, error: profileError } = await supabaseServer
    .from("profiles")
    .select("role, organization_id")
    .eq("id", user.id)
    .single();

  if (profileError || !profile) {
    return { user: null, error: "User profile not found" };
  }

  const allowedRoles = ["admin", "principal", "registrar"];
  if (!allowedRoles.includes(profile.role)) {
    return { user: null, error: "Forbidden: Admin access required" };
  }

  return { user, profile, error: null };
}

export async function POST(request: NextRequest) {
  try {
    // Verify admin access
    const { user, profile, error: authError } = await verifyAdminAccess(request);
    if (authError || !user || !profile) {
      return NextResponse.json(
        { error: authError || "Unauthorized" },
        { status: 401 }
      );
    }

    const body = await request.json();
    const { studentId, email } = body;

    // Validate required fields
    if (!studentId || !email) {
      return NextResponse.json(
        { error: "Missing required fields: studentId, email" },
        { status: 400 }
      );
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: "Invalid email format" },
        { status: 400 }
      );
    }

    // Fetch student and verify it belongs to requester's organization
    const { data: student, error: studentError } = await supabaseServer
      .from("students")
      .select("id, organization_id, profile_id, primary_email")
      .eq("id", studentId)
      .single();

    if (studentError || !student) {
      return NextResponse.json(
        { error: "Student not found" },
        { status: 404 }
      );
    }

    // Verify organization match (unless super admin)
    const { data: requesterProfile } = await supabaseServer
      .from("profiles")
      .select("is_super_admin")
      .eq("id", user.id)
      .single();

    if (!requesterProfile?.is_super_admin && student.organization_id !== profile.organization_id) {
      return NextResponse.json(
        { error: "Forbidden: Student does not belong to your organization" },
        { status: 403 }
      );
    }

    // Check if email is already used by another student
    const { data: existingStudent } = await supabaseServer
      .from("students")
      .select("id, primary_email")
      .or(`primary_email.eq.${email},email.eq.${email}`)
      .neq("id", studentId)
      .maybeSingle();

    if (existingStudent) {
      return NextResponse.json(
        { error: "Email is already used by another student" },
        { status: 400 }
      );
    }

    let userId: string;
    let isNewAccount = false;

    // Prepare redirect URL for invite email
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectTo = `${siteUrl}/api/auth/callback?type=invite&next=${encodeURIComponent('/student/reset-password')}`;

    // Check if student already has a profile_id (existing account)
    if (student.profile_id) {
      // Student already has an account - resend invite
      userId = student.profile_id;
      
      console.log('Resending invitation email to existing student account:', email);
      const { error: resendError } = await supabaseServer.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectTo,
          data: {
            organization_id: student.organization_id,
          },
        }
      );
      
      if (resendError) {
        console.error("Error resending invite:", resendError);
        return NextResponse.json(
          { error: resendError.message || "Failed to resend invitation email" },
          { status: 400 }
        );
      }
      
      console.log('Invitation email resent successfully to:', email);
    } else {
      // Use inviteUserByEmail() which automatically sends an invitation email
      // When user clicks the link, they'll be logged in and redirected to reset-password page
      console.log('Inviting student and sending invitation email to:', email);
      console.log('Invitation redirect URL:', redirectTo);
      
      const { data: inviteData, error: inviteError } = await supabaseServer.auth.admin.inviteUserByEmail(
        email,
        {
          redirectTo: redirectTo,
          data: {
            organization_id: student.organization_id,
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
          // User exists in auth but not linked to student - find them via listUsers
          const { data: usersList } = await supabaseServer.auth.admin.listUsers();
          const foundUser = usersList?.users?.find((u: any) => u.email?.toLowerCase() === email.toLowerCase());
          
          if (foundUser) {
            userId = foundUser.id;
            // Resend invite to existing user
            const { error: resendError } = await supabaseServer.auth.admin.inviteUserByEmail(
              email,
              {
                redirectTo: redirectTo,
                data: {
                  organization_id: student.organization_id,
                },
              }
            );
            if (resendError) {
              console.error("Error resending invite:", resendError);
              return NextResponse.json(
                { error: resendError.message || "Failed to resend invitation email" },
                { status: 400 }
              );
            }
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
        console.log('Student invitation email sent successfully to:', email);
        console.log('User ID:', userId);
      }
    }

    // Create or update profiles record with organization_id
    const { error: profileError } = await supabaseServer
      .from("profiles")
      .upsert({
        id: userId,
        role: "student",
        organization_id: student.organization_id,
      }, {
        onConflict: "id",
      });

    if (profileError) {
      console.error("Error creating/updating profile:", profileError);
      // If this is a new account, clean up
      if (isNewAccount) {
        await supabaseServer.auth.admin.deleteUser(userId);
      }
      return NextResponse.json(
        { error: "Failed to create profile" },
        { status: 500 }
      );
    }

    // Update students table
    const { error: updateError } = await supabaseServer
      .from("students")
      .update({
        profile_id: userId,
        primary_email: email,
        must_reset_password: true,
        invited_at: new Date().toISOString(),
      })
      .eq("id", studentId);

    if (updateError) {
      console.error("Error updating student:", updateError);
      // If this is a new account, clean up
      if (isNewAccount) {
        await supabaseServer.auth.admin.deleteUser(userId);
        await supabaseServer.from("profiles").delete().eq("id", userId);
      }
      return NextResponse.json(
        { error: updateError.message || "Failed to update student record" },
        { status: 400 }
      );
    }

    // Return response matching staff create pattern
    const response: any = {
      success: true,
      isNewAccount,
      message: isNewAccount 
        ? "Invitation email sent successfully. The student will receive an email with a link to set up their account and password."
        : student.profile_id
        ? "Invitation email resent successfully. The student will receive an email with a link to set up their account and password."
        : "Student record updated and linked to existing account.",
    };

    return NextResponse.json(response);

  } catch (error: any) {
    console.error("Error in student invite:", error);
    return NextResponse.json(
      { error: error.message || "Internal server error" },
      { status: 500 }
    );
  }
}
