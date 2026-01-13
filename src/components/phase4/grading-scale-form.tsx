"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import type { GradingScale } from "@/lib/phase4/policies";

interface GradingScaleFormProps {
  scale: GradingScale | null;
  policyType: "letter_grade" | "descriptor" | "pass_fail";
  onSubmit: (data: {
    grade_value: string;
    grade_label: string | null;
    description: string | null;
    is_passing: boolean | null;
    display_order: number | null;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function GradingScaleForm({
  scale,
  policyType,
  onSubmit,
  onCancel,
  isSubmitting,
}: GradingScaleFormProps) {
  const [formData, setFormData] = useState({
    grade_value: scale?.grade_value || "",
    grade_label: scale?.grade_label || "",
    description: scale?.description || "",
    is_passing: scale?.is_passing ?? null,
    display_order: scale?.display_order?.toString() || "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      grade_value: formData.grade_value,
      grade_label: formData.grade_label || null,
      description: formData.description || null,
      is_passing: formData.is_passing,
      display_order: formData.display_order ? parseInt(formData.display_order) : null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {scale ? "Edit Grading Scale" : "Create Grading Scale"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="grade_value">Grade Value *</Label>
            <Input
              id="grade_value"
              value={formData.grade_value}
              onChange={(e) =>
                setFormData({ ...formData, grade_value: e.target.value })
              }
              required
              placeholder={
                policyType === "letter_grade"
                  ? "e.g., A, B, C"
                  : policyType === "pass_fail"
                  ? "e.g., Pass, Fail"
                  : "e.g., Exceeds Expectations"
              }
            />
            <p className="text-xs text-gray-500 mt-1">
              The actual grade value displayed in reports
            </p>
          </div>

          <div>
            <Label htmlFor="grade_label">Display Label (Optional)</Label>
            <Input
              id="grade_label"
              value={formData.grade_label}
              onChange={(e) =>
                setFormData({ ...formData, grade_label: e.target.value })
              }
              placeholder="Optional display name"
            />
            <p className="text-xs text-gray-500 mt-1">
              Optional label for UI display (defaults to grade value)
            </p>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe what this grade means"
              rows={3}
            />
          </div>

          {policyType === "pass_fail" && (
            <div className="flex items-center space-x-2">
              <Switch
                id="is_passing"
                checked={formData.is_passing === true}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_passing: checked ? true : false })
                }
              />
              <Label htmlFor="is_passing">Is Passing</Label>
            </div>
          )}

          <div>
            <Label htmlFor="display_order">Display Order (Optional)</Label>
            <Input
              id="display_order"
              type="number"
              value={formData.display_order}
              onChange={(e) =>
                setFormData({ ...formData, display_order: e.target.value })
              }
              placeholder="UI ordering only"
            />
            <p className="text-xs text-gray-500 mt-1">
              For UI ordering only, no computation
            </p>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : scale ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
