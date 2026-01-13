"use client";

import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
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
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/lib/supabase/client";
import type { GradePolicy } from "@/lib/phase4/policies";

interface GradePolicyFormProps {
  policy: GradePolicy | null;
  onSubmit: (data: {
    policy_name: string;
    policy_type: "letter_grade" | "descriptor" | "pass_fail";
    description: string | null;
    school_id: string | null;
    program_id: string | null;
    is_active: boolean;
    effective_start_date: string | null;
    effective_end_date: string | null;
  }) => void;
  onCancel: () => void;
  isSubmitting: boolean;
  organizationId: string | null;
}

export function GradePolicyForm({
  policy,
  onSubmit,
  onCancel,
  isSubmitting,
  organizationId,
}: GradePolicyFormProps) {
  const [formData, setFormData] = useState({
    policy_name: policy?.policy_name || "",
    policy_type: (policy?.policy_type || "letter_grade") as "letter_grade" | "descriptor" | "pass_fail",
    description: policy?.description || "",
    school_id: policy?.school_id || null,
    program_id: policy?.program_id || null,
    is_active: policy?.is_active ?? true,
    effective_start_date: policy?.effective_start_date || "",
    effective_end_date: policy?.effective_end_date || "",
  });

  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchOptions = async () => {
      if (organizationId) {
        // Fetch schools
        const { data: schoolsData } = await supabase
          .from("schools")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name");

        // Fetch programs
        const { data: programsData } = await supabase
          .from("programs")
          .select("id, name")
          .eq("organization_id", organizationId)
          .order("name");

        setSchools(schoolsData || []);
        setPrograms(programsData || []);
      }
    };

    fetchOptions();
  }, [organizationId]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      ...formData,
      description: formData.description || null,
      school_id: formData.school_id || null,
      program_id: formData.program_id || null,
      effective_start_date: formData.effective_start_date || null,
      effective_end_date: formData.effective_end_date || null,
    });
  };

  return (
    <Dialog open={true} onOpenChange={(open) => !open && onCancel()}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {policy ? "Edit Grade Policy" : "Create Grade Policy"}
          </DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="policy_name">Policy Name *</Label>
            <Input
              id="policy_name"
              value={formData.policy_name}
              onChange={(e) =>
                setFormData({ ...formData, policy_name: e.target.value })
              }
              required
              placeholder="e.g., Standard A-F Grading"
            />
          </div>

          <div>
            <Label htmlFor="policy_type">Policy Type *</Label>
            <Select
              value={formData.policy_type}
              onValueChange={(value: "letter_grade" | "descriptor" | "pass_fail") =>
                setFormData({ ...formData, policy_type: value })
              }
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="letter_grade">Letter Grade (A-F)</SelectItem>
                <SelectItem value="descriptor">Descriptor (Exceeds/Meets/etc.)</SelectItem>
                <SelectItem value="pass_fail">Pass/Fail</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) =>
                setFormData({ ...formData, description: e.target.value })
              }
              placeholder="Describe how this policy translates learning evidence to grades"
              rows={3}
            />
          </div>

          {schools.length > 0 && (
            <div>
              <Label htmlFor="school_id">School (Optional)</Label>
              <Select
                value={formData.school_id || "all"}
                onValueChange={(value) =>
                  setFormData({ ...formData, school_id: value === "all" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All schools" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {programs.length > 0 && (
            <div>
              <Label htmlFor="program_id">Program (Optional)</Label>
              <Select
                value={formData.program_id || "all"}
                onValueChange={(value) =>
                  setFormData({ ...formData, program_id: value === "all" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex items-center space-x-2">
            <Switch
              id="is_active"
              checked={formData.is_active}
              onCheckedChange={(checked) =>
                setFormData({ ...formData, is_active: checked })
              }
            />
            <Label htmlFor="is_active">Active</Label>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="effective_start_date">Effective Start Date</Label>
              <Input
                id="effective_start_date"
                type="date"
                value={formData.effective_start_date}
                onChange={(e) =>
                  setFormData({ ...formData, effective_start_date: e.target.value })
                }
              />
            </div>
            <div>
              <Label htmlFor="effective_end_date">Effective End Date</Label>
              <Input
                id="effective_end_date"
                type="date"
                value={formData.effective_end_date}
                onChange={(e) =>
                  setFormData({ ...formData, effective_end_date: e.target.value })
                }
              />
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? "Saving..." : policy ? "Update" : "Create"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
