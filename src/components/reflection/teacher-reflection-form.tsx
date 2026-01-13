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
import { TeacherReflection, ReflectionPrompt } from "@/lib/reflection";
import { Experience } from "@/lib/ams";
import { Competency } from "@/lib/obs";

interface SchoolYear {
  id: string;
  year_label: string;
}

interface TeacherReflectionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  reflection?: TeacherReflection | null;
  reflectionPrompts: ReflectionPrompt[];
  experiences: Experience[];
  schoolYears: SchoolYear[];
  competencies: Competency[];
  organizationId: string | null;
  isSuperAdmin: boolean;
  onSubmit: (data: {
    reflection_prompt_id: string | null;
    experience_id: string | null;
    school_year_id: string | null;
    quarter: string | null;
    competency_id: string | null;
    reflection_text: string;
    reflected_at: string;
    status: "draft" | "completed";
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function TeacherReflectionForm({
  open,
  onOpenChange,
  reflection,
  reflectionPrompts,
  experiences,
  schoolYears,
  competencies,
  organizationId,
  isSuperAdmin,
  onSubmit,
  isSubmitting = false,
}: TeacherReflectionFormProps) {
  const [reflectionPromptId, setReflectionPromptId] = useState(
    reflection?.reflection_prompt_id || "none"
  );
  const [experienceId, setExperienceId] = useState(
    reflection?.experience_id || "none"
  );
  const [schoolYearId, setSchoolYearId] = useState(
    reflection?.school_year_id || "none"
  );
  const [quarter, setQuarter] = useState(reflection?.quarter || "none");
  const [competencyId, setCompetencyId] = useState(
    reflection?.competency_id || "none"
  );
  const [reflectionText, setReflectionText] = useState(
    reflection?.reflection_text || ""
  );
  const [reflectedAt, setReflectedAt] = useState(
    reflection?.reflected_at
      ? reflection.reflected_at.split("T")[0] + "T" + reflection.reflected_at.split("T")[1].split(".")[0]
      : new Date().toISOString().slice(0, 16)
  );
  const [status, setStatus] = useState<"draft" | "completed">(
    reflection?.status || "draft"
  );
  const [error, setError] = useState<string | null>(null);

  // Reset form when reflection changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      setReflectionPromptId(reflection?.reflection_prompt_id || "none");
      setExperienceId(reflection?.experience_id || "none");
      setSchoolYearId(reflection?.school_year_id || "none");
      setQuarter(reflection?.quarter || "none");
      setCompetencyId(reflection?.competency_id || "none");
      setReflectionText(reflection?.reflection_text || "");
      setReflectedAt(
        reflection?.reflected_at
          ? reflection.reflected_at.split("T")[0] + "T" + reflection.reflected_at.split("T")[1].split(".")[0]
          : new Date().toISOString().slice(0, 16)
      );
      setStatus(reflection?.status || "draft");
      setError(null);
    }
  }, [open, reflection]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!reflectionText.trim()) {
      setError("Reflection text is required");
      return;
    }

    try {
      await onSubmit({
        reflection_prompt_id: reflectionPromptId === "none" ? null : reflectionPromptId,
        experience_id: experienceId === "none" ? null : experienceId,
        school_year_id: schoolYearId === "none" ? null : schoolYearId,
        quarter: quarter === "none" ? null : quarter,
        competency_id: competencyId === "none" ? null : competencyId,
        reflection_text: reflectionText.trim(),
        reflected_at: reflectedAt || new Date().toISOString(),
        status: status,
      });
      // Reset form on success
      setReflectionPromptId("none");
      setExperienceId("none");
      setSchoolYearId("none");
      setQuarter("none");
      setCompetencyId("none");
      setReflectionText("");
      setReflectedAt(new Date().toISOString().slice(0, 16));
      setStatus("draft");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save reflection");
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
            {reflection ? "Edit Reflection" : "Create Reflection"}
          </DialogTitle>
          <DialogDescription>
            {reflection
              ? "Update your reflection on teaching practice."
              : "Create a narrative reflection on your teaching practice."}
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="reflection_prompt_id">
                Reflection Prompt (Optional)
              </Label>
              <Select
                value={reflectionPromptId || "none"}
                onValueChange={setReflectionPromptId}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a prompt (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {reflectionPrompts
                    .filter((p) => p.is_active)
                    .map((prompt) => (
                      <SelectItem key={prompt.id} value={prompt.id}>
                        {prompt.prompt_text}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="school_year_id">School Year (Optional)</Label>
                <Select
                  value={schoolYearId || "none"}
                  onValueChange={setSchoolYearId}
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
                <Label htmlFor="quarter">Quarter (Optional)</Label>
                <Select
                  value={quarter || "none"}
                  onValueChange={setQuarter}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
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
                <Label htmlFor="experience_id">Experience (Optional)</Label>
                <Select
                  value={experienceId || "none"}
                  onValueChange={setExperienceId}
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
                <Label htmlFor="competency_id">Competency (Optional)</Label>
                <Select
                  value={competencyId || "none"}
                  onValueChange={setCompetencyId}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {competencies.map((comp) => (
                      <SelectItem key={comp.id} value={comp.id}>
                        {comp.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reflection_text">
                Reflection Text <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="reflection_text"
                value={reflectionText}
                onChange={(e) => setReflectionText(e.target.value)}
                placeholder="Write your reflection here... What worked? What didn't? What changed from plan?"
                required
                rows={8}
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Narrative reflection only - no scores or grades
              </p>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="reflected_at">Reflected At</Label>
                <Input
                  id="reflected_at"
                  type="datetime-local"
                  value={reflectedAt}
                  onChange={(e) => setReflectedAt(e.target.value)}
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
              {isSubmitting ? "Saving..." : reflection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
