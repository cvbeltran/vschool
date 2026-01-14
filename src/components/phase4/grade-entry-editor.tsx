"use client";

import { useState, useEffect, useRef } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Plus } from "lucide-react";
import {
  updateStudentGradeHeader,
  addGradeEntry,
  type StudentGrade,
  type GradeEntry,
} from "@/lib/phase4/grades";
import { GradeJustificationEditor } from "./grade-justification-editor";

interface GradeEntryEditorProps {
  grade: StudentGrade;
  gradeEntries: GradeEntry[];
  observations: any[];
  scales: Array<{ id: string; grade_value: string; grade_label: string | null }>;
  organizationId: string | null;
  currentProfileId: string | null;
  onGradeUpdate: (grade: StudentGrade) => void;
  onEntriesUpdate: () => void;
}

export function GradeEntryEditor({
  grade,
  gradeEntries,
  observations,
  scales,
  organizationId,
  currentProfileId,
  onGradeUpdate,
  onEntriesUpdate,
}: GradeEntryEditorProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddEntry, setShowAddEntry] = useState(false);
  const [localNotes, setLocalNotes] = useState(grade.notes || "");
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleGradeValueChange = async (scaleId: string) => {
    if (!currentProfileId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await updateStudentGradeHeader(grade.id, {
        grading_scale_id: scaleId,
        updated_by: currentProfileId,
      });
      onGradeUpdate(updated);
    } catch (err: any) {
      console.error("Error updating grade:", err);
      setError(err.message || "Failed to update grade");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Sync local notes with prop when grade changes externally
  useEffect(() => {
    setLocalNotes(grade.notes || "");
  }, [grade.notes]);

  const handleNotesChange = (notes: string) => {
    // Update local state immediately for responsive UI
    setLocalNotes(notes);

    // Clear existing debounce timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    // Debounce API call
    debounceTimerRef.current = setTimeout(async () => {
      if (!currentProfileId) return;

      try {
        const updated = await updateStudentGradeHeader(grade.id, {
          notes,
          updated_by: currentProfileId,
        });
        onGradeUpdate(updated);
      } catch (err: any) {
        console.error("Error updating notes:", {
          error: err,
          message: err?.message,
          gradeId: grade.id,
          currentProfileId,
          notes,
        });
        // Revert to last known good value on error
        setLocalNotes(grade.notes || "");
        // Show user-friendly error
        setError(err?.message || "Failed to save notes. You may not have permission to update this grade.");
      }
    }, 500); // 500ms debounce delay
  };

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  const handleAddEntry = async (entryData: {
    entry_type: "observation_reference" | "competency_summary" | "domain_summary" | "manual_note";
    entry_text: string | null;
    observation_id?: string | null;
    competency_id?: string | null;
    domain_id?: string | null;
  }) => {
    if (!organizationId || !currentProfileId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      await addGradeEntry({
        organization_id: organizationId,
        student_grade_id: grade.id,
        ...entryData,
        created_by: currentProfileId,
      });
      onEntriesUpdate();
      setShowAddEntry(false);
    } catch (err: any) {
      console.error("Error adding grade entry:", err);
      setError(err.message || "Failed to add entry");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmitForConfirmation = async () => {
    if (!currentProfileId) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const updated = await updateStudentGradeHeader(grade.id, {
        status: "pending_confirmation",
        updated_by: currentProfileId,
      });
      onGradeUpdate(updated);
      // Show success message
      setError(null);
    } catch (err: any) {
      console.error("Error submitting grade for confirmation:", err);
      setError(err?.message || "Failed to submit grade for confirmation. You may not have permission.");
    } finally {
      setIsSubmitting(false);
    }
  };

  const selectedScale = scales.find((s) => s.id === grade.grading_scale_id);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Grade Assignment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="grade_value">Grade Value *</Label>
            <Select
              value={grade.grading_scale_id}
              onValueChange={handleGradeValueChange}
              disabled={isSubmitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {scales.map((scale) => (
                  <SelectItem key={scale.id} value={scale.id}>
                    {scale.grade_label || scale.grade_value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {selectedScale && (
              <p className="text-sm text-gray-600 mt-1">
                Current: {selectedScale.grade_label || selectedScale.grade_value}
              </p>
            )}
          </div>

          <div>
            <Label htmlFor="notes">Notes</Label>
            <Textarea
              id="notes"
              value={localNotes}
              onChange={(e) => handleNotesChange(e.target.value)}
              placeholder="Add notes explaining this grade translation"
              rows={3}
            />
          </div>

          <div className="flex justify-between items-center gap-2">
            <span className="text-sm text-gray-600">
              Status: <strong className="capitalize">{grade.status.replace("_", " ")}</strong>
            </span>
            {grade.status === "draft" && (
              <Button
                onClick={handleSubmitForConfirmation}
                disabled={isSubmitting}
                className="ml-auto"
              >
                {isSubmitting ? "Submitting..." : "Submit for Confirmation"}
              </Button>
            )}
            {grade.status === "pending_confirmation" && (
              <span className="text-sm text-blue-600 italic">
                Awaiting review by admin/principal
              </span>
            )}
            {(grade.status === "confirmed" || grade.status === "overridden") && (
              <span className="text-sm text-green-600 italic">
                Grade finalized
              </span>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <CardTitle>Grade Entries (Supporting Evidence)</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowAddEntry(true)}
            >
              <Plus className="h-4 w-4 mr-2" />
              Add Entry
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {gradeEntries.length === 0 ? (
            <p className="text-sm text-gray-500">
              No entries yet. Add entries to document supporting evidence.
            </p>
          ) : (
            <div className="space-y-3">
              {gradeEntries.map((entry) => (
                <div
                  key={entry.id}
                  className="p-3 border rounded bg-gray-50"
                >
                  <div className="flex justify-between items-start mb-2">
                    <span className="text-sm font-medium">
                      {entry.entry_type.replace("_", " ")}
                    </span>
                  </div>
                  {entry.entry_text && (
                    <p className="text-sm text-gray-700">{entry.entry_text}</p>
                  )}
                  {entry.observation && (
                    <p className="text-xs text-gray-500 mt-1">
                      Observation: {entry.observation.notes || "No notes"}
                    </p>
                  )}
                  {entry.competency && (
                    <p className="text-xs text-gray-500 mt-1">
                      Competency: {entry.competency.name}
                    </p>
                  )}
                  {entry.domain && (
                    <p className="text-xs text-gray-500 mt-1">
                      Domain: {entry.domain.name}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Learning Evidence (Read-Only Reference)</CardTitle>
        </CardHeader>
        <CardContent>
          {observations.length === 0 ? (
            <p className="text-sm text-gray-500">
              No observations found for this student.
            </p>
          ) : (
            <div className="space-y-3">
              {observations.slice(0, 10).map((obs: any) => (
                <div
                  key={obs.id}
                  className="p-3 border rounded bg-blue-50"
                >
                  <div className="text-sm">
                    <strong>Observed:</strong>{" "}
                    {new Date(obs.observed_at).toLocaleDateString()}
                  </div>
                  {obs.notes && (
                    <p className="text-sm text-gray-700 mt-1">{obs.notes}</p>
                  )}
                  {obs.competency && (
                    <p className="text-xs text-gray-500 mt-1">
                      Competency: {obs.competency.name}
                    </p>
                  )}
                  {obs.competency_level && (
                    <p className="text-xs text-gray-500">
                      Level: {obs.competency_level.label}
                    </p>
                  )}
                </div>
              ))}
              {observations.length > 10 && (
                <p className="text-xs text-gray-500">
                  Showing 10 of {observations.length} observations
                </p>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showAddEntry && (
        <GradeJustificationEditor
          observations={observations}
          onSubmit={handleAddEntry}
          onCancel={() => setShowAddEntry(false)}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
