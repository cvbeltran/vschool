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
  listFeedbackDimensions,
  createFeedbackDimension,
  updateFeedbackDimension,
  archiveFeedbackDimension,
  type FeedbackDimension,
} from "@/lib/feedback";
import {
  listReflectionPrompts,
  type ReflectionPrompt,
} from "@/lib/reflection";
import { FeedbackDimensionForm } from "@/components/feedback/feedback-dimension-form";

export default function FeedbackDimensionsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [dimensions, setDimensions] = useState<FeedbackDimension[]>([]);
  const [reflectionPrompts, setReflectionPrompts] = useState<
    ReflectionPrompt[]
  >([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [isActiveFilter, setIsActiveFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDimension, setEditingDimension] =
    useState<FeedbackDimension | null>(null);
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

      // Fetch reflection prompts for form dropdown
      try {
        const promptsData = await listReflectionPrompts(
          isSuperAdmin ? null : organizationId || null
        );
        setReflectionPrompts(promptsData);
      } catch (err: any) {
        console.error("Error fetching reflection prompts:", err);
      }

      // Fetch feedback dimensions
      try {
        const data = await listFeedbackDimensions(
          isSuperAdmin ? null : organizationId || null,
          {
            isActive:
              isActiveFilter === "all"
                ? null
                : isActiveFilter === "active"
                  ? true
                  : false,
          }
        );
        setDimensions(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching feedback dimensions:", err);
        setError(err.message || "Failed to load feedback dimensions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, isActiveFilter]);

  const canEdit = role === "principal" || role === "admin";

  const handleCreate = () => {
    setEditingDimension(null);
    setIsFormOpen(true);
  };

  const handleEdit = (dimension: FeedbackDimension) => {
    setEditingDimension(dimension);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    dimension_name: string;
    description: string | null;
    reflection_prompt_id: string | null;
    display_order: number | null;
    is_active: boolean;
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

      if (editingDimension) {
        await updateFeedbackDimension(editingDimension.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createFeedbackDimension({
          organization_id: orgId,
          dimension_name: data.dimension_name,
          description: data.description,
          reflection_prompt_id: data.reflection_prompt_id,
          display_order: data.display_order,
          is_active: data.is_active,
          created_by: session.user.id,
        });
      }

      // Refresh dimensions list
      const updatedDimensions = await listFeedbackDimensions(
        isSuperAdmin ? null : organizationId || null,
        {
          isActive:
            isActiveFilter === "all"
              ? null
              : isActiveFilter === "active"
                ? true
                : false,
        }
      );
      setDimensions(updatedDimensions);
      setIsFormOpen(false);
      setEditingDimension(null);
    } catch (err: any) {
      console.error("Error saving feedback dimension:", err);
      setError(err.message || "Failed to save feedback dimension");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (dimension: FeedbackDimension) => {
    if (
      !confirm(
        `Archive feedback dimension "${dimension.dimension_name}"? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(dimension.id);
    setError(null);

    try {
      await archiveFeedbackDimension(dimension.id);
      // Refresh dimensions list
      const updatedDimensions = await listFeedbackDimensions(
        isSuperAdmin ? null : organizationId || null,
        {
          isActive:
            isActiveFilter === "all"
              ? null
              : isActiveFilter === "active"
                ? true
                : false,
        }
      );
      setDimensions(updatedDimensions);
    } catch (err: any) {
      console.error("Error archiving feedback dimension:", err);
      setError(err.message || "Failed to archive feedback dimension");
    } finally {
      setArchivingId(null);
    }
  };

  const filteredDimensions =
    isActiveFilter === "all"
      ? dimensions
      : isActiveFilter === "active"
        ? dimensions.filter((d) => d.is_active)
        : dimensions.filter((d) => !d.is_active);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Feedback Dimensions</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Feedback Dimensions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Dimensions that students use when providing feedback on learning experiences
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Dimension
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

      <div className="flex items-center gap-2">
        <label htmlFor="active-filter" className="text-sm font-medium">
          Filter:
        </label>
        <Select value={isActiveFilter} onValueChange={setIsActiveFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All</SelectItem>
            <SelectItem value="active">Active</SelectItem>
            <SelectItem value="inactive">Inactive</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {filteredDimensions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">
              No feedback dimensions yet
            </div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Feedback dimensions are categories that students use when providing feedback. Create your first dimension to guide student feedback practice."
                : "Feedback dimensions will appear here once created by an administrator."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Dimension Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Linked Prompt
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Order
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Status
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredDimensions.map((dimension) => (
                <tr key={dimension.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {dimension.dimension_name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {dimension.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {dimension.reflection_prompt?.prompt_text || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {dimension.display_order ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {dimension.is_active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(dimension)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(dimension)}
                          disabled={archivingId === dimension.id}
                          className="gap-1 text-muted-foreground"
                        >
                          <Archive className="size-4" />
                          {archivingId === dimension.id
                            ? "Archiving..."
                            : "Archive"}
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

      <FeedbackDimensionForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        dimension={editingDimension}
        reflectionPrompts={reflectionPrompts}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
