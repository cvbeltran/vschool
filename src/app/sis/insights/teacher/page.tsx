import { redirect } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  BarChart3,
  BookOpen,
  MessageSquare,
  Users,
  ArrowRight,
} from "lucide-react";

/**
 * Teacher Insights Landing Page
 * Shows overview cards linking to different insight sections
 */
export default async function TeacherInsightsPage() {
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

  // Allow teachers, principals, and admins (they can see their own personal insights)
  if (normalizedRole !== "teacher" && normalizedRole !== "principal" && normalizedRole !== "admin") {
    redirect("/sis");
  }

  const insightSections = [
    {
      title: "My Observation Patterns",
      description: "View your observation patterns by competency, indicator, and experience",
      href: "/sis/insights/teacher/observation-patterns",
      icon: BarChart3,
    },
    {
      title: "My Teaching Adaptation",
      description: "Analyze your lesson logs vs planned weeks, syllabus revisions, and off-track reasons",
      href: "/sis/insights/teacher/teaching-adaptation",
      icon: BookOpen,
    },
    {
      title: "My Reflection & Feedback",
      description: "Explore your reflection frequency, feedback volume, and alignment patterns",
      href: "/sis/insights/teacher/reflection-feedback",
      icon: MessageSquare,
    },
    {
      title: "My Engagement Signals",
      description: "Review portfolio artifacts and attendance for learners in your context",
      href: "/sis/insights/teacher/engagement-signals",
      icon: Users,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Insights</h1>
        <p className="text-muted-foreground mt-1">
          Narrative insights about your teaching practice, reflections, and learner engagement
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        {insightSections.map((section) => (
          <Card key={section.href} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex items-center gap-3">
                <section.icon className="h-6 w-6 text-primary" />
                <CardTitle>{section.title}</CardTitle>
              </div>
              <CardDescription>{section.description}</CardDescription>
            </CardHeader>
            <CardContent>
              <Link href={section.href}>
                <Button variant="outline" className="w-full">
                  View Insights
                  <ArrowRight className="ml-2 h-4 w-4" />
                </Button>
              </Link>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}

