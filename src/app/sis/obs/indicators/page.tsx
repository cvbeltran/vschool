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
  getIndicators,
  getCompetencies,
  getDomains,
  createIndicator,
  updateIndicator,
  archiveIndicator,
  type Indicator,
  type Competency,
  type Domain,
} from "@/lib/obs";
import { IndicatorForm } from "@/components/obs/indicator-form";

export default function IndicatorsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [selectedDomainId, setSelectedDomainId] = useState<string>("all");
  const [selectedCompetencyId, setSelectedCompetencyId] =
    useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingIndicator, setEditingIndicator] = useState<Indicator | null>(
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

      // Fetch domains and competencies
      try {
        const [domainsData, competenciesData] = await Promise.all([
          getDomains(isSuperAdmin ? null : organizationId || null),
          getCompetencies(isSuperAdmin ? null : organizationId || null),
        ]);
        setDomains(domainsData);
        setCompetencies(competenciesData);
      } catch (err: any) {
        console.error("Error fetching domains/competencies:", err);
      }

      // Fetch indicators
      try {
        const data = await getIndicators(
          isSuperAdmin ? null : organizationId || null
        );
        setIndicators(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching indicators:", err);
        setError(err.message || "Failed to load indicators");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canEdit = role === "principal" || role === "admin";

  const filteredIndicators = indicators.filter((indicator) => {
    if (selectedDomainId !== "all") {
      if (indicator.domain?.id !== selectedDomainId) return false;
    }
    if (selectedCompetencyId !== "all") {
      if (indicator.competency_id !== selectedCompetencyId) return false;
    }
    return true;
  });

  const handleCreate = () => {
    setEditingIndicator(null);
    setIsFormOpen(true);
  };

  const handleEdit = (indicator: Indicator) => {
    setEditingIndicator(indicator);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    competency_id: string;
    description: string;
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

      if (editingIndicator) {
        await updateIndicator(editingIndicator.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createIndicator({
          organization_id: orgId,
          competency_id: data.competency_id,
          description: data.description,
          created_by: session.user.id,
        });
      }

      // Refresh indicators list
      const updatedIndicators = await getIndicators(
        isSuperAdmin ? null : organizationId || null
      );
      setIndicators(updatedIndicators);
      setIsFormOpen(false);
      setEditingIndicator(null);
    } catch (err: any) {
      console.error("Error saving indicator:", err);
      setError(err.message || "Failed to save indicator");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (indicator: Indicator) => {
    if (
      !confirm(
        `Archive indicator? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(indicator.id);
    setError(null);

    try {
      await archiveIndicator(indicator.id);
      // Refresh indicators list
      const updatedIndicators = await getIndicators(
        isSuperAdmin ? null : organizationId || null
      );
      setIndicators(updatedIndicators);
    } catch (err: any) {
      console.error("Error archiving indicator:", err);
      setError(err.message || "Failed to archive indicator");
    } finally {
      setArchivingId(null);
    }
  };

  const getCompetencyName = (competencyId: string) => {
    return competencies.find((c) => c.id === competencyId)?.name || "Unknown";
  };

  const getDomainName = (domainId: string | undefined) => {
    if (!domainId) return "Unknown";
    return domains.find((d) => d.id === domainId)?.name || "Unknown";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Indicators</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Indicators</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Observable signals that demonstrate competencies
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Create Indicator
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

      <div className="flex items-center gap-4">
        {domains.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="domain-filter" className="text-sm font-medium">
              Domain:
            </label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger className="w-[200px]">
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
        {competencies.length > 0 && (
          <div className="flex items-center gap-2">
            <label htmlFor="competency-filter" className="text-sm font-medium">
              Competency:
            </label>
            <Select
              value={selectedCompetencyId}
              onValueChange={setSelectedCompetencyId}
            >
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="All competencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competencies</SelectItem>
                {competencies
                  .filter(
                    (c) =>
                      selectedDomainId === "all" ||
                      c.domain_id === selectedDomainId
                  )
                  .map((competency) => (
                    <SelectItem key={competency.id} value={competency.id}>
                      {competency.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}
      </div>

      {indicators.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No indicators yet</div>
            <div className="text-sm text-muted-foreground">
              {canEdit
                ? "Indicators are observable signals that demonstrate a competency. Add indicators to help mentors recognize evidence of learning."
                : "Indicators will appear here once created by an administrator."}
            </div>
          </CardContent>
        </Card>
      ) : filteredIndicators.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">
              No indicators found for selected filters
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Competency
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">Domain</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredIndicators.map((indicator) => (
                <tr key={indicator.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">{indicator.description}</td>
                  <td className="px-4 py-3 text-sm">
                    {getCompetencyName(indicator.competency_id)}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {getDomainName(indicator.domain?.id)}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(indicator)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(indicator)}
                          disabled={archivingId === indicator.id}
                          className="gap-1 text-muted-foreground"
                        >
                          <Archive className="size-4" />
                          {archivingId === indicator.id ? "Archiving..." : "Archive"}
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

      <IndicatorForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        indicator={editingIndicator}
        competencies={competencies}
        domains={domains}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
