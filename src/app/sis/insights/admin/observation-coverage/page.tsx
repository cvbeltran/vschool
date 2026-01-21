import { redirect } from "next/navigation";
import { createSupabaseServerClient } from "@/lib/supabase/server-client";
import { normalizeRole } from "@/lib/rbac";
import {
  getObservationCompetencyCounts,
  getObservationExperienceFrequency,
  getIndicatorOccurrenceCounts,
} from "@/lib/insights";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";

/**
 * Admin: Observation Coverage Insights
 * Shows observation patterns by competency, indicator, and experience
 */
export default async function ObservationCoveragePage() {
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

  // Fetch all insight data
  const [competencyCounts, experienceFrequency, indicatorCounts] = await Promise.all([
    getObservationCompetencyCounts().catch(() => []),
    getObservationExperienceFrequency().catch(() => []),
    getIndicatorOccurrenceCounts().catch(() => []),
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
          <h1 className="text-2xl font-semibold">Observation Coverage</h1>
          <p className="text-muted-foreground mt-1">
            Observation patterns across competencies, indicators, and experiences
          </p>
        </div>
      </div>

      {/* Competency Counts */}
      <Card>
        <CardHeader>
          <CardTitle>Observations by Competency</CardTitle>
          <CardDescription>
            Count of observations grouped by competency and domain
          </CardDescription>
        </CardHeader>
        <CardContent>
          {competencyCounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No observation data available.</p>
              <p className="text-sm mt-2">
                Create observations to see competency coverage patterns.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Domain</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Competency</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Observation Count</th>
                  </tr>
                </thead>
                <tbody>
                  {competencyCounts.map((item) => (
                    <tr key={`${item.competency_id}-${item.domain_name}`} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Badge variant="outline">{item.domain_name}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.competency_name}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.observation_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Experience Frequency */}
      <Card>
        <CardHeader>
          <CardTitle>Observations by Experience</CardTitle>
          <CardDescription>
            Observation frequency grouped by experience type
          </CardDescription>
        </CardHeader>
        <CardContent>
          {experienceFrequency.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No observation data available.</p>
              <p className="text-sm mt-2">
                Create observations linked to experiences to see frequency patterns.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Experience</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Observation Count</th>
                  </tr>
                </thead>
                <tbody>
                  {experienceFrequency.map((item) => (
                    <tr key={item.experience_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">
                        {item.experience_name}
                      </td>
                      <td className="px-4 py-3">
                        {item.experience_type ? (
                          <Badge variant="outline">{item.experience_type}</Badge>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.observation_count}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Indicator Occurrence */}
      <Card>
        <CardHeader>
          <CardTitle>Indicator Occurrence</CardTitle>
          <CardDescription>
            How often each indicator appears in observations
          </CardDescription>
        </CardHeader>
        <CardContent>
          {indicatorCounts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p>No indicator data available.</p>
              <p className="text-sm mt-2">
                Add indicators to observations to see occurrence patterns.
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Competency</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Indicator</th>
                    <th className="px-4 py-3 text-right text-sm font-medium">Occurrence Count</th>
                  </tr>
                </thead>
                <tbody>
                  {indicatorCounts.map((item) => (
                    <tr key={item.indicator_id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3">
                        <Badge variant="outline">{item.competency_name}</Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {item.indicator_description}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {item.occurrence_count}
                      </td>
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

