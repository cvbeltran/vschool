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
import { Competency, Domain } from "@/lib/obs";

interface CompetencyFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  competency?: Competency | null;
  domains: Domain[];
  onSubmit: (data: {
    domain_id: string;
    name: string;
    description: string | null;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

export function CompetencyForm({
  open,
  onOpenChange,
  competency,
  domains,
  onSubmit,
  isSubmitting = false,
}: CompetencyFormProps) {
  const [domainId, setDomainId] = useState(competency?.domain_id || "");
  const [name, setName] = useState(competency?.name || "");
  const [description, setDescription] = useState(competency?.description || "");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (competency) {
      setDomainId(competency.domain_id);
      setName(competency.name);
      setDescription(competency.description || "");
    } else {
      setDomainId("");
      setName("");
      setDescription("");
    }
  }, [competency, open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!domainId) {
      setError("Domain is required");
      return;
    }

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      await onSubmit({
        domain_id: domainId,
        name: name.trim(),
        description: description.trim() || null,
      });
      // Reset form on success
      setDomainId("");
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save competency");
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {competency ? "Edit Competency" : "Create Competency"}
          </DialogTitle>
          <DialogDescription>
            {competency
              ? "Update the competency information."
              : "Create a new competency within a domain."}
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
                value={domainId}
                onValueChange={setDomainId}
                disabled={isSubmitting || !!competency}
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
              {competency && (
                <p className="text-xs text-muted-foreground">
                  Domain cannot be changed after creation
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Effective Communication, Problem Solving"
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
                placeholder="Optional description of this competency"
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
              {isSubmitting ? "Saving..." : competency ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
