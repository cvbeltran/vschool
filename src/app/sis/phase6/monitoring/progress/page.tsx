"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { normalizeRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase/client";
import {
  getProgressOverview,
  getSyllabusProgress,
  getWeeklyProgress,
  getLearnerProgressSignals,
  type ProgressOverview,
  type SyllabusProgress,
  type WeeklyProgress,
  type LearnerProgressSignal,
} from "@/lib/phase6/monitoring";
import {
  BookOpen,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Clock,
  Users,
  FileText,
  ChevronRight,
  Eye,
  Plus,
  AlertTriangle,
} from "lucide-react";

export default function ProgressMonitoringPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [syllabusProgress, setSyllabusProgress] = useState<SyllabusProgress[]>([]);
  const [selectedSyllabusId, setSelectedSyllabusId] = useState<string | null>(null);
  const [weeklyProgress, setWeeklyProgress] = useState<WeeklyProgress[]>([]);
  const [learnerSignals, setLearnerSignals] = useState<LearnerProgressSignal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      if (!session) {
        setError("No active session");
        setLoading(false);
        return;
      }

      setCurrentUserId(session.user.id);

      // Get user role first
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();
      
      let userRole: "principal" | "admin" | "teacher" = "principal";
      if (profile?.role) {
        const normalizedRole = normalizeRole(profile.role);
        userRole = normalizedRole;
        setRole(normalizedRole);
      }

      try {
        // For teachers, filter by their own teacher_id
        // For admins/principals, show all data (no filter)
        const filters = userRole === "teacher" ? { teacher_id: session.user.id } : undefined;
        
        const [overviewData, syllabusData] = await Promise.all([
          getProgressOverview(filters),
          getSyllabusProgress(filters),
        ]);
        setOverview(overviewData);
        setSyllabusProgress(syllabusData);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching progress overview:", err);
        setError(err.message || "Failed to load progress overview");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  useEffect(() => {
    if (selectedSyllabusId) {
      const fetchWeeklyAndLearnerData = async () => {
        try {
          const [weeklyData, learnerData] = await Promise.all([
            getWeeklyProgress(selectedSyllabusId),
            getLearnerProgressSignals(selectedSyllabusId),
          ]);
          setWeeklyProgress(weeklyData);
          setLearnerSignals(learnerData);
        } catch (err: any) {
          console.error("Error fetching weekly/learner progress:", err);
        }
      };
      fetchWeeklyAndLearnerData();
    }
  }, [selectedSyllabusId]);

  const getStatusColor = (status: "on_track" | "needs_attention" | "off_track") => {
    switch (status) {
      case "on_track":
        return "bg-green-100 text-green-800 border-green-200";
      case "needs_attention":
        return "bg-yellow-100 text-yellow-800 border-yellow-200";
      case "off_track":
        return "bg-red-100 text-red-800 border-red-200";
    }
  };

  const getStatusIcon = (status: "on_track" | "needs_attention" | "off_track") => {
    switch (status) {
      case "on_track":
        return <CheckCircle2 className="h-4 w-4" />;
      case "needs_attention":
        return <AlertCircle className="h-4 w-4" />;
      case "off_track":
        return <AlertTriangle className="h-4 w-4" />;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Progress Monitoring</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Progress Monitoring</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Progress Monitoring helps track teaching continuity and learner coverage. This does NOT grade learners.
          </p>
        </div>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {overview && (
        <>
          {/* Status Tiles */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-5">
            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                document.getElementById("syllabus-progress")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Active Syllabi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <BookOpen className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{overview.active_syllabi_count}</span>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                document.getElementById("syllabus-progress")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Weeks Logged
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Calendar className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{overview.weeks_logged_count}</span>
                  <span className="text-sm text-muted-foreground">
                    / {overview.weeks_planned_count}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                document.getElementById("missing-logs")?.scrollIntoView({ behavior: "smooth" });
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Missing Weeks
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Clock className="h-5 w-5 text-destructive" />
                  <span className="text-2xl font-bold text-destructive">
                    {overview.missing_weeks_count}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                if (selectedSyllabusId) {
                  document.getElementById("learner-signals")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Unverified Learners
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <Users className="h-5 w-5 text-yellow-600" />
                  <span className="text-2xl font-bold text-yellow-600">
                    {overview.learners_with_unverified_objectives_count}
                  </span>
                </div>
              </CardContent>
            </Card>

            <Card
              className="cursor-pointer hover:shadow-md transition-shadow"
              onClick={() => {
                if (selectedSyllabusId) {
                  document.getElementById("weekly-progress")?.scrollIntoView({ behavior: "smooth" });
                }
              }}
            >
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-medium text-muted-foreground">
                  Attendance Gaps
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-orange-600" />
                  <span className="text-2xl font-bold text-orange-600">
                    {overview.sessions_with_attendance_gaps_count}
                  </span>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Syllabus Progress - Grouped by Syllabus */}
          <Card id="syllabus-progress">
            <CardHeader>
              <CardTitle>Syllabus Progress</CardTitle>
            </CardHeader>
            <CardContent>
              {syllabusProgress.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No syllabi found</p>
                </div>
              ) : (
                <div className="space-y-6">
                  {syllabusProgress.map((syllabus) => {
                    const syllabusMissingLogs = overview.missing_logs.filter(
                      (log) => log.syllabus_id === syllabus.syllabus_id
                    );
                    const syllabusOffTrackLogs = overview.off_track_logs.filter(
                      (log) => log.syllabus_name === syllabus.syllabus_name
                    );

                    return (
                      <div key={syllabus.syllabus_id} className="border rounded-lg p-4 space-y-4">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <div className="flex items-center gap-3 mb-2">
                              <h3 className="text-lg font-semibold">{syllabus.syllabus_name}</h3>
                              <Badge
                                variant="outline"
                                className={getStatusColor(syllabus.status)}
                              >
                                <span className="flex items-center gap-1">
                                  {getStatusIcon(syllabus.status)}
                                  {syllabus.status === "on_track"
                                    ? "On Track"
                                    : syllabus.status === "needs_attention"
                                    ? "Needs Attention"
                                    : "Off Track"}
                                </span>
                              </Badge>
                            </div>
                            {syllabus.teacher_name && (
                              <p className="text-sm text-muted-foreground mb-3">
                                Teacher: {syllabus.teacher_name}
                              </p>
                            )}
                            
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                              <div>
                                <span className="text-muted-foreground">Total Planned Weeks:</span>{" "}
                                <span className="font-medium">{syllabus.planned_weeks}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Lesson Logs Completed:</span>{" "}
                                <span className="font-medium">{syllabus.weeks_logged}</span>
                              </div>
                              <div>
                                <span className="text-muted-foreground">Missing Lesson Logs:</span>{" "}
                                {syllabus.missing_weeks > 0 ? (
                                  <span className="font-medium text-destructive">
                                    {syllabus.missing_weeks}
                                  </span>
                                ) : (
                                  <span className="font-medium text-green-600">0</span>
                                )}
                              </div>
                              <div>
                                <span className="text-muted-foreground">Last Logged:</span>{" "}
                                <span className="font-medium">
                                  {syllabus.last_logged_week
                                    ? new Date(syllabus.last_logged_week).toLocaleDateString()
                                    : "Never"}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="flex gap-2 ml-4">
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => router.push(`/sis/phase6/syllabus/${syllabus.syllabus_id}`)}
                            >
                              <Eye className="h-4 w-4 mr-1" />
                              View Syllabus
                            </Button>
                            <Button
                              variant="outline"
                              size="sm"
                              onClick={() => {
                                setSelectedSyllabusId(syllabus.syllabus_id);
                                setTimeout(() => {
                                  document.getElementById("weekly-progress")?.scrollIntoView({ behavior: "smooth" });
                                }, 100);
                              }}
                            >
                              Weekly Progress
                            </Button>
                          </div>
                        </div>

                        {/* Missing Lesson Logs */}
                        {syllabusMissingLogs.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-medium mb-2 text-destructive">Missing Lesson Logs</h4>
                            <div className="space-y-2">
                              {syllabusMissingLogs.map((log, idx) => (
                                <div
                                  key={idx}
                                  className="flex items-center justify-between p-2 bg-red-50 border border-red-200 rounded"
                                >
                                  <div>
                                    <span className="font-medium">Week {log.week_number}</span>
                                    {log.week_start_date && log.week_end_date && (
                                      <span className="text-sm text-muted-foreground ml-2">
                                        ({new Date(log.week_start_date).toLocaleDateString()} -{" "}
                                        {new Date(log.week_end_date).toLocaleDateString()})
                                      </span>
                                    )}
                                    {log.planned_objectives.length > 0 && (
                                      <span className="text-xs text-muted-foreground block mt-1">
                                        {log.planned_objectives.length} planned objectives
                                      </span>
                                    )}
                                  </div>
                                  <Button
                                    size="sm"
                                    onClick={() => {
                                      router.push(
                                        `/sis/phase6/lesson-logs/new?syllabus_id=${log.syllabus_id}&week_number=${log.week_number}`
                                      );
                                    }}
                                  >
                                    <Plus className="h-4 w-4 mr-1" />
                                    Create Missing Lesson Log
                                  </Button>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Off-Track Weeks */}
                        {syllabusOffTrackLogs.length > 0 && (
                          <div className="border-t pt-4">
                            <h4 className="font-medium mb-2 text-yellow-700">Off-Track Weeks</h4>
                            <div className="space-y-2">
                              {syllabusOffTrackLogs.map((log) => (
                                <div
                                  key={log.lesson_log_id}
                                  className="flex items-center justify-between p-2 bg-yellow-50 border border-yellow-200 rounded"
                                >
                                  <div>
                                    <span className="font-medium">
                                      {new Date(log.week_start_date).toLocaleDateString()} -{" "}
                                      {new Date(log.week_end_date).toLocaleDateString()}
                                    </span>
                                    <span className="text-sm text-muted-foreground ml-2">
                                      {log.not_accomplished_count} not accomplished entries
                                    </span>
                                    {log.reflection_id ? (
                                      <Badge variant="outline" className="ml-2 border-blue-500 text-blue-700">
                                        Reflection Added
                                      </Badge>
                                    ) : (
                                      <Badge variant="outline" className="ml-2 border-red-500 text-red-700">
                                        Reflection Needed
                                      </Badge>
                                    )}
                                  </div>
                                  <div className="flex gap-2">
                                    <Button
                                      size="sm"
                                      variant="outline"
                                      onClick={() => {
                                        router.push(`/sis/phase6/lesson-logs/${log.lesson_log_id}`);
                                      }}
                                    >
                                      <Eye className="h-4 w-4 mr-1" />
                                      Review Week
                                    </Button>
                                    {!log.reflection_id && (
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          router.push(
                                            `/sis/phase6/lesson-logs/${log.lesson_log_id}#reflection`
                                          );
                                        }}
                                      >
                                        <Plus className="h-4 w-4 mr-1" />
                                        Add Progress Reflection
                                      </Button>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Weekly Progress Timeline */}
          {selectedSyllabusId && weeklyProgress.length > 0 && (
            <Card id="weekly-progress">
              <CardHeader>
                <CardTitle>
                  Weekly Progress Timeline
                  {syllabusProgress.find((s) => s.syllabus_id === selectedSyllabusId) && (
                    <span className="text-base font-normal text-muted-foreground ml-2">
                      - {syllabusProgress.find((s) => s.syllabus_id === selectedSyllabusId)?.syllabus_name}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {weeklyProgress.map((week) => (
                    <div
                      key={week.week_id}
                      className="border rounded-lg p-4 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1">
                          <div className="flex items-center gap-3 mb-2">
                            <span className="font-semibold">Week {week.week_number}</span>
                            {week.week_start_date && week.week_end_date && (
                              <span className="text-sm text-muted-foreground">
                                {new Date(week.week_start_date).toLocaleDateString()} -{" "}
                                {new Date(week.week_end_date).toLocaleDateString()}
                              </span>
                            )}
                            <Badge
                              variant={
                                week.lesson_log_status === "logged" ? "default" : "destructive"
                              }
                            >
                              {week.lesson_log_status === "logged" ? "Logged" : "Missing"}
                            </Badge>
                          </div>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-3 text-sm">
                            <div>
                              <span className="text-muted-foreground">Objectives:</span>{" "}
                              <span className="font-medium">{week.objectives_planned}</span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Learners Verified:</span>{" "}
                              <span className="font-medium">
                                {week.learners_verified} / {week.learners_total || 0}
                              </span>
                            </div>
                            <div>
                              <span className="text-muted-foreground">Attendance:</span>{" "}
                              <Badge
                                variant="outline"
                                className={
                                  week.attendance_recorded === "yes"
                                    ? "border-green-500 text-green-700"
                                    : week.attendance_recorded === "partial"
                                    ? "border-yellow-500 text-yellow-700"
                                    : "border-red-500 text-red-700"
                                }
                              >
                                {week.attendance_recorded === "yes"
                                  ? "Yes"
                                  : week.attendance_recorded === "partial"
                                  ? "Partial"
                                  : "Missing"}
                              </Badge>
                            </div>
                            {week.reflection_added && (
                              <div>
                                <Badge variant="outline" className="border-blue-500 text-blue-700">
                                  Reflection Added
                                </Badge>
                              </div>
                            )}
                          </div>
                        </div>
                        <div className="flex gap-2 ml-4">
                          {week.lesson_log_status === "missing" ? (
                            <Button
                              size="sm"
                              onClick={() => {
                                router.push(
                                  `/sis/phase6/lesson-logs/new?syllabus_id=${selectedSyllabusId}&week_id=${week.week_id}`
                                );
                              }}
                            >
                              <Plus className="h-4 w-4 mr-1" />
                              Create Log
                            </Button>
                          ) : (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => {
                                  if (week.lesson_log_id) {
                                    router.push(`/sis/phase6/lesson-logs/${week.lesson_log_id}`);
                                  }
                                }}
                              >
                                <Eye className="h-4 w-4 mr-1" />
                                View Log
                              </Button>
                              {week.learners_verified < week.learners_total && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    if (week.lesson_log_id) {
                                      router.push(`/sis/phase6/lesson-logs/${week.lesson_log_id}#verifications`);
                                    }
                                  }}
                                >
                                  Complete Verifications
                                </Button>
                              )}
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Learner Progress Signals */}
          {selectedSyllabusId && learnerSignals.length > 0 && (
            <Card id="learner-signals">
              <CardHeader>
                <CardTitle>
                  Learner Progress Signals
                  {syllabusProgress.find((s) => s.syllabus_id === selectedSyllabusId) && (
                    <span className="text-base font-normal text-muted-foreground ml-2">
                      - {syllabusProgress.find((s) => s.syllabus_id === selectedSyllabusId)?.syllabus_name}
                    </span>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead>
                      <tr className="border-b">
                        <th className="text-left p-2 font-medium">Learner Name</th>
                        <th className="text-left p-2 font-medium">Weeks Participated</th>
                        <th className="text-left p-2 font-medium">Objectives Verified</th>
                        <th className="text-left p-2 font-medium">Pending Verifications</th>
                        <th className="text-left p-2 font-medium">Evidence Linked</th>
                        <th className="text-left p-2 font-medium">Attention Flag</th>
                      </tr>
                    </thead>
                    <tbody>
                      {learnerSignals.map((learner) => (
                        <tr key={learner.learner_id} className="border-b hover:bg-muted/50">
                          <td className="p-2 font-medium">{learner.learner_name}</td>
                          <td className="p-2">{learner.weeks_participated}</td>
                          <td className="p-2">{learner.objectives_verified}</td>
                          <td className="p-2">
                            {learner.pending_verifications > 0 ? (
                              <span className="text-yellow-600 font-medium">
                                {learner.pending_verifications}
                              </span>
                            ) : (
                              <span className="text-muted-foreground">0</span>
                            )}
                          </td>
                          <td className="p-2">
                            {learner.evidence_linked ? (
                              <Badge variant="outline" className="border-green-500 text-green-700">
                                Yes
                              </Badge>
                            ) : (
                              <Badge variant="outline" className="border-red-500 text-red-700">
                                No
                              </Badge>
                            )}
                          </td>
                          <td className="p-2">
                            {learner.attention_flag === "needs_followup" ? (
                              <Badge variant="destructive">Needs Follow-up</Badge>
                            ) : (
                              <Badge variant="outline">Normal</Badge>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CardContent>
            </Card>
          )}

        </>
      )}
    </div>
  );
}
