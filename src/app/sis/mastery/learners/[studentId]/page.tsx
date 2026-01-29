"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { listMasterySnapshots, getEvidenceRollupCounts, type LearnerOutcomeMasterySnapshot } from "@/lib/mastery";
import { ArrowLeft, Target, Calendar } from "lucide-react";

export default function LearnerMasteryPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [snapshots, setSnapshots] = useState<LearnerOutcomeMasterySnapshot[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !studentId) return;
      try {
        setLoading(true);
        
        // Fetch student
        const { data: studentData } = await supabase
          .from("students")
          .select("id, first_name, last_name, student_number")
          .eq("id", studentId)
          .single();
        setStudent(studentData);

        // Fetch snapshots
        const snapshotsData = await listMasterySnapshots(organizationId, { learner_id: studentId });
        setSnapshots(snapshotsData || []);
      } catch (error) {
        console.error("Error fetching learner mastery", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, organizationId, orgLoading]);

  // Group snapshots by outcome/competency
  const groupedSnapshots = snapshots.reduce((acc, snapshot) => {
    const key = snapshot.outcome_id || snapshot.competency_id || "unknown";
    if (!acc[key]) {
      acc[key] = {
        outcome: snapshot.outcome || snapshot.competency,
        snapshots: [],
      };
    }
    acc[key].snapshots.push(snapshot);
    // Sort by snapshot_date descending
    acc[key].snapshots.sort((a, b) => 
      new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
    );
    return acc;
  }, {} as Record<string, { outcome: any; snapshots: LearnerOutcomeMasterySnapshot[] }>);

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
        <h1 className="text-2xl font-semibold">Learner Mastery History</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sis/mastery")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Learner Mastery History</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {student
                ? `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unknown Learner"
                : "Unknown Learner"}
            </p>
          </div>
        </div>
      </div>

      {Object.keys(groupedSnapshots).length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No mastery snapshots found for this learner.
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedSnapshots).map(([key, group]) => (
          <Card key={key}>
            <CardContent className="pt-6">
              <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
                <Target className="h-5 w-5" />
                {group.outcome?.name || "Unknown Outcome/Competency"}
              </h2>
              <div className="space-y-3">
                {group.snapshots.map((snapshot) => (
                  <div
                    key={snapshot.id}
                    className="border rounded-lg p-4 hover:bg-muted/50"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <Badge className={getMasteryLevelColor(snapshot.mastery_level?.label || "")}>
                            {snapshot.mastery_level?.label || "Unknown"}
                          </Badge>
                          <span className="text-sm text-muted-foreground">
                            {snapshot.evidence_count} evidence items
                          </span>
                        </div>
                        {snapshot.rationale_text && (
                          <p className="text-sm text-muted-foreground mb-2">
                            {snapshot.rationale_text}
                          </p>
                        )}
                        <div className="flex items-center gap-4 text-xs text-muted-foreground">
                          <div className="flex items-center gap-1">
                            <Calendar className="h-3 w-3" />
                            Snapshot: {new Date(snapshot.snapshot_date).toLocaleDateString()}
                          </div>
                          {snapshot.last_evidence_at && (
                            <div>
                              Last evidence: {new Date(snapshot.last_evidence_at).toLocaleDateString()}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ))
      )}
    </div>
  );
}
