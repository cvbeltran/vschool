"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Archive, Plus } from "lucide-react";
import { normalizeRole } from "@/lib/rbac";
import { getAssessment, listEvidenceLinks, archiveAssessment, type Assessment, type AssessmentEvidenceLink } from "@/lib/assessments";

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [evidenceLinks, setEvidenceLinks] = useState<AssessmentEvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [canModify, setCanModify] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
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
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          setOriginalRole(profile.role);
        }
      }

      try {
        const assessmentData = await getAssessment(assessmentId);
        if (!assessmentData) {
          router.push("/sis/assessments");
          return;
        }
        setAssessment(assessmentData);

        const evidenceData = await listEvidenceLinks(assessmentId);
        setEvidenceLinks(evidenceData);
      } catch (error) {
        console.error("Error fetching assessment:", error);
      } finally {
        setLoading(false);
      }
    };

    if (assessmentId) {
      fetchData();
    }
  }, [assessmentId, router]);

  const handleArchive = async () => {
    if (!confirm("Are you sure you want to archive this assessment?")) {
      return;
    }

    try {
      setArchiving(true);
      await archiveAssessment(assessmentId);
      router.push("/sis/assessments");
    } catch (error: any) {
      console.error("Error archiving assessment:", error);
      alert(error.message || "Failed to archive assessment");
    } finally {
      setArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Assessment</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  useEffect(() => {
    const checkPermissions = async () => {
      if (!assessment) return;
      
      const {
        data: { session },
      } = await supabase.auth.getSession();
      const userId = session?.user.id;

      const canEdit =
        (role === "teacher" && assessment.teacher_id === userId) ||
        role === "principal" ||
        (role === "admin" && originalRole !== "registrar");
      const isFinalized = assessment.status === "confirmed";
      setCanModify(canEdit && !isFinalized);
    };

    if (assessment && role) {
      checkPermissions();
    }
  }, [assessment, role, originalRole]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Assessment</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!assessment) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Assessment Not Found</h1>
        <Button onClick={() => router.push("/sis/assessments")}>Back to Assessments</Button>
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
          <h1 className="text-2xl font-semibold">Assessment Details</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View assessment judgment and evidence
          </p>
        </div>
        {canModify && (
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={() => router.push(`/sis/assessments/${assessmentId}/edit`)}
              className="gap-2"
            >
              <Edit className="size-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              onClick={handleArchive}
              disabled={archiving}
              className="gap-2"
            >
              <Archive className="size-4" />
              {archiving ? "Archiving..." : "Archive"}
            </Button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Assessment Information */}
        <Card>
          <CardHeader>
            <CardTitle>Assessment Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Learner</div>
              <div className="text-base">
                {assessment.learner
                  ? `${assessment.learner.last_name || ""}, ${assessment.learner.first_name || ""}`.trim() || "—"
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Teacher</div>
              <div className="text-base">
                {assessment.teacher
                  ? `${assessment.teacher.first_name || ""} ${assessment.teacher.last_name || ""}`.trim() || "—"
                  : "—"}
              </div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Judgment Label</div>
              <div className="text-base font-medium">
                {assessment.label?.label_text || "—"}
              </div>
              {assessment.label?.description && (
                <div className="text-sm text-muted-foreground mt-1">
                  {assessment.label.description}
                </div>
              )}
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Status</div>
              <span
                className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                  assessment.status === "confirmed"
                    ? "bg-green-100 text-green-800"
                    : assessment.status === "draft"
                    ? "bg-yellow-100 text-yellow-800"
                    : "bg-gray-100 text-gray-800"
                }`}
              >
                {assessment.status}
              </span>
            </div>
            {assessment.school_year && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">School Year</div>
                <div className="text-base">{assessment.school_year.name}</div>
              </div>
            )}
            {assessment.term_period && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Term Period</div>
                <div className="text-base">{assessment.term_period}</div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Created</div>
              <div className="text-base">
                {new Date(assessment.created_at).toLocaleString()}
              </div>
            </div>
            {assessment.updated_at !== assessment.created_at && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
                <div className="text-base">
                  {new Date(assessment.updated_at).toLocaleString()}
                </div>
              </div>
            )}
            {assessment.label?.label_set && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Label Set</div>
                <div className="text-base">{assessment.label.label_set.name}</div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Rationale */}
      <Card>
        <CardHeader>
          <CardTitle>Rationale</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none whitespace-pre-wrap">
            {assessment.rationale || "—"}
          </div>
        </CardContent>
      </Card>

      {/* Evidence Links */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Evidence Links</CardTitle>
            {canModify && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/sis/assessments/${assessmentId}/evidence`)}
                className="gap-2"
              >
                <Plus className="size-4" />
                Add Evidence
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {evidenceLinks.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              No evidence links yet. {canModify && "Click 'Add Evidence' to link evidence."}
            </div>
          ) : (
            <div className="space-y-3">
              {evidenceLinks.map((link) => (
                <div
                  key={link.id}
                  className="border rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium capitalize">{link.evidence_type.replace(/_/g, " ")}</div>
                    {link.notes && (
                      <div className="text-sm text-muted-foreground mt-1">{link.notes}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Linked {new Date(link.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  {canModify && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={async () => {
                        // Archive evidence link
                        if (confirm("Remove this evidence link?")) {
                          try {
                            const { archiveEvidenceLink } = await import("@/lib/assessments");
                            await archiveEvidenceLink(link.id);
                            const updated = await listEvidenceLinks(assessmentId);
                            setEvidenceLinks(updated);
                          } catch (error: any) {
                            alert(error.message || "Failed to remove evidence link");
                          }
                        }
                      }}
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

