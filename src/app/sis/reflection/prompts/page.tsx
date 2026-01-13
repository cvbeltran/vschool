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
  listReflectionPrompts,
  createReflectionPrompt,
  updateReflectionPrompt,
  archiveReflectionPrompt,
  type ReflectionPrompt,
} from "@/lib/reflection";
import { ReflectionPromptForm } from "@/components/reflection/reflection-prompt-form";

export default function ReflectionPromptsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [prompts, setPrompts] = useState<ReflectionPrompt[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [isActiveFilter, setIsActiveFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPrompt, setEditingPrompt] = useState<ReflectionPrompt | null>(
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

      // Fetch reflection prompts
      try {
        const data = await listReflectionPrompts(
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
        setPrompts(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching reflection prompts:", err);
        setError(err.message || "Failed to load reflection prompts");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, isActiveFilter]);

  const canEdit = role === "principal" || role === "admin";

  const handleCreate = () => {
    setEditingPrompt(null);
    setIsFormOpen(true);
  };

  const handleEdit = (prompt: ReflectionPrompt) => {
    setEditingPrompt(prompt);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    prompt_text: string;
    description: string | null;
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

      if (editingPrompt) {
        await updateReflectionPrompt(editingPrompt.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createReflectionPrompt({
          organization_id: orgId,
          prompt_text: data.prompt_text,
          description: data.description,
          display_order: data.display_order,
          is_active: data.is_active,
          created_by: session.user.id,
        });
      }

      // Refresh prompts list
      const updatedPrompts = await listReflectionPrompts(
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
      setPrompts(updatedPrompts);
      setIsFormOpen(false);
      setEditingPrompt(null);
    } catch (err: any) {
      console.error("Error saving reflection prompt:", err);
      setError(err.message || "Failed to save reflection prompt");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (prompt: ReflectionPrompt) => {
    if (
      !confirm(
        `Archive reflection prompt "${prompt.prompt_text.substring(0, 50)}..."? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(prompt.id);
    setError(null);

    try {
      await archiveReflectionPrompt(prompt.id);
      // Refresh prompts list
      const updatedPrompts = await listReflectionPrompts(
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
      setPrompts(updatedPrompts);
    } catch (err: any) {
      console.error("Error archiving reflection prompt:", err);
      setError(err.message || "Failed to archive reflection prompt");
    } finally {
      setArchivingId(null);
    }
  };

  const filteredPrompts =
    isActiveFilter === "all"
      ? prompts
      : isActiveFilter === "active"
        ? prompts.filter((p) => p.is_active)
        : prompts.filter((p) => !p.is_active);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Reflection Prompts</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Reflection Prompts</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Prompts that teachers answer during reflection on their practice
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Prompt
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

      {filteredPrompts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No reflection prompts yet</div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Reflection prompts are questions that teachers answer during reflection. Create your first prompt to guide teacher reflection practice."
                : "Reflection prompts will appear here once created by an administrator."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Prompt Text
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Description
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
              {filteredPrompts.map((prompt) => (
                <tr key={prompt.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {prompt.prompt_text}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {prompt.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {prompt.display_order ?? (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {prompt.is_active ? (
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
                          onClick={() => handleEdit(prompt)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(prompt)}
                          disabled={archivingId === prompt.id}
                          className="gap-1 text-muted-foreground"
                        >
                          <Archive className="size-4" />
                          {archivingId === prompt.id ? "Archiving..." : "Archive"}
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

      <ReflectionPromptForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        prompt={editingPrompt}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
