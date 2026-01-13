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
import { FeedbackDimension } from "@/lib/feedback";
import { ReflectionPrompt } from "@/lib/reflection";

interface FeedbackDimensionFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  dimension?: FeedbackDimension | null;
  reflectionPrompts: ReflectionPrompt[];
  onSubmit: (data: {
    dimension_name: string;
    description: string | null;
    reflection_prompt_id: string | null;
    display_order: number | null;
    is_active: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function FeedbackDimensionForm({
  open,
  onOpenChange,
  dimension,
  reflectionPrompts,
  onSubmit,
  isSubmitting = false,
}: FeedbackDimensionFormProps) {
  const [dimensionName, setDimensionName] = useState(
    dimension?.dimension_name || ""
  );
  const [description, setDescription] = useState(dimension?.description || "");
  const [reflectionPromptId, setReflectionPromptId] = useState(
    dimension?.reflection_prompt_id || "none"
  );
  const [displayOrder, setDisplayOrder] = useState(
    dimension?.display_order?.toString() || ""
  );
  const [isActive, setIsActive] = useState(dimension?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  // Reset form when dimension changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      setDimensionName(dimension?.dimension_name || "");
      setDescription(dimension?.description || "");
      setReflectionPromptId(dimension?.reflection_prompt_id || "none");
      setDisplayOrder(dimension?.display_order?.toString() || "");
      setIsActive(dimension?.is_active ?? true);
      setError(null);
    }
  }, [open, dimension]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!dimensionName.trim()) {
      setError("Dimension name is required");
      return;
    }

    try {
      await onSubmit({
        dimension_name: dimensionName.trim(),
        description: description.trim() || null,
        reflection_prompt_id: reflectionPromptId === "none" ? null : reflectionPromptId,
        display_order: displayOrder ? parseInt(displayOrder, 10) : null,
        is_active: isActive,
      });
      // Reset form on success
      setDimensionName("");
      setDescription("");
      setReflectionPromptId("none");
      setDisplayOrder("");
      setIsActive(true);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save feedback dimension");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setDimensionName(dimension?.dimension_name || "");
      setDescription(dimension?.description || "");
      setReflectionPromptId(dimension?.reflection_prompt_id || "none");
      setDisplayOrder(dimension?.display_order?.toString() || "");
      setIsActive(dimension?.is_active ?? true);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {dimension ? "Edit Feedback Dimension" : "Create Feedback Dimension"}
          </DialogTitle>
          <DialogDescription>
            {dimension
              ? "Update the feedback dimension information."
              : "Create a new dimension that students will use when providing feedback."}
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
              <Label htmlFor="dimension_name">
                Dimension Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="dimension_name"
                value={dimensionName}
                onChange={(e) => setDimensionName(e.target.value)}
                placeholder={"e.g., \"What worked?\", \"What didn't?\", \"What changed from plan?\""}
                required
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description or guidance for this dimension"
                rows={3}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="reflection_prompt_id">
                Linked Reflection Prompt (Optional)
              </Label>
              <Select
                value={reflectionPromptId || "none"}
                onValueChange={setReflectionPromptId}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a reflection prompt (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {reflectionPrompts.map((prompt) => (
                    <SelectItem key={prompt.id} value={prompt.id}>
                      {prompt.prompt_text}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Link this dimension to a teacher reflection prompt for alignment
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order</Label>
              <Input
                id="display_order"
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(e.target.value)}
                placeholder="Order for display (optional)"
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first. Leave empty for default ordering.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_active"
                checked={isActive}
                onCheckedChange={(checked) => setIsActive(checked === true)}
                disabled={isSubmitting}
              />
              <Label htmlFor="is_active" className="font-normal cursor-pointer">
                Active (visible to students)
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
              {isSubmitting ? "Saving..." : dimension ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
