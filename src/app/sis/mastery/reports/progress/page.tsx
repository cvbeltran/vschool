"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { type StudentProgressReportData, type MasterySnapshotRun } from "@/lib/mastery";
import { Printer, Download, ArrowLeft, Calendar, User, Search } from "lucide-react";
import { MasteryRadarChart, type RadarChartDataPoint } from "@/components/mastery/mastery-radar-chart";

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
}

export default function StudentProgressReportPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const studentId = searchParams.get("student_id");
  const snapshotRunId = searchParams.get("snapshot_run_id");
  
  // Force re-render when search params change by using a key
  const reportKey = `${studentId}-${snapshotRunId}`;

  const [report, setReport] = useState<StudentProgressReportData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [students, setStudents] = useState<Student[]>([]);
  const [snapshotRuns, setSnapshotRuns] = useState<MasterySnapshotRun[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSnapshotRunId, setSelectedSnapshotRunId] = useState<string>("");
  const [showSelection, setShowSelection] = useState(false);
  const [loadingSelection, setLoadingSelection] = useState(false);

  // Fetch students and snapshot runs for selection
  useEffect(() => {
    const fetchSelectionData = async () => {
      if (orgLoading) return;
      
      setLoadingSelection(true);
      setError(null);
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error("No session found");
          setError("Not authenticated. Please log in again.");
          setLoadingSelection(false);
          return;
        }

        // Fetch students
        if (organizationId) {
          const { data: studentsData, error: studentsError } = await supabase
            .from("students")
            .select("id, first_name, last_name, student_number")
            .eq("organization_id", organizationId)
            .order("first_name");
          
          if (studentsError) {
            console.error("Error fetching students:", studentsError);
            setError(`Failed to load students: ${studentsError.message}`);
          } else if (studentsData) {
            setStudents(studentsData);
            console.log(`Loaded ${studentsData.length} students`);
          }
        } else {
          console.warn("Organization ID not available");
        }

        // Fetch snapshot runs
        console.log("Fetching snapshot runs from /api/mastery/runs");
        const response = await fetch("/api/mastery/runs", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        console.log("Snapshot runs response status:", response.status);

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          console.error("Error fetching snapshot runs:", errorData);
          setError(`Failed to load snapshot runs: ${errorData.error || "Unknown error"}`);
        } else {
          const data = await response.json();
          console.log("Snapshot runs response data:", data);
          const runs = data.runs || data || [];
          console.log(`Fetched ${runs.length} snapshot runs:`, runs);
          setSnapshotRuns(runs);
          if (runs.length === 0) {
            setError("No snapshot runs found. Please create a snapshot run from the Mastery Dashboard first.");
          } else {
            setError(null); // Clear any previous errors
          }
        }
      } catch (err) {
        console.error("Error fetching selection data", err);
        setError(err instanceof Error ? err.message : "Failed to load selection data");
      } finally {
        setLoadingSelection(false);
      }
    };

    if (!studentId || !snapshotRunId) {
      setShowSelection(true);
      setLoading(false); // Don't show loading spinner for selection form
      setReport(null); // Clear any previous report
      setError(null); // Clear any previous errors
      fetchSelectionData();
    } else {
      setShowSelection(false); // Hide selection form when params are present
    }
  }, [organizationId, orgLoading, studentId, snapshotRunId]);

  useEffect(() => {
    const fetchReport = async () => {
      if (!studentId || !snapshotRunId) {
        setLoading(false);
        setReport(null);
        setError(null);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        setReport(null); // Clear previous report while loading
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        console.log("[ProgressReport] Fetching report for:", { studentId, snapshotRunId });

        const response = await fetch(
          `/api/mastery/reports/progress?student_id=${studentId}&snapshot_run_id=${snapshotRunId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch report");
        }

        const data = await response.json();
        console.log("[ProgressReport] Received report data:", {
          hasStudent: !!data.student,
          hasSnapshotRun: !!data.snapshot_run,
          domainsCount: data.domains?.length || 0,
          domains: data.domains,
        });
        setReport(data);
        setError(null); // Clear any previous errors
      } catch (err) {
        console.error("Error fetching report", err);
        setError(err instanceof Error ? err.message : "Failed to load report");
        setReport(null);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [studentId, snapshotRunId, reportKey]);

  const handlePrint = () => {
    window.print();
  };

  const handleExportCSV = () => {
    if (!report) return;

    const rows: string[][] = [
      ["Student Progress Report"],
      ["Student", `${report.student.first_name} ${report.student.last_name}`],
      ["Snapshot Date", report.snapshot_run.snapshot_date],
      ["Snapshot Run ID", report.snapshot_run.id],
      [],
      ["Domain", "Competency", "Performance Indicator", "Mastery Level", "Decision Date", "Reviewer"],
    ];

    report.domains.forEach((domain) => {
      domain.competencies.forEach((competency) => {
        const masteryLevel = competency.snapshot?.mastery_level?.label || "N/A";
        const decisionDate = competency.snapshot?.confirmed_at
          ? new Date(competency.snapshot.confirmed_at).toLocaleDateString()
          : report.snapshot_run.snapshot_date;
        const reviewer = competency.snapshot?.teacher
          ? `${competency.snapshot.teacher.first_name || ""} ${competency.snapshot.teacher.last_name || ""}`.trim()
          : "N/A";

        if (competency.indicators.length === 0) {
          rows.push([
            domain.name,
            competency.name,
            "N/A",
            masteryLevel,
            decisionDate,
            reviewer,
          ]);
        } else {
          competency.indicators.forEach((indicator, idx) => {
            rows.push([
              idx === 0 ? domain.name : "",
              idx === 0 ? competency.name : "",
              indicator.description,
              idx === 0 ? masteryLevel : "",
              idx === 0 ? decisionDate : "",
              idx === 0 ? reviewer : "",
            ]);
          });
        }
      });
    });

    const csv = rows.map((row) => row.map((cell) => `"${cell}"`).join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `progress-report-${report.student.student_number || report.student.id}-${report.snapshot_run.snapshot_date}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleGenerateReport = async () => {
    if (selectedStudentId && selectedSnapshotRunId) {
      // Clear previous report and show loading state immediately
      setReport(null);
      setError(null);
      setLoading(true);
      setShowSelection(false);
      
      // Navigate to the report URL using replace to update URL immediately
      router.replace(
        `/sis/mastery/reports/progress?student_id=${selectedStudentId}&snapshot_run_id=${selectedSnapshotRunId}`
      );
      
      // Force a small delay to ensure URL params are updated, then trigger fetch manually
      // The useEffect should handle this, but we'll also trigger it manually as a fallback
      setTimeout(() => {
        // This will be handled by the useEffect, but we ensure state is set
        console.log("[ProgressReport] Navigation complete, fetching report...");
      }, 100);
    }
  };

  if (showSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Student Progress Report</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a student and snapshot run to generate the report
            </p>
          </div>
          <Button onClick={() => router.push("/sis/mastery")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Mastery
          </Button>
        </div>

        {error && (
          <Card className="border-destructive">
            <CardContent className="pt-6">
              <div className="text-sm text-destructive">{error}</div>
              {error.includes("No snapshot runs") && (
                <Button
                  onClick={() => router.push("/sis/mastery/runs")}
                  variant="outline"
                  className="mt-2"
                >
                  Go to Snapshot Runs
                </Button>
              )}
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle>Select Report Parameters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <label className="text-sm font-medium mb-2 block">Student</label>
              <select
                value={selectedStudentId}
                onChange={(e) => setSelectedStudentId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                disabled={students.length === 0}
              >
                <option value="">Select a student...</option>
                {students.length === 0 ? (
                  <option value="" disabled>No students available</option>
                ) : (
                  students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                      {student.student_number && ` (${student.student_number})`}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Snapshot Run</label>
              {loadingSelection ? (
                <div className="w-full px-3 py-2 border rounded-md bg-muted">
                  <span className="text-sm text-muted-foreground">Loading snapshot runs...</span>
                </div>
              ) : (
                <>
                  <select
                    value={selectedSnapshotRunId}
                    onChange={(e) => setSelectedSnapshotRunId(e.target.value)}
                    className="w-full px-3 py-2 border rounded-md"
                    disabled={snapshotRuns.length === 0}
                  >
                    <option value="">Select a snapshot run...</option>
                    {snapshotRuns.length === 0 ? (
                      <option value="" disabled>No snapshot runs available</option>
                    ) : (
                      snapshotRuns.map((run) => (
                        <option key={run.id} value={run.id}>
                          {new Date(run.snapshot_date).toLocaleDateString()} - {run.scope_type}
                          {run.term && ` - ${run.term}`}
                          {run.school_year?.year_label && ` (${run.school_year.year_label})`}
                        </option>
                      ))
                    )}
                  </select>
                  {snapshotRuns.length === 0 && !loadingSelection && (
                    <p className="text-xs text-muted-foreground mt-1">
                      No snapshot runs found. Create one from the{" "}
                      <Button
                        variant="link"
                        className="p-0 h-auto text-xs"
                        onClick={() => router.push("/sis/mastery/runs")}
                      >
                        Snapshot Runs page
                      </Button>
                      .
                    </p>
                  )}
                </>
              )}
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={!selectedStudentId || !selectedSnapshotRunId}
              >
                <Search className="h-4 w-4 mr-2" />
                Generate Report
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student Progress Report</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student Progress Report</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-destructive">
              {error || "Report not found"}
            </div>
            <div className="text-center space-x-2">
              <Button
                onClick={() => {
                  router.push("/sis/mastery/reports/progress");
                }}
                variant="outline"
              >
                Select Different Report
              </Button>
              <Button onClick={() => router.back()} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print Header - only visible when printing */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">
              Student Progress Report
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {report.student.first_name} {report.student.last_name}
              {report.student.student_number && ` (${report.student.student_number})`}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Snapshot Date: {new Date(report.snapshot_run.snapshot_date).toLocaleDateString()}</div>
            <div>Snapshot Run ID: {report.snapshot_run.id.slice(0, 8)}...</div>
            {report.snapshot_run.term && <div>Term: {report.snapshot_run.term}</div>}
            {report.snapshot_run.quarter && <div>Quarter: {report.snapshot_run.quarter}</div>}
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Student Progress Report</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {report.student.first_name} {report.student.last_name}
            {report.student.student_number && ` (${report.student.student_number})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={handleExportCSV} variant="outline">
            <Download className="h-4 w-4 mr-2" />
            Export CSV
          </Button>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Report Metadata */}
      <Card className="print:hidden">
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Snapshot Date</div>
              <div className="font-medium">
                {new Date(report.snapshot_run.snapshot_date).toLocaleDateString()}
              </div>
            </div>
            {report.snapshot_run.term && (
              <div>
                <div className="text-muted-foreground">Term</div>
                <div className="font-medium">{report.snapshot_run.term}</div>
              </div>
            )}
            {report.snapshot_run.quarter && (
              <div>
                <div className="text-muted-foreground">Quarter</div>
                <div className="font-medium">{report.snapshot_run.quarter}</div>
              </div>
            )}
            <div>
              <div className="text-muted-foreground">Scope</div>
              <Badge variant="outline">{report.snapshot_run.scope_type}</Badge>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Radar Chart */}
      {report.domains.length > 0 && (() => {
        // Transform report data into radar chart format
        const radarData: RadarChartDataPoint[] = [];
        report.domains.forEach((domain) => {
          domain.competencies.forEach((competency) => {
            if (competency.snapshot?.mastery_level) {
              radarData.push({
                competency_id: competency.id,
                competency_name: competency.name,
                mastery_level_order: competency.snapshot.mastery_level.display_order,
                mastery_level_label: competency.snapshot.mastery_level.label,
              });
            }
          });
        });

        return radarData.length > 0 ? (
          <MasteryRadarChart data={radarData} />
        ) : null;
      })()}

      {/* Domains and Competencies */}
      {report.domains.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No mastery data found for this snapshot run.
            </div>
          </CardContent>
        </Card>
      ) : (
        report.domains.map((domain) => (
          <Card key={domain.id} className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="text-xl">{domain.name}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {domain.competencies.map((competency) => (
                <div key={competency.id} className="border-l-4 border-primary pl-4 space-y-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="font-semibold text-lg">{competency.name}</h3>
                      {competency.snapshot?.mastery_level && (
                        <div className="mt-2 flex items-center gap-2">
                          <Badge variant="default">
                            {competency.snapshot.mastery_level.label}
                          </Badge>
                          {competency.snapshot.confirmed_at && (
                            <span className="text-sm text-muted-foreground">
                              Confirmed: {new Date(competency.snapshot.confirmed_at).toLocaleDateString()}
                            </span>
                          )}
                          {competency.snapshot.teacher && (
                            <span className="text-sm text-muted-foreground">
                              by {competency.snapshot.teacher.first_name} {competency.snapshot.teacher.last_name}
                            </span>
                          )}
                        </div>
                      )}
                      {competency.snapshot?.rationale_text && (
                        <p className="text-sm text-muted-foreground mt-2">
                          {competency.snapshot.rationale_text}
                        </p>
                      )}
                    </div>
                  </div>

                  {/* Performance Indicators */}
                  {competency.indicators.length > 0 && (
                    <div className="ml-4 space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Performance Indicators:</h4>
                      <ul className="list-disc list-inside space-y-1 text-sm">
                        {competency.indicators.map((indicator) => (
                          <li key={indicator.id}>{indicator.description}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {/* Evidence Highlights */}
                  {competency.evidence_highlights.length > 0 && (
                    <div className="ml-4 space-y-2">
                      <h4 className="text-sm font-medium text-muted-foreground">Evidence Highlights:</h4>
                      <ul className="space-y-1 text-sm">
                        {competency.evidence_highlights.map((highlight) => (
                          <li key={highlight.id} className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              {highlight.evidence_type}
                            </Badge>
                            <span>{highlight.title}</span>
                            <span className="text-muted-foreground">
                              {new Date(highlight.date).toLocaleDateString()}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* Print Footer */}
      <div className="hidden print:block border-t pt-4 mt-4 text-sm text-muted-foreground text-center">
        <div>Snapshot Run ID: {report.snapshot_run.id}</div>
        <div>Generated: {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
}
