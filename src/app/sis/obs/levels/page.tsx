"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Archive } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getCompetencyLevels,
  createCompetencyLevel,
  updateCompetencyLevel,
  archiveCompetencyLevel,
  type CompetencyLevel,
} from "@/lib/obs";
import { CompetencyLevelForm } from "@/components/obs/competency-level-form";

export default function CompetencyLevelsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [levels, setLevels] = useState<CompetencyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<CompetencyLevel | null>(
    null
  );
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Fetch user role
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setRole(normalizeRole(profile.role));
        }
      }

      // Fetch competency levels
      try {
        const data = await getCompetencyLevels(
          isSuperAdmin ? null : organizationId || null
        );
        setLevels(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching competency levels:", err);
        setError(err.message || "Failed to load competency levels");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canEdit = role === "principal" || role === "admin";

  const handleCreate = () => {
    setEditingLevel(null);
    setIsFormOpen(true);
  };

  const handleEdit = (level: CompetencyLevel) => {
    setEditingLevel(level);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    label: string;
    description: string | null;
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

      if (editingLevel) {
        await updateCompetencyLevel(editingLevel.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createCompetencyLevel({
          organization_id: orgId,
          label: data.label,
          description: data.description,
          created_by: session.user.id,
        });
      }

      // Refresh levels list
      const updatedLevels = await getCompetencyLevels(
        isSuperAdmin ? null : organizationId || null
      );
      setLevels(updatedLevels);
      setIsFormOpen(false);
      setEditingLevel(null);
    } catch (err: any) {
      console.error("Error saving competency level:", err);
      setError(err.message || "Failed to save competency level");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (level: CompetencyLevel) => {
    if (
      !confirm(
        `Archive competency level "${level.label}"? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(level.id);
    setError(null);

    try {
      await archiveCompetencyLevel(level.id);
      // Refresh levels list
      const updatedLevels = await getCompetencyLevels(
        isSuperAdmin ? null : organizationId || null
      );
      setLevels(updatedLevels);
    } catch (err: any) {
      console.error("Error archiving competency level:", err);
      setError(err.message || "Failed to archive competency level");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Competency Levels</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Competency Levels</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Qualitative labels for mentor-selected judgment
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Level
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

      {levels.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No competency levels yet</div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Competency levels are qualitative labels mentors use to describe learner progress. Create levels like 'Emerging', 'Developing', 'Proficient', or 'Advanced'."
                : "Competency levels will appear here once created by an administrator."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Label</th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Description
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {levels.map((level) => (
                <tr key={level.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {level.label}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {level.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(level)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(level)}
                          disabled={archivingId === level.id}
                          className="gap-1 text-muted-foreground"
                        >
                          <Archive className="size-4" />
                          {archivingId === level.id ? "Archiving..." : "Archive"}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <CompetencyLevelForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        level={editingLevel}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
