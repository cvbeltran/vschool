import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";
import {
  getPortfolioArtifactCounts,
  getAttendanceParticipation,
} from "@/lib/insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Teacher: My Engagement Signals
 * Shows portfolio artifacts and attendance for learners in teacher's context
 */
export default async function MyEngagementSignalsPage() {
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

  // Views are already scoped to teacher's context via RLS
  const [portfolioCounts, attendance] = await Promise.all([
    getPortfolioArtifactCounts().catch(() => []),
    getAttendanceParticipation().catch(() => []),
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
          <h1 className="text-2xl font-semibold">My Engagement Signals</h1>
          <p className="text-muted-foreground mt-1">
            Portfolio artifacts and attendance for learners in your context
          </p>
        </div>
      </div>

      {/* Portfolio Artifacts */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Artifact Counts</CardTitle>
          <CardDescription>
            Count of portfolio artifacts per learner in your context
          </CardDescription>
        </CardHeader>
        <CardContent>
          {portfolioCounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No portfolio artifacts found.</p>
              <p className="text-sm mt-2">
                Students can upload portfolio artifacts to showcase their work.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Student Number</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Artifact Count</th>
                  </tr>
                </thead>
                <tbody>
                  {portfolioCounts.map((item) => (
                    <tr key={item.student_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {item.student_first_name} {item.student_last_name}
                      </td>
                      <td className="px-4 py-3">
                        {item.student_number || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{item.artifact_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Attendance Participation */}
      <Card>
        <CardHeader>
          <CardTitle>Attendance Participation</CardTitle>
          <CardDescription>
            Attendance counts per learner showing present, absent, and late counts
          </CardDescription>
        </CardHeader>
        <CardContent>
          {attendance.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No attendance data available.</p>
              <p className="text-sm mt-2">
                Log attendance sessions to track learner participation.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Student</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Student Number</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Total Sessions</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Present</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Absent</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Late</th>
                  </tr>
                </thead>
                <tbody>
                  {attendance.map((item) => (
                    <tr key={item.learner_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {item.student_first_name} {item.student_last_name}
                      </td>
                      <td className="px-4 py-3">
                        {item.student_number || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3 text-right">{item.total_sessions}</td>
                      <td className="px-4 py-3 text-right">{item.present_count}</td>
                      <td className="px-4 py-3 text-right">{item.absent_count}</td>
                      <td className="px-4 py-3 text-right">{item.late_count}</td>
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

