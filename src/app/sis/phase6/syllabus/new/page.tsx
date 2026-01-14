"use client";

import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { SyllabusForm } from "@/components/phase6/syllabus-form";

export default function NewSyllabusPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Syllabus</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Create Syllabus</h1>
      </div>

      <SyllabusForm
        syllabus={null}
        organizationId={organizationId}
        isSuperAdmin={isSuperAdmin}
        onSuccess={(syllabusId) => {
          router.push(`/sis/phase6/syllabus/${syllabusId}`);
        }}
        onCancel={() => router.back()}
      />
    </div>
  );
}
