"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  getLearnerObservations,
  getExperiences,
  type Observation,
  type Experience,
} from "@/lib/ams";
import { getCompetencies, getDomains, type Competency, type Domain } from "@/lib/obs";

export default function LearnerObservationsPage() {
  const params = useParams();
  const learnerId = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [observations, setObservations] = useState<Observation[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [competencies, setCompetencies] = useState<Competency[]>([]);
  const [domains, setDomains] = useState<Domain[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [selectedExperienceId, setSelectedExperienceId] = useState<string>("all");
  const [selectedDomainId, setSelectedDomainId] = useState<string>("all");
  const [selectedCompetencyId, setSelectedCompetencyId] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !learnerId) return;

      try {
        const [obsData, expData, compData, domData] = await Promise.all([
          getLearnerObservations(learnerId, {
            experienceId: selectedExperienceId !== "all" ? selectedExperienceId : null,
            competencyId: selectedCompetencyId !== "all" ? selectedCompetencyId : null,
            domainId: selectedDomainId !== "all" ? selectedDomainId : null,
            dateFrom: dateFrom || null,
            dateTo: dateTo || null,
          }),
          getExperiences(isSuperAdmin ? null : organizationId || null),
          getCompetencies(isSuperAdmin ? null : organizationId || null),
          getDomains(isSuperAdmin ? null : organizationId || null),
        ]);

        setObservations(obsData);
        setExperiences(expData);
        setCompetencies(compData);
        setDomains(domData);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching learner observations:", err);
        setError(err.message || "Failed to load observations");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    learnerId,
    organizationId,
    isSuperAdmin,
    orgLoading,
    selectedExperienceId,
    selectedDomainId,
    selectedCompetencyId,
    dateFrom,
    dateTo,
  ]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Observations</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Observations</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Read-only view of observations for this learner
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {experiences.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="experience-filter">Experience</Label>
            <Select value={selectedExperienceId} onValueChange={setSelectedExperienceId}>
              <SelectTrigger>
                <SelectValue placeholder="All experiences" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Experiences</SelectItem>
                {experiences.map((exp) => (
                  <SelectItem key={exp.id} value={exp.id}>
                    {exp.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {domains.length > 0 && (
          <div className="space-y-2">
            <Label htmlFor="domain-filter">Domain</Label>
            <Select value={selectedDomainId} onValueChange={setSelectedDomainId}>
              <SelectTrigger>
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
          <div className="space-y-2">
            <Label htmlFor="competency-filter">Competency</Label>
            <Select value={selectedCompetencyId} onValueChange={setSelectedCompetencyId}>
              <SelectTrigger>
                <SelectValue placeholder="All competencies" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Competencies</SelectItem>
                {competencies
                  .filter(
                    (c) =>
                      selectedDomainId === "all" || c.domain_id === selectedDomainId
                  )
                  .map((comp) => (
                    <SelectItem key={comp.id} value={comp.id}>
                      {comp.name}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className="space-y-2">
          <Label htmlFor="date-from">Date From</Label>
          <Input
            id="date-from"
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="date-to">Date To</Label>
          <Input
            id="date-to"
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>
      </div>

      {observations.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No observations found</div>
            <div className="text-sm text-muted-foreground">
              Observations will appear here once recorded for this learner.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {observations.map((obs) => (
            <Card key={obs.id}>
              <CardContent className="py-4">
                <div className="space-y-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <div className="font-medium">
                        {obs.experience?.name || "Unknown Experience"}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {obs.competency?.name} · {obs.competency_level?.label}
                      </div>
                      {obs.competency?.domain && (
                        <div className="text-xs text-muted-foreground">
                          {obs.competency.domain.name}
                        </div>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(obs.observed_at).toLocaleDateString()}
                    </div>
                  </div>
                  {obs.notes && (
                    <div className="text-sm mt-2">{obs.notes}</div>
                  )}
                  {obs.indicators && obs.indicators.length > 0 && (
                    <div className="text-xs text-muted-foreground mt-2">
                      Indicators: {obs.indicators.map((i) => i.description).join(", ")}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
