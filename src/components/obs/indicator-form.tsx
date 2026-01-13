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
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Indicator, Competency, Domain } from "@/lib/obs";

interface IndicatorFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  indicator?: Indicator | null;
  competencies: Competency[];
  domains: Domain[];
  onSubmit: (data: {
    competency_id: string;
    description: string;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function IndicatorForm({
  open,
  onOpenChange,
  indicator,
  competencies,
  domains,
  onSubmit,
  isSubmitting = false,
}: IndicatorFormProps) {
  const [selectedDomainId, setSelectedDomainId] = useState<string>(
    indicator?.competency?.domain_id || ""
  );
  const [competencyId, setCompetencyId] = useState(
    indicator?.competency_id || ""
  );
  const [description, setDescription] = useState(indicator?.description || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (indicator) {
      setSelectedDomainId(indicator.competency?.domain_id || "");
      setCompetencyId(indicator.competency_id);
      setDescription(indicator.description);
    } else {
      setSelectedDomainId("");
      setCompetencyId("");
      setDescription("");
    }
  }, [indicator, open]);

  // Filter competencies by selected domain
  const availableCompetencies = selectedDomainId
    ? competencies.filter((c) => c.domain_id === selectedDomainId)
    : [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!competencyId) {
      setError("Competency is required");
      return;
    }

    if (!description.trim()) {
      setError("Description is required");
      return;
    }

    try {
      await onSubmit({
        competency_id: competencyId,
        description: description.trim(),
      });
      // Reset form on success
      setSelectedDomainId("");
      setCompetencyId("");
      setDescription("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save indicator");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  };

  // Reset competency when domain changes
  useEffect(() => {
    if (selectedDomainId && competencyId) {
      const currentCompetency = competencies.find((c) => c.id === competencyId);
      if (currentCompetency?.domain_id !== selectedDomainId) {
        setCompetencyId("");
      }
    }
  }, [selectedDomainId, competencyId, competencies]);

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {indicator ? "Edit Indicator" : "Create Indicator"}
          </DialogTitle>
          <DialogDescription>
            {indicator
              ? "Update the indicator description."
              : "Create a new observable signal for a competency."}
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
              <Label htmlFor="domain_id">
                Domain <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedDomainId}
                onValueChange={setSelectedDomainId}
                disabled={isSubmitting || !!indicator}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a domain" />
                </SelectTrigger>
                <SelectContent>
                  {domains.map((domain) => (
                    <SelectItem key={domain.id} value={domain.id}>
                      {domain.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {indicator && (
                <p className="text-xs text-muted-foreground">
                  Domain cannot be changed after creation
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="competency_id">
                Competency <span className="text-destructive">*</span>
              </Label>
              <Select
                value={competencyId}
                onValueChange={setCompetencyId}
                disabled={isSubmitting || !selectedDomainId || !!indicator}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={
                      selectedDomainId
                        ? "Select a competency"
                        : "Select a domain first"
                    }
                  />
                </SelectTrigger>
                <SelectContent>
                  {availableCompetencies.map((competency) => (
                    <SelectItem key={competency.id} value={competency.id}>
                      {competency.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {indicator && (
                <p className="text-xs text-muted-foreground">
                  Competency cannot be changed after creation
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">
                Description <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe an observable signal that demonstrates this competency"
                rows={4}
                required
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
              {isSubmitting ? "Saving..." : indicator ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
