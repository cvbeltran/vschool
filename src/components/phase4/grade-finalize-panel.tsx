"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import {
  listGradeEntries,
  listGradeJustifications,
  type StudentGrade,
  type GradeEntry,
  type GradeJustification,
} from "@/lib/phase4/grades";
import { listGradingScales } from "@/lib/phase4/policies";
import { getObservations } from "@/lib/ams";

interface GradeFinalizePanelProps {
  grade: StudentGrade;
  onConfirm: (gradeId: string, justificationText: string) => void;
  onOverride: (
    gradeId: string,
    overrideReason: string,
    newScaleId?: string
  ) => void;
  onCancel: () => void;
  organizationId: string | null;
}

export function GradeFinalizePanel({
  grade,
  onConfirm,
  onOverride,
  onCancel,
  organizationId,
}: GradeFinalizePanelProps) {
  const [entries, setEntries] = useState<GradeEntry[]>([]);
  const [justifications, setJustifications] = useState<GradeJustification[]>([]);
  const [observations, setObservations] = useState<any[]>([]);
  const [scales, setScales] = useState<
    Array<{ id: string; grade_value: string; grade_label: string | null }>
  >([]);
  const [action, setAction] = useState<"confirm" | "override" | null>(null);
  const [justificationText, setJustificationText] = useState("");
  const [overrideReason, setOverrideReason] = useState("");
  const [newScaleId, setNewScaleId] = useState<string>("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [entriesData, justificationsData, scalesData, observationsData] =
          await Promise.all([
            listGradeEntries(grade.id, organizationId),
            listGradeJustifications(grade.id, organizationId),
            listGradingScales(grade.grade_policy_id, organizationId),
            getObservations(organizationId, {
              learnerId: grade.student_id,
            }),
          ]);

        setEntries(entriesData);
        setJustifications(justificationsData);
        setScales(scalesData);
        setObservations(observationsData || []);
      } catch (err: any) {
        console.error("Error fetching grade details:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [grade.id, grade.grade_policy_id, grade.student_id, organizationId]);

  const handleConfirm = () => {
    if (!justificationText.trim()) {
      alert("Please provide a justification");
      return;
    }
    onConfirm(grade.id, justificationText);
  };

  const handleOverride = () => {
    if (!overrideReason.trim()) {
      alert("Please provide an override reason");
      return;
    }
    onOverride(grade.id, overrideReason, newScaleId || undefined);
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Review Grade: {grade.student?.first_name} {grade.student?.last_name}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <p>Loading...</p>
        ) : (
          <div className="space-y-4">
            <Card>
              <CardContent className="p-4">
                <div className="space-y-2">
                  <div>
                    <strong>Student:</strong> {grade.student?.first_name}{" "}
                    {grade.student?.last_name}
                  </div>
                  <div>
                    <strong>School Year:</strong> {grade.school_year?.year_label}
                  </div>
                  <div>
                    <strong>Term:</strong> {grade.term_period}
                  </div>
                  <div>
                    <strong>Policy:</strong> {grade.grade_policy?.policy_name}
                  </div>
                  <div>
                    <strong>Grade:</strong>{" "}
                    {grade.grading_scale?.grade_label ||
                      grade.grading_scale?.grade_value}
                  </div>
                  {grade.notes && (
                    <div>
                      <strong>Notes:</strong> {grade.notes}
                    </div>
                  )}
                  <div>
                    <strong>Status:</strong> {grade.status}
                  </div>
                </div>
              </CardContent>
            </Card>

            {entries.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Grade Entries</h3>
                  <div className="space-y-2">
                    {entries.map((entry) => (
                      <div key={entry.id} className="p-2 bg-gray-50 rounded">
                        <div className="text-sm font-medium">
                          {entry.entry_type.replace("_", " ")}
                        </div>
                        {entry.entry_text && (
                          <p className="text-sm">{entry.entry_text}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {observations.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">
                    Learning Evidence (Read-Only)
                  </h3>
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {observations.slice(0, 5).map((obs: any) => (
                      <div key={obs.id} className="p-2 bg-blue-50 rounded text-sm">
                        <div>
                          {new Date(obs.observed_at).toLocaleDateString()}
                        </div>
                        {obs.notes && <div>{obs.notes}</div>}
                      </div>
                    ))}
                    {observations.length > 5 && (
                      <p className="text-xs text-gray-500">
                        Showing 5 of {observations.length} observations
                      </p>
                    )}
                  </div>
                </CardContent>
              </Card>
            )}

            {justifications.length > 0 && (
              <Card>
                <CardContent className="p-4">
                  <h3 className="font-semibold mb-2">Audit Trail</h3>
                  <div className="space-y-2">
                    {justifications.map((just) => (
                      <div key={just.id} className="p-2 bg-gray-50 rounded text-sm">
                        <div className="font-medium">{just.justification_type}</div>
                        <div>{just.justification_text}</div>
                        <div className="text-xs text-gray-500">
                          {new Date(just.created_at).toLocaleString()}
                        </div>
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            )}

            {action === null && (
              <div className="flex gap-2 pt-4">
                <Button onClick={() => setAction("confirm")}>Confirm Grade</Button>
                <Button variant="outline" onClick={() => setAction("override")}>
                  Override Grade
                </Button>
                <Button variant="outline" onClick={onCancel}>
                  Cancel
                </Button>
              </div>
            )}

            {action === "confirm" && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="justification">Justification *</Label>
                  <Textarea
                    id="justification"
                    value={justificationText}
                    onChange={(e) => setJustificationText(e.target.value)}
                    placeholder="Explain why you are confirming this grade"
                    rows={3}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleConfirm}>Confirm</Button>
                  <Button variant="outline" onClick={() => setAction(null)}>
                    Back
                  </Button>
                </div>
              </div>
            )}

            {action === "override" && (
              <div className="space-y-4 pt-4">
                <div>
                  <Label htmlFor="new_grade">New Grade (Optional)</Label>
                  <Select value={newScaleId || "keep"} onValueChange={(value) => setNewScaleId(value === "keep" ? "" : value)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Keep current grade" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keep">Keep current grade</SelectItem>
                      {scales.map((scale) => (
                        <SelectItem key={scale.id} value={scale.id}>
                          {scale.grade_label || scale.grade_value}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="override_reason">Override Reason *</Label>
                  <Textarea
                    id="override_reason"
                    value={overrideReason}
                    onChange={(e) => setOverrideReason(e.target.value)}
                    placeholder="Explain why you are overriding this grade"
                    rows={3}
                    required
                  />
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleOverride}>Override</Button>
                  <Button variant="outline" onClick={() => setAction(null)}>
                    Back
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
