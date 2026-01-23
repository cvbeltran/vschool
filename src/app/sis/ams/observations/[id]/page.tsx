"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Edit } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getObservation,
  type Observation,
} from "@/lib/ams";

export default function ObservationDetailPage() {
  const params = useParams();
  const router = useRouter();
  const observationId = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [userId, setUserId] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !observationId) return;

      // Fetch user role and ID
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setUserId(session.user.id);
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
        const obs = await getObservation(observationId);
        if (!obs) {
          setError("Observation not found");
          setLoading(false);
          return;
        }

        setObservation(obs);

        // Check if user can edit
        const canEditObservation =
          role === "principal" ||
          role === "admin" ||
          (role === "teacher" && obs.created_by === userId);
        setCanEdit(canEditObservation);

        setError(null);
      } catch (err: any) {
        console.error("Error fetching observation:", err);
        setError(err.message || "Failed to load observation");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [observationId, orgLoading, role, userId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Observation</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!observation) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Observation Not Found</h1>
        <Button onClick={() => router.back()}>Back</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">Observation Details</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {observation.learner?.first_name} {observation.learner?.last_name} ·{" "}
            {observation.competency?.name}
          </p>
        </div>
        {canEdit && (
          <Button
            variant="outline"
            onClick={() => router.push(`/sis/ams/observations/${observationId}/edit`)}
            className="gap-2"
          >
            <Edit className="size-4" />
            Edit
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

      {observation.status === "withdrawn" && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-amber-600">
              This observation has been withdrawn.
              {observation.withdrawn_reason && (
                <div className="mt-1">Reason: {observation.withdrawn_reason}</div>
              )}
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Observation Information */}
        <Card>
          <CardHeader>
            <CardTitle>Observation Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {observation.learner && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Learner
                </div>
                <div className="text-base">
                  {observation.learner.first_name} {observation.learner.last_name}
                  {observation.learner.student_number && (
                    <span className="text-sm text-muted-foreground ml-2">
                      ({observation.learner.student_number})
                    </span>
                  )}
                </div>
              </div>
            )}
            {observation.experience && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Experience
                </div>
                <div className="text-base">{observation.experience.name}</div>
              </div>
            )}
            {observation.competency && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Competency
                </div>
                <div className="text-base">{observation.competency.name}</div>
                {observation.competency.domain && (
                  <div className="text-sm text-muted-foreground mt-1">
                    Domain: {observation.competency.domain.name}
                  </div>
                )}
              </div>
            )}
            {observation.competency_level && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Competency Level
                </div>
                <div className="text-base">
                  {observation.competency_level.label}
                </div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Status
              </div>
              <Badge
                variant={
                  observation.status === "active" ? "default" : "secondary"
                }
              >
                {observation.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Observed At
              </div>
              <div className="text-base">
                {new Date(observation.observed_at).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Created
              </div>
              <div className="text-base">
                {new Date(observation.created_at).toLocaleString()}
              </div>
            </div>
            {observation.updated_at !== observation.created_at && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </div>
                <div className="text-base">
                  {new Date(observation.updated_at).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Notes */}
      {observation.notes && (
        <Card>
          <CardHeader>
            <CardTitle>Notes</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="prose max-w-none whitespace-pre-wrap">
              {observation.notes}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Indicators */}
      {observation.indicators && observation.indicators.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Indicators</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {observation.indicators.map((indicator) => (
                <div key={indicator.id} className="p-3 border rounded-lg">
                  <div className="text-sm font-medium">{indicator.description}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
