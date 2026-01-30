"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { type ReportingEvidencePackItem, type MasterySnapshotRun } from "@/lib/mastery";
import { Printer, Download, ArrowLeft, Filter, FileText, Eye, User, Calendar, Search } from "lucide-react";
import Link from "next/link";

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
}

export default function EvidencePackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const studentId = searchParams.get("student_id");
  const snapshotRunId = searchParams.get("snapshot_run_id");

  const [evidencePack, setEvidencePack] = useState<ReportingEvidencePackItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterCompetency, setFilterCompetency] = useState<string>("all");
  
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
    const fetchEvidencePack = async () => {
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

        const url = new URL("/api/mastery/reports/evidence-pack", window.location.origin);
        url.searchParams.set("student_id", studentId);
        url.searchParams.set("snapshot_run_id", snapshotRunId);
        if (filterCompetency !== "all") {
          url.searchParams.set("competency_id", filterCompetency);
        }

        const response = await fetch(url.toString(), {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch evidence pack");
        }

        const data = await response.json();
        setEvidencePack(data);
      } catch (err) {
        console.error("Error fetching evidence pack", err);
        setError(err instanceof Error ? err.message : "Failed to load evidence pack");
      } finally {
        setLoading(false);
      }
    };

    fetchEvidencePack();
  }, [studentId, snapshotRunId, filterCompetency]);

  const handlePrint = () => {
    window.print();
  };

  // Get unique competencies for filter
  const competencies = Array.from(
    new Set(evidencePack.map((item) => item.competency_id).filter(Boolean))
  );

  // Filter evidence by competency
  const filteredEvidence = filterCompetency === "all"
    ? evidencePack
    : evidencePack.filter((item) => item.competency_id === filterCompetency);

  // Group by type
  const groupedByType = filteredEvidence.reduce((acc, item) => {
    if (!acc[item.type]) {
      acc[item.type] = [];
    }
    acc[item.type].push(item);
    return acc;
  }, {} as Record<string, ReportingEvidencePackItem[]>);

  const handleGenerateReport = () => {
    if (selectedStudentId && selectedSnapshotRunId) {
      router.push(
        `/sis/mastery/reports/evidence-pack?student_id=${selectedStudentId}&snapshot_run_id=${selectedSnapshotRunId}`
      );
    }
  };

  if (showSelection) {
    return (
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-semibold">Evidence Pack</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Select a student and snapshot run to view evidence
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
                View Evidence Pack
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
        <h1 className="text-2xl font-semibold">Evidence Pack</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Evidence Pack</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-destructive">{error}</div>
            <div className="text-center space-x-2">
              <Button
                onClick={() => {
                  router.push("/sis/mastery/reports/evidence-pack");
                }}
                variant="outline"
              >
                Select Different Pack
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

  const getEvidenceTypeIcon = (type: string) => {
    switch (type) {
      case "observation":
        return <Eye className="h-4 w-4" />;
      case "reflection":
      case "teacher_reflection":
        return <FileText className="h-4 w-4" />;
      case "portfolio_artifact":
        return <FileText className="h-4 w-4" />;
      case "assessment":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
    }
  };

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print Header */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <h1 className="text-2xl font-semibold">Evidence Pack</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Snapshot Run ID: {snapshotRunId}
        </p>
      </div>

      {/* Screen Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Evidence Pack</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Evidence linked to mastery snapshots
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

      {/* Filters */}
      {competencies.length > 0 && (
        <Card className="print:hidden">
          <CardContent className="pt-6">
            <div className="flex items-center gap-4">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <label className="text-sm font-medium">Filter by Competency:</label>
              <select
                value={filterCompetency}
                onChange={(e) => setFilterCompetency(e.target.value)}
                className="px-3 py-1 border rounded-md text-sm"
              >
                <option value="all">All Competencies</option>
                {competencies.map((compId) => {
                  const comp = evidencePack.find((item) => item.competency_id === compId);
                  return (
                    <option key={compId} value={compId}>
                      {comp?.competency_name || compId}
                    </option>
                  );
                })}
              </select>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Evidence Items */}
      {filteredEvidence.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No evidence items found for this snapshot run.
            </div>
          </CardContent>
        </Card>
      ) : (
        Object.entries(groupedByType).map(([type, items]) => (
          <Card key={type} className="print:break-inside-avoid">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 capitalize">
                {getEvidenceTypeIcon(type)}
                {type.replace("_", " ")} ({items.length})
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {items.map((item) => (
                <div
                  key={item.id}
                  className="border rounded-lg p-4 space-y-2 hover:bg-muted/50"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <Badge variant="outline">{item.type}</Badge>
                        {item.competency_name && (
                          <Badge variant="secondary">{item.competency_name}</Badge>
                        )}
                      </div>
                      <h3 className="font-semibold">{item.title}</h3>
                      {item.description && (
                        <p className="text-sm text-muted-foreground mt-1 line-clamp-2">
                          {item.description}
                        </p>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    {item.author_name && (
                      <div className="flex items-center gap-1">
                        <User className="h-3 w-3" />
                        {item.author_name}
                      </div>
                    )}
                    <div className="flex items-center gap-1">
                      <Calendar className="h-3 w-3" />
                      {new Date(item.date).toLocaleDateString()}
                    </div>
                    {item.link_url && (
                      <Link
                        href={item.link_url}
                        className="text-primary hover:underline print:hidden"
                      >
                        View Source
                      </Link>
                    )}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        ))
      )}

      {/* Print Footer */}
      <div className="hidden print:block border-t pt-4 mt-4 text-sm text-muted-foreground text-center">
        <div>Snapshot Run ID: {snapshotRunId}</div>
        <div>Generated: {new Date().toLocaleString()}</div>
      </div>
    </div>
  );
}
