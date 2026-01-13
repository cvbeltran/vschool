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
  getCompetencies,
  getDomains,
  createCompetency,
  updateCompetency,
  archiveCompetency,
  type Competency,
  type Domain,
} from "@/lib/obs";
import { CompetencyForm } from "@/components/obs/competency-form";

export default function CompetenciesPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [selectedDomainId, setSelectedDomainId] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingCompetency, setEditingCompetency] =
    useState<Competency | null>(null);
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
        const domainsData = await getDomains(
          isSuperAdmin ? null : organizationId || null
        );
        setDomains(domainsData);
      } catch (err: any) {
        console.error("Error fetching domains:", err);
      }

      // Fetch competencies
      try {
        const data = await getCompetencies(
          isSuperAdmin ? null : organizationId || null
        );
        setCompetencies(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching competencies:", err);
        setError(err.message || "Failed to load competencies");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canEdit = role === "principal" || role === "admin";

  const filteredCompetencies =
    selectedDomainId === "all"
      ? competencies
      : competencies.filter((c) => c.domain_id === selectedDomainId);

  const handleCreate = () => {
    setEditingCompetency(null);
    setIsFormOpen(true);
  };

  const handleEdit = (competency: Competency) => {
    setEditingCompetency(competency);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    domain_id: string;
    name: string;
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

      if (editingCompetency) {
        await updateCompetency(editingCompetency.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createCompetency({
          organization_id: orgId,
          domain_id: data.domain_id,
          name: data.name,
          description: data.description,
          created_by: session.user.id,
        });
      }

      // Refresh competencies list
      const updatedCompetencies = await getCompetencies(
        isSuperAdmin ? null : organizationId || null
      );
      setCompetencies(updatedCompetencies);
      setIsFormOpen(false);
      setEditingCompetency(null);
    } catch (err: any) {
      console.error("Error saving competency:", err);
      setError(err.message || "Failed to save competency");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (competency: Competency) => {
    if (
      !confirm(
        `Archive competency "${competency.name}"? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(competency.id);
    setError(null);

    try {
      await archiveCompetency(competency.id);
      // Refresh competencies list
      const updatedCompetencies = await getCompetencies(
        isSuperAdmin ? null : organizationId || null
      );
      setCompetencies(updatedCompetencies);
    } catch (err: any) {
      console.error("Error archiving competency:", err);
      setError(err.message || "Failed to archive competency");
    } finally {
      setArchivingId(null);
    }
  };

  const getDomainName = (domainId: string) => {
    return domains.find((d) => d.id === domainId)?.name || "Unknown";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Competencies</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Competencies</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Human capabilities within domains
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Competency
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

      {domains.length > 0 && (
        <div className="flex items-center gap-2">
          <label htmlFor="domain-filter" className="text-sm font-medium">
            Filter by Domain:
          </label>
          <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
            <SelectTrigger className="w-[250px]">
              <SelectValue placeholder="All domains" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Domains</SelectItem>
              {domains.map((domain) => (
                <SelectItem key={domain.id} value={domain.id}>
                  {domain.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {competencies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No competencies yet</div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Competencies represent human capabilities within a domain. Link competencies to domains to create meaningful learning structures."
                : "Competencies will appear here once created by an administrator."}
            </div>
          </CardContent>
        </Card>
      ) : filteredCompetencies.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">
              No competencies found for selected domain
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Domain</th>
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
              {filteredCompetencies.map((competency) => (
                <tr key={competency.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {competency.name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {getDomainName(competency.domain_id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {competency.description || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(competency)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(competency)}
                          disabled={archivingId === competency.id}
                          className="gap-1 text-muted-foreground"
                        >
                          <Archive className="size-4" />
                          {archivingId === competency.id ? "Archiving..." : "Archive"}
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

      <CompetencyForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        competency={editingCompetency}
        domains={domains}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
