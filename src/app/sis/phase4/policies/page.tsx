"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Archive } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listGradePolicies,
  createGradePolicy,
  updateGradePolicy,
  archiveGradePolicy,
  type GradePolicy,
} from "@/lib/phase4/policies";
import { GradePolicyForm } from "@/components/phase4/grade-policy-form";

export default function PoliciesPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [policies, setPolicies] = useState<GradePolicy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingPolicy, setEditingPolicy] = useState<GradePolicy | null>(null);
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

      // Fetch policies
      try {
        const data = await listGradePolicies(
          isSuperAdmin ? null : organizationId || null
        );
        setPolicies(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching grade policies:", err);
        setError(err.message || "Failed to load grade policies");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canEdit = role === "principal" || role === "admin";

  const handleCreate = () => {
    setEditingPolicy(null);
    setIsFormOpen(true);
  };

  const handleEdit = (policy: GradePolicy) => {
    setEditingPolicy(policy);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    policy_name: string;
    policy_type: "letter_grade" | "descriptor" | "pass_fail";
    description: string | null;
    school_id: string | null;
    program_id: string | null;
    is_active: boolean;
    effective_start_date: string | null;
    effective_end_date: string | null;
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
        throw new Error("Organization ID not found");
      }

      if (editingPolicy) {
        await updateGradePolicy(editingPolicy.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createGradePolicy({
          ...data,
          organization_id: orgId,
          created_by: session.user.id,
        });
      }

      setIsFormOpen(false);
      setEditingPolicy(null);

      // Refresh list
      const updated = await listGradePolicies(
        isSuperAdmin ? null : organizationId || null
      );
      setPolicies(updated);
    } catch (err: any) {
      console.error("Error saving grade policy:", err);
      setError(err.message || "Failed to save grade policy");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this policy?")) {
      return;
    }

    setArchivingId(id);
    try {
      await archiveGradePolicy(id);
      const updated = await listGradePolicies(
        isSuperAdmin ? null : organizationId || null
      );
      setPolicies(updated);
    } catch (err: any) {
      console.error("Error archiving policy:", err);
      setError(err.message || "Failed to archive policy");
    } finally {
      setArchivingId(null);
    }
  };

  if (orgLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Grade Policies</h1>
        {canEdit && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Policy
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      {policies.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            {canEdit
              ? "No grade policies yet. Create your first policy to define how learning evidence translates to grades."
              : "No grade policies available."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {policies.map((policy) => (
            <Card key={policy.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>{policy.policy_name}</CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      Type: {policy.policy_type.replace("_", " ")}
                      {policy.school_id && " • School-scoped"}
                      {policy.program_id && " • Program-scoped"}
                    </p>
                  </div>
                  {canEdit && (
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(policy)}
                      >
                        <Edit2 className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleArchive(policy.id)}
                        disabled={archivingId === policy.id}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                {policy.description && (
                  <p className="text-sm text-gray-700 mb-2">
                    {policy.description}
                  </p>
                )}
                <div className="flex gap-4 text-sm text-gray-600">
                  <span>
                    Status: {policy.is_active ? "Active" : "Inactive"}
                  </span>
                  {policy.effective_start_date && (
                    <span>
                      Start: {new Date(policy.effective_start_date).toLocaleDateString()}
                    </span>
                  )}
                  {policy.effective_end_date && (
                    <span>
                      End: {new Date(policy.effective_end_date).toLocaleDateString()}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {isFormOpen && (
        <GradePolicyForm
          policy={editingPolicy}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingPolicy(null);
          }}
          isSubmitting={isSubmitting}
          organizationId={isSuperAdmin ? null : organizationId || null}
        />
      )}
    </div>
  );
}
