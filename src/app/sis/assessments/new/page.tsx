"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
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
import { ArrowLeft, Save } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { createAssessment } from "@/lib/assessments";
import { listLabelSets, listLabels, type AssessmentLabelSet, type AssessmentLabel } from "@/lib/assessment-labels";

export default function CreateAssessmentPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [students, setStudents] = useState<Array<{ id: string; first_name: string | null; last_name: string | null }>>([]);
  const [labelSets, setLabelSets] = useState<AssessmentLabelSet[]>([]);
  const [labels, setLabels] = useState<AssessmentLabel[]>([]);
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState({
    learner_id: "",
    experience_id: "",
    competency_id: "",
    school_year_id: "",
    term_period: "",
    label_set_id: "",
    label_id: "",
    rationale: "",
    status: "draft" as "draft" | "confirmed",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      try {
        setLoading(true);

        // Fetch students
        let studentsQuery = supabase
          .from("students")
          .select("id, first_name, last_name");
        
        if (!isSuperAdmin && organizationId) {
          studentsQuery = studentsQuery.eq("organization_id", organizationId);
        }
        
        const { data: studentsData } = await studentsQuery.order("last_name", { ascending: true });
        setStudents(studentsData || []);

        // Fetch label sets
        const labelSetsData = await listLabelSets();
        setLabelSets(labelSetsData);

        // Fetch school years
        let schoolYearsQuery = supabase
          .from("school_years")
          .select("id, name");
        
        if (!isSuperAdmin && organizationId) {
          schoolYearsQuery = schoolYearsQuery.eq("organization_id", organizationId);
        }
        
        const { data: schoolYearsData } = await schoolYearsQuery.order("name", { ascending: false });
        setSchoolYears(schoolYearsData || []);

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load form data");
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Fetch labels when label set changes
  useEffect(() => {
    const fetchLabels = async () => {
      if (!formData.label_set_id) {
        setLabels([]);
        setFormData((prev) => ({ ...prev, label_id: "" }));
        return;
      }

      try {
        const labelsData = await listLabels(formData.label_set_id);
        setLabels(labelsData);
        setFormData((prev) => ({ ...prev, label_id: "" }));
      } catch (err: any) {
        console.error("Error fetching labels:", err);
        setError(err.message || "Failed to load labels");
      }
    };

    fetchLabels();
  }, [formData.label_set_id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validation
    if (!formData.learner_id) {
      setError("Learner is required");
      return;
    }
    if (!formData.label_set_id) {
      setError("Label set is required");
      return;
    }
    if (!formData.label_id) {
      setError("Judgment label is required");
      return;
    }
    if (!formData.rationale.trim()) {
      setError("Rationale is required");
      return;
    }

    try {
      setSubmitting(true);
      const assessment = await createAssessment({
        learner_id: formData.learner_id,
        experience_id: formData.experience_id || null,
        competency_id: formData.competency_id || null,
        school_year_id: formData.school_year_id && formData.school_year_id !== "none" ? formData.school_year_id : null,
        term_period: formData.term_period || null,
        label_set_id: formData.label_set_id,
        label_id: formData.label_id,
        rationale: formData.rationale.trim(),
        status: formData.status,
      });

      router.push(`/sis/assessments/${assessment.id}`);
    } catch (err: any) {
      console.error("Error creating assessment:", err);
      setError(err.message || "Failed to create assessment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Assessment</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Create Assessment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Document your judgment about a learner's progress
          </p>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <form onSubmit={handleSubmit}>
        <Card>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Learner (required) */}
              <div className="space-y-2">
                <Label htmlFor="learner_id">
                  Learner <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.learner_id}
                  onValueChange={(value) => setFormData({ ...formData, learner_id: value })}
                  required
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select learner" />
                  </SelectTrigger>
                  <SelectContent>
                    {students.map((student) => (
                      <SelectItem key={student.id} value={student.id}>
                        {student.last_name}, {student.first_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Label Set (required) */}
              <div className="space-y-2">
                <Label htmlFor="label_set_id">
                  Label Set <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.label_set_id}
                  onValueChange={(value) => setFormData({ ...formData, label_set_id: value, label_id: "" })}
                  required
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select label set" />
                  </SelectTrigger>
                  <SelectContent>
                    {labelSets.map((set) => (
                      <SelectItem key={set.id} value={set.id}>
                        {set.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Judgment Label (required) */}
              <div className="space-y-2">
                <Label htmlFor="label_id">
                  Judgment Label <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.label_id}
                  onValueChange={(value) => setFormData({ ...formData, label_id: value })}
                  required
                  disabled={submitting || !formData.label_set_id || labels.length === 0}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={formData.label_set_id ? "Select label" : "Select label set first"} />
                  </SelectTrigger>
                  <SelectContent>
                    {labels.map((label) => (
                      <SelectItem key={label.id} value={label.id}>
                        {label.label_text}
                        {label.description && ` - ${label.description}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {formData.label_set_id && labels.length === 0 && (
                  <p className="text-sm text-muted-foreground">No labels available in this set</p>
                )}
              </div>

              {/* School Year (optional) */}
              <div className="space-y-2">
                <Label htmlFor="school_year_id">School Year</Label>
                <Select
                  value={formData.school_year_id || undefined}
                  onValueChange={(value) => setFormData({ ...formData, school_year_id: value === "none" ? "" : value })}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school year (optional)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {schoolYears.map((sy) => (
                      <SelectItem key={sy.id} value={sy.id}>
                        {sy.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Term Period (optional) */}
              <div className="space-y-2">
                <Label htmlFor="term_period">Term Period</Label>
                <Input
                  id="term_period"
                  value={formData.term_period}
                  onChange={(e) => setFormData({ ...formData, term_period: e.target.value })}
                  placeholder="e.g., Q1, Q2, Semester 1, Full Year"
                  disabled={submitting}
                />
              </div>

              {/* Status */}
              <div className="space-y-2">
                <Label htmlFor="status">Status</Label>
                <Select
                  value={formData.status}
                  onValueChange={(value) => setFormData({ ...formData, status: value as "draft" | "confirmed" })}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Rationale (required) */}
            <div className="space-y-2">
              <Label htmlFor="rationale">
                Rationale <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="rationale"
                value={formData.rationale}
                onChange={(e) => setFormData({ ...formData, rationale: e.target.value })}
                placeholder="Explain your judgment about this learner's progress..."
                rows={8}
                required
                disabled={submitting}
              />
              <p className="text-sm text-muted-foreground">
                Provide a clear narrative explaining your judgment. This is required.
              </p>
            </div>

            {/* Note: Experience and Competency fields are optional and can be added later if needed */}
            {/* They would be read-only references if used */}
          </CardContent>
        </Card>

        <div className="flex justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={() => router.back()}
            disabled={submitting}
          >
            Cancel
          </Button>
          <Button type="submit" disabled={submitting} className="gap-2">
            <Save className="size-4" />
            {submitting ? "Creating..." : formData.status === "confirmed" ? "Create & Confirm" : "Save as Draft"}
          </Button>
        </div>
      </form>
    </div>
  );
}

