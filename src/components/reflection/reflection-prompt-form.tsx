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
import { Switch } from "@/components/ui/switch";
import { ReflectionPrompt } from "@/lib/reflection";

interface ReflectionPromptFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  prompt?: ReflectionPrompt | null;
  onSubmit: (data: {
    prompt_text: string;
    description: string | null;
    display_order: number | null;
    is_active: boolean;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function ReflectionPromptForm({
  open,
  onOpenChange,
  prompt,
  onSubmit,
  isSubmitting = false,
}: ReflectionPromptFormProps) {
  const [promptText, setPromptText] = useState(prompt?.prompt_text || "");
  const [description, setDescription] = useState(prompt?.description || "");
  const [displayOrder, setDisplayOrder] = useState(
    prompt?.display_order?.toString() || ""
  );
  const [isActive, setIsActive] = useState(prompt?.is_active ?? true);
  const [error, setError] = useState<string | null>(null);

  // Reset form when prompt changes or dialog opens/closes
  useEffect(() => {
    if (open) {
      setPromptText(prompt?.prompt_text || "");
      setDescription(prompt?.description || "");
      setDisplayOrder(prompt?.display_order?.toString() || "");
      setIsActive(prompt?.is_active ?? true);
      setError(null);
    }
  }, [open, prompt]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!promptText.trim()) {
      setError("Prompt text is required");
      return;
    }

    try {
      await onSubmit({
        prompt_text: promptText.trim(),
        description: description.trim() || null,
        display_order: displayOrder ? parseInt(displayOrder, 10) : null,
        is_active: isActive,
      });
      // Reset form on success
      setPromptText("");
      setDescription("");
      setDisplayOrder("");
      setIsActive(true);
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save reflection prompt");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setPromptText(prompt?.prompt_text || "");
      setDescription(prompt?.description || "");
      setDisplayOrder(prompt?.display_order?.toString() || "");
      setIsActive(prompt?.is_active ?? true);
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {prompt ? "Edit Reflection Prompt" : "Create Reflection Prompt"}
          </DialogTitle>
          <DialogDescription>
            {prompt
              ? "Update the reflection prompt information."
              : "Create a new prompt that teachers will answer during reflection."}
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
              <Label htmlFor="prompt_text">
                Prompt Text <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="prompt_text"
                value={promptText}
                onChange={(e) => setPromptText(e.target.value)}
                placeholder={"e.g., \"What worked?\", \"What didn't?\", \"What changed from plan?\""}
                required
                rows={3}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description or guidance for this prompt"
                rows={3}
                disabled={isSubmitting}
              />
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
                Active (visible to teachers)
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
              {isSubmitting ? "Saving..." : prompt ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
