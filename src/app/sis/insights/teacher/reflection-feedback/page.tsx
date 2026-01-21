import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";
import {
  getReflectionFrequency,
  getFeedbackVolumeByExperience,
  getReflectionFeedbackAlignment,
} from "@/lib/insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Teacher: My Reflection & Feedback
 * Shows reflection frequency, feedback volume, and alignment patterns for current teacher
 */
export default async function MyReflectionFeedbackPage() {
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
  const [reflectionFreq, feedbackVolume, alignment] = await Promise.all([
    getReflectionFrequency({ teacher_id: user.id }).catch(() => []),
    getFeedbackVolumeByExperience().catch(() => []),
    getReflectionFeedbackAlignment().catch(() => []),
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
          <h1 className="text-2xl font-semibold">My Reflection & Feedback</h1>
          <p className="text-muted-foreground mt-1">
            Your reflection frequency, feedback volume, and alignment patterns
          </p>
        </div>
      </div>

      {/* Reflection Frequency */}
      <Card>
        <CardHeader>
          <CardTitle>My Reflection Frequency</CardTitle>
          <CardDescription>
            Your reflection counts by school year and quarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {reflectionFreq.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No reflection data available.</p>
              <p className="text-sm mt-2">
                Complete reflections to track your teaching practice.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">School Year</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Quarter</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Reflection Count</th>
                  </tr>
                </thead>
                <tbody>
                  {reflectionFreq.map((item, idx) => (
                    <tr key={`${item.school_year_id}-${item.quarter}-${idx}`} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        {item.school_year_label || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {item.quarter ? (
                          <Badge variant="outline">{item.quarter}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{item.reflection_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Feedback Volume */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Volume by Experience</CardTitle>
          <CardDescription>
            Student feedback counts grouped by experience type and quarter
          </CardDescription>
        </CardHeader>
        <CardContent>
          {feedbackVolume.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No feedback data available.</p>
              <p className="text-sm mt-2">
                Students can provide feedback on their learning experiences.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Experience</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Quarter</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Feedback Count</th>
                  </tr>
                </thead>
                <tbody>
                  {feedbackVolume.map((item, idx) => (
                    <tr key={`${item.experience_id}-${item.quarter}-${idx}`} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {item.experience_name || <span className="text-muted-foreground">—</span>}
                      </td>
                      <td className="px-4 py-3">
                        {item.experience_type ? (
                          <Badge variant="outline">{item.experience_type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {item.quarter ? (
                          <Badge variant="outline">{item.quarter}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">{item.feedback_count}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Alignment */}
      <Card>
        <CardHeader>
          <CardTitle>Reflection & Feedback Alignment</CardTitle>
          <CardDescription>
            Counts of reflections and feedback linked to the same experiences
          </CardDescription>
        </CardHeader>
        <CardContent>
          {alignment.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No alignment data available.</p>
              <p className="text-sm mt-2">
                When you reflect and students provide feedback on the same experiences, alignment patterns emerge.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Experience</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Reflection Count</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Feedback Count</th>
                  </tr>
                </thead>
                <tbody>
                  {alignment.map((item) => (
                    <tr key={item.experience_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{item.experience_name}</td>
                      <td className="px-4 py-3 text-right">{item.reflection_count}</td>
                      <td className="px-4 py-3 text-right">{item.feedback_count}</td>
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

