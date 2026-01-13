"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { StudentFeedback } from "@/lib/feedback";
import { FeedbackDimension } from "@/lib/feedback";
import { Experience } from "@/lib/ams";

interface SchoolYear {
  id: string;
  year_label: string;
}

interface Teacher {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

interface StudentFeedbackFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  feedback?: StudentFeedback | null;
  feedbackDimensions: FeedbackDimension[];
  teachers: Teacher[];
  experiences: Experience[];
  schoolYears: SchoolYear[];
  organizationId: string | null;
  isSuperAdmin: boolean;
  onSubmit: (data: {
    feedback_dimension_id: string;
    quarter: string;
    teacher_id: string | null;
    experience_id: string | null;
    experience_type: string | null;
    school_year_id: string | null;
    feedback_text: string;
    provided_at: string;
    status: "draft" | "completed";
    is_anonymous: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function StudentFeedbackForm({
  open,
  onOpenChange,
  feedback,
  feedbackDimensions,
  teachers,
  experiences,
  schoolYears,
  organizationId,
  isSuperAdmin,
  onSubmit,
  isSubmitting = false,
}: StudentFeedbackFormProps) {
  const [feedbackDimensionId, setFeedbackDimensionId] = useState(
    feedback?.feedback_dimension_id || ""
  );
  const [quarter, setQuarter] = useState(feedback?.quarter || "");
  const [teacherId, setTeacherId] = useState(feedback?.teacher_id || "");
  const [experienceId, setExperienceId] = useState(
    feedback?.experience_id || ""
  );
  const [experienceType, setExperienceType] = useState(
    feedback?.experience_type || ""
  );
  const [schoolYearId, setSchoolYearId] = useState(
    feedback?.school_year_id || ""
  );
  const [feedbackText, setFeedbackText] = useState(
    feedback?.feedback_text || ""
  );
  const [providedAt, setProvidedAt] = useState(
    feedback?.provided_at
      ? feedback.provided_at.split("T")[0] + "T" + feedback.provided_at.split("T")[1].split(".")[0]
      : new Date().toISOString().slice(0, 16)
  );
  const [status, setStatus] = useState<"draft" | "completed">(
    feedback?.status || "draft"
  );
  const [isAnonymous, setIsAnonymous] = useState(
    feedback?.is_anonymous ?? false
  );
  const [error, setError] = useState<string | null>(null);

  // Reset form when feedback changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      setFeedbackDimensionId(feedback?.feedback_dimension_id || "");
      setQuarter(feedback?.quarter || "");
      setTeacherId(feedback?.teacher_id || "");
      setExperienceId(feedback?.experience_id || "");
      setExperienceType(feedback?.experience_type || "");
      setSchoolYearId(feedback?.school_year_id || "");
      setFeedbackText(feedback?.feedback_text || "");
      setProvidedAt(
        feedback?.provided_at
          ? feedback.provided_at.split("T")[0] + "T" + feedback.provided_at.split("T")[1].split(".")[0]
          : new Date().toISOString().slice(0, 16)
      );
      setStatus(feedback?.status || "draft");
      setIsAnonymous(feedback?.is_anonymous ?? false);
      setError(null);
    }
  }, [open, feedback]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!feedbackDimensionId) {
      setError("Feedback dimension is required");
      return;
    }

    if (!quarter) {
      setError("Quarter is required");
      return;
    }

    if (!feedbackText.trim()) {
      setError("Feedback text is required");
      return;
    }

    try {
      await onSubmit({
        feedback_dimension_id: feedbackDimensionId,
        quarter: quarter,
        teacher_id: teacherId || null,
        experience_id: experienceId || null,
        experience_type: experienceType || null,
        school_year_id: schoolYearId || null,
        feedback_text: feedbackText.trim(),
        provided_at: providedAt || new Date().toISOString(),
        status: status,
        is_anonymous: isAnonymous,
      });
      // Reset form on success
      setFeedbackDimensionId("");
      setQuarter("");
      setTeacherId("");
      setExperienceId("");
      setExperienceType("");
      setSchoolYearId("");
      setFeedbackText("");
      setProvidedAt(new Date().toISOString().slice(0, 16));
      setStatus("draft");
      setIsAnonymous(false);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save feedback");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {feedback ? "Edit Feedback" : "Create Feedback"}
          </DialogTitle>
          <DialogDescription>
            {feedback
              ? "Update your feedback on learning experiences."
              : "Provide qualitative feedback on your learning experiences."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="feedback_dimension_id">
                  Feedback Dimension <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={feedbackDimensionId}
                  onValueChange={setFeedbackDimensionId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select dimension" />
                  </SelectTrigger>
                  <SelectContent>
                    {feedbackDimensions
                      .filter((d) => d.is_active)
                      .map((dimension) => (
                        <SelectItem key={dimension.id} value={dimension.id}>
                          {dimension.dimension_name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="quarter">
                  Quarter <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={quarter}
                  onValueChange={setQuarter}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select quarter" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school_year_id">School Year (Optional)</Label>
                <Select
                  value={schoolYearId || "none"}
                  onValueChange={(value) => setSchoolYearId(value === "none" ? "" : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {schoolYears.map((year) => (
                      <SelectItem key={year.id} value={year.id}>
                        {year.year_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="teacher_id">Teacher (Optional)</Label>
                <Select
                  value={teacherId || "none"}
                  onValueChange={(value) => setTeacherId(value === "none" ? "" : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="experience_id">Experience (Optional)</Label>
                <Select
                  value={experienceId || "none"}
                  onValueChange={(value) => setExperienceId(value === "none" ? "" : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {experiences.map((exp) => (
                      <SelectItem key={exp.id} value={exp.id}>
                        {exp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="experience_type">Experience Type (Optional)</Label>
                <Select
                  value={experienceType || "none"}
                  onValueChange={(value) => setExperienceType(value === "none" ? "" : value)}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mentoring">Mentoring</SelectItem>
                    <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="feedback_text">
                Feedback Text <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="feedback_text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Write your feedback here... What worked? What didn't? What changed from plan?"
                required
                rows={8}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Narrative feedback only - no scores or ratings
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="provided_at">Provided At</Label>
                <Input
                  id="provided_at"
                  type="datetime-local"
                  value={providedAt}
                  onChange={(e) => setProvidedAt(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">
                  Status <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={status}
                  onValueChange={(value) =>
                    setStatus(value as "draft" | "completed")
                  }
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="completed">Completed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_anonymous"
                checked={isAnonymous}
                onCheckedChange={(checked) => setIsAnonymous(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor="is_anonymous" className="font-normal cursor-pointer">
                Make feedback anonymous (teacher will not see your name)
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => handleOpenChange(false)}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : feedback ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
