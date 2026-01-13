"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, X } from "lucide-react";
import {
  getExperienceCompetencyLinks,
  linkCompetencyToExperience,
  unlinkCompetencyFromExperience,
  updateCompetencyLinkEmphasis,
  type ExperienceCompetencyLink,
} from "@/lib/ams";
import { getCompetencies, type Competency } from "@/lib/obs";

interface ExperienceCompetencyLinkEditorProps {
  experienceId: string;
  organizationId: string | null;
  isSuperAdmin: boolean;
  canEdit: boolean;
  onUpdate?: () => void;
}

export function ExperienceCompetencyLinkEditor({
  experienceId,
  organizationId,
  isSuperAdmin,
  canEdit,
  onUpdate,
}: ExperienceCompetencyLinkEditorProps) {
  const [links, setLinks] = useState<ExperienceCompetencyLink[]>([]);
  const [availableCompetencies, setAvailableCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [selectedCompetencyId, setSelectedCompetencyId] = useState("");
  const [selectedEmphasis, setSelectedEmphasis] = useState<"Primary" | "Secondary" | "Contextual">("Primary");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        const [linksData, competenciesData] = await Promise.all([
          getExperienceCompetencyLinks(experienceId),
          getCompetencies(isSuperAdmin ? null : organizationId || null),
        ]);

        setLinks(linksData);
        // Filter out competencies that are already linked
        const linkedCompetencyIds = new Set(linksData.map((l) => l.competency_id));
        const available = competenciesData.filter(
          (c) => !linkedCompetencyIds.has(c.id)
        );
        setAvailableCompetencies(available);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching competency links:", err);
        setError(err.message || "Failed to load competency links");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [experienceId, organizationId, isSuperAdmin]);

  const handleAdd = async () => {
    if (!selectedCompetencyId || !organizationId) {
      setError("Please select a competency");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await linkCompetencyToExperience(
        experienceId,
        selectedCompetencyId,
        selectedEmphasis,
        organizationId
      );

      // Refresh links
      const updatedLinks = await getExperienceCompetencyLinks(experienceId);
      setLinks(updatedLinks);

      // Update available competencies
      const competenciesData = await getCompetencies(
        isSuperAdmin ? null : organizationId || null
      );
      const linkedCompetencyIds = new Set(updatedLinks.map((l) => l.competency_id));
      const available = competenciesData.filter(
        (c) => !linkedCompetencyIds.has(c.id)
      );
      setAvailableCompetencies(available);

      // Reset form
      setSelectedCompetencyId("");
      setSelectedEmphasis("Primary");
      setIsAddDialogOpen(false);
      onUpdate?.();
    } catch (err: any) {
      console.error("Error adding competency link:", err);
      setError(err.message || "Failed to add competency link");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleRemove = async (competencyId: string) => {
    if (!confirm("Remove this competency link?")) {
      return;
    }

    try {
      await unlinkCompetencyFromExperience(experienceId, competencyId);

      // Refresh links
      const updatedLinks = await getExperienceCompetencyLinks(experienceId);
      setLinks(updatedLinks);

      // Update available competencies
      const competenciesData = await getCompetencies(
        isSuperAdmin ? null : organizationId || null
      );
      const linkedCompetencyIds = new Set(updatedLinks.map((l) => l.competency_id));
      const available = competenciesData.filter(
        (c) => !linkedCompetencyIds.has(c.id)
      );
      setAvailableCompetencies(available);
      onUpdate?.();
    } catch (err: any) {
      console.error("Error removing competency link:", err);
      setError(err.message || "Failed to remove competency link");
    }
  };

  const handleUpdateEmphasis = async (
    competencyId: string,
    emphasis: "Primary" | "Secondary" | "Contextual"
  ) => {
    try {
      await updateCompetencyLinkEmphasis(experienceId, competencyId, emphasis);

      // Refresh links
      const updatedLinks = await getExperienceCompetencyLinks(experienceId);
      setLinks(updatedLinks);
      onUpdate?.();
    } catch (err: any) {
      console.error("Error updating emphasis:", err);
      setError(err.message || "Failed to update emphasis");
    }
  };

  if (loading) {
    return (
      <div className="text-muted-foreground text-sm">Loading competency links...</div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Linked Competencies</h2>
        {canEdit && availableCompetencies.length > 0 && (
          <Button onClick={() => setIsAddDialogOpen(true)} className="gap-2">
            <Plus className="size-4" />
            Add Competency
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {links.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">
              No competencies linked yet
            </div>
            <div className="text-sm text-muted-foreground">
              Link competencies to this experience to guide observations.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {links.map((link) => (
            <Card key={link.id}>
              <CardContent className="py-4">
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    <div className="font-medium">
                      {link.competency?.name || "Unknown Competency"}
                    </div>
                    {link.competency?.domain && (
                      <div className="text-sm text-muted-foreground">
                        {link.competency.domain.name}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    {canEdit ? (
                      <Select
                        value={link.emphasis}
                        onValueChange={(value: "Primary" | "Secondary" | "Contextual") =>
                          handleUpdateEmphasis(link.competency_id, value)
                        }
                      >
                        <SelectTrigger className="w-[140px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Primary">Primary</SelectItem>
                          <SelectItem value="Secondary">Secondary</SelectItem>
                          <SelectItem value="Contextual">Contextual</SelectItem>
                        </SelectContent>
                      </Select>
                    ) : (
                      <Badge variant="outline">{link.emphasis}</Badge>
                    )}
                    {canEdit && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleRemove(link.competency_id)}
                        className="gap-1 text-muted-foreground"
                      >
                        <X className="size-4" />
                        Remove
                      </Button>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Competency</DialogTitle>
            <DialogDescription>
              Link a competency to this experience and set its emphasis level.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="competency">
                Competency <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedCompetencyId}
                onValueChange={setSelectedCompetencyId}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a competency" />
                </SelectTrigger>
                <SelectContent>
                  {availableCompetencies.map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name} {comp.domain && `(${comp.domain.name})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="emphasis">
                Emphasis <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedEmphasis}
                onValueChange={(value: "Primary" | "Secondary" | "Contextual") =>
                  setSelectedEmphasis(value)
                }
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Primary">Primary</SelectItem>
                  <SelectItem value="Secondary">Secondary</SelectItem>
                  <SelectItem value="Contextual">Contextual</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Emphasis guides attention but does not influence competency levels.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsAddDialogOpen(false);
                setSelectedCompetencyId("");
                setSelectedEmphasis("Primary");
                setError(null);
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button onClick={handleAdd} disabled={isSubmitting || !selectedCompetencyId}>
              {isSubmitting ? "Adding..." : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
