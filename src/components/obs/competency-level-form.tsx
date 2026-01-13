"use client";

import { useState } from "react";
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
import { CompetencyLevel } from "@/lib/obs";

interface CompetencyLevelFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  level?: CompetencyLevel | null;
  onSubmit: (data: { label: string; description: string | null }) => Promise<void>;
  isSubmitting?: boolean;
}

export function CompetencyLevelForm({
  open,
  onOpenChange,
  level,
  onSubmit,
  isSubmitting = false,
}: CompetencyLevelFormProps) {
  const [label, setLabel] = useState(level?.label || "");
  const [description, setDescription] = useState(level?.description || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!label.trim()) {
      setError("Label is required");
      return;
    }

    try {
      await onSubmit({
        label: label.trim(),
        description: description.trim() || null,
      });
      // Reset form on success
      setLabel("");
      setDescription("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save competency level");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setLabel(level?.label || "");
      setDescription(level?.description || "");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {level ? "Edit Competency Level" : "Create Competency Level"}
          </DialogTitle>
          <DialogDescription>
            {level
              ? "Update the competency level information."
              : "Create a qualitative label for mentor-selected judgment (e.g., 'Emerging', 'Developing', 'Proficient', 'Advanced')."}
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
              <Label htmlFor="label">
                Label <span className="text-destructive">*</span>
              </Label>
              <Input
                id="label"
                value={label}
                onChange={(e) => setLabel(e.target.value)}
                placeholder="e.g., Emerging, Developing, Proficient, Advanced"
                required
                disabled={isSubmitting}
              />
              <p className="text-xs text-muted-foreground">
                Qualitative label only - no numeric ordering
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this competency level"
                rows={4}
                disabled={isSubmitting}
              />
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
              {isSubmitting ? "Saving..." : level ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
