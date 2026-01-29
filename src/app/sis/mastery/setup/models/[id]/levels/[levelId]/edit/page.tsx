"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { getMasteryLevel, updateMasteryLevel, type MasteryLevel } from "@/lib/mastery";
import { useToast } from "@/hooks/use-toast";

export default function EditMasteryLevelPage() {
  const router = useRouter();
  const params = useParams();
  const modelId = params.id as string;
  const levelId = params.levelId as string;
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);
  const [formData, setFormData] = useState({
    label: "",
    description: "",
    display_order: 1,
    is_terminal: false,
  });

  useEffect(() => {
    const fetchLevel = async () => {
      if (!levelId) return;
      try {
        setLoading(true);
        const level = await getMasteryLevel(levelId);
        if (level) {
          setFormData({
            label: level.label,
            description: level.description || "",
            display_order: level.display_order,
            is_terminal: level.is_terminal,
          });
        }
      } catch (error) {
        console.error("Error fetching mastery level", error);
        toast({
          title: "Error",
          description: "Failed to load mastery level",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchLevel();
  }, [levelId, toast]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!levelId) return;

    try {
      setSubmitting(true);
      await updateMasteryLevel(levelId, {
        label: formData.label,
        description: formData.description || null,
        display_order: formData.display_order,
        is_terminal: formData.is_terminal,
      });
      toast({
        title: "Success",
        description: "Mastery level updated successfully",
      });
      router.push(`/sis/mastery/setup/models/${modelId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to update mastery level",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit Mastery Level</h1>
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
          onClick={() => router.push(`/sis/mastery/setup/models/${modelId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Edit Mastery Level</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Not Started, Emerging, Developing, Proficient, Mastered"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of this mastery level"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order *</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    display_order: parseInt(e.target.value) || 1,
                  })
                }
                min={1}
                required
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first. Levels are ordered by this value.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_terminal"
                checked={formData.is_terminal}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_terminal: checked })
                }
              />
              <Label htmlFor="is_terminal" className="cursor-pointer">
                Terminal Level
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Terminal levels indicate the highest achievement level (e.g., "Mastered").
            </p>
            <div className="flex gap-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Updating..." : "Update Level"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/sis/mastery/setup/models/${modelId}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
