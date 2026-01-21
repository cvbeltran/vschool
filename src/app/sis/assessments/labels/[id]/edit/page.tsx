"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save, Archive } from "lucide-react";
import { listLabels, updateLabel, archiveLabel } from "@/lib/assessment-labels";
import { type AssessmentLabel } from "@/lib/assessment-labels";

export default function EditLabelPage() {
  const params = useParams();
  const router = useRouter();
  const labelId = params.id as string;

  const [label, setLabel] = useState<AssessmentLabel | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    label_text: "",
    description: "",
    display_order: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Find the label by searching through label sets
        // This is a simplified approach - in production, you might want a getLabel function
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id, is_super_admin")
          .eq("id", (await supabase.auth.getSession()).data.session?.user.id || "")
          .single();

        if (!profile) return;

        let query = supabase
          .from("assessment_labels")
          .select(`
            *,
            label_set:assessment_label_sets!inner(id, name)
          `)
          .eq("id", labelId)
          .is("archived_at", null);

        if (!profile.is_super_admin && profile.organization_id) {
          query = query.eq("organization_id", profile.organization_id);
        }

        const { data, error: fetchError } = await query.single();

        if (fetchError || !data) {
          router.push("/sis/assessments/label-sets");
          return;
        }

        setLabel(data as AssessmentLabel);
        setFormData({
          label_text: data.label_text,
          description: data.description || "",
          display_order: data.display_order?.toString() || "",
        });
      } catch (error: any) {
        console.error("Error fetching label:", error);
        setError(error.message || "Failed to load label");
      } finally {
        setLoading(false);
      }
    };

    if (labelId) {
      fetchData();
    }
  }, [labelId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.label_text.trim()) {
      setError("Label text is required");
      return;
    }

    try {
      setSubmitting(true);
      await updateLabel(labelId, {
        label_text: formData.label_text.trim(),
        description: formData.description.trim() || null,
        display_order: formData.display_order ? parseInt(formData.display_order) : null,
      });

      if (label?.label_set?.id) {
        router.push(`/sis/assessments/label-sets/${label.label_set.id}`);
      } else {
        router.push("/sis/assessments/label-sets");
      }
    } catch (err: any) {
      console.error("Error updating label:", err);
      setError(err.message || "Failed to update label");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (!confirm("Archive this label? This will hide it from the list.")) {
      return;
    }

    try {
      setArchiving(true);
      await archiveLabel(labelId);
      if (label?.label_set?.id) {
        router.push(`/sis/assessments/label-sets/${label.label_set.id}`);
      } else {
        router.push("/sis/assessments/label-sets");
      }
    } catch (err: any) {
      console.error("Error archiving label:", err);
      setError(err.message || "Failed to archive label");
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit Label</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!label) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Label Not Found</h1>
        <Button onClick={() => router.push("/sis/assessments/label-sets")}>Back to Label Sets</Button>
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
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Edit Label</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update label in "{label.label_set?.name || "Label Set"}"
          </p>
        </div>
        <Button
          variant="outline"
          onClick={handleArchive}
          disabled={archiving}
          className="gap-2"
        >
          <Archive className="size-4" />
          {archiving ? "Archiving..." : "Archive"}
        </Button>
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
            <div className="space-y-2">
              <Label htmlFor="label_text">
                Label Text <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label_text"
                value={formData.label_text}
                onChange={(e) => setFormData({ ...formData, label_text: e.target.value })}
                placeholder="e.g., Emerging, Developing, Proficient, Exceeds"
                required
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of what this label means"
                rows={4}
                disabled={submitting}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order (UI only)</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) => setFormData({ ...formData, display_order: e.target.value })}
                placeholder="e.g., 1, 2, 3 (optional)"
                disabled={submitting}
              />
              <p className="text-sm text-muted-foreground">
                Optional: Order for displaying labels in UI. Not used for computation.
              </p>
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

