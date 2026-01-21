"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { getLabelSet, type AssessmentLabelSet } from "@/lib/assessment-labels";
import { createLabel } from "@/lib/assessment-labels";

export default function CreateLabelPage() {
  const params = useParams();
  const router = useRouter();
  const labelSetId = params.id as string;

  const [labelSet, setLabelSet] = useState<AssessmentLabelSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    label_text: "",
    description: "",
    display_order: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const labelSetData = await getLabelSet(labelSetId);
        if (!labelSetData) {
          router.push("/sis/assessments/label-sets");
          return;
        }
        setLabelSet(labelSetData);
      } catch (error: any) {
        console.error("Error fetching label set:", error);
        setError(error.message || "Failed to load label set");
      } finally {
        setLoading(false);
      }
    };

    if (labelSetId) {
      fetchData();
    }
  }, [labelSetId, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.label_text.trim()) {
      setError("Label text is required");
      return;
    }

    try {
      setSubmitting(true);
      await createLabel(labelSetId, {
        label_text: formData.label_text.trim(),
        description: formData.description.trim() || null,
        display_order: formData.display_order ? parseInt(formData.display_order) : null,
      });

      router.push(`/sis/assessments/label-sets/${labelSetId}`);
    } catch (err: any) {
      console.error("Error creating label:", err);
      setError(err.message || "Failed to create label");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Label</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!labelSet) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Label Set Not Found</h1>
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
        <div>
          <h1 className="text-2xl font-semibold">Create Label</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Add a new judgment label to "{labelSet.name}"
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
              <p className="text-sm text-muted-foreground">
                The text that will appear as the judgment label in assessments.
              </p>
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
            {submitting ? "Creating..." : "Create Label"}
          </Button>
        </div>
      </form>
    </div>
  );
}

