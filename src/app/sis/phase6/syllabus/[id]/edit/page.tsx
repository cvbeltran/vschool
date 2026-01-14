"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { getSyllabus, type Syllabus } from "@/lib/phase6/syllabus";
import { SyllabusForm } from "@/components/phase6/syllabus-form";

export default function EditSyllabusPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getSyllabus(id);
        if (!data) {
          setError("Syllabus not found");
        } else {
          setSyllabus(data);
        }
      } catch (err: any) {
        console.error("Error fetching syllabus:", err);
        setError(err.message || "Failed to load syllabus");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  if (orgLoading || loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit Syllabus</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !syllabus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Edit Syllabus</h1>
        </div>
        <div className="text-destructive">{error || "Syllabus not found"}</div>
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
        <h1 className="text-2xl font-semibold">Edit Syllabus</h1>
      </div>

      <SyllabusForm
        syllabus={syllabus}
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
