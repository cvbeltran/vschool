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
import { Domain } from "@/lib/obs";

interface DomainFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  domain?: Domain | null;
  onSubmit: (data: { name: string; description: string | null }) => Promise<void>;
  isSubmitting?: boolean;
}

export function DomainForm({
  open,
  onOpenChange,
  domain,
  onSubmit,
  isSubmitting = false,
}: DomainFormProps) {
  const [name, setName] = useState(domain?.name || "");
  const [description, setDescription] = useState(domain?.description || "");
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!name.trim()) {
      setError("Name is required");
      return;
    }

    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || null,
      });
      // Reset form on success
      setName("");
      setDescription("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save domain");
    }
  };

  // Reset form when domain changes or dialog opens/closes
  const handleOpenChange = (newOpen: boolean) => {
    if (!newOpen) {
      setName(domain?.name || "");
      setDescription(domain?.description || "");
      setError(null);
    }
    onOpenChange(newOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{domain ? "Edit Domain" : "Create Domain"}</DialogTitle>
          <DialogDescription>
            {domain
              ? "Update the domain information."
              : "Create a new domain to organize competencies."}
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
              <Label htmlFor="name">
                Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Communication, Critical Thinking"
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
                placeholder="Optional description of this domain"
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
              {isSubmitting ? "Saving..." : domain ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
