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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";
import {
  getExperienceCompetencyLinks,
  createObservation,
  type ExperienceCompetencyLink,
} from "@/lib/ams";
import { getIndicators, getCompetencyLevels, type Indicator, type CompetencyLevel } from "@/lib/obs";
import { ObservationForm } from "./observation-form";

interface RecordObservationModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experienceId: string;
  organizationId: string | null;
  isSuperAdmin: boolean;
  initialLearnerId?: string;
  initialCompetencyId?: string;
  onSuccess?: () => void;
}

interface Student {
  id: string;
  first_name: string;
  last_name: string;
}

export function RecordObservationModal({
  open,
  onOpenChange,
  experienceId,
  organizationId,
  isSuperAdmin,
  initialLearnerId,
  initialCompetencyId,
  onSuccess,
}: RecordObservationModalProps) {
  const [learners, setLearners] = useState<Student[]>([]);
  const [competencyLinks, setCompetencyLinks] = useState<ExperienceCompetencyLink[]>([]);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [competencyLevels, setCompetencyLevels] = useState<CompetencyLevel[]>([]);
  const [selectedLearnerId, setSelectedLearnerId] = useState(initialLearnerId || "");
  const [selectedCompetencyId, setSelectedCompetencyId] = useState(initialCompetencyId || "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!open) return;

    const fetchData = async () => {
      setLoading(true);
      try {
        // Fetch learners (students)
        let learnersQuery = supabase
          .from("students")
          .select("id, first_name, last_name")
          .order("last_name", { ascending: true });

        if (!isSuperAdmin && organizationId) {
          learnersQuery = learnersQuery.eq("organization_id", organizationId);
        }

        const { data: learnersData } = await learnersQuery;
        setLearners(learnersData || []);

        // Fetch competency links for this experience
        const links = await getExperienceCompetencyLinks(experienceId, organizationId);
        setCompetencyLinks(links);
        
        // Log for debugging
        console.log("Competency links fetched:", links);
        if (links.length === 0) {
          console.warn("No competency links found for experience:", experienceId);
        }

        // Fetch competency levels
        const levels = await getCompetencyLevels(
          isSuperAdmin ? null : organizationId || null
        );
        setCompetencyLevels(levels);

        // Set initial competency if provided
        if (initialCompetencyId) {
          setSelectedCompetencyId(initialCompetencyId);
        } else if (links.length > 0) {
          setSelectedCompetencyId(links[0].competency_id);
        }
      } catch (err) {
        console.error("Error fetching data:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [open, experienceId, organizationId, isSuperAdmin, initialCompetencyId]);

  // Fetch indicators when competency changes
  useEffect(() => {
    if (!selectedCompetencyId) {
      setIndicators([]);
      return;
    }

    const fetchIndicators = async () => {
      try {
        const data = await getIndicators(
          isSuperAdmin ? null : organizationId || null,
          { competencyId: selectedCompetencyId }
        );
        setIndicators(data);
      } catch (err) {
        console.error("Error fetching indicators:", err);
      }
    };

    fetchIndicators();
  }, [selectedCompetencyId, organizationId, isSuperAdmin]);

  const handleSubmit = async (data: {
    competency_level_id: string;
    notes: string | null;
    indicator_ids: string[];
  }) => {
    if (!selectedLearnerId || !selectedCompetencyId || !organizationId) {
      return;
    }

    setIsSubmitting(true);
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      await createObservation({
        organization_id: organizationId,
        learner_id: selectedLearnerId,
        experience_id: experienceId,
        competency_id: selectedCompetencyId,
        competency_level_id: data.competency_level_id,
        notes: data.notes,
        indicator_ids: data.indicator_ids,
        created_by: session.user.id,
      });

      onSuccess?.();
      onOpenChange(false);
      // Reset form
      setSelectedLearnerId(initialLearnerId || "");
      setSelectedCompetencyId(initialCompetencyId || "");
    } catch (err: any) {
      console.error("Error creating observation:", err);
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Record Observation</DialogTitle>
          <DialogDescription>
            Record evidence of learning for a learner in this experience.
          </DialogDescription>
        </DialogHeader>
        {loading ? (
          <div className="py-8 text-center text-muted-foreground">Loading...</div>
        ) : (
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="learner_id">
                Learner <span className="text-destructive">*</span>
              </Label>
              <Select
                value={selectedLearnerId}
                onValueChange={setSelectedLearnerId}
                disabled={isSubmitting || !!initialLearnerId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a learner" />
                </SelectTrigger>
                <SelectContent>
                  {learners.map((learner) => (
                    <SelectItem key={learner.id} value={learner.id}>
                      {learner.last_name}, {learner.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="competency_id">
                Competency <span className="text-destructive">*</span>
              </Label>
              {competencyLinks.length === 0 ? (
                <div className="text-sm text-muted-foreground bg-muted border rounded-md p-3">
                  <p className="font-medium mb-1">No competencies linked to this experience</p>
                  <p className="text-xs">
                    Please link competencies to this experience first before recording observations.
                    You can do this from the Experience detail page.
                  </p>
                </div>
              ) : (
                <Select
                  value={selectedCompetencyId}
                  onValueChange={setSelectedCompetencyId}
                  disabled={isSubmitting || !!initialCompetencyId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a competency" />
                  </SelectTrigger>
                  <SelectContent>
                    {competencyLinks.map((link) => (
                      <SelectItem key={link.competency_id} value={link.competency_id}>
                        {link.competency?.name || "Unknown"} ({link.emphasis})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            {selectedLearnerId && selectedCompetencyId && (
              <ObservationForm
                learnerId={selectedLearnerId}
                experienceId={experienceId}
                competencyId={selectedCompetencyId}
                indicators={indicators}
                competencyLevels={competencyLevels}
                onSubmit={handleSubmit}
                isSubmitting={isSubmitting}
              />
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
