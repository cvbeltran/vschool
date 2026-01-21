"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase/client";
import {
  getAdminInsights,
  type AdminInsights,
} from "@/lib/phase7/insights";

export default function InsightsOverviewPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<AdminInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );

  useEffect(() => {
    const fetchData = async () => {
      // Check role - only admins and principals should access this page
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          if (normalizedRole === "teacher") {
            router.push("/sis/phase7/insights/my-insights");
            return;
          }
          if (normalizedRole === "admin" || normalizedRole === "principal") {
            try {
              const data = await getAdminInsights();
              setInsights(data);
              setError(null);
            } catch (err: any) {
              console.error("Error fetching admin insights:", err);
              setError(err.message || "Failed to load insights");
            } finally {
              setLoading(false);
            }
          } else {
            setError("You do not have access to this page");
            setLoading(false);
          }
        } else {
          setError("User role not found");
          setLoading(false);
        }
      } else {
        setError("Please log in to view insights");
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Insights Overview</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Insights Overview</h1>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Insights Overview</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Narrative insights about pedagogy evolution, plan vs execution patterns, and reflection coverage across your organization.
        </p>
      </div>

      {insights && (
        <>
          {/* Pedagogy Evolution */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Pedagogy Evolution</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lesson Logs vs Planned Weeks</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.pedagogyEvolution.lessonLogVsPlanned.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No syllabi with lesson logs yet. This comparison shows how planned weeks relate to actual lesson logs created.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.pedagogyEvolution.lessonLogVsPlanned
                        .slice(0, 10)
                        .map((item) => (
                          <div key={item.syllabus_id} className="text-sm border-b pb-2 last:border-0">
                            <p className="font-medium">{item.syllabus_name}</p>
                            <p className="text-muted-foreground">
                              Planned weeks: {item.planned_weeks_count} • Lesson logs: {item.lesson_logs_count}
                            </p>
                            <p className="text-xs text-muted-foreground mt-1">
                              {item.planned_weeks_count > 0 && item.lesson_logs_count < item.planned_weeks_count
                                ? "Fewer logs than planned weeks - may indicate adaptation or delays"
                                : item.lesson_logs_count > item.planned_weeks_count
                                ? "More logs than planned weeks - may indicate additional sessions or revisions"
                                : "Logs match planned weeks"}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Syllabus Revisions</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.pedagogyEvolution.syllabusRevisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No syllabus revisions yet. Revisions show how teachers adapt their plans based on learner needs.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground mb-3">
                        Total revisions across all teachers: {insights.pedagogyEvolution.syllabusRevisions.reduce((sum, item) => sum + item.syllabus_revision_count, 0)}
                      </p>
                      <div className="space-y-2">
                        {insights.pedagogyEvolution.syllabusRevisions
                          .slice(0, 10)
                          .map((item) => (
                            <div key={item.teacher_id} className="text-sm border-b pb-2 last:border-0">
                              <p className="font-medium">
                                Teacher: {item.teacher_id.slice(0, 8)}...
                              </p>
                              <p className="text-muted-foreground">
                                {item.syllabus_revision_count} revision{item.syllabus_revision_count !== 1 ? "s" : ""}
                              </p>
                            </div>
                          ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Plan vs Execution */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Plan vs Execution Patterns</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Execution Comparison</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.planVsExecution.lessonLogVsPlanned.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No execution data yet. Compare planned weeks to actual lesson logs to see execution patterns.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.planVsExecution.lessonLogVsPlanned
                        .slice(0, 10)
                        .map((item) => (
                          <div key={item.syllabus_id} className="text-sm border-b pb-2 last:border-0">
                            <p className="font-medium">{item.syllabus_name}</p>
                            <p className="text-muted-foreground">
                              Planned: {item.planned_weeks_count} • Executed: {item.lesson_logs_count}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Off-Track Reasons</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.planVsExecution.offTrackReasons.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No off-track reflections yet. When teachers note deviations from plans, their reflections provide context.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.planVsExecution.offTrackReasons
                        .slice(0, 10)
                        .map((item, idx) => (
                          <div key={idx} className="text-sm border-b pb-2 last:border-0">
                            <p className="font-medium">{item.syllabus_name || "General"}</p>
                            <p className="text-muted-foreground mt-1 line-clamp-2">{item.reflection_text}</p>
                            <p className="text-xs text-muted-foreground mt-1">
                              Mentioned {item.mention_count} time{item.mention_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Reflection Coverage */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Reflection Coverage</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reflection Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.reflectionCoverage.reflectionFrequency.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No reflections recorded yet. Regular reflection supports continuous improvement.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.reflectionCoverage.reflectionFrequency
                        .slice(0, 10)
                        .map((item, idx) => (
                          <div key={idx} className="text-sm border-b pb-2 last:border-0">
                            <p className="font-medium">
                              {item.school_year_label || "Unspecified"} {item.quarter || ""}
                            </p>
                            <p className="text-muted-foreground">
                              Teacher: {item.teacher_id.slice(0, 8)}... • {item.reflection_count} reflection{item.reflection_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Student Feedback Volume</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.reflectionCoverage.feedbackVolume.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No student feedback received yet. Feedback provides learner perspectives on experiences.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.reflectionCoverage.feedbackVolume
                        .slice(0, 10)
                        .map((item, idx) => (
                          <div key={idx} className="text-sm border-b pb-2 last:border-0">
                            <p className="font-medium">{item.experience_name || "General"}</p>
                            <p className="text-muted-foreground">
                              {item.quarter} • {item.feedback_count} feedback{item.feedback_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {insights.reflectionCoverage.alignment.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Reflection & Feedback Alignment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Experiences with both teacher reflections and student feedback show alignment between practice and learner perspectives.
                  </p>
                  <div className="space-y-2">
                    {insights.reflectionCoverage.alignment
                      .slice(0, 10)
                      .map((item) => (
                        <div key={item.experience_id} className="text-sm border-b pb-2 last:border-0">
                          <p className="font-medium">{item.experience_name}</p>
                          <p className="text-muted-foreground">
                            {item.reflection_count} reflection{item.reflection_count !== 1 ? "s" : ""} • {item.feedback_count} feedback{item.feedback_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </>
      )}
    </div>
  );
}

