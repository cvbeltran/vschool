"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/lib/hooks/use-organization";
import { MasteryRadarChart, type RadarChartDataPoint } from "@/components/mastery/mastery-radar-chart";
import { type MasterySnapshotRun } from "@/lib/mastery";
import { ArrowLeft, Search } from "lucide-react";

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
}

export default function MasteryRadarChartPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const studentId = searchParams.get("student_id");
  const snapshotRunId = searchParams.get("snapshot_run_id");

  const [chartData, setChartData] = useState<RadarChartDataPoint[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState<string>("");
  
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
    const fetchData = async () => {
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

        // Fetch student progress report to get the data
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
          throw new Error(errorData.error || "Failed to fetch data");
        }

        const report = await response.json();
        setStudentName(
          `${report.student.first_name || ""} ${report.student.last_name || ""}`.trim()
        );

        // Transform report data into radar chart format
        const radarData: RadarChartDataPoint[] = [];
        report.domains.forEach((domain: any) => {
          domain.competencies.forEach((competency: any) => {
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

        setChartData(radarData);
      } catch (err) {
        console.error("Error fetching radar chart data", err);
        setError(err instanceof Error ? err.message : "Failed to load chart data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [studentId, snapshotRunId]);

  const handleGenerateChart = () => {
    if (selectedStudentId && selectedSnapshotRunId) {
      router.push(
        `/sis/mastery/reports/radar?student_id=${selectedStudentId}&snapshot_run_id=${selectedSnapshotRunId}`
      );
    }
  };

  if (showSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Mastery Radar Chart</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a student and snapshot run to view the radar chart
            </p>
          </div>
          <Button onClick={() => router.push("/sis/mastery")} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back to Mastery
          </Button>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Select Chart Parameters</CardTitle>
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
                onClick={handleGenerateChart}
                disabled={!selectedStudentId || !selectedSnapshotRunId}
              >
                <Search className="h-4 w-4 mr-2" />
                View Chart
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
        <h1 className="text-2xl font-semibold">Mastery Radar Chart</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mastery Radar Chart</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-destructive">{error}</div>
            <div className="text-center space-x-2">
              <Button
                onClick={() => {
                  router.push("/sis/mastery/reports/radar");
                }}
                variant="outline"
              >
                Select Different Chart
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
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mastery Radar Chart</h1>
          {studentName && (
            <p className="text-sm text-muted-foreground mt-1">{studentName}</p>
          )}
        </div>
        <Button onClick={() => router.back()} variant="outline">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
      </div>

      <MasteryRadarChart data={chartData} maxLevels={5} size={500} />
    </div>
  );
}
