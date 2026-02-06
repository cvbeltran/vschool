import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import StudentLayoutClient from "./layout-client";
import { logError } from "@/lib/logger";

export default async function StudentLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Get the current pathname from middleware header
  const headersList = await headers();
  const pathname = headersList.get("x-pathname") || "";
  
  // Skip auth checks for login and reset-password pages
  // CRITICAL: Check pathname BEFORE any async operations to prevent loops
  // Note: pathname from middleware doesn't include query params, so "/student/reset-password" matches
  // Also check for exact match and startsWith to catch all variations
  const isAuthRoute = 
    pathname === "/student/login" || 
    pathname.startsWith("/student/login/") ||
    pathname === "/student/reset-password" ||
    pathname.startsWith("/student/reset-password");
  
  // CRITICAL: Early return for auth routes to prevent any processing
  // This must happen BEFORE any database calls or async operations
  // This is the FIRST thing we check to prevent infinite loops
  if (isAuthRoute) {
    // For auth routes, render without layout wrapper
    // This prevents any auth checks or redirects from running
    // Return immediately to avoid any database calls or async operations
    // This is critical to prevent infinite loops
    return <>{children}</>;
  }

  const supabase = await createSupabaseServerClient();
  
  try {
    const { data: { user }, error: authError } = await supabase.auth.getUser();

    // If there's an auth error or no user, redirect to login
    if (authError || !user) {
      redirect("/student/login");
    }

    // Verify user is a student
    const { data: profile, error: profileError } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (profileError || !profile || profile.role !== "student") {
      // Not a student, redirect to staff login
      redirect("/sis/auth/login");
    }

    // Check must_reset_password flag
    const { data: student, error: studentError } = await supabase
      .from("students")
      .select("must_reset_password")
      .eq("profile_id", user.id)
      .maybeSingle();

    // If student record doesn't exist, redirect to login (shouldn't happen, but handle gracefully)
    if (studentError || !student) {
      redirect("/student/login");
    }

    // CRITICAL: If must_reset_password is true, redirect to reset-password page
    // This enforces password creation for invited students
    // Skip this check if already on reset-password page to avoid redirect loop
    if (student.must_reset_password && !isAuthRoute) {
      redirect("/student/reset-password?fromInvite=true");
    }

    // Pass must_reset_password to client component
    // Client component will handle redirect based on pathname to prevent layout flash
    return (
      <StudentLayoutClient mustResetPassword={student.must_reset_password || false}>
        {children}
      </StudentLayoutClient>
    );
  } catch (error) {
    // Next.js redirect() throws a special error that should be re-thrown
    // Check if this is a redirect error by checking for NEXT_REDIRECT digest
    if (
      error &&
      typeof error === 'object' &&
      'digest' in error &&
      typeof error.digest === 'string' &&
      error.digest.includes('NEXT_REDIRECT')
    ) {
      // This is a Next.js redirect error - re-throw it to allow the redirect to proceed
      throw error;
    }
    
    // If there's any other error (network, fetch, etc.), log and redirect to login
    logError("Error in student layout auth check", error);
    redirect("/student/login");
  }
}
