"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { getSnapshotRun, listMasterySnapshots, type MasterySnapshotRun, type LearnerOutcomeMasterySnapshot } from "@/lib/mastery";
import { ArrowLeft, Calendar, User, Target } from "lucide-react";

export default function SnapshotRunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const runId = params.id as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [run, setRun] = useState<MasterySnapshotRun | null>(null);
  const [snapshots, setSnapshots] = useState<LearnerOutcomeMasterySnapshot[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !runId) return;
      try {
        setLoading(true);
        const [runData, snapshotsData] = await Promise.all([
          getSnapshotRun(runId),
          listMasterySnapshots(organizationId, { snapshot_run_id: runId }),
        ]);
        setRun(runData);
        setSnapshots(snapshotsData || []);
      } catch (error) {
        console.error("Error fetching snapshot run", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [runId, organizationId, orgLoading]);

  const getMasteryLevelColor = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes("mastered") || lower.includes("proficient")) {
      return "bg-green-100 text-green-800";
    }
    if (lower.includes("developing")) {
      return "bg-blue-100 text-blue-800";
    }
    if (lower.includes("emerging")) {
      return "bg-yellow-100 text-yellow-800";
    }
    if (lower.includes("not_started")) {
      return "bg-gray-100 text-gray-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Snapshot Run Details</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Snapshot Run Details</h1>
        <div className="text-muted-foreground text-sm">Snapshot run not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sis/mastery/runs")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Snapshot Run Details</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {run.scope_type} snapshot from {new Date(run.snapshot_date).toLocaleDateString()}
            </p>
          </div>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Scope Type</div>
              <div className="font-medium">
                <Badge variant="outline">{run.scope_type}</Badge>
              </div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">School Year</div>
              <div className="font-medium">{run.school_year?.year_label || "N/A"}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Snapshot Count</div>
              <div className="font-medium">{run.snapshot_count}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Created</div>
              <div className="font-medium">
                {new Date(run.created_at).toLocaleDateString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <h2 className="text-lg font-semibold mb-4">Snapshots ({snapshots.length})</h2>
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No snapshots found in this run.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Learner</th>
                    <th className="text-left p-2">Outcome/Competency</th>
                    <th className="text-left p-2">Mastery Level</th>
                    <th className="text-left p-2">Evidence Count</th>
                    <th className="text-left p-2">Rationale</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr
                      key={snapshot.id}
                      className="border-b hover:bg-muted/50 cursor-pointer"
                      onClick={() => router.push(`/sis/mastery/learners/${snapshot.learner_id}`)}
                    >
                      <td className="p-2">
                        {snapshot.learner
                          ? `${snapshot.learner.first_name || ""} ${snapshot.learner.last_name || ""}`.trim() || "Unknown"
                          : "Unknown"}
                      </td>
                      <td className="p-2">
                        {snapshot.outcome?.name || snapshot.competency?.name || "Unknown"}
                      </td>
                      <td className="p-2">
                        <Badge className={getMasteryLevelColor(snapshot.mastery_level?.label || "")}>
                          {snapshot.mastery_level?.label || "Unknown"}
                        </Badge>
                      </td>
                      <td className="p-2">{snapshot.evidence_count}</td>
                      <td className="p-2 text-sm text-muted-foreground">
                        {snapshot.rationale_text || "N/A"}
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
