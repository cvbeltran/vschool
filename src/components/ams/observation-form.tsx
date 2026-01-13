"use client";

import { useState, useEffect } from "react";
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
import { supabase } from "@/lib/supabase/client";
import { Competency, Indicator, CompetencyLevel } from "@/lib/obs";

interface ObservationFormProps {
  learnerId: string;
  experienceId: string;
  competencyId: string;
  indicators: Indicator[];
  competencyLevels: CompetencyLevel[];
  initialData?: {
    competency_level_id: string;
    notes: string | null;
    indicator_ids: string[];
  };
  onSubmit: (data: {
    competency_level_id: string;
    notes: string | null;
    indicator_ids: string[];
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function ObservationForm({
  learnerId,
  experienceId,
  competencyId,
  indicators,
  competencyLevels,
  initialData,
  onSubmit,
  isSubmitting = false,
}: ObservationFormProps) {
  const [competencyLevelId, setCompetencyLevelId] = useState(
    initialData?.competency_level_id || ""
  );
  const [notes, setNotes] = useState(initialData?.notes || "");
  const [selectedIndicatorIds, setSelectedIndicatorIds] = useState<string[]>(
    initialData?.indicator_ids || []
  );
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!competencyLevelId) {
      setError("Competency level is required");
      return;
    }

    try {
      await onSubmit({
        competency_level_id: competencyLevelId,
        notes: notes.trim() || null,
        indicator_ids: selectedIndicatorIds,
      });
    } catch (err: any) {
      setError(err.message || "Failed to save observation");
    }
  };

  const toggleIndicator = (indicatorId: string) => {
    setSelectedIndicatorIds((prev) =>
      prev.includes(indicatorId)
        ? prev.filter((id) => id !== indicatorId)
        : [...prev, indicatorId]
    );
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      <div className="space-y-2">
        <Label htmlFor="competency_level_id">
          Competency Level <span className="text-destructive">*</span>
        </Label>
        <Select
          value={competencyLevelId}
          onValueChange={setCompetencyLevelId}
          disabled={isSubmitting}
          required
        >
          <SelectTrigger>
            <SelectValue placeholder="Select a competency level (required)" />
          </SelectTrigger>
          <SelectContent>
            {competencyLevels.map((level) => (
              <SelectItem key={level.id} value={level.id}>
                {level.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        <p className="text-xs text-muted-foreground">
          Select the level that best describes the learner's demonstration of this competency.
        </p>
      </div>

      <div className="space-y-2">
        <Label>Indicators Observed</Label>
        <div className="space-y-2 max-h-48 overflow-y-auto border rounded-md p-2">
          {indicators.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No indicators available for this competency
            </p>
          ) : (
            indicators.map((indicator) => (
              <label
                key={indicator.id}
                className="flex items-start gap-2 p-2 hover:bg-muted rounded cursor-pointer"
              >
                <input
                  type="checkbox"
                  checked={selectedIndicatorIds.includes(indicator.id)}
                  onChange={() => toggleIndicator(indicator.id)}
                  disabled={isSubmitting}
                  className="mt-1"
                />
                <span className="text-sm">{indicator.description}</span>
              </label>
            ))
          )}
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="notes">Notes</Label>
        <Textarea
          id="notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional qualitative notes about this observation"
          rows={4}
          disabled={isSubmitting}
        />
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" disabled={isSubmitting || !competencyLevelId}>
          {isSubmitting ? "Saving..." : "Save Observation"}
        </Button>
      </div>
    </form>
  );
}
