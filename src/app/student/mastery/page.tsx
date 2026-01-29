"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentSnapshots, listMasterySnapshots, listEvidenceLinks } from "@/lib/mastery";
import { getMyStudentRow } from "@/lib/student/student-data";
import { Target, Calendar, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase/client";

interface CurrentSnapshot {
  learner_id: string;
  outcome_id: string | null;
  competency_id: string | null;
  mastery_level_label: string;
  mastery_level_display_order: number;
  evidence_count: number;
  last_evidence_at: string | null;
  snapshot_date: string;
  outcome?: {
    id: string;
    name: string;
  };
  competency?: {
    id: string;
    name: string;
  };
}

interface SnapshotWithHistory extends CurrentSnapshot {
  id?: string;
  rationale_text?: string | null;
  evidence_highlights?: Array<{
    type: string;
    id: string;
    title?: string;
  }>;
  history?: Array<{
    snapshot_date: string;
    mastery_level_label: string;
    rationale_text?: string | null;
  }>;
}

export default function StudentMasteryPage() {
  const [snapshots, setSnapshots] = useState<SnapshotWithHistory[]>([]);
  const [loading, setLoading] = useState(true);
  const [studentId, setStudentId] = useState<string | null>(null);
  const [expandedCompetency, setExpandedCompetency] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const student = await getMyStudentRow();
        if (student) {
          setStudentId(student.id);
          
          // Get current snapshots (latest confirmed)
          const currentData = await getCurrentSnapshots(student.organization_id, {
            learnerId: student.id,
          });

          // Get full snapshot history for each competency
          const allSnapshots = await listMasterySnapshots(student.organization_id, {
            learner_id: student.id,
          });

          // Filter to only approved snapshots (confirmed_by != teacher_id, archived_at IS NULL)
          // Students should only see approved/confirmed mastery, not drafts or submitted proposals
          const approvedSnapshots = (currentData || []).filter((snapshot: any) => {
            // Only show snapshots that are approved (confirmed_by != teacher_id)
            // This excludes drafts (archived_at IS NOT NULL) and submitted proposals (confirmed_by = teacher_id)
            return !snapshot.archived_at && snapshot.confirmed_by !== snapshot.teacher_id;
          });

          // Enhance approved snapshots with evidence highlights and history
          const enhancedSnapshots = await Promise.all(
            approvedSnapshots.map(async (snapshot: any) => {
              const competencyId = snapshot.outcome_id || snapshot.competency_id;
              
              // Get evidence highlights
              let evidenceHighlights: any[] = [];
              if (snapshot.id) {
                const links = await listEvidenceLinks(snapshot.id);
                evidenceHighlights = links.map((link) => ({
                  type: link.evidence_type,
                  id: link.observation_id || link.portfolio_artifact_id || link.assessment_id || "",
                }));
              }

              // Get snapshot history (last 5 approved snapshots for this competency)
              const history = allSnapshots
                .filter((s: any) => (s.outcome_id || s.competency_id) === competencyId)
                .filter((s: any) => !s.archived_at && s.confirmed_by !== s.teacher_id) // Only approved snapshots
                .sort((a: any, b: any) => 
                  new Date(b.snapshot_date).getTime() - new Date(a.snapshot_date).getTime()
                )
                .slice(0, 5)
                .map((s: any) => ({
                  snapshot_date: s.snapshot_date,
                  mastery_level_label: s.mastery_level?.label || "Unknown",
                  rationale_text: s.rationale_text,
                }));

              return {
                ...snapshot,
                id: snapshot.id,
                rationale_text: snapshot.rationale_text,
                evidence_highlights: evidenceHighlights,
                history,
              };
            })
          );

          setSnapshots(enhancedSnapshots);
        }
      } catch (error) {
        console.error("Error fetching mastery snapshots", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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
        <h1 className="text-2xl font-semibold">My Mastery</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">My Mastery</h1>
        <p className="text-sm text-muted-foreground mt-1">
          View your current mastery levels by outcome/competency
        </p>
      </div>

      {snapshots.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No mastery snapshots found. Snapshots are generated by your teachers.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshots.map((snapshot) => {
            const competencyId = snapshot.outcome_id || snapshot.competency_id || "";
            const isExpanded = expandedCompetency === competencyId;
            
            return (
              <Card key={competencyId}>
                <CardContent className="pt-6">
                  <div className="space-y-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-2">
                        <Target className="h-5 w-5 text-muted-foreground" />
                        <h3 className="font-semibold">
                          {snapshot.outcome?.name || snapshot.competency?.name || "Unknown"}
                        </h3>
                      </div>
                      <Badge className={getMasteryLevelColor(snapshot.mastery_level_label)}>
                        {snapshot.mastery_level_label}
                      </Badge>
                    </div>
                    
                    {snapshot.rationale_text && (
                      <div className="text-sm p-2 bg-muted rounded-md">
                        <p className="text-muted-foreground">{snapshot.rationale_text}</p>
                      </div>
                    )}

                    <div className="space-y-2 text-sm">
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">Evidence Items:</span>
                        <span className="font-medium">{snapshot.evidence_count}</span>
                      </div>
                      {snapshot.last_evidence_at && (
                        <div className="flex items-center gap-1 text-muted-foreground">
                          <Calendar className="h-3 w-3" />
                          Last evidence: {new Date(snapshot.last_evidence_at).toLocaleDateString()}
                        </div>
                      )}
                      <div className="flex items-center gap-1 text-muted-foreground">
                        <Calendar className="h-3 w-3" />
                        Snapshot: {new Date(snapshot.snapshot_date).toLocaleDateString()}
                      </div>
                    </div>

                    {snapshot.evidence_highlights && snapshot.evidence_highlights.length > 0 && (
                      <div>
                        <div className="flex items-center gap-2 mb-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium">Evidence Highlights</span>
                        </div>
                        <div className="space-y-1">
                          {snapshot.evidence_highlights.slice(0, 3).map((highlight, idx) => (
                            <div key={idx} className="text-xs p-2 bg-muted rounded">
                              {highlight.type}: {highlight.id.substring(0, 8)}...
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {snapshot.history && snapshot.history.length > 1 && (
                      <div>
                        <button
                          onClick={() => setExpandedCompetency(isExpanded ? null : competencyId)}
                          className="text-sm text-muted-foreground hover:text-foreground"
                        >
                          {isExpanded ? "Hide" : "Show"} snapshot history ({snapshot.history.length})
                        </button>
                        {isExpanded && (
                          <div className="mt-2 space-y-2 border-t pt-2">
                            {snapshot.history.map((hist, idx) => (
                              <div key={idx} className="text-xs p-2 bg-muted rounded">
                                <div className="flex items-center justify-between">
                                  <Badge variant="outline" className="text-xs">
                                    {hist.mastery_level_label}
                                  </Badge>
                                  <span className="text-muted-foreground">
                                    {new Date(hist.snapshot_date).toLocaleDateString()}
                                  </span>
                                </div>
                                {hist.rationale_text && (
                                  <p className="mt-1 text-muted-foreground">{hist.rationale_text}</p>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
