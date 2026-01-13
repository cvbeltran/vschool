"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getExperience,
  getExperienceCompetencyLinks,
  getObservations,
  type Experience,
  type ExperienceCompetencyLink,
  type Observation,
} from "@/lib/ams";
import { RecordObservationModal } from "@/components/ams/record-observation-modal";
import { ExperienceCompetencyLinkEditor } from "@/components/ams/experience-competency-link-editor";

export default function ExperienceDetailPage() {
  const params = useParams();
  const router = useRouter();
  const experienceId = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [experience, setExperience] = useState<Experience | null>(null);
  const [links, setLinks] = useState<ExperienceCompetencyLink[]>([]);
  const [observations, setObservations] = useState<Observation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [isObservationModalOpen, setIsObservationModalOpen] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !experienceId) return;

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

      try {
        const [exp, linksData, obsData] = await Promise.all([
          getExperience(experienceId),
          getExperienceCompetencyLinks(experienceId),
          getObservations(
            isSuperAdmin ? null : organizationId || null,
            { experienceId }
          ),
        ]);

        setExperience(exp);
        setLinks(linksData);
        setObservations(obsData);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching experience data:", err);
        setError(err.message || "Failed to load experience");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [experienceId, organizationId, isSuperAdmin, orgLoading]);

  const canEdit = role === "principal" || role === "admin" || role === "teacher";
  const canCreateObservation = role === "principal" || role === "admin" || role === "teacher";

  const handleLinksUpdate = async () => {
    const updatedLinks = await getExperienceCompetencyLinks(experienceId);
    setLinks(updatedLinks);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!experience) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">Experience not found</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/sis/ams/experiences")}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">{experience.name}</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {experience.experience_type || "Experience"}
          </p>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <Tabs defaultValue="overview" className="w-full">
        <TabsList>
          <TabsTrigger value="overview">Overview</TabsTrigger>
          <TabsTrigger value="competencies">Linked Competencies</TabsTrigger>
          <TabsTrigger value="observations">Observations</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardContent className="py-6 space-y-4">
              <div>
                <h3 className="text-sm font-medium text-muted-foreground">Description</h3>
                <p className="mt-1">
                  {experience.description || (
                    <span className="text-muted-foreground">No description</span>
                  )}
                </p>
              </div>
              {experience.start_at && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">Start Date</h3>
                  <p className="mt-1">
                    {new Date(experience.start_at).toLocaleDateString()}
                  </p>
                </div>
              )}
              {experience.end_at && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground">End Date</h3>
                  <p className="mt-1">
                    {new Date(experience.end_at).toLocaleDateString()}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="competencies" className="space-y-4">
          <ExperienceCompetencyLinkEditor
            experienceId={experienceId}
            organizationId={organizationId}
            isSuperAdmin={isSuperAdmin || false}
            canEdit={canEdit}
            onUpdate={handleLinksUpdate}
          />
        </TabsContent>

        <TabsContent value="observations" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold">Observations</h2>
            {canCreateObservation && (
              <Button
                onClick={() => setIsObservationModalOpen(true)}
                className="gap-2"
              >
                <Plus className="size-4" />
                Record Observation
              </Button>
            )}
          </div>
          {observations.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center">
                <div className="text-muted-foreground mb-2">
                  No observations yet
                </div>
                <div className="text-sm text-muted-foreground">
                  Record observations to capture mentor insights about competency development.
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {observations.map((obs) => (
                <Card key={obs.id}>
                  <CardContent className="py-4">
                    <div className="flex items-start justify-between">
                      <div className="space-y-1">
                        <div className="font-medium">
                          {obs.learner?.first_name} {obs.learner?.last_name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {obs.competency?.name} · {obs.competency_level?.label}
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
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() =>
                          router.push(`/sis/ams/observations/${obs.id}/edit`)
                        }
                      >
                        View
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {experience && (
        <RecordObservationModal
          open={isObservationModalOpen}
          onOpenChange={setIsObservationModalOpen}
          experienceId={experienceId}
          organizationId={organizationId}
          isSuperAdmin={isSuperAdmin || false}
          onSuccess={async () => {
            const updatedObs = await getObservations(
              isSuperAdmin ? null : organizationId || null,
              { experienceId }
            );
            setObservations(updatedObs);
          }}
        />
      )}
    </div>
  );
}
