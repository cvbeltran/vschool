"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { type TermSummaryMasteryData, type MasterySnapshotRun } from "@/lib/mastery";
import { Printer, Download, ArrowLeft, BarChart3, Search } from "lucide-react";

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
}

export default function TermSummaryMasteryPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const studentId = searchParams.get("student_id");
  const snapshotRunId = searchParams.get("snapshot_run_id");

  const [summary, setSummary] = useState<TermSummaryMasteryData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  
  // Selection state
  const [students, setStudents] = useState<Student[]>([]);
  const [snapshotRuns, setSnapshotRuns] = useState<MasterySnapshotRun[]>([]);
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedSnapshotRunId, setSelectedSnapshotRunId] = useState<string>("");
  const [showSelection, setShowSelection] = useState(false);

  // Fetch students and snapshot runs for selection
  useEffect(() => {
    const fetchSelectionData = async () => {
      if (orgLoading) return;
      
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          console.error("No session found");
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
          } else if (studentsData) {
            setStudents(studentsData);
          }
        }

        // Fetch snapshot runs
        const response = await fetch("/api/mastery/runs", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          console.error("Error fetching snapshot runs:", errorData);
          setError(`Failed to load snapshot runs: ${errorData.error || "Unknown error"}`);
        } else {
          const { runs } = await response.json();
          console.log("Fetched snapshot runs:", runs?.length || 0);
          setSnapshotRuns(runs || []);
          if (!runs || runs.length === 0) {
            setError("No snapshot runs found. Please create a snapshot run first.");
          }
        }
      } catch (err) {
        console.error("Error fetching selection data", err);
        setError(err instanceof Error ? err.message : "Failed to load selection data");
      }
    };

    if (!studentId || !snapshotRunId) {
      setShowSelection(true);
      setLoading(false);
      fetchSelectionData();
    }
  }, [organizationId, orgLoading, studentId, snapshotRunId]);

  useEffect(() => {
    const fetchSummary = async () => {
      if (!studentId || !snapshotRunId) {
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(
          `/api/mastery/reports/term-summary?student_id=${studentId}&snapshot_run_id=${snapshotRunId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch summary");
        }

        const data = await response.json();
        setSummary(data);
      } catch (err) {
        console.error("Error fetching summary", err);
        setError(err instanceof Error ? err.message : "Failed to load summary");
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, [studentId, snapshotRunId]);

  const handlePrint = () => {
    window.print();
  };

  const handleGenerateReport = () => {
    if (selectedStudentId && selectedSnapshotRunId) {
      router.push(
        `/sis/mastery/reports/term-summary?student_id=${selectedStudentId}&snapshot_run_id=${selectedSnapshotRunId}`
      );
    }
  };

  if (showSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Term Summary Mastery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a student and snapshot run to generate the summary
            </p>
          </div>
          <Button onClick={() => router.push("/sis/mastery")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Mastery
          </Button>
        </div>

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
              >
                <option value="">Select a student...</option>
                {students.map((student) => (
                  <option key={student.id} value={student.id}>
                    {student.first_name} {student.last_name}
                    {student.student_number && ` (${student.student_number})`}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-sm font-medium mb-2 block">Snapshot Run</label>
              <select
                value={selectedSnapshotRunId}
                onChange={(e) => setSelectedSnapshotRunId(e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="">Select a snapshot run...</option>
                {snapshotRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {new Date(run.snapshot_date).toLocaleDateString()} - {run.scope_type}
                    {run.term && ` - ${run.term}`}
                    {run.school_year?.year_label && ` (${run.school_year.year_label})`}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-2">
              <Button
                onClick={handleGenerateReport}
                disabled={!selectedStudentId || !selectedSnapshotRunId}
              >
                <Search className="h-4 w-4 mr-2" />
                Generate Summary
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
        <h1 className="text-2xl font-semibold">Term Summary Mastery</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !summary) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Term Summary Mastery</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-destructive">
              {error || "Summary not found"}
            </div>
            <div className="text-center space-x-2">
              <Button
                onClick={() => {
                  router.push("/sis/mastery/reports/term-summary");
                }}
                variant="outline"
              >
                Select Different Summary
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

  // Calculate totals
  const totalMasteryItems = Object.values(summary.mastery_counts).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print Header */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">Term Summary Mastery</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {summary.student.first_name} {summary.student.last_name}
              {summary.student.student_number && ` (${summary.student.student_number})`}
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Snapshot Date: {new Date(summary.snapshot_run.snapshot_date).toLocaleDateString()}</div>
            {summary.snapshot_run.term && <div>Term: {summary.snapshot_run.term}</div>}
            {summary.snapshot_run.quarter && <div>Quarter: {summary.snapshot_run.quarter}</div>}
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Term Summary Mastery</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {summary.student.first_name} {summary.student.last_name}
            {summary.student.student_number && ` (${summary.student.student_number})`}
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Competencies</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_competencies}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{summary.total_indicators}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Total Mastery Items</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalMasteryItems}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-muted-foreground">Snapshot Date</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">
              {new Date(summary.snapshot_run.snapshot_date).toLocaleDateString()}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Mastery Level Counts */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Mastery Level Distribution
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(summary.mastery_counts).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No mastery data available
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(summary.mastery_counts)
                .sort(([, a], [, b]) => b - a)
                .map(([level, count]) => {
                  const percentage = totalMasteryItems > 0
                    ? Math.round((count / totalMasteryItems) * 100)
                    : 0;
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{level}</Badge>
                          <span className="text-muted-foreground">{count} items</span>
                        </div>
                        <span className="font-medium">{percentage}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Competency Summary */}
      <Card>
        <CardHeader>
          <CardTitle>Competency Summary</CardTitle>
        </CardHeader>
        <CardContent>
          {summary.competency_summary.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No competency data available
            </div>
          ) : (
            <div className="space-y-2">
              {summary.competency_summary.map((comp) => (
                <div
                  key={comp.competency_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{comp.competency_name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {comp.pi_count} Performance Indicators
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    {comp.mastery_level && (
                      <Badge variant="default">{comp.mastery_level}</Badge>
                    )}
                    {comp.pi_proficient_plus > 0 && (
                      <span className="text-sm text-muted-foreground">
                        Proficient+
                      </span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Footer */}
      <div className="hidden print:block border-t pt-4 mt-4 text-sm text-muted-foreground text-center">
        <div>Snapshot Run ID: {summary.snapshot_run.id}</div>
        <div>Generated: {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
}
