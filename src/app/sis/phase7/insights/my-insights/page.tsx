"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { normalizeRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase/client";
import {
  getTeacherInsights,
  type TeacherInsights,
} from "@/lib/phase7/insights";

export default function MyInsightsPage() {
  const router = useRouter();
  const [insights, setInsights] = useState<TeacherInsights | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "teacher"
  );

  useEffect(() => {
    const fetchData = async () => {
      // Check role - only teachers should access this page
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
          // Allow teachers, admins, and principals to view their own insights
          if (normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "principal") {
            try {
              const data = await getTeacherInsights();
              setInsights(data);
              setError(null);
            } catch (err: any) {
              console.error("Error fetching teacher insights:", err);
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
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Insights</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Insights</h1>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Insights</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Narrative insights about your teaching practice, reflections, and learner engagement.
        </p>
      </div>

      {insights && (
        <>
          {/* Observation Patterns */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Observation Patterns</h2>
            <div className="grid gap-4 md:grid-cols-3">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Competencies Observed</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.observationPatterns.competencyCounts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No observations yet. Start observing learners to see patterns emerge.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.observationPatterns.competencyCounts
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.competency_id} className="text-sm">
                            <p className="font-medium">{item.competency_name}</p>
                            <p className="text-muted-foreground">
                              {item.domain_name} • {item.observation_count} observation{item.observation_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Experience Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.observationPatterns.experienceFrequencies.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No observations by experience type yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.observationPatterns.experienceFrequencies
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.experience_id} className="text-sm">
                            <p className="font-medium">{item.experience_name}</p>
                            <p className="text-muted-foreground">
                              {item.experience_type || "Unspecified"} • {item.observation_count} observation{item.observation_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Indicator Occurrences</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.observationPatterns.indicatorOccurrences.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No indicator occurrences recorded yet.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.observationPatterns.indicatorOccurrences
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.indicator_id} className="text-sm">
                            <p className="font-medium line-clamp-1">{item.indicator_description}</p>
                            <p className="text-muted-foreground">
                              {item.competency_name} • {item.occurrence_count} time{item.occurrence_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>

          {/* Teaching Adaptation */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Teaching Adaptation</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Lesson Logs vs Planned</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.teachingAdaptation.lessonLogVsPlanned.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No syllabi with lesson logs yet. Create syllabi and lesson logs to see how planning compares to execution.
                    </p>
                  ) : (
                    <div className="space-y-3">
                      {insights.teachingAdaptation.lessonLogVsPlanned
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.syllabus_id} className="text-sm border-b pb-2 last:border-0">
                            <p className="font-medium">{item.syllabus_name}</p>
                            <p className="text-muted-foreground">
                              Planned weeks: {item.planned_weeks_count} • Lesson logs created: {item.lesson_logs_count}
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
                  {insights.teachingAdaptation.syllabusRevisions.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No syllabus revisions yet. Revisions show how you adapt your teaching plans.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      <p className="text-sm font-medium">
                        You have revised {insights.teachingAdaptation.syllabusRevisions[0]?.syllabus_revision_count || 0} syllabus{insights.teachingAdaptation.syllabusRevisions[0]?.syllabus_revision_count !== 1 ? "es" : ""}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Revisions reflect your adaptation to learner needs and changing circumstances.
                      </p>
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {insights.teachingAdaptation.offTrackReasons.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Off-Track Reflections</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {insights.teachingAdaptation.offTrackReasons
                      .slice(0, 3)
                      .map((item, idx) => (
                        <div key={idx} className="text-sm border-b pb-2 last:border-0">
                          <p className="font-medium">{item.syllabus_name || "General"}</p>
                          <p className="text-muted-foreground mt-1">{item.reflection_text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            Mentioned {item.mention_count} time{item.mention_count !== 1 ? "s" : ""}
                          </p>
                        </div>
                      ))}
                  </div>
                </CardContent>
              </Card>
            )}
          </div>

          {/* Reflection & Feedback */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Reflection & Feedback</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Reflection Frequency</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.reflectionFeedback.reflectionFrequency.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No completed reflections yet. Regular reflection helps identify patterns and improvements.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.reflectionFeedback.reflectionFrequency
                        .slice(0, 5)
                        .map((item, idx) => (
                          <div key={idx} className="text-sm">
                            <p className="font-medium">
                              {item.school_year_label || "Unspecified"} {item.quarter || ""}
                            </p>
                            <p className="text-muted-foreground">
                              {item.reflection_count} reflection{item.reflection_count !== 1 ? "s" : ""}
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
                  {insights.reflectionFeedback.feedbackVolume.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No student feedback received yet. Feedback provides valuable learner perspectives.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.reflectionFeedback.feedbackVolume
                        .slice(0, 5)
                        .map((item, idx) => (
                          <div key={idx} className="text-sm">
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

            {insights.reflectionFeedback.alignment.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Reflection & Feedback Alignment</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Experiences where both reflections and feedback exist show alignment between your practice and learner perspectives.
                  </p>
                  <div className="space-y-2">
                    {insights.reflectionFeedback.alignment
                      .slice(0, 5)
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

          {/* Engagement Signals */}
          <div>
            <h2 className="text-lg font-semibold mb-4">Engagement Signals</h2>
            <div className="grid gap-4 md:grid-cols-2">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Portfolio Artifacts</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.engagementSignals.portfolioArtifacts.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No portfolio artifacts from learners yet. Artifacts show learner engagement and self-directed learning.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.engagementSignals.portfolioArtifacts
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.student_id} className="text-sm">
                            <p className="font-medium">
                              {item.student_first_name} {item.student_last_name}
                              {item.student_number && ` (${item.student_number})`}
                            </p>
                            <p className="text-muted-foreground">
                              {item.artifact_count} artifact{item.artifact_count !== 1 ? "s" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>

              <Card>
                <CardHeader>
                  <CardTitle className="text-base">Attendance Participation</CardTitle>
                </CardHeader>
                <CardContent>
                  {insights.engagementSignals.attendanceParticipation.length === 0 ? (
                    <p className="text-sm text-muted-foreground">
                      No attendance records yet. Attendance patterns show learner engagement.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {insights.engagementSignals.attendanceParticipation
                        .slice(0, 5)
                        .map((item) => (
                          <div key={item.learner_id} className="text-sm">
                            <p className="font-medium">
                              {item.student_first_name} {item.student_last_name}
                              {item.student_number && ` (${item.student_number})`}
                            </p>
                            <p className="text-muted-foreground">
                              {item.total_sessions} session{item.total_sessions !== 1 ? "s" : ""} • 
                              {" "}{item.present_count} present{item.present_count !== 1 ? "" : ""}, 
                              {" "}{item.absent_count} absent{item.absent_count !== 1 ? "" : ""}, 
                              {" "}{item.late_count} late{item.late_count !== 1 ? "" : ""}
                            </p>
                          </div>
                        ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

            {insights.engagementSignals.experienceParticipation.length > 0 && (
              <Card className="mt-4">
                <CardHeader>
                  <CardTitle className="text-base">Experience Participation Coverage</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-3">
                    Shows how many unique learners participated across observations, attendance, and portfolios for each experience.
                  </p>
                  <div className="space-y-2">
                    {insights.engagementSignals.experienceParticipation
                      .slice(0, 5)
                      .map((item) => (
                        <div key={item.experience_id} className="text-sm border-b pb-2 last:border-0">
                          <p className="font-medium">{item.experience_name}</p>
                          <p className="text-muted-foreground">
                            {item.unique_learners_observed} observed, {item.unique_learners_attended} attended, {item.unique_learners_portfolio} portfolio{item.unique_learners_portfolio !== 1 ? "s" : ""}
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

