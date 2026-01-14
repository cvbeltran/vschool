"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Save, CheckCircle } from "lucide-react";
import {
  createSyllabus,
  updateSyllabus,
  publishSyllabus,
  manageContributors,
  upsertSyllabusWeek,
  listSyllabusContributors,
  listSyllabusWeeks,
  type Syllabus,
} from "@/lib/phase6/syllabus";
import { getExperiences, type Experience } from "@/lib/ams";

interface Week {
  id?: string; // For existing weeks
  week_number: number;
  week_start_date: string;
  week_end_date: string;
  objectives: string[];
  activities: string[];
  verification_method: string;
}

interface Program {
  id: string;
  name: string;
}

interface Teacher {
  id: string;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
}

interface SyllabusFormProps {
  syllabus?: Syllabus | null;
  organizationId: string | null;
  isSuperAdmin: boolean;
  onSuccess: (syllabusId: string) => void;
  onCancel: () => void;
}

export function SyllabusForm({
  syllabus,
  organizationId,
  isSuperAdmin,
  onSuccess,
  onCancel,
}: SyllabusFormProps) {
  const isEdit = !!syllabus;
  const isPublished = syllabus?.status === "published";
  const isDraft = !syllabus || syllabus.status === "draft";

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [programId, setProgramId] = useState("");
  const [subject, setSubject] = useState("");
  const [experienceId, setExperienceId] = useState("");
  const [selectedContributors, setSelectedContributors] = useState<string[]>([]);
  const [weeks, setWeeks] = useState<Week[]>([]);
  const [existingWeekIds, setExistingWeekIds] = useState<Map<number, string>>(
    new Map()
  );

  // Data loading
  const [programs, setPrograms] = useState<Program[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);

  // Load existing data if editing
  useEffect(() => {
    const loadData = async () => {
      if (!organizationId) return;

      try {
        setLoading(true);

        // Get current user
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setCurrentUserId(session.user.id);
        }

        // Fetch programs
        let programsQuery = supabase
          .from("programs")
          .select("id, name")
          .order("name", { ascending: true });

        if (!isSuperAdmin && organizationId) {
          programsQuery = programsQuery.eq("organization_id", organizationId);
        }

        const { data: programsData } = await programsQuery;
        setPrograms((programsData || []) as Program[]);

        // Fetch experiences
        const experiencesData = await getExperiences(
          isSuperAdmin ? null : organizationId || null
        );
        setExperiences(experiencesData);

        // Fetch teachers
        let teachersQuery = supabase
          .from("profiles")
          .select("id, first_name, last_name, email")
          .in("role", ["teacher", "principal", "admin"])
          .order("first_name", { ascending: true });

        if (!isSuperAdmin && organizationId) {
          teachersQuery = teachersQuery.eq("organization_id", organizationId);
        }

        const { data: teachersData } = await teachersQuery;
        setTeachers((teachersData || []) as Teacher[]);

        // Load existing syllabus data if editing
        if (syllabus) {
          setName(syllabus.name || "");
          setDescription(syllabus.description || "");
          setProgramId(syllabus.program_id || "");
          setSubject(syllabus.subject || "");
          setExperienceId(syllabus.experience_id || "");

          // Load contributors
          const contributors = await listSyllabusContributors(syllabus.id);
          setSelectedContributors(
            contributors.map((c) => c.teacher_id).filter((id) => id !== syllabus.created_by)
          );

          // Load weeks
          const existingWeeks = await listSyllabusWeeks(syllabus.id);
          const weekMap = new Map<number, string>();
          const weeksData: Week[] = existingWeeks.map((week) => {
            weekMap.set(week.week_number, week.id);
            return {
              id: week.id,
              week_number: week.week_number,
              week_start_date: week.week_start_date || "",
              week_end_date: week.week_end_date || "",
              objectives: week.objectives || [],
              activities: week.activities || [],
              verification_method: week.verification_method || "",
            };
          });
          setWeeks(weeksData);
          setExistingWeekIds(weekMap);
        }
      } catch (err: any) {
        console.error("Error loading data:", err);
        setError(err.message || "Failed to load form data");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [syllabus, organizationId, isSuperAdmin]);

  const addWeek = () => {
    const weekNumber = weeks.length > 0
      ? Math.max(...weeks.map((w) => w.week_number)) + 1
      : 1;
    setWeeks([
      ...weeks,
      {
        week_number: weekNumber,
        week_start_date: "",
        week_end_date: "",
        objectives: [],
        activities: [],
        verification_method: "",
      },
    ]);
  };

  const removeWeek = (index: number) => {
    const newWeeks = weeks.filter((_, i) => i !== index);
    setWeeks(newWeeks);
  };

  const updateWeek = (index: number, field: keyof Week, value: any) => {
    const newWeeks = [...weeks];
    newWeeks[index] = { ...newWeeks[index], [field]: value };
    setWeeks(newWeeks);
  };

  const addObjective = (weekIndex: number) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex].objectives = [...newWeeks[weekIndex].objectives, ""];
    setWeeks(newWeeks);
  };

  const removeObjective = (weekIndex: number, objIndex: number) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex].objectives = newWeeks[weekIndex].objectives.filter(
      (_, i) => i !== objIndex
    );
    setWeeks(newWeeks);
  };

  const updateObjective = (
    weekIndex: number,
    objIndex: number,
    value: string
  ) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex].objectives[objIndex] = value;
    setWeeks(newWeeks);
  };

  const addActivity = (weekIndex: number) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex].activities = [...newWeeks[weekIndex].activities, ""];
    setWeeks(newWeeks);
  };

  const removeActivity = (weekIndex: number, actIndex: number) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex].activities = newWeeks[weekIndex].activities.filter(
      (_, i) => i !== actIndex
    );
    setWeeks(newWeeks);
  };

  const updateActivity = (
    weekIndex: number,
    actIndex: number,
    value: string
  ) => {
    const newWeeks = [...weeks];
    newWeeks[weekIndex].activities[actIndex] = value;
    setWeeks(newWeeks);
  };

  const handleSubmit = async (publish: boolean = false) => {
    setError(null);

    if (!name.trim()) {
      setError("Syllabus title is required");
      return;
    }

    if (!organizationId) {
      setError("Organization context is required");
      return;
    }

    setIsSubmitting(true);

    try {
      let syllabusId: string;

      if (isEdit) {
        // Update existing syllabus
        const updated = await updateSyllabus(syllabus!.id, {
          name: name.trim(),
          description: description.trim() || null,
          program_id: programId || null,
          subject: subject.trim() || null,
          experience_id: experienceId || null,
          status: publish ? "published" : "draft",
        });
        syllabusId = updated.id;

        // If publishing, also set published_at and published_by
        if (publish) {
          await publishSyllabus(syllabusId);
        }
      } else {
        // Create new syllabus
        const created = await createSyllabus({
          organization_id: organizationId,
          name: name.trim(),
          description: description.trim() || null,
          program_id: programId || null,
          subject: subject.trim() || null,
          experience_id: experienceId || null,
          status: publish ? "published" : "draft",
        });
        syllabusId = created.id;
      }

      // Update contributors
      if (isEdit) {
        // Get existing contributors
        const existingContributors = await listSyllabusContributors(syllabusId);
        const existingIds = existingContributors
          .map((c) => c.teacher_id)
          .filter((id) => id !== (syllabus?.created_by || currentUserId));

        // Remove contributors not in new list
        for (const existingId of existingIds) {
          if (!selectedContributors.includes(existingId)) {
            try {
              await manageContributors(syllabusId, "remove", {
                teacher_id: existingId,
              });
            } catch (err: any) {
              console.warn(`Failed to remove contributor:`, err);
            }
          }
        }
      }

      // Add new contributors
      for (const contributorId of selectedContributors) {
        if (contributorId !== currentUserId) {
          try {
            await manageContributors(syllabusId, "add", {
              teacher_id: contributorId,
              role: "contributor",
              permissions: "edit",
            });
          } catch (err: any) {
            // Might already exist, try update
            try {
              await manageContributors(syllabusId, "update", {
                teacher_id: contributorId,
                role: "contributor",
                permissions: "edit",
              });
            } catch (updateErr: any) {
              console.warn(`Failed to add contributor:`, updateErr);
            }
          }
        }
      }

      // Update weeks
      for (const week of weeks) {
        if (week.objectives.length > 0 || week.activities.length > 0) {
          try {
            await upsertSyllabusWeek(syllabusId, {
              week_number: week.week_number,
              week_start_date: week.week_start_date || null,
              week_end_date: week.week_end_date || null,
              objectives: week.objectives.filter((obj) => obj.trim().length > 0),
              activities: week.activities.filter((act) => act.trim().length > 0),
              verification_method: week.verification_method.trim() || null,
            });
          } catch (err: any) {
            console.warn(`Failed to save week ${week.week_number}:`, err);
          }
        }
      }

      // Success
      onSuccess(syllabusId);
    } catch (err: any) {
      console.error("Error saving syllabus:", err);
      setError(err.message || "Failed to save syllabus");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        Loading form...
      </div>
    );
  }

  if (isPublished) {
    return (
      <div className="text-center py-8">
        <p className="text-muted-foreground mb-4">
          This syllabus is published and cannot be edited directly.
        </p>
        <p className="text-sm text-muted-foreground">
          Create a new revision to make changes.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleSubmit(false);
      }}
    >
      <div className="space-y-6">
        {error && (
          <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
            {error}
          </div>
        )}

        {/* Syllabus Details */}
        <Card>
          <CardHeader>
            <CardTitle>Syllabus Details</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g., Mathematics Grade 10 Syllabus"
                required
                disabled={isSubmitting || isPublished}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of this syllabus"
                rows={4}
                disabled={isSubmitting || isPublished}
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="program_id">Program (Optional)</Label>
                <Select
                  value={programId || "none"}
                  onValueChange={(value) =>
                    setProgramId(value === "none" ? "" : value)
                  }
                  disabled={isSubmitting || isPublished}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {programs.map((program) => (
                      <SelectItem key={program.id} value={program.id}>
                        {program.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="subject">Subject (Optional)</Label>
                <Input
                  id="subject"
                  value={subject}
                  onChange={(e) => setSubject(e.target.value)}
                  placeholder="e.g., Mathematics, Science"
                  disabled={isSubmitting || isPublished}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience_id">Experience Reference (Optional)</Label>
              <Select
                value={experienceId || "none"}
                onValueChange={(value) =>
                  setExperienceId(value === "none" ? "" : value)
                }
                disabled={isSubmitting || isPublished}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select experience (read-only reference)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {experiences.map((exp) => (
                    <SelectItem key={exp.id} value={exp.id}>
                      {exp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                This is a read-only reference to Phase 2 experiences
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Contributors */}
        <Card>
          <CardHeader>
            <CardTitle>Contributors (Optional)</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Add Contributors</Label>
              <Select
                value=""
                onValueChange={(value) => {
                  if (value && !selectedContributors.includes(value)) {
                    setSelectedContributors([...selectedContributors, value]);
                  }
                }}
                disabled={isSubmitting || isPublished}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a teacher to add as contributor" />
                </SelectTrigger>
                <SelectContent>
                  {teachers
                    .filter(
                      (t) =>
                        !selectedContributors.includes(t.id) &&
                        t.id !== currentUserId
                    )
                    .map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                        {teacher.email && ` (${teacher.email})`}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </div>

            {selectedContributors.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {selectedContributors.map((contributorId) => {
                  const teacher = teachers.find((t) => t.id === contributorId);
                  return (
                    <Badge
                      key={contributorId}
                      variant="secondary"
                      className="flex items-center gap-2"
                    >
                      {teacher
                        ? `${teacher.first_name} ${teacher.last_name}`
                        : contributorId}
                      <button
                        type="button"
                        onClick={() =>
                          setSelectedContributors(
                            selectedContributors.filter((id) => id !== contributorId)
                          )
                        }
                        className="ml-1 hover:text-destructive"
                        disabled={isSubmitting || isPublished}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    </Badge>
                  );
                })}
              </div>
            )}

            {currentUserId && (
              <p className="text-xs text-muted-foreground">
                You are automatically set as the lead teacher
              </p>
            )}
          </CardContent>
        </Card>

        {/* Weekly Plans */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Weekly Plans</CardTitle>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addWeek}
                disabled={isSubmitting || isPublished}
              >
                <Plus className="mr-2 h-4 w-4" />
                Add Week
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-6">
            {weeks.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <p>No weeks added yet.</p>
                <p className="text-sm mt-2">
                  Click "Add Week" to start planning your syllabus weeks.
                </p>
              </div>
            ) : (
              weeks.map((week, weekIndex) => (
                <Card key={weekIndex} className="border-2">
                  <CardHeader>
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-lg">
                        Week {week.week_number}
                      </CardTitle>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeWeek(weekIndex)}
                        disabled={isSubmitting || isPublished}
                      >
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>Start Date (Optional)</Label>
                        <Input
                          type="date"
                          value={week.week_start_date}
                          onChange={(e) =>
                            updateWeek(weekIndex, "week_start_date", e.target.value)
                          }
                          disabled={isSubmitting || isPublished}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>End Date (Optional)</Label>
                        <Input
                          type="date"
                          value={week.week_end_date}
                          onChange={(e) =>
                            updateWeek(weekIndex, "week_end_date", e.target.value)
                          }
                          disabled={isSubmitting || isPublished}
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Planned Objectives</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addObjective(weekIndex)}
                          disabled={isSubmitting || isPublished}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add
                        </Button>
                      </div>
                      {week.objectives.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No objectives added. Click "Add" to add objectives.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {week.objectives.map((obj, objIndex) => (
                            <div key={objIndex} className="flex items-center gap-2">
                              <Input
                                value={obj}
                                onChange={(e) =>
                                  updateObjective(
                                    weekIndex,
                                    objIndex,
                                    e.target.value
                                  )
                                }
                                placeholder={`Objective ${objIndex + 1}`}
                                disabled={isSubmitting || isPublished}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  removeObjective(weekIndex, objIndex)
                                }
                                disabled={isSubmitting || isPublished}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label>Planned Activities</Label>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => addActivity(weekIndex)}
                          disabled={isSubmitting || isPublished}
                        >
                          <Plus className="mr-1 h-3 w-3" />
                          Add
                        </Button>
                      </div>
                      {week.activities.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          No activities added. Click "Add" to add activities.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {week.activities.map((act, actIndex) => (
                            <div key={actIndex} className="flex items-center gap-2">
                              <Input
                                value={act}
                                onChange={(e) =>
                                  updateActivity(
                                    weekIndex,
                                    actIndex,
                                    e.target.value
                                  )
                                }
                                placeholder={`Activity ${actIndex + 1}`}
                                disabled={isSubmitting || isPublished}
                              />
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() =>
                                  removeActivity(weekIndex, actIndex)
                                }
                                disabled={isSubmitting || isPublished}
                              >
                                <Trash2 className="h-4 w-4 text-destructive" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="space-y-2">
                      <Label>Verification Method (Optional)</Label>
                      <Textarea
                        value={week.verification_method}
                        onChange={(e) =>
                          updateWeek(weekIndex, "verification_method", e.target.value)
                        }
                        placeholder="How to verify learning for this week"
                        rows={2}
                        disabled={isSubmitting || isPublished}
                      />
                    </div>
                  </CardContent>
                </Card>
              ))
            )}
          </CardContent>
        </Card>

        {/* Actions */}
        <div className="flex items-center justify-end gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            type="submit"
            variant="outline"
            disabled={isSubmitting}
          >
            <Save className="mr-2 h-4 w-4" />
            Save as Draft
          </Button>
          {isDraft && (
            <Button
              type="button"
              onClick={() => handleSubmit(true)}
              disabled={isSubmitting}
            >
              <CheckCircle className="mr-2 h-4 w-4" />
              {isEdit ? "Update & Publish" : "Publish"}
            </Button>
          )}
        </div>
      </div>
    </form>
  );
}
