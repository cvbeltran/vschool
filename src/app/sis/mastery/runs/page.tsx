"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { type MasterySnapshotRun } from "@/lib/mastery";
import { ExternalLink, Calendar, User } from "lucide-react";

export default function SnapshotRunsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [runs, setRuns] = useState<MasterySnapshotRun[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRuns = async () => {
      if (orgLoading) return;
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        console.log("[SnapshotRunsPage] Fetching runs with:", {
          organizationId,
          isSuperAdmin,
        });

        const response = await fetch("/api/mastery/runs", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          console.error("[SnapshotRunsPage] API error:", error);
          throw new Error(error.error || "Failed to fetch snapshot runs");
        }

        const { runs: data } = await response.json();
        console.log("[SnapshotRunsPage] Received runs:", {
          count: data?.length || 0,
          runs: data,
        });
        setRuns(data || []);
      } catch (error) {
        console.error("[SnapshotRunsPage] Error fetching snapshot runs", error);
      } finally {
        setLoading(false);
      }
    };

    fetchRuns();
  }, [organizationId, orgLoading, isSuperAdmin]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Snapshot Runs</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Snapshot Runs</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View all mastery snapshot generation runs
          </p>
        </div>
        <Button onClick={() => router.push("/sis/mastery")} variant="outline">
          Back to Dashboard
        </Button>
      </div>

      <Card>
        <CardContent className="pt-6">
          {runs.length === 0 ? (
            <div className="text-center py-8 space-y-2">
              <div className="text-muted-foreground">
                No snapshot runs found. Generate a snapshot from the dashboard to get started.
              </div>
              {organizationId && (
                <div className="text-xs text-muted-foreground mt-4 p-3 bg-muted rounded">
                  <div>Current Organization ID: {organizationId}</div>
                  <div className="mt-1">
                    If you have snapshot runs in the database but they're not showing, they may belong to a different organization.
                  </div>
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => (
                <div
                  key={run.id}
                  className="border rounded-lg p-4 hover:bg-muted/50 cursor-pointer"
                  onClick={() => router.push(`/sis/mastery/runs/${run.id}`)}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{run.scope_type}</Badge>
                        <span className="text-sm text-muted-foreground">
                          {run.school_year?.year_label || "No year"}
                        </span>
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(run.snapshot_date).toLocaleDateString()}
                        </div>
                        <div className="flex items-center gap-1">
                          <span>{run.snapshot_count} snapshots</span>
                        </div>
                        {run.created_by_profile && (
                          <div className="flex items-center gap-1">
                            <User className="h-4 w-4" />
                            User {run.created_by_profile.id.slice(0, 8)}
                          </div>
                        )}
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <ExternalLink className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
