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
  listGradingScales,
  createGradingScale,
  updateGradingScale,
  archiveGradingScale,
  type GradePolicy,
  type GradingScale,
} from "@/lib/phase4/policies";
import { GradingScaleForm } from "@/components/phase4/grading-scale-form";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function ScalesPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [policies, setPolicies] = useState<GradePolicy[]>([]);
  const [selectedPolicyId, setSelectedPolicyId] = useState<string | null>(null);
  const [scales, setScales] = useState<GradingScale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingScale, setEditingScale] = useState<GradingScale | null>(null);
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
          isSuperAdmin ? null : organizationId || null,
          { isActive: true }
        );
        setPolicies(data);
        if (data.length > 0 && !selectedPolicyId) {
          setSelectedPolicyId(data[0].id);
        }
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

  useEffect(() => {
    const fetchScales = async () => {
      if (!selectedPolicyId || orgLoading) return;

      try {
        const data = await listGradingScales(
          selectedPolicyId,
          isSuperAdmin ? null : organizationId || null
        );
        setScales(data);
      } catch (err: any) {
        console.error("Error fetching grading scales:", err);
        setError(err.message || "Failed to load grading scales");
      }
    };

    fetchScales();
  }, [selectedPolicyId, organizationId, isSuperAdmin, orgLoading]);

  const canEdit = role === "principal" || role === "admin";
  const selectedPolicy = policies.find((p) => p.id === selectedPolicyId);

  const handleCreate = () => {
    if (!selectedPolicyId) {
      setError("Please select a policy first");
      return;
    }
    setEditingScale(null);
    setIsFormOpen(true);
  };

  const handleEdit = (scale: GradingScale) => {
    setEditingScale(scale);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    grade_value: string;
    grade_label: string | null;
    description: string | null;
    is_passing: boolean | null;
    display_order: number | null;
  }) => {
    if (!selectedPolicyId) {
      setError("Please select a policy");
      return;
    }

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

      if (editingScale) {
        await updateGradingScale(editingScale.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createGradingScale({
          ...data,
          organization_id: orgId,
          grade_policy_id: selectedPolicyId,
          created_by: session.user.id,
        });
      }

      setIsFormOpen(false);
      setEditingScale(null);

      // Refresh list
      const updated = await listGradingScales(
        selectedPolicyId,
        isSuperAdmin ? null : organizationId || null
      );
      setScales(updated);
    } catch (err: any) {
      console.error("Error saving grading scale:", err);
      setError(err.message || "Failed to save grading scale");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this scale?")) {
      return;
    }

    setArchivingId(id);
    try {
      await archiveGradingScale(id);
      const updated = await listGradingScales(
        selectedPolicyId!,
        isSuperAdmin ? null : organizationId || null
      );
      setScales(updated);
    } catch (err: any) {
      console.error("Error archiving scale:", err);
      setError(err.message || "Failed to archive scale");
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
        <h1 className="text-3xl font-bold">Grading Scales</h1>
        {canEdit && selectedPolicyId && (
          <Button onClick={handleCreate}>
            <Plus className="mr-2 h-4 w-4" />
            New Scale
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      <div className="mb-6">
        <label className="block text-sm font-medium mb-2">Select Policy</label>
        <Select
          value={selectedPolicyId || ""}
          onValueChange={setSelectedPolicyId}
        >
          <SelectTrigger className="w-full max-w-md">
            <SelectValue placeholder="Select a policy" />
          </SelectTrigger>
          <SelectContent>
            {policies.map((policy) => (
              <SelectItem key={policy.id} value={policy.id}>
                {policy.policy_name} ({policy.policy_type.replace("_", " ")})
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {selectedPolicy && (
        <div className="mb-4 p-3 bg-gray-50 rounded">
          <p className="text-sm">
            <strong>Policy:</strong> {selectedPolicy.policy_name} •{" "}
            <strong>Type:</strong> {selectedPolicy.policy_type.replace("_", " ")}
          </p>
        </div>
      )}

      {!selectedPolicyId ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            Please select a policy to view its grading scales.
          </CardContent>
        </Card>
      ) : scales.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            {canEdit
              ? "No grading scales yet. Create scales to define grade values for this policy."
              : "No grading scales available."}
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {scales
            .sort((a, b) => {
              if (a.display_order !== null && b.display_order !== null) {
                return a.display_order - b.display_order;
              }
              if (a.display_order !== null) return -1;
              if (b.display_order !== null) return 1;
              return a.grade_value.localeCompare(b.grade_value);
            })
            .map((scale) => (
              <Card key={scale.id}>
                <CardHeader>
                  <div className="flex justify-between items-start">
                    <div>
                      <CardTitle>
                        {scale.grade_label || scale.grade_value}
                      </CardTitle>
                      <p className="text-sm text-gray-600 mt-1">
                        Value: {scale.grade_value}
                        {scale.is_passing !== null &&
                          ` • ${scale.is_passing ? "Passing" : "Not Passing"}`}
                      </p>
                    </div>
                    {canEdit && (
                      <div className="flex gap-2">
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleEdit(scale)}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleArchive(scale.id)}
                          disabled={archivingId === scale.id}
                        >
                          <Archive className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                  </div>
                </CardHeader>
                {scale.description && (
                  <CardContent>
                    <p className="text-sm text-gray-700">{scale.description}</p>
                  </CardContent>
                )}
              </Card>
            ))}
        </div>
      )}

      {isFormOpen && selectedPolicyId && (
        <GradingScaleForm
          scale={editingScale}
          policyType={selectedPolicy?.policy_type || "letter_grade"}
          onSubmit={handleSubmit}
          onCancel={() => {
            setIsFormOpen(false);
            setEditingScale(null);
          }}
          isSubmitting={isSubmitting}
        />
      )}
    </div>
  );
}
