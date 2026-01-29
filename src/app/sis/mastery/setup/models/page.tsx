"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ExternalLink, Plus } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { listMasteryModels, archiveMasteryModel, type MasteryModel } from "@/lib/mastery";
import { normalizeRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase/client";

export default function MasteryModelsPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [models, setModels] = useState<MasteryModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
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
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          setOriginalRole(profile.role);
        }
      }

      try {
        const data = await listMasteryModels(organizationId);
        setModels(data);
      } catch (error: any) {
        console.error("Error fetching mastery models:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, orgLoading]);

  const handleArchive = async (model: MasteryModel) => {
    if (!confirm(`Archive mastery model "${model.name}"? This will hide it from the list.`)) {
      return;
    }

    try {
      setArchivingId(model.id);
      await archiveMasteryModel(model.id);
      const updated = await listMasteryModels(organizationId);
      setModels(updated);
    } catch (error: any) {
      console.error("Error archiving mastery model:", error);
      alert(error.message || "Failed to archive mastery model");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mastery Models</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const canManage = role === "principal" || (role === "admin" && originalRole !== "registrar");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mastery Models</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Configure mastery states and thresholds for your organization
          </p>
        </div>
        {canManage && (
          <Button onClick={() => router.push("/sis/mastery/setup/models/new")} className="gap-2">
            <Plus className="size-4" />
            Create Mastery Model
          </Button>
        )}
      </div>

      {models.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No mastery models yet</div>
            <div className="text-sm text-muted-foreground">
              {canManage
                ? "Create your first mastery model to define mastery levels and thresholds."
                : "No mastery models have been created yet."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((model) => (
            <Card key={model.id}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{model.name}</h3>
                    {model.description && (
                      <p className="text-sm text-muted-foreground mt-1">{model.description}</p>
                    )}
                  </div>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={model.is_active ? "default" : "secondary"}>
                        {model.is_active ? "Active" : "Inactive"}
                      </Badge>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Thresholds: Emerging={model.threshold_emerging}, Developing={model.threshold_developing}, 
                      Proficient={model.threshold_proficient}, Mastered={model.threshold_mastered}
                    </div>
                  </div>
                  <div className="flex items-center justify-between pt-2">
                    <div className="text-sm text-muted-foreground">
                      {model.program?.name || "Org-wide"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/sis/mastery/setup/models/${model.id}`)}
                        className="gap-1"
                      >
                        View
                        <ExternalLink className="size-3" />
                      </Button>
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/sis/mastery/setup/models/${model.id}/edit`)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(model)}
                            disabled={archivingId === model.id}
                          >
                            {archivingId === model.id ? "Archiving..." : "Archive"}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
