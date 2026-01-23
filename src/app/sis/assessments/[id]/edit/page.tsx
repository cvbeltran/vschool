"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { normalizeRole } from "@/lib/rbac";
import { getAssessment, updateAssessment, type Assessment } from "@/lib/assessments";
import { listLabelSets, listLabels, type AssessmentLabelSet, type AssessmentLabel } from "@/lib/assessment-labels";

export default function EditAssessmentPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);

  const [labelSets, setLabelSets] = useState<AssessmentLabelSet[]>([]);
  const [labels, setLabels] = useState<AssessmentLabel[]>([]);
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState({
    school_year_id: "",
    term_period: "",
    label_set_id: "",
    label_id: "",
    rationale: "",
    status: "draft" as "draft" | "confirmed" | "archived",
  });

  useEffect(() => {
    const fetchData = async () => {
      // Fetch user role
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          setOriginalRole(profile.role);
        }
      }

      try {
        const assessmentData = await getAssessment(assessmentId);
        if (!assessmentData) {
          router.push("/sis/assessments");
          return;
        }
        setAssessment(assessmentData);

        // Check if finalized - block editing
        if (assessmentData.status === "confirmed") {
          setError("This assessment is finalized and cannot be edited.");
          return;
        }

        // Check permissions
        const canEdit =
          (role === "teacher" && assessmentData.teacher_id === session?.user.id) ||
          role === "principal" ||
          (role === "admin" && originalRole !== "registrar");
        
        if (!canEdit) {
          setError("You do not have permission to edit this assessment.");
          return;
        }

        // Set form data
        setFormData({
          school_year_id: assessmentData.school_year_id || "",
          term_period: assessmentData.term_period || "",
          label_set_id: assessmentData.label?.label_set?.id || "",
          label_id: assessmentData.label_id,
          rationale: assessmentData.rationale,
          status: assessmentData.status,
        });

        // Fetch label sets
        const labelSetsData = await listLabelSets();
        setLabelSets(labelSetsData);

        // Fetch labels for current label set
        if (assessmentData.label?.label_set?.id) {
          const labelsData = await listLabels(assessmentData.label.label_set.id);
          setLabels(labelsData);
        }

        // Fetch school years
        const { data: profileData } = await supabase
          .from("profiles")
          .select("organization_id, is_super_admin")
          .eq("id", session?.user.id || "")
          .single();

        let schoolYearsQuery = supabase
          .from("school_years")
          .select("id, name");
        
        if (!profileData?.is_super_admin && profileData?.organization_id) {
          schoolYearsQuery = schoolYearsQuery.eq("organization_id", profileData.organization_id);
        }
        
        const { data: schoolYearsData } = await schoolYearsQuery.order("name", { ascending: false });
        setSchoolYears(schoolYearsData || []);

        setLoading(false);
      } catch (error: any) {
        console.error("Error fetching assessment:", error);
        setError(error.message || "Failed to load assessment");
        setLoading(false);
      }
    };

    if (assessmentId) {
      fetchData();
    }
  }, [assessmentId, router, role]);

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
        // If current label_id is not in the new set, clear it
        if (!labelsData.find((l) => l.id === formData.label_id)) {
          setFormData((prev) => ({ ...prev, label_id: "" }));
        }
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
      await updateAssessment(assessmentId, {
        school_year_id: formData.school_year_id && formData.school_year_id !== "none" ? formData.school_year_id : null,
        term_period: formData.term_period || null,
        label_id: formData.label_id,
        rationale: formData.rationale.trim(),
        status: formData.status,
      });

      router.push(`/sis/assessments/${assessmentId}`);
    } catch (err: any) {
      console.error("Error updating assessment:", err);
      setError(err.message || "Failed to update assessment");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit Assessment</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Assessment Not Found</h1>
        <Button onClick={() => router.push("/sis/assessments")}>Back to Assessments</Button>
      </div>
    );
  }

  if (error && (error.includes("permission") || error.includes("finalized"))) {
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
          <h1 className="text-2xl font-semibold">Edit Assessment</h1>
        </div>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
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
          <h1 className="text-2xl font-semibold">Edit Assessment</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update assessment judgment and rationale
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
            {/* Read-only learner info */}
            <div>
              <Label>Learner</Label>
              <div className="text-base mt-1">
                {assessment.learner
                  ? `${assessment.learner.last_name || ""}, ${assessment.learner.first_name || ""}`.trim() || "—"
                  : "—"}
              </div>
              <p className="text-sm text-muted-foreground mt-1">Learner cannot be changed</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Label Set */}
              <div className="space-y-2">
                <Label htmlFor="label_set_id">Label Set</Label>
                <Select
                  value={formData.label_set_id}
                  onValueChange={(value) => setFormData({ ...formData, label_set_id: value, label_id: "" })}
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
              </div>

              {/* School Year */}
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

              {/* Term Period */}
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
                  onValueChange={(value) => setFormData({ ...formData, status: value as "draft" | "confirmed" | "archived" })}
                  disabled={submitting}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="draft">Draft</SelectItem>
                    <SelectItem value="confirmed">Confirmed</SelectItem>
                    <SelectItem value="archived">Archived</SelectItem>
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
            </div>
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
            {submitting ? "Saving..." : "Save Changes"}
          </Button>
        </div>
      </form>
    </div>
  );
}

