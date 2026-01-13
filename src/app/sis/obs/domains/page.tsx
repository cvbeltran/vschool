"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus, Edit2, Archive } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getDomains,
  createDomain,
  updateDomain,
  archiveDomain,
  type Domain,
} from "@/lib/obs";
import { DomainForm } from "@/components/obs/domain-form";

export default function DomainsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingDomain, setEditingDomain] = useState<Domain | null>(null);
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

      // Fetch domains
      try {
        const data = await getDomains(
          isSuperAdmin ? null : organizationId || null
        );
        setDomains(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching domains:", err);
        setError(err.message || "Failed to load domains");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canEdit = role === "principal" || role === "admin";

  const handleCreate = () => {
    setEditingDomain(null);
    setIsFormOpen(true);
  };

  const handleEdit = (domain: Domain) => {
    setEditingDomain(domain);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: { name: string; description: string | null }) => {
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

      if (editingDomain) {
        await updateDomain(editingDomain.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createDomain({
          organization_id: orgId,
          name: data.name,
          description: data.description,
          created_by: session.user.id,
        });
      }

      // Refresh domains list
      const updatedDomains = await getDomains(
        isSuperAdmin ? null : organizationId || null
      );
      setDomains(updatedDomains);
      setIsFormOpen(false);
      setEditingDomain(null);
    } catch (err: any) {
      console.error("Error saving domain:", err);
      setError(err.message || "Failed to save domain");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (domain: Domain) => {
    if (!confirm(`Archive domain "${domain.name}"? This will hide it from the list.`)) {
      return;
    }

    setArchivingId(domain.id);
    setError(null);

    try {
      await archiveDomain(domain.id);
      // Refresh domains list
      const updatedDomains = await getDomains(
        isSuperAdmin ? null : organizationId || null
      );
      setDomains(updatedDomains);
    } catch (err: any) {
      console.error("Error archiving domain:", err);
      setError(err.message || "Failed to archive domain");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Domains</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Domains</h1>
          <p className="text-sm text-muted-foreground mt-1">
            High-level learning areas that organize competencies
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Domain
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

      {domains.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No domains yet</div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Domains are high-level learning areas that organize competencies. Create your first domain to begin building your outcome-based structure."
                : "Domains will appear here once created by an administrator."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
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
              {domains.map((domain) => (
                <tr key={domain.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {domain.name}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {domain.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(domain)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(domain)}
                          disabled={archivingId === domain.id}
                          className="gap-1 text-muted-foreground"
                        >
                          <Archive className="size-4" />
                          {archivingId === domain.id ? "Archiving..." : "Archive"}
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

      <DomainForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        domain={editingDomain}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
