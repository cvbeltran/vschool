import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";
import {
  getLessonLogVsPlanned,
  getOffTrackReasons,
  getSyllabusRevisionCounts,
} from "@/lib/insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Admin: Teaching Adaptation Insights
 * Shows lesson logs vs planned, syllabus revisions, and off-track reasons
 */
export default async function TeachingAdaptationPage() {
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

  if (normalizedRole !== "principal" && normalizedRole !== "admin") {
    redirect("/sis");
  }

  const [lessonLogVsPlanned, offTrackReasons, syllabusRevisions] = await Promise.all([
    getLessonLogVsPlanned().catch(() => []),
    getOffTrackReasons().catch(() => []),
    getSyllabusRevisionCounts().catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sis/insights/admin">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Teaching Adaptation</h1>
          <p className="text-muted-foreground mt-1">
            Lesson logs vs planned weeks, syllabus revisions, and off-track reasons
          </p>
        </div>
      </div>

      {/* Lesson Logs vs Planned */}
      <Card>
        <CardHeader>
          <CardTitle>Lesson Logs vs Planned Weeks</CardTitle>
          <CardDescription>
            Comparison of planned syllabus weeks to actual lesson logs created
          </CardDescription>
        </CardHeader>
        <CardContent>
          {lessonLogVsPlanned.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No syllabus data available.</p>
              <p className="text-sm mt-2">
                Create syllabi and lesson logs to see plan vs execution patterns.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Syllabus</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Planned Weeks</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Lesson Logs</th>
                  </tr>
                </thead>
                <tbody>
                  {lessonLogVsPlanned.map((item) => (
                    <tr key={item.syllabus_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{item.syllabus_name}</td>
                      <td className="px-4 py-3 text-right">{item.planned_weeks_count}</td>
                      <td className="px-4 py-3 text-right">{item.lesson_logs_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Syllabus Revisions */}
      <Card>
        <CardHeader>
          <CardTitle>Syllabus Revisions</CardTitle>
          <CardDescription>
            Count of syllabus revisions per teacher
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syllabusRevisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No syllabus revisions found.</p>
              <p className="text-sm mt-2">
                Teachers can revise syllabi to adapt their teaching plans.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Teacher ID</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Revision Count</th>
                  </tr>
                </thead>
                <tbody>
                  {syllabusRevisions.map((item) => (
                    <tr key={item.teacher_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-mono text-sm">{item.teacher_id.slice(0, 8)}...</td>
                      <td className="px-4 py-3 text-right">{item.syllabus_revision_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Off-Track Reasons */}
      <Card>
        <CardHeader>
          <CardTitle>Off-Track Reasons</CardTitle>
          <CardDescription>
            Text-based reasons for off-track progress from teacher reflections
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offTrackReasons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No off-track reasons recorded.</p>
              <p className="text-sm mt-2">
                Teachers can add progress reflections when plans go off-track.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Syllabus</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Reflection Text</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Mentions</th>
                  </tr>
                </thead>
                <tbody>
                  {offTrackReasons.map((item, idx) => (
                    <tr key={`${item.teacher_id}-${item.syllabus_id}-${idx}`} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        {item.syllabus_name || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">{item.reflection_text}</td>
                      <td className="px-4 py-3 text-right">{item.mention_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

