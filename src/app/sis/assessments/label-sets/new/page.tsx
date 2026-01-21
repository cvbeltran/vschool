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
import { createLabelSet } from "@/lib/assessment-labels";

export default function CreateLabelSetPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);

  const [formData, setFormData] = useState({
    name: "",
    description: "",
    school_id: "",
    is_active: true,
  });

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      try {
        // Fetch schools
        let schoolsQuery = supabase
          .from("schools")
          .select("id, name");
        
        if (!isSuperAdmin && organizationId) {
          schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
        }
        
        const { data: schoolsData } = await schoolsQuery.order("name", { ascending: true });
        setSchools(schoolsData || []);

        setLoading(false);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load form data");
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      setSubmitting(true);
      const labelSet = await createLabelSet({
        name: formData.name.trim(),
        description: formData.description.trim() || null,
        school_id: formData.school_id && formData.school_id !== "none" ? formData.school_id : null,
        is_active: formData.is_active,
      });

      router.push(`/sis/assessments/label-sets/${labelSet.id}`);
    } catch (err: any) {
      console.error("Error creating label set:", err);
      setError(err.message || "Failed to create label set");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Label Set</h1>
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
          <h1 className="text-2xl font-semibold">Create Label Set</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Create a new collection of judgment labels for assessments
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

            <div className="space-y-2">
              <Label htmlFor="school_id">School (Optional)</Label>
              <Select
                value={formData.school_id || undefined}
                onValueChange={(value) => setFormData({ ...formData, school_id: value === "none" ? "" : value })}
                disabled={submitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school (optional, leave blank for organization-wide)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Organization-wide</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
            {submitting ? "Creating..." : "Create Label Set"}
          </Button>
        </div>
      </form>
    </div>
  );
}

