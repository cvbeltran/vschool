import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";
import {
  getLessonLogVsPlanned,
  getOffTrackReasons,
  getSyllabusRevisionCounts,
} from "@/lib/insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Teacher: My Teaching Adaptation
 * Shows lesson logs vs planned, syllabus revisions, and off-track reasons for current teacher
 */
export default async function MyTeachingAdaptationPage() {
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

  // Filter by current teacher
  const [lessonLogVsPlanned, offTrackReasons, syllabusRevisions] = await Promise.all([
    getLessonLogVsPlanned({ teacher_id: user.id }).catch(() => []),
    getOffTrackReasons({ teacher_id: user.id }).catch(() => []),
    getSyllabusRevisionCounts({ teacher_id: user.id }).catch(() => []),
  ]);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sis/insights/teacher">
          <Button variant="ghost" size="icon">
            <ArrowLeft className="h-4 w-4" />
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">My Teaching Adaptation</h1>
          <p className="text-muted-foreground mt-1">
            Your lesson logs vs planned weeks, syllabus revisions, and off-track reasons
          </p>
        </div>
      </div>

      {/* Lesson Logs vs Planned */}
      <Card>
        <CardHeader>
          <CardTitle>My Lesson Logs vs Planned Weeks</CardTitle>
          <CardDescription>
            Comparison of planned syllabus weeks to your actual lesson logs
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
          <CardTitle>My Syllabus Revisions</CardTitle>
          <CardDescription>
            Count of your syllabus revisions
          </CardDescription>
        </CardHeader>
        <CardContent>
          {syllabusRevisions.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No syllabus revisions found.</p>
              <p className="text-sm mt-2">
                Revise syllabi to adapt your teaching plans as needed.
              </p>
            </div>
          ) : (
            <div className="text-center py-8">
              <div className="text-3xl font-semibold">{syllabusRevisions[0]?.syllabus_revision_count || 0}</div>
              <p className="text-sm text-muted-foreground mt-2">Total revisions</p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Off-Track Reasons */}
      <Card>
        <CardHeader>
          <CardTitle>My Off-Track Reasons</CardTitle>
          <CardDescription>
            Your reflections on why plans went off-track
          </CardDescription>
        </CardHeader>
        <CardContent>
          {offTrackReasons.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No off-track reasons recorded.</p>
              <p className="text-sm mt-2">
                Add progress reflections when plans go off-track to document adaptation patterns.
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
                    <tr key={`${item.syllabus_id}-${idx}`} className="border-b hover:bg-muted/50">
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

