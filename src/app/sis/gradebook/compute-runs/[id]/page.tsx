"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Send, CheckCircle, AlertCircle } from "lucide-react";
import type { GradebookComputeRun, GradebookComputedGrade } from "@/lib/gradebook";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export default function ComputeRunDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { toast } = useToast();
  const runId = params.id as string;

  const [run, setRun] = useState<GradebookComputeRun | null>(null);
  const [computedGrades, setComputedGrades] = useState<GradebookComputedGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [sendingToPhase4, setSendingToPhase4] = useState(false);
  const [linksCreated, setLinksCreated] = useState(0);
  const [breakdownDialogOpen, setBreakdownDialogOpen] = useState(false);
  const [selectedBreakdown, setSelectedBreakdown] = useState<any>(null);
  const [selectedStudent, setSelectedStudent] = useState<string | null>(null);

  useEffect(() => {
    const fetchRun = async () => {
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(`/api/gradebook/compute-runs/${runId}`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch compute run");
        }

        const { run: runData, computedGrades: gradesData } = await response.json();
        setRun(runData);
        setComputedGrades(gradesData || []);

        // Check existing links
        if (gradesData && gradesData.length > 0) {
          const { data: links } = await supabase
            .from("gradebook_phase4_links")
            .select("computed_grade_id")
            .in(
              "computed_grade_id",
              gradesData.map((g: GradebookComputedGrade) => g.id)
            )
            .is("archived_at", null);

          setLinksCreated(links?.length || 0);
        }
      } catch (error: any) {
        console.error("Error fetching compute run", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load compute run",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    if (runId) {
      fetchRun();
    }
  }, [runId, toast]);

  const handleSendToPhase4 = async () => {
    if (!run || run.status !== "completed") {
      toast({
        title: "Error",
        description: "Compute run must be completed before sending to Phase 4",
        variant: "destructive",
      });
      return;
    }

    try {
      setSendingToPhase4(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/gradebook/compute-runs/${runId}/send-to-phase4`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to send to Phase 4");
      }

      const { linksCreated: count, errors } = await response.json();

      setLinksCreated(count);

      if (errors && errors.length > 0) {
        toast({
          title: "Partial Success",
          description: `Created ${count} links. Some errors occurred. Check console for details.`,
          variant: "default",
        });
        console.error("Phase 4 linking errors:", errors);
      } else {
        toast({
          title: "Success",
          description: `Successfully created ${count} Phase 4 grade entries and links`,
        });
      }
    } catch (error: any) {
      console.error("Error sending to Phase 4", error);
      toast({
        title: "Error",
        description: error.message || "Failed to send to Phase 4",
        variant: "destructive",
      });
    } finally {
      setSendingToPhase4(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading compute run...</p>
        </div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Compute run not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center gap-4 mb-6">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <div>
          <h1 className="text-3xl font-bold">Compute Run Details</h1>
          <p className="text-muted-foreground mt-1">
            {run.section?.name || "Section"} - {run.term_period}
          </p>
        </div>
      </div>

      <div className="grid gap-6">
        {/* Run Info */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Run Information</CardTitle>
              <Badge
                className={
                  run.status === "completed"
                    ? "bg-green-500"
                    : run.status === "failed"
                    ? "bg-red-500"
                    : "bg-yellow-500"
                }
              >
                {run.status}
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-muted-foreground">Scheme</p>
                <p className="font-medium">
                  {run.scheme?.name || "N/A"} v{run.scheme_version}
                </p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Computed At</p>
                <p className="font-medium">{new Date(run.as_of).toLocaleString()}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Section</p>
                <p className="font-medium">{run.section?.name || "N/A"}</p>
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Term Period</p>
                <p className="font-medium">{run.term_period}</p>
              </div>
            </div>
            {run.error_message && (
              <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded">
                <p className="text-sm text-red-800">
                  <strong>Error:</strong> {run.error_message}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Computed Grades */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Computed Grades ({computedGrades.length} students)</CardTitle>
              {run.status === "completed" && (
                <Button
                  onClick={handleSendToPhase4}
                  disabled={sendingToPhase4 || linksCreated === computedGrades.length}
                >
                  <Send className="mr-2 h-4 w-4" />
                  {sendingToPhase4
                    ? "Sending..."
                    : linksCreated > 0
                    ? `Send to Phase 4 (${linksCreated}/${computedGrades.length} linked)`
                    : "Send to Phase 4"}
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {linksCreated > 0 && (
              <div className="mb-4 p-3 bg-green-50 border border-green-200 rounded flex items-center gap-2">
                <CheckCircle className="h-5 w-5 text-green-600" />
                <p className="text-sm text-green-800">
                  {linksCreated} computed grade{linksCreated !== 1 ? "s" : ""} linked to Phase 4
                </p>
              </div>
            )}

            {computedGrades.length === 0 ? (
              <p className="text-muted-foreground">No computed grades found</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Student</TableHead>
                    <TableHead>Initial Grade</TableHead>
                      {(run.scheme?.scheme_type === "deped_k12" || run.scheme?.scheme_type === "ched_hei") && <TableHead>Transmuted</TableHead>}
                    <TableHead>Final Grade</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {computedGrades.map((grade) => (
                    <TableRow key={grade.id}>
                      <TableCell>
                        {grade.student?.first_name} {grade.student?.last_name}
                        {grade.student?.student_number && (
                          <span className="text-muted-foreground ml-2">
                            ({grade.student.student_number})
                          </span>
                        )}
                      </TableCell>
                      <TableCell>
                        {grade.initial_grade !== null
                          ? grade.initial_grade.toFixed(2)
                          : "N/A"}
                      </TableCell>
                      {(run.scheme?.scheme_type === "deped_k12" || run.scheme?.scheme_type === "ched_hei") && (
                        <TableCell>
                          {grade.transmuted_grade !== null
                            ? grade.transmuted_grade.toFixed(2)
                            : "N/A"}
                        </TableCell>
                      )}
                      <TableCell>
                        <Badge className="bg-blue-500">
                          {grade.final_numeric_grade.toFixed(2)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => {
                            setSelectedBreakdown(grade.breakdown);
                            setSelectedStudent(
                              `${grade.student?.first_name} ${grade.student?.last_name}`
                            );
                            setBreakdownDialogOpen(true);
                          }}
                        >
                          View Breakdown
                        </Button>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Breakdown Dialog */}
      <Dialog open={breakdownDialogOpen} onOpenChange={setBreakdownDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Grade Breakdown - {selectedStudent}</DialogTitle>
            <DialogDescription>
              Detailed component breakdown and computation details
            </DialogDescription>
          </DialogHeader>
          {selectedBreakdown && (
            <div className="space-y-4">
              {/* Summary */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-blue-50 rounded-md">
                <div>
                  <p className="text-sm text-muted-foreground">Initial Grade (Raw)</p>
                  <p className="text-lg font-semibold">
                    {selectedBreakdown.initial_grade_raw?.toFixed(2) ?? "N/A"}
                  </p>
                </div>
                {selectedBreakdown.initial_grade_key !== null && selectedBreakdown.initial_grade_key !== undefined && (
                  <div>
                    <p className="text-sm text-muted-foreground">Initial Grade Key (Used from Table)</p>
                    <p className="text-lg font-semibold">
                      {typeof selectedBreakdown.initial_grade_key === 'number' 
                        ? selectedBreakdown.initial_grade_key.toFixed(2)
                        : selectedBreakdown.initial_grade_key}
                    </p>
                    {selectedBreakdown.initial_grade_raw !== selectedBreakdown.initial_grade_key && (
                      <p className="text-xs text-muted-foreground mt-1">
                        Closest lower match from transmutation table
                      </p>
                    )}
                  </div>
                )}
                {selectedBreakdown.transmuted_grade !== null && (
                  <div>
                    <p className="text-sm text-muted-foreground">Transmuted Grade</p>
                    <p className="text-lg font-semibold">
                      {selectedBreakdown.transmuted_grade.toFixed(2)}
                    </p>
                  </div>
                )}
                <div>
                  <p className="text-sm text-muted-foreground">Final Numeric Grade</p>
                  <p className="text-lg font-semibold">
                    {selectedBreakdown.transmuted_grade !== null
                      ? selectedBreakdown.transmuted_grade.toFixed(2)
                      : selectedBreakdown.initial_grade_raw?.toFixed(2) ?? "N/A"}
                  </p>
                </div>
              </div>

              {/* Component Breakdown */}
              {selectedBreakdown.components && selectedBreakdown.components.length > 0 && (
                <div>
                  <h3 className="font-semibold mb-2">Component Breakdown</h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Component</TableHead>
                        <TableHead>Raw Total</TableHead>
                        <TableHead>Max Total</TableHead>
                        <TableHead>Percent</TableHead>
                        <TableHead>Weight %</TableHead>
                        <TableHead>Weighted Score</TableHead>
                        <TableHead>Status Counts</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {selectedBreakdown.components.map((comp: any, idx: number) => (
                        <TableRow key={idx}>
                          <TableCell className="font-medium">
                            {comp.component_code} - {comp.component_label}
                          </TableCell>
                          <TableCell>{comp.raw_total?.toFixed(2) ?? "0.00"}</TableCell>
                          <TableCell>{comp.max_total?.toFixed(2) ?? "0.00"}</TableCell>
                          <TableCell>{comp.percent?.toFixed(2) ?? "0.00"}%</TableCell>
                          <TableCell>{comp.weight_percent?.toFixed(2) ?? "0.00"}%</TableCell>
                          <TableCell>{comp.weighted_score?.toFixed(2) ?? "0.00"}</TableCell>
                          <TableCell>
                            <div className="text-xs space-y-1">
                              {comp.status_counts?.present > 0 && (
                                <div>Present: {comp.status_counts.present}</div>
                              )}
                              {comp.status_counts?.missing > 0 && (
                                <div>Missing: {comp.status_counts.missing}</div>
                              )}
                              {comp.status_counts?.absent > 0 && (
                                <div>Absent: {comp.status_counts.absent}</div>
                              )}
                              {comp.status_counts?.excused > 0 && (
                                <div>Excused: {comp.status_counts.excused}</div>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Computation Details */}
              <div className="p-4 bg-gray-50 rounded-md">
                <h3 className="font-semibold mb-2">Computation Details</h3>
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Rounding Mode</p>
                    <p className="font-medium">{selectedBreakdown.rounding_mode || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Weight Policy</p>
                    <p className="font-medium">{selectedBreakdown.weight_policy || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Total Weight Used</p>
                    <p className="font-medium">
                      {selectedBreakdown.total_weight?.toFixed(2) ?? "0.00"}%
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Computation Method</p>
                    <p className="font-medium">
                      {selectedBreakdown.computation_method || "N/A"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Scheme Version</p>
                    <p className="font-medium">{selectedBreakdown.scheme_version || "N/A"}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Computed As Of</p>
                    <p className="font-medium">
                      {selectedBreakdown.as_of
                        ? new Date(selectedBreakdown.as_of).toLocaleString()
                        : "N/A"}
                    </p>
                  </div>
                </div>
              </div>

              {/* Raw JSON (for debugging) */}
              <details className="mt-4">
                <summary className="cursor-pointer text-sm text-muted-foreground hover:text-foreground">
                  View Raw JSON
                </summary>
                <pre className="mt-2 p-4 bg-gray-100 rounded-md text-xs overflow-x-auto">
                  {JSON.stringify(selectedBreakdown, null, 2)}
                </pre>
              </details>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
