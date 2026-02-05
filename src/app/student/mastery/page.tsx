"use client";

import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getCurrentSnapshots, listMasterySnapshots, listEvidenceLinks } from "@/lib/mastery";
import { getMyStudentRow } from "@/lib/student/student-data";
import { Target, Calendar, FileText } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { MasteryRadarChart, type RadarChartDataPoint } from "@/components/mastery/mastery-radar-chart";
import { logError, logDebug } from "@/lib/logger";

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
          
          // Query snapshots directly from table (like admin side does with the view)
          // This avoids RLS issues with complex joins
          const { data: rawSnapshots, error: snapshotsError } = await supabase
            .from("learner_outcome_mastery_snapshots")
            .select("*")
            .eq("learner_id", student.id)
            .is("archived_at", null)
            .not("confirmed_at", "is", null)
            .order("snapshot_date", { ascending: false })
            .order("created_at", { ascending: false });

          if (snapshotsError) {
            logError("[StudentMastery] Error fetching snapshots", snapshotsError, { studentId: student.id });
            throw snapshotsError;
          }

          const approvedSnapshots = rawSnapshots || [];

          logDebug("[StudentMastery] Fetched raw snapshots", {
            total: approvedSnapshots.length,
            sample: approvedSnapshots[0],
            mastery_level_ids: approvedSnapshots.map((s: any) => s.mastery_level_id).filter(Boolean),
            competency_ids: approvedSnapshots.map((s: any) => s.competency_id || s.outcome_id).filter(Boolean),
          });

          // Extract competency IDs for fetching (in case joins didn't work due to RLS)
          const competencyIds = new Set<string>();
          const masteryLevelIds = new Set<string>();
          approvedSnapshots.forEach((s: any) => {
            if (s.competency_id) competencyIds.add(s.competency_id);
            if (s.outcome_id) competencyIds.add(s.outcome_id);
            if (s.mastery_level_id) masteryLevelIds.add(s.mastery_level_id);
          });

          // Fetch competencies
          const competenciesMap = new Map<string, any>();
          if (competencyIds.size > 0) {
            const competencyIdsArray = Array.from(competencyIds);
            logDebug("[StudentMastery] Fetching competencies", { competencyIdsArray });
            
            const { data: competencies, error: compError } = await supabase
              .from("competencies")
              .select("id, name, domain_id")
              .in("id", competencyIdsArray);

            if (compError) {
              logError("[StudentMastery] Error fetching competencies", compError, { competencyIdsArray });
            } else {
              logDebug("[StudentMastery] Fetched competencies", { count: competencies?.length });
              if (competencies) {
                competencies.forEach((c: any) => {
                  competenciesMap.set(c.id, c);
                });
              }
            }
          }

          // Fetch mastery levels - CRITICAL: This must succeed for the page to work
          const masteryLevelsMap = new Map<string, any>();
          if (masteryLevelIds.size > 0) {
            const masteryLevelIdsArray = Array.from(masteryLevelIds);
            logDebug("[StudentMastery] Fetching mastery levels", {
              count: masteryLevelIdsArray.length,
              ids: masteryLevelIdsArray,
            });
            
            const { data: levels, error: levelsError } = await supabase
              .from("mastery_levels")
              .select("id, label, description, display_order, is_terminal")
              .in("id", masteryLevelIdsArray);

            if (levelsError) {
              logError("[StudentMastery] CRITICAL ERROR fetching mastery levels", levelsError, {
                requested_ids: masteryLevelIdsArray,
              });
              // Try fetching one by one as fallback
              logDebug("[StudentMastery] Attempting to fetch mastery levels one by one as fallback");
              for (const levelId of masteryLevelIdsArray) {
                const { data: singleLevel, error: singleError } = await supabase
                  .from("mastery_levels")
                  .select("id, label, description, display_order, is_terminal")
                  .eq("id", levelId)
                  .single();
                
                if (singleError) {
                  logError(`[StudentMastery] Error fetching mastery level ${levelId}`, singleError);
                } else if (singleLevel) {
                  masteryLevelsMap.set(singleLevel.id, singleLevel);
                }
              }
            } else {
              if (levels && levels.length > 0) {
                levels.forEach((l: any) => {
                  if (l.id) {
                    masteryLevelsMap.set(l.id, l);
                  }
                });
                logDebug(`[StudentMastery] Mastery levels map populated`, {
                  map_size: masteryLevelsMap.size,
                });
              } else {
                logError("[StudentMastery] CRITICAL: No mastery levels returned from query", undefined, {
                  requested_ids: masteryLevelIdsArray,
                });
                // Try fetching one by one as fallback
                logDebug("[StudentMastery] Attempting to fetch mastery levels one by one as fallback");
                for (const levelId of masteryLevelIdsArray) {
                  const { data: singleLevel, error: singleError } = await supabase
                    .from("mastery_levels")
                    .select("id, label, description, display_order, is_terminal")
                    .eq("id", levelId)
                    .single();
                  
                  if (singleError) {
                    logError(`[StudentMastery] Error fetching mastery level ${levelId}`, singleError);
                  } else if (singleLevel) {
                    masteryLevelsMap.set(singleLevel.id, singleLevel);
                  }
                }
              }
            }
          } else {
            logError("[StudentMastery] CRITICAL: No mastery level IDs found in snapshots", undefined, {
              snapshot_count: approvedSnapshots.length,
            });
          }

          // Fetch snapshot runs
          const snapshotRunIds = new Set<string>();
          approvedSnapshots.forEach((s: any) => {
            if (s.snapshot_run_id) snapshotRunIds.add(s.snapshot_run_id);
          });

          const snapshotRunsMap = new Map<string, any>();
          if (snapshotRunIds.size > 0) {
            const { data: runs, error: runsError } = await supabase
              .from("mastery_snapshot_runs")
              .select("id, scope_type, scope_id, snapshot_date, term, quarter")
              .in("id", Array.from(snapshotRunIds));

            if (!runsError && runs) {
              runs.forEach((r: any) => {
                snapshotRunsMap.set(r.id, r);
              });
            }
          }

          // Enrich snapshots with fetched data
          // listMasterySnapshots includes joins, but they may fail for students due to RLS
          // So we prioritize our separately fetched data which we know works
          const enrichedSnapshots = approvedSnapshots.map((snapshot: any) => {
            // Prioritize separately fetched data (which we know works) over joined data
            // Joined data might be null due to RLS restrictions
            const competency = (snapshot.competency_id ? competenciesMap.get(snapshot.competency_id) : null) || snapshot.competency || null;
            const outcome = (snapshot.outcome_id ? competenciesMap.get(snapshot.outcome_id) : null) || snapshot.outcome || null;
            // Get mastery level from map (we fetched it separately, so it should be there)
            const masteryLevel = snapshot.mastery_level_id ? masteryLevelsMap.get(snapshot.mastery_level_id) : null;
            
            // Debug: Check if map lookup worked
            if (snapshot.mastery_level_id && !masteryLevel) {
              logError(`[StudentMastery] CRITICAL: Mastery level ${snapshot.mastery_level_id} not found in map`, undefined, {
                map_size: masteryLevelsMap.size,
                requested_id: snapshot.mastery_level_id,
              });
            }
            const snapshotRun = (snapshot.snapshot_run_id ? snapshotRunsMap.get(snapshot.snapshot_run_id) : null) || snapshot.snapshot_run || null;

            // CRITICAL: Always use mastery level from our map if available
            // The map has complete data with label and display_order
            // Joined data might be missing these properties even if the object exists
            const masteryLabel = masteryLevel?.label || null;
            const masteryDisplayOrder = masteryLevel?.display_order ?? null;
            
            // If we still don't have data, try joined data as last resort
            const finalMasteryLabel = masteryLabel || snapshot.mastery_level?.label || null;
            const finalMasteryDisplayOrder = masteryDisplayOrder ?? snapshot.mastery_level?.display_order ?? null;
            
            logDebug("[StudentMastery] Enriching snapshot", {
              id: snapshot.id,
              competency_id: snapshot.competency_id,
              outcome_id: snapshot.outcome_id,
              mastery_level_id: snapshot.mastery_level_id,
              competency_found: !!competency,
              outcome_found: !!outcome,
              mastery_level_found: !!masteryLevel,
            });

            return {
              ...snapshot,
              competency: competency || undefined,
              outcome: outcome || undefined,
              mastery_level: masteryLevel || undefined,
              mastery_level_label: finalMasteryLabel,
              mastery_level_display_order: finalMasteryDisplayOrder,
              snapshot_run: snapshotRun || undefined,
            };
          });

          const allSnapshots = enrichedSnapshots;

          logDebug("[StudentMastery] Enriched snapshots", {
            count: enrichedSnapshots.length,
            sample_competency: enrichedSnapshots[0]?.competency?.name,
            sample_mastery_level: enrichedSnapshots[0]?.mastery_level?.label,
          });

          // Enhance enriched snapshots with evidence highlights and history
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

              const competencyName = snapshot.competency?.name || snapshot.outcome?.name || "Unknown Competency";

              // Preserve all enriched data including mastery level info
              return {
                ...snapshot,
                id: snapshot.id,
                rationale_text: snapshot.rationale_text,
                evidence_highlights: evidenceHighlights,
                history,
              };
            })
          );

          logDebug("[StudentMastery] Found snapshots", {
            total: allSnapshots?.length || 0,
            approved: approvedSnapshots.length,
            enhanced: enhancedSnapshots.length,
          });
          setSnapshots(enhancedSnapshots);
        }
      } catch (error) {
        logError("Error fetching mastery snapshots", error);
        setSnapshots([]);
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
        <>
          {/* Radar Chart - Visual Overview */}
          {(() => {
            // Group snapshots by competency and get the latest one per competency
            // This creates ONE radar chart showing current mastery state
            const competencyMap = new Map<string, SnapshotWithHistory>();
            
            snapshots.forEach((snapshot) => {
              const competencyId = snapshot.outcome_id || snapshot.competency_id;
              if (!competencyId) return;
              
              const label = snapshot.mastery_level_label || snapshot.mastery_level?.label;
              const displayOrder = snapshot.mastery_level_display_order ?? snapshot.mastery_level?.display_order ?? null;
              
              // Only include snapshots with valid mastery level data
              if (!label || displayOrder === null || displayOrder === undefined) {
                return;
              }
              
              // Get existing snapshot for this competency
              const existing = competencyMap.get(competencyId);
              
              // If no existing snapshot, or this one is newer, use this one
              if (!existing || !existing.snapshot_date || 
                  (snapshot.snapshot_date && new Date(snapshot.snapshot_date) > new Date(existing.snapshot_date))) {
                competencyMap.set(competencyId, snapshot);
              }
            });
            
            // Transform to radar chart format (one point per competency - latest snapshot)
            const radarData: RadarChartDataPoint[] = Array.from(competencyMap.values())
              .map((snapshot) => {
                const competencyName = snapshot.outcome?.name || snapshot.competency?.name || "Unknown Competency";
                const masteryLabel = snapshot.mastery_level_label || snapshot.mastery_level?.label || "Unknown";
                const displayOrder = snapshot.mastery_level_display_order ?? snapshot.mastery_level?.display_order ?? null;
                
                return {
                  competency_id: snapshot.outcome_id || snapshot.competency_id || "",
                  competency_name: competencyName,
                  mastery_level_order: displayOrder!,
                  mastery_level_label: masteryLabel,
                };
              });
            
            logDebug("[StudentMastery] Radar chart data (latest per competency)", {
              total_competencies: radarData.length,
              data: radarData,
            });

            logDebug("[StudentMastery] Radar chart data", {
              count: radarData.length,
              data: radarData,
            });

            return radarData.length > 0 ? (
              <MasteryRadarChart data={radarData} />
            ) : (
              <Card>
                <CardContent className="pt-6">
                  <div className="text-center py-8 text-muted-foreground">
                    No valid mastery data available for radar chart.
                    <br />
                    <span className="text-xs">
                      Radar chart requires mastery levels with display_order values.
                    </span>
                  </div>
                </CardContent>
              </Card>
            );
          })()}

          {/* Detailed Competency List */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {snapshots.map((snapshot, index) => {
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
