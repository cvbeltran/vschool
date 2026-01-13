"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GradeJustificationEditorProps {
  observations?: any[];
  onSubmit: (data: {
    entry_type: "observation_reference" | "competency_summary" | "domain_summary" | "manual_note";
    entry_text: string | null;
    observation_id?: string | null;
    competency_id?: string | null;
    domain_id?: string | null;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
}

export function GradeJustificationEditor({
  observations = [],
  onSubmit,
  onCancel,
  isSubmitting,
}: GradeJustificationEditorProps) {
  const [formData, setFormData] = useState({
    entry_type: "manual_note" as "observation_reference" | "competency_summary" | "domain_summary" | "manual_note",
    entry_text: "",
    observation_id: "",
    competency_id: "",
    domain_id: "",
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      entry_type: formData.entry_type,
      entry_text: formData.entry_text || null,
      observation_id: formData.observation_id || null,
      competency_id: formData.competency_id || null,
      domain_id: formData.domain_id || null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Grade Entry</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="entry_type">Entry Type *</Label>
            <Select
              value={formData.entry_type}
              onValueChange={(value: any) =>
                setFormData({ ...formData, entry_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="manual_note">Manual Note</SelectItem>
                <SelectItem value="observation_reference">Observation Reference</SelectItem>
                <SelectItem value="competency_summary">Competency Summary</SelectItem>
                <SelectItem value="domain_summary">Domain Summary</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {formData.entry_type === "observation_reference" && observations.length > 0 && (
            <div>
              <Label htmlFor="observation_id">Observation (Optional)</Label>
              <Select
                value={formData.observation_id || "none"}
                onValueChange={(value) =>
                  setFormData({ ...formData, observation_id: value === "none" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select observation" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {observations.map((obs: any) => (
                    <SelectItem key={obs.id} value={obs.id}>
                      {new Date(obs.observed_at).toLocaleDateString()} - {obs.notes?.substring(0, 50) || "No notes"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div>
            <Label htmlFor="entry_text">Entry Text</Label>
            <Textarea
              id="entry_text"
              value={formData.entry_text}
              onChange={(e) =>
                setFormData({ ...formData, entry_text: e.target.value })
              }
              placeholder="Describe this entry"
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Adding..." : "Add Entry"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
