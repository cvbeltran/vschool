"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft, Save } from "lucide-react";
import { getLabelSet, updateLabelSet, type AssessmentLabelSet } from "@/lib/assessment-labels";

export default function EditLabelSetPage() {
  const params = useParams();
  const router = useRouter();
  const labelSetId = params.id as string;

  const [labelSet, setLabelSet] = useState<AssessmentLabelSet | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
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
        setFormData({
          name: labelSetData.name,
          description: labelSetData.description || "",
          is_active: labelSetData.is_active,
        });
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

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setSubmitting(true);
      await updateLabelSet(labelSetId, {
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        is_active: formData.is_active,
      });

      router.push(`/sis/assessments/label-sets/${labelSetId}`);
    } catch (err: any) {
      console.error("Error updating label set:", err);
      setError(err.message || "Failed to update label set");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit Label Set</h1>
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
          <h1 className="text-2xl font-semibold">Edit Label Set</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Update label set information
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
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="e.g., Proficiency Levels, Progress Indicators"
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
                placeholder="Optional description of this label set"
                rows={4}
                disabled={submitting}
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                type="checkbox"
                id="is_active"
                checked={formData.is_active}
                onChange={(e) => setFormData({ ...formData, is_active: e.target.checked })}
                disabled={submitting}
                className="rounded border-gray-300"
              />
              <Label htmlFor="is_active" className="font-normal">
                Active (available for use in assessments)
              </Label>
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

