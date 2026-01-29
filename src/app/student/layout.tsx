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
  const isAuthRoute = 
    pathname.startsWith("/student/login") || 
    pathname.startsWith("/student/reset-password");
  
  if (isAuthRoute) {
    // For auth routes, render without layout wrapper
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

    // Pass must_reset_password to client component
    // Client component will handle redirect based on pathname to prevent layout flash
    return (
      <StudentLayoutClient mustResetPassword={student.must_reset_password || false}>
        {children}
      </StudentLayoutClient>
    );
  } catch (error) {
    // If there's any error (network, fetch, etc.), redirect to login
    logError("Error in student layout auth check", error);
    redirect("/student/login");
  }
}
