"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Edit2, Archive, ExternalLink } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getExperiences,
  createExperience,
  updateExperience,
  archiveExperience,
  type Experience,
} from "@/lib/ams";
import { ExperienceForm } from "@/components/ams/experience-form";

export default function ExperiencesPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [selectedType, setSelectedType] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingExperience, setEditingExperience] =
    useState<Experience | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Fetch user role and ID
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setRole(normalizeRole(profile.role));
        }
      }

      // Fetch experiences
      try {
        const data = await getExperiences(
          isSuperAdmin ? null : organizationId || null
        );
        setExperiences(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching experiences:", err);
        setError(err.message || "Failed to load experiences");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canCreate = role === "principal" || role === "admin" || role === "teacher";
  const canEditAll = role === "principal" || role === "admin";
  const canEdit = (experience: Experience) => {
    if (canEditAll) return true;
    if (role === "teacher" && experience.created_by === userId) return true;
    return false;
  };

  const filteredExperiences =
    selectedType === "all"
      ? experiences
      : experiences.filter((e) => e.experience_type === selectedType);

  const uniqueTypes = Array.from(
    new Set(experiences.map((e) => e.experience_type).filter(Boolean))
  );

  const handleCreate = () => {
    setEditingExperience(null);
    setIsFormOpen(true);
  };

  const handleEdit = (experience: Experience) => {
    setEditingExperience(experience);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    name: string;
    description: string | null;
    experience_type: string | null;
    program_id: string | null;
    section_id: string | null;
    batch_id: string | null;
    term_id: string | null;
    start_at: string | null;
    end_at: string | null;
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
          : (await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", session.user.id)
              .single()).data?.organization_id;

      if (!orgId) {
        throw new Error("User is not associated with an organization");
      }

      if (editingExperience) {
        await updateExperience(editingExperience.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createExperience({
          organization_id: orgId,
          ...data,
          created_by: session.user.id,
        });
      }

      // Refresh experiences list
      const updatedExperiences = await getExperiences(
        isSuperAdmin ? null : organizationId || null
      );
      setExperiences(updatedExperiences);
      setIsFormOpen(false);
      setEditingExperience(null);
    } catch (err: any) {
      console.error("Error saving experience:", err);
      setError(err.message || "Failed to save experience");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (experience: Experience) => {
    if (
      !confirm(
        `Archive experience "${experience.name}"? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(experience.id);
    setError(null);

    try {
      await archiveExperience(experience.id);
      // Refresh experiences list
      const updatedExperiences = await getExperiences(
        isSuperAdmin ? null : organizationId || null
      );
      setExperiences(updatedExperiences);
    } catch (err: any) {
      console.error("Error archiving experience:", err);
      setError(err.message || "Failed to archive experience");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Experiences</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Experiences</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Learning activities where observations happen
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Experience
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

      {uniqueTypes.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="type-filter" className="text-sm font-medium">
            Filter by Type:
          </label>
          <Select value={selectedType} onValueChange={setSelectedType}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Types</SelectItem>
              {uniqueTypes.map((type) => (
                <SelectItem key={type} value={type}>
                  {type}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {experiences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No experiences yet</div>
            <div className="text-sm text-muted-foreground">
              {canCreate
                ? "Experiences are learning activities where observations happen. Create experiences to document learning moments and link them to competencies."
                : "Experiences will appear here once created."}
            </div>
          </CardContent>
        </Card>
      ) : filteredExperiences.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">
              No experiences found for selected type
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredExperiences.map((experience) => (
                <tr key={experience.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {experience.name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {experience.experience_type || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {experience.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/sis/ams/experiences/${experience.id}`)}
                        className="gap-1"
                      >
                        View
                        <ExternalLink className="size-3" />
                      </Button>
                      {canEdit(experience) && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(experience)}
                            className="gap-1"
                          >
                            <Edit2 className="size-4" />
                            Edit
                          </Button>
                          {canEditAll && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(experience)}
                              disabled={archivingId === experience.id}
                              className="gap-1 text-muted-foreground"
                            >
                              <Archive className="size-4" />
                              {archivingId === experience.id ? "Archiving..." : "Archive"}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ExperienceForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        experience={editingExperience}
        organizationId={organizationId}
        isSuperAdmin={isSuperAdmin || false}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
