"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Plus } from "lucide-react";
import { normalizeRole } from "@/lib/rbac";
import { listLabelSets, archiveLabelSet, type AssessmentLabelSet } from "@/lib/assessment-labels";

export default function LabelSetsPage() {
  const router = useRouter();
  const [labelSets, setLabelSets] = useState<AssessmentLabelSet[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
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
        const data = await listLabelSets();
        setLabelSets(data);
      } catch (error: any) {
        console.error("Error fetching label sets:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const handleArchive = async (labelSet: AssessmentLabelSet) => {
    if (!confirm(`Archive label set "${labelSet.name}"? This will hide it from the list.`)) {
      return;
    }

    try {
      setArchivingId(labelSet.id);
      await archiveLabelSet(labelSet.id);
      const updated = await listLabelSets();
      setLabelSets(updated);
    } catch (error: any) {
      console.error("Error archiving label set:", error);
      alert(error.message || "Failed to archive label set");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Label Sets</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const canManage = role === "principal" || (role === "admin" && originalRole !== "registrar");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assessment Label Sets</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Manage collections of judgment labels for assessments
          </p>
        </div>
        {canManage && (
          <Button onClick={() => router.push("/sis/assessments/label-sets/new")} className="gap-2">
            <Plus className="size-4" />
            Create Label Set
          </Button>
        )}
      </div>

      {labelSets.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No label sets yet</div>
            <div className="text-sm text-muted-foreground">
              {canManage
                ? "Create your first label set to define assessment judgment labels."
                : "No label sets have been created yet."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {labelSets.map((labelSet) => (
            <Card key={labelSet.id}>
              <CardContent className="p-6">
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-lg">{labelSet.name}</h3>
                    {labelSet.description && (
                      <p className="text-sm text-muted-foreground mt-1">{labelSet.description}</p>
                    )}
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="text-sm text-muted-foreground">
                      {labelSet.is_active ? "Active" : "Inactive"}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/sis/assessments/label-sets/${labelSet.id}`)}
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
                            onClick={() => router.push(`/sis/assessments/label-sets/${labelSet.id}/edit`)}
                          >
                            Edit
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(labelSet)}
                            disabled={archivingId === labelSet.id}
                          >
                            {archivingId === labelSet.id ? "Archiving..." : "Archive"}
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

