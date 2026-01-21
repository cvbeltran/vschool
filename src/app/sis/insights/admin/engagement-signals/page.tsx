import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";
import {
  getPortfolioArtifactCounts,
  getAttendanceParticipation,
  getExperienceParticipation,
} from "@/lib/insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Admin: Engagement Signals Insights
 * Shows portfolio artifacts, attendance participation, and experience coverage
 */
export default async function EngagementSignalsPage() {
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

  const [portfolioCounts, attendance, experienceParticipation] = await Promise.all([
    getPortfolioArtifactCounts().catch(() => []),
    getAttendanceParticipation().catch(() => []),
    getExperienceParticipation().catch(() => []),
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
          <h1 className="text-2xl font-semibold">Engagement Signals</h1>
          <p className="text-muted-foreground mt-1">
            Portfolio artifacts, attendance participation, and experience coverage
          </p>
        </div>
      </div>

      {/* Portfolio Artifacts */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Artifact Counts</CardTitle>
          <CardDescription>
            Count of portfolio artifacts per learner
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

      {/* Experience Participation */}
      <Card>
        <CardHeader>
          <CardTitle>Experience Participation Coverage</CardTitle>
          <CardDescription>
            Counts of unique learners across observations, attendance, and portfolios per experience
          </CardDescription>
        </CardHeader>
        <CardContent>
          {experienceParticipation.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No experience participation data available.</p>
              <p className="text-sm mt-2">
                Link observations, attendance sessions, and portfolio artifacts to experiences to see coverage patterns.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Experience</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Learners Observed</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Learners Attended</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Learners Portfolio</th>
                  </tr>
                </thead>
                <tbody>
                  {experienceParticipation.map((item) => (
                    <tr key={item.experience_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{item.experience_name}</td>
                      <td className="px-4 py-3">
                        {item.experience_type ? (
                          <Badge variant="outline">{item.experience_type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{item.unique_learners_observed}</td>
                      <td className="px-4 py-3 text-right">{item.unique_learners_attended}</td>
                      <td className="px-4 py-3 text-right">{item.unique_learners_portfolio}</td>
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

