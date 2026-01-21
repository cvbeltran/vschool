import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";

/**
 * Role-based landing page for Insights
 * Redirects users to appropriate insights page based on role
 */
export default async function InsightsLandingPage() {
  const supabase = await createSupabaseServerClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect("/sis/auth/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  if (!profile?.role) {
    redirect("/sis");
  }

  const normalizedRole = normalizeRole(profile.role);

  // Redirect based on role
  if (normalizedRole === "principal" || normalizedRole === "admin") {
    redirect("/sis/insights/admin");
  } else if (normalizedRole === "teacher") {
    redirect("/sis/insights/teacher");
  } else {
    // Student/guardian - no access
    redirect("/sis");
  }
}

