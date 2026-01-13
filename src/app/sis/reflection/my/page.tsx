"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Archive } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listTeacherReflections,
  createTeacherReflection,
  updateTeacherReflection,
  archiveTeacherReflection,
  type TeacherReflection,
} from "@/lib/reflection";
import {
  listReflectionPrompts,
  type ReflectionPrompt,
} from "@/lib/reflection";
import { getExperiences, type Experience } from "@/lib/ams";
import { getCompetencies, type Competency } from "@/lib/obs";
import { TeacherReflectionForm } from "@/components/reflection/teacher-reflection-form";

interface SchoolYear {
  id: string;
  year_label: string;
}

export default function MyReflectionsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [reflections, setReflections] = useState<TeacherReflection[]>([]);
  const [reflectionPrompts, setReflectionPrompts] = useState<
    ReflectionPrompt[]
  >([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [experienceFilter, setExperienceFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingReflection, setEditingReflection] =
    useState<TeacherReflection | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Fetch user role and profile ID
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setCurrentProfileId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setRole(normalizeRole(profile.role));
        }
      }

      // Fetch related data for form
      try {
        const [promptsData, experiencesData, competenciesData] =
          await Promise.all([
            listReflectionPrompts(
              isSuperAdmin ? null : organizationId || null
            ),
            getExperiences(isSuperAdmin ? null : organizationId || null),
            getCompetencies(isSuperAdmin ? null : organizationId || null),
          ]);
        setReflectionPrompts(promptsData);
        setExperiences(experiencesData);
        setCompetencies(competenciesData);
      } catch (err: any) {
        console.error("Error fetching related data:", err);
      }

      // Fetch school years
      try {
        let schoolYearsQuery = supabase
          .from("school_years")
          .select("id, year_label")
          .order("start_date", { ascending: false });

        if (!isSuperAdmin && organizationId) {
          schoolYearsQuery = schoolYearsQuery.eq(
            "organization_id",
            organizationId
          );
        }

        const { data: schoolYearsData } = await schoolYearsQuery;
        setSchoolYears(schoolYearsData || []);
      } catch (err: any) {
        console.error("Error fetching school years:", err);
      }

      // Fetch reflections
      try {
        const filters: any = {};
        if (role === "teacher" && currentProfileId) {
          filters.teacherId = currentProfileId;
        }
        if (statusFilter !== "all") {
          filters.status = statusFilter as "draft" | "completed";
        }
        if (schoolYearFilter !== "all") {
          filters.schoolYearId = schoolYearFilter;
        }
        if (quarterFilter !== "all") {
          filters.quarter = quarterFilter;
        }
        if (experienceFilter !== "all") {
          filters.experienceId = experienceFilter;
        }

        const data = await listTeacherReflections(
          isSuperAdmin ? null : organizationId || null,
          filters
        );
        setReflections(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching teacher reflections:", err);
        setError(err.message || "Failed to load reflections");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    organizationId,
    isSuperAdmin,
    orgLoading,
    role,
    currentProfileId,
    statusFilter,
    schoolYearFilter,
    quarterFilter,
    experienceFilter,
  ]);

  const canCreate =
    role === "principal" || role === "admin" || role === "teacher";
  const canEditAll = role === "principal" || role === "admin";
  const canEdit = (reflection: TeacherReflection) => {
    if (canEditAll) return true;
    if (role === "teacher" && reflection.teacher_id === currentProfileId)
      return true;
    return false;
  };

  const handleCreate = () => {
    setEditingReflection(null);
    setIsFormOpen(true);
  };

  const handleEdit = (reflection: TeacherReflection) => {
    setEditingReflection(reflection);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    reflection_prompt_id: string | null;
    experience_id: string | null;
    school_year_id: string | null;
    quarter: string | null;
    competency_id: string | null;
    reflection_text: string;
    reflected_at: string;
    status: "draft" | "completed";
  }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const orgId =
        isSuperAdmin && organizationId
          ? organizationId
          : (
              await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", session.user.id)
                .single()
            ).data?.organization_id;

      if (!orgId) {
        throw new Error("User is not associated with an organization");
      }

      if (editingReflection) {
        await updateTeacherReflection(editingReflection.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createTeacherReflection({
          organization_id: orgId,
          teacher_id: session.user.id, // Must be current user
          reflection_prompt_id: data.reflection_prompt_id,
          experience_id: data.experience_id,
          school_year_id: data.school_year_id,
          quarter: data.quarter,
          competency_id: data.competency_id,
          reflection_text: data.reflection_text,
          reflected_at: data.reflected_at,
          status: data.status,
          created_by: session.user.id,
        });
      }

      // Refresh reflections list
      const filters: any = {};
      if (role === "teacher" && currentProfileId) {
        filters.teacherId = currentProfileId;
      }
      if (statusFilter !== "all") {
        filters.status = statusFilter as "draft" | "completed";
      }
      if (schoolYearFilter !== "all") {
        filters.schoolYearId = schoolYearFilter;
      }
      if (quarterFilter !== "all") {
        filters.quarter = quarterFilter;
      }
      if (experienceFilter !== "all") {
        filters.experienceId = experienceFilter;
      }

      const updatedReflections = await listTeacherReflections(
        isSuperAdmin ? null : organizationId || null,
        filters
      );
      setReflections(updatedReflections);
      setIsFormOpen(false);
      setEditingReflection(null);
    } catch (err: any) {
      console.error("Error saving reflection:", err);
      setError(err.message || "Failed to save reflection");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (reflection: TeacherReflection) => {
    if (
      !confirm(
        `Archive this reflection? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(reflection.id);
    setError(null);

    try {
      await archiveTeacherReflection(reflection.id);
      // Refresh reflections list
      const filters: any = {};
      if (role === "teacher" && currentProfileId) {
        filters.teacherId = currentProfileId;
      }
      if (statusFilter !== "all") {
        filters.status = statusFilter as "draft" | "completed";
      }
      if (schoolYearFilter !== "all") {
        filters.schoolYearId = schoolYearFilter;
      }
      if (quarterFilter !== "all") {
        filters.quarter = quarterFilter;
      }
      if (experienceFilter !== "all") {
        filters.experienceId = experienceFilter;
      }

      const updatedReflections = await listTeacherReflections(
        isSuperAdmin ? null : organizationId || null,
        filters
      );
      setReflections(updatedReflections);
    } catch (err: any) {
      console.error("Error archiving reflection:", err);
      setError(err.message || "Failed to archive reflection");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Reflections</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Reflections</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Narrative reflections on teaching practice
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Reflection
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">School Year</label>
          <Select value={schoolYearFilter} onValueChange={setSchoolYearFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {schoolYears.map((year) => (
                <SelectItem key={year.id} value={year.id}>
                  {year.year_label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Quarter</label>
          <Select value={quarterFilter} onValueChange={setQuarterFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Q1">Q1</SelectItem>
              <SelectItem value="Q2">Q2</SelectItem>
              <SelectItem value="Q3">Q3</SelectItem>
              <SelectItem value="Q4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Experience</label>
          <Select
            value={experienceFilter}
            onValueChange={setExperienceFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {experiences.map((exp) => (
                <SelectItem key={exp.id} value={exp.id}>
                  {exp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {reflections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No reflections yet</div>
            <div className="text-sm text-muted-foreground">
              {canCreate
                ? "Reflections are narrative thoughts on your teaching practice. Create your first reflection to document your learning journey."
                : "Reflections will appear here once created."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Prompt
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Experience
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Year / Quarter
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Reflection
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Reflected At
                </th>
                {canCreate && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {reflections.map((reflection) => (
                <tr key={reflection.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {reflection.reflection_prompt?.prompt_text || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {reflection.experience?.name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {reflection.school_year?.year_label || ""}
                    {reflection.quarter ? ` / ${reflection.quarter}` : ""}
                    {!reflection.school_year && !reflection.quarter && (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {reflection.reflection_text.length > 100
                      ? reflection.reflection_text.substring(0, 100) + "..."
                      : reflection.reflection_text}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {reflection.status === "completed" ? (
                      <span className="text-green-600">Completed</span>
                    ) : (
                      <span className="text-muted-foreground">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(reflection.reflected_at).toLocaleDateString()}
                  </td>
                  {canEdit(reflection) && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(reflection)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        {canEditAll && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(reflection)}
                            disabled={archivingId === reflection.id}
                            className="gap-1 text-muted-foreground"
                          >
                            <Archive className="size-4" />
                            {archivingId === reflection.id
                              ? "Archiving..."
                              : "Archive"}
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <TeacherReflectionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        reflection={editingReflection}
        reflectionPrompts={reflectionPrompts}
        experiences={experiences}
        schoolYears={schoolYears}
        competencies={competencies}
        organizationId={organizationId}
        isSuperAdmin={isSuperAdmin || false}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
