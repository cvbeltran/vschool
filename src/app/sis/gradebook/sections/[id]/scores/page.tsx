"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Save } from "lucide-react";
import {
  listGradedItems,
  listGradedScores,
  bulkUpsertGradedScores,
  type GradebookGradedItem,
  type GradebookGradedScore,
} from "@/lib/gradebook";
import { listSectionStudents } from "@/lib/phase6/operations";
import { SectionContextHeader } from "@/components/gradebook/SectionContextHeader";

interface ScoreRow {
  student_id: string;
  student_name: string;
  student_number: string | null;
  points_earned: number | null;
  status: "present" | "absent" | "excused" | "missing";
  existing_score_id?: string;
}

export default function SectionScoresPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const sectionId = params.id as string;
  const termPeriod = searchParams.get("term") || "";
  const period = searchParams.get("period") || "";

  const [items, setItems] = useState<GradebookGradedItem[]>([]);
  const [selectedItemId, setSelectedItemId] = useState<string>("");
  const [selectedItem, setSelectedItem] = useState<GradebookGradedItem | null>(null);
  const [students, setStudents] = useState<Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  }>>([]);
  const [scoreRows, setScoreRows] = useState<ScoreRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Fetch items and students
  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !sectionId || !organizationId) return;
      try {
        setLoading(true);

        // Fetch all graded items for this section (no term filter)
        const itemsData = await listGradedItems({
          section_id: sectionId,
        });
        setItems(itemsData);

        // Fetch students in section
        const sectionStudents = await listSectionStudents(sectionId);
        const studentList = sectionStudents
          .map((ss) => ss.student)
          .filter((s): s is NonNullable<typeof s> => s !== null)
          .map((s) => ({
            id: s.id,
            first_name: s.first_name,
            last_name: s.last_name,
            student_number: s.student_number,
          }));
        setStudents(studentList);

        // Initialize score rows
        const initialRows: ScoreRow[] = studentList.map((s) => ({
          student_id: s.id,
          student_name: `${s.last_name || ""}, ${s.first_name || ""}`.trim() || "Unknown",
          student_number: s.student_number,
          points_earned: null,
          status: "present" as const,
        }));
        setScoreRows(initialRows);
      } catch (error: any) {
        console.error("Error fetching data", error);
        toast({
          message: error.message || "Failed to load data",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading, sectionId, organizationId]);

  // Load scores when item is selected
  useEffect(() => {
    const loadScores = async () => {
      if (!selectedItemId || !organizationId) {
        setScoreRows(students.map((s) => ({
          student_id: s.id,
          student_name: `${s.last_name || ""}, ${s.first_name || ""}`.trim() || "Unknown",
          student_number: s.student_number,
          points_earned: null,
          status: "present" as const,
        })));
        return;
      }

      try {
        // Get session token for API authentication
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        // Use API route instead of direct client call to avoid RLS issues
        const response = await fetch(`/api/gradebook/graded-items/${selectedItemId}/scores`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });
        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to load scores");
        }
        const data = await response.json();
        const scores: GradebookGradedScore[] = data.scores || [];
        
        const scoreMap = new Map<string, GradebookGradedScore>();
        scores.forEach((s) => {
          scoreMap.set(s.student_id, s);
        });

        const updatedRows: ScoreRow[] = students.map((s) => {
          const existingScore = scoreMap.get(s.id);
          return {
            student_id: s.id,
            student_name: `${s.last_name || ""}, ${s.first_name || ""}`.trim() || "Unknown",
            student_number: s.student_number,
            points_earned: existingScore?.points_earned ?? null,
            status: existingScore?.status || "present",
            existing_score_id: existingScore?.id,
          };
        });
        setScoreRows(updatedRows);
      } catch (error: any) {
        console.error("Error loading scores", error);
        toast({
          message: error.message || "Failed to load scores",
          type: "error",
        });
      }
    };

    loadScores();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedItemId, students]);

  // Update selectedItem when selectedItemId changes
  useEffect(() => {
    const item = items.find((i) => i.id === selectedItemId);
    setSelectedItem(item || null);
  }, [selectedItemId, items]);

  const handleScoreChange = (studentId: string, field: "points_earned" | "status", value: any) => {
    setScoreRows((prev) =>
      prev.map((row) => {
        if (row.student_id !== studentId) return row;

        // Guardrail: excused status must have null points_earned
        if (field === "status" && value === "excused") {
          return { ...row, status: value, points_earned: null };
        }
        // If changing from excused to another status, allow points_earned
        if (field === "points_earned" && row.status === "excused") {
          return row; // Don't allow changing points_earned when excused
        }

        return { ...row, [field]: value };
      })
    );
  };

  const handleBulkSave = async () => {
    if (!selectedItemId || !organizationId) {
      toast({
        message: "Please select a graded item first",
        type: "error",
      });
      return;
    }

    try {
      setSaving(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const scoresToSave = scoreRows.map((row) => ({
        organization_id: organizationId,
        graded_item_id: selectedItemId,
        student_id: row.student_id,
        points_earned: row.status === "excused" ? null : row.points_earned,
        status: row.status,
        entered_by: session.user.id,
      }));

      // Use API route for bulk save
      const response = await fetch(`/api/gradebook/graded-items/${selectedItemId}/scores`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({ scores: scoresToSave }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to save scores");
      }

      const result = await response.json();
      const scores: GradebookGradedScore[] = result.scores || [];

      toast({
        message: `✅ Scores saved successfully for ${scoreRows.length} student(s)`,
        type: "success",
        duration: 5000,
      });

      // Reload scores to get updated data
      const scoreMap = new Map<string, GradebookGradedScore>();
      scores.forEach((s) => {
        scoreMap.set(s.student_id, s);
      });

      const updatedRows: ScoreRow[] = students.map((s) => {
        const existingScore = scoreMap.get(s.id);
        return {
          student_id: s.id,
          student_name: `${s.last_name || ""}, ${s.first_name || ""}`.trim() || "Unknown",
          student_number: s.student_number,
          points_earned: existingScore?.points_earned ?? null,
          status: existingScore?.status || "present",
          existing_score_id: existingScore?.id,
        };
      });
      setScoreRows(updatedRows);
    } catch (error: any) {
      toast({
        message: error.message || "Failed to save scores",
        type: "error",
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading scores...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Score Entry</h1>
            <p className="text-muted-foreground mt-1">Enter scores for students in this section</p>
          </div>
        </div>
      </div>

      {/* Section Context Header */}
      <SectionContextHeader sectionId={sectionId} period={selectedItem?.term_period} />

      <div className="space-y-6">
        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle>Select Graded Item</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid gap-2">
              <Label htmlFor="graded_item">Graded Item *</Label>
              <Select
                value={selectedItemId}
                onValueChange={setSelectedItemId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select graded item" />
                </SelectTrigger>
                <SelectContent>
                  {items.map((item) => (
                    <SelectItem key={item.id} value={item.id}>
                      {(item.component as any)?.code || "N/A"} - {item.title} ({item.max_points} pts) - {item.term_period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {selectedItem && (
              <div className="bg-muted p-3 rounded-md">
                <p className="text-sm">
                  <strong>Selected:</strong> {selectedItem.title}
                </p>
                <p className="text-sm text-muted-foreground">
                  Component: {(selectedItem.component as any)?.code || "N/A"} - {(selectedItem.component as any)?.label || "N/A"}
                  {" | "}
                  Term Period: {selectedItem.term_period}
                  {" | "}
                  Max Points: {selectedItem.max_points}
                  {selectedItem.due_at && ` | Due: ${new Date(selectedItem.due_at).toLocaleDateString()}`}
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Scores Grid */}
        {selectedItemId && (
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Student Scores</CardTitle>
                <Button onClick={handleBulkSave} disabled={saving}>
                  <Save className="mr-2 h-4 w-4" />
                  {saving ? "Saving..." : "Save All Scores"}
                </Button>
              </div>
            </CardHeader>
            <CardContent>
              {scoreRows.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No students in this section.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Student Number</TableHead>
                        <TableHead>Student Name</TableHead>
                        <TableHead>Points Earned</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scoreRows.map((row) => (
                        <TableRow key={row.student_id}>
                          <TableCell className="font-mono text-sm">
                            {row.student_number || "-"}
                          </TableCell>
                          <TableCell className="font-medium">
                            {row.student_name}
                          </TableCell>
                          <TableCell>
                            <Input
                              type="number"
                              min="0"
                              max={selectedItem?.max_points || 100}
                              step="0.01"
                              value={row.points_earned ?? ""}
                              onChange={(e) =>
                                handleScoreChange(
                                  row.student_id,
                                  "points_earned",
                                  e.target.value === "" ? null : parseFloat(e.target.value)
                                )
                              }
                              disabled={row.status === "excused"}
                              className="w-24"
                              placeholder="0"
                            />
                          </TableCell>
                          <TableCell>
                            <Select
                              value={row.status}
                              onValueChange={(value: "present" | "absent" | "excused" | "missing") =>
                                handleScoreChange(row.student_id, "status", value)
                              }
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="missing">Missing</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                                <SelectItem value="excused">Excused</SelectItem>
                              </SelectContent>
                            </Select>
                            {row.status === "excused" && (
                              <p className="text-xs text-muted-foreground mt-1">
                                Points cleared (excused)
                              </p>
                            )}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {!selectedItemId && (
          <Card>
            <CardContent className="py-8">
              <p className="text-sm text-muted-foreground text-center">
                Select a graded item above to enter scores.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
