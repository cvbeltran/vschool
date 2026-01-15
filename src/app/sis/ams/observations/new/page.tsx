"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { RecordObservationModal } from "@/components/ams/record-observation-modal";

function NewObservationForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [isModalOpen, setIsModalOpen] = useState(false);

  const experienceId = searchParams.get("experienceId") || undefined;
  const learnerId = searchParams.get("learnerId") || undefined;

  useEffect(() => {
    if (!orgLoading) {
      setIsModalOpen(true);
    }
  }, [orgLoading]);

  const handleSuccess = () => {
    if (experienceId) {
      router.push(`/sis/ams/experiences/${experienceId}`);
    } else {
      router.push("/sis/ams/experiences");
    }
  };

  if (!experienceId) {
    return (
      <div className="space-y-6">
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">
              Experience ID is required
            </div>
            <Button
              variant="outline"
              onClick={() => router.push("/sis/ams/experiences")}
            >
              Go to Experiences
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="size-4" />
        </Button>
        <h1 className="text-2xl font-semibold">Record Observation</h1>
      </div>

      <RecordObservationModal
        open={isModalOpen}
        onOpenChange={(open) => {
          setIsModalOpen(open);
          if (!open) {
            router.back();
          }
        }}
        experienceId={experienceId}
        organizationId={organizationId}
        isSuperAdmin={isSuperAdmin || false}
        initialLearnerId={learnerId}
        onSuccess={handleSuccess}
      />
    </div>
  );
}

export default function NewObservationPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <NewObservationForm />
    </Suspense>
  );
}
