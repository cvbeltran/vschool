"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getObservation,
  updateObservation,
  withdrawObservation,
  type Observation,
} from "@/lib/ams";
import { getIndicators, getCompetencyLevels, type Indicator, type CompetencyLevel } from "@/lib/obs";
import { ObservationForm } from "@/components/ams/observation-form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

export default function ObservationEditPage() {
  const params = useParams();
  const router = useRouter();
  const observationId = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [observation, setObservation] = useState<Observation | null>(null);
  const [indicators, setIndicators] = useState<Indicator[]>([]);
  const [competencyLevels, setCompetencyLevels] = useState<CompetencyLevel[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [userId, setUserId] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isWithdrawModalOpen, setIsWithdrawModalOpen] = useState(false);
  const [withdrawReason, setWithdrawReason] = useState("");

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

        // Check permissions
        const canEdit =
          role === "principal" ||
          role === "admin" ||
          (role === "teacher" && obs.created_by === userId);

        if (!canEdit) {
          setError("You do not have permission to edit this observation");
          setLoading(false);
          return;
        }

        setObservation(obs);

        // Fetch indicators and levels
        const [indicatorsData, levelsData] = await Promise.all([
          getIndicators(
            isSuperAdmin ? null : organizationId || null,
            { competencyId: obs.competency_id }
          ),
          getCompetencyLevels(
            isSuperAdmin ? null : organizationId || null
          ),
        ]);

        setIndicators(indicatorsData);
        setCompetencyLevels(levelsData);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching observation:", err);
        setError(err.message || "Failed to load observation");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [observationId, organizationId, isSuperAdmin, orgLoading, role, userId]);

  const handleSubmit = async (data: {
    competency_level_id: string;
    notes: string | null;
    indicator_ids: string[];
  }) => {
    if (!observation) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      await updateObservation(observation.id, {
        ...data,
        updated_by: session.user.id,
      });

      // Refresh observation
      const updated = await getObservation(observationId);
      setObservation(updated);
    } catch (err: any) {
      console.error("Error updating observation:", err);
      setError(err.message || "Failed to update observation");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleWithdraw = async () => {
    if (!observation) return;

    setIsSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      await withdrawObservation(observation.id, withdrawReason || null, session.user.id);
      setIsWithdrawModalOpen(false);
      setWithdrawReason("");

      // Refresh observation
      const updated = await getObservation(observationId);
      setObservation(updated);
    } catch (err: any) {
      console.error("Error withdrawing observation:", err);
      setError(err.message || "Failed to withdraw observation");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !observation) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!observation) {
    return null;
  }

  const canEdit =
    role === "principal" ||
    role === "admin" ||
    (role === "teacher" && observation.created_by === userId);

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
        >
          <ArrowLeft className="size-4" />
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Edit Observation</h1>
          <p className="text-sm text-muted-foreground mt-1">
            {observation.learner?.first_name} {observation.learner?.last_name} ·{" "}
            {observation.competency?.name}
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

      <Card>
        <CardContent className="py-6">
          <div className="space-y-4 mb-6">
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Learner</h3>
              <p className="mt-1">
                {observation.learner?.first_name} {observation.learner?.last_name}
              </p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Experience</h3>
              <p className="mt-1">{observation.experience?.name}</p>
            </div>
            <div>
              <h3 className="text-sm font-medium text-muted-foreground">Competency</h3>
              <p className="mt-1">{observation.competency?.name}</p>
            </div>
          </div>

          {canEdit && (
            <ObservationForm
              learnerId={observation.learner_id}
              experienceId={observation.experience_id}
              competencyId={observation.competency_id}
              indicators={indicators}
              competencyLevels={competencyLevels}
              initialData={{
                competency_level_id: observation.competency_level_id,
                notes: observation.notes,
                indicator_ids: observation.indicators?.map((i) => i.id) || [],
              }}
              onSubmit={handleSubmit}
              isSubmitting={isSubmitting}
            />
          )}

          {canEdit && observation.status === "active" && (
            <div className="mt-6 pt-6 border-t">
              <Button
                variant="destructive"
                onClick={() => setIsWithdrawModalOpen(true)}
                disabled={isSubmitting}
              >
                Withdraw Observation
              </Button>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog open={isWithdrawModalOpen} onOpenChange={setIsWithdrawModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Withdraw Observation</DialogTitle>
            <DialogDescription>
              Withdrawing an observation marks it as withdrawn but preserves all data for reversibility.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="withdraw_reason">Reason (Optional)</Label>
              <Textarea
                id="withdraw_reason"
                value={withdrawReason}
                onChange={(e) => setWithdrawReason(e.target.value)}
                placeholder="Optional reason for withdrawal"
                rows={3}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsWithdrawModalOpen(false);
                setWithdrawReason("");
              }}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleWithdraw}
              disabled={isSubmitting}
            >
              {isSubmitting ? "Withdrawing..." : "Withdraw"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
