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
import { Experience } from "@/lib/ams";
import { supabase } from "@/lib/supabase/client";

interface ExperienceFormProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  experience?: Experience | null;
  organizationId: string | null;
  isSuperAdmin: boolean;
  onSubmit: (data: {
    name: string;
    description: string | null;
    experience_type: string | null;
    program_id: string | null;
    section_id: string | null;
    batch_id: string | null;
    term_id: string | null;
    start_at: string | null;
    end_at: string | null;
  }) => Promise<void>;
  isSubmitting?: boolean;
}

interface Program {
  id: string;
  name: string;
  school_id: string;
}

interface Section {
  id: string;
  name: string;
  program_id: string;
}

interface Batch {
  id: string;
  name: string;
}

export function ExperienceForm({
  open,
  onOpenChange,
  experience,
  organizationId,
  isSuperAdmin,
  onSubmit,
  isSubmitting = false,
}: ExperienceFormProps) {
  const [name, setName] = useState(experience?.name || "");
  const [description, setDescription] = useState(experience?.description || "");
  const [experienceType, setExperienceType] = useState(
    experience?.experience_type || ""
  );
  const [programId, setProgramId] = useState(experience?.program_id || "");
  const [sectionId, setSectionId] = useState(experience?.section_id || "");
  const [batchId, setBatchId] = useState(experience?.batch_id || "");
  const [termId, setTermId] = useState(experience?.term_id || "");
  const [startAt, setStartAt] = useState(
    experience?.start_at ? experience.start_at.split("T")[0] : ""
  );
  const [endAt, setEndAt] = useState(
    experience?.end_at ? experience.end_at.split("T")[0] : ""
  );
  const [error, setError] = useState<string | null>(null);

  const [programs, setPrograms] = useState<Program[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [batches, setBatches] = useState<Batch[]>([]);

  useEffect(() => {
    if (experience) {
      setName(experience.name);
      setDescription(experience.description || "");
      setExperienceType(experience.experience_type || "");
      setProgramId(experience.program_id || "");
      setSectionId(experience.section_id || "");
      setBatchId(experience.batch_id || "");
      setTermId(experience.term_id || "");
      setStartAt(experience.start_at ? experience.start_at.split("T")[0] : "");
      setEndAt(experience.end_at ? experience.end_at.split("T")[0] : "");
    } else {
      setName("");
      setDescription("");
      setExperienceType("");
      setProgramId("");
      setSectionId("");
      setBatchId("");
      setTermId("");
      setStartAt("");
      setEndAt("");
    }
  }, [experience, open]);

  // Fetch programs
  useEffect(() => {
    if (!open) return;

    const fetchPrograms = async () => {
      let query = supabase.from("programs").select("id, name, school_id");

      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data } = await query.order("name", { ascending: true });
      setPrograms(data || []);
    };

    fetchPrograms();
  }, [open, organizationId, isSuperAdmin]);

  // Fetch sections when program changes
  useEffect(() => {
    if (!programId) {
      setSections([]);
      setSectionId("");
      return;
    }

    const fetchSections = async () => {
      let query = supabase
        .from("sections")
        .select("id, name, program_id")
        .eq("program_id", programId);

      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data } = await query.order("name", { ascending: true });
      setSections(data || []);
    };

    fetchSections();
  }, [programId, organizationId, isSuperAdmin]);

  // Fetch batches
  useEffect(() => {
    if (!open) return;

    const fetchBatches = async () => {
      let query = supabase.from("batches").select("id, name");

      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }

      const { data } = await query.order("name", { ascending: true });
      setBatches(data || []);
    };

    fetchBatches();
  }, [open, organizationId, isSuperAdmin]);

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
        experience_type: experienceType || null,
        program_id: programId || null,
        section_id: sectionId || null,
        batch_id: batchId || null,
        term_id: termId || null,
        start_at: startAt ? `${startAt}T00:00:00Z` : null,
        end_at: endAt ? `${endAt}T23:59:59Z` : null,
      });
      // Reset form on success
      setName("");
      setDescription("");
      setExperienceType("");
      setProgramId("");
      setSectionId("");
      setBatchId("");
      setTermId("");
      setStartAt("");
      setEndAt("");
      onOpenChange(false);
    } catch (err: any) {
      setError(err.message || "Failed to save experience");
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
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {experience ? "Edit Experience" : "Create Experience"}
          </DialogTitle>
          <DialogDescription>
            {experience
              ? "Update the experience information."
              : "Create a new learning activity where observations happen."}
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
                placeholder="e.g., Science Lab Session, Art Studio Project"
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
                placeholder="Optional description of this experience"
                rows={4}
                disabled={isSubmitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="experience_type">Experience Type</Label>
              <Input
                id="experience_type"
                value={experienceType}
                onChange={(e) => setExperienceType(e.target.value)}
                placeholder="e.g., mentoring, apprenticeship, lab, studio, project"
                disabled={isSubmitting}
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="program_id">Program</Label>
                <Select
                  value={programId || undefined}
                  onValueChange={(value) => {
                    setProgramId(value === "__none__" ? "" : value);
                    setSectionId(""); // Reset section when program changes
                  }}
                  disabled={isSubmitting}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Optional" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="section_id">Section</Label>
                <Select
                  value={sectionId || undefined}
                  onValueChange={(value) => setSectionId(value === "__none__" ? "" : value)}
                  disabled={isSubmitting || !programId}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={programId ? "Optional" : "Select program first"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch_id">Batch</Label>
              <Select
                value={batchId || undefined}
                onValueChange={(value) => setBatchId(value === "__none__" ? "" : value)}
                disabled={isSubmitting}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_at">Start Date</Label>
                <Input
                  id="start_at"
                  type="date"
                  value={startAt}
                  onChange={(e) => setStartAt(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_at">End Date</Label>
                <Input
                  id="end_at"
                  type="date"
                  value={endAt}
                  onChange={(e) => setEndAt(e.target.value)}
                  disabled={isSubmitting}
                />
              </div>
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
              {isSubmitting ? "Saving..." : experience ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
