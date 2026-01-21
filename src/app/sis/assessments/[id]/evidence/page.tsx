"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Plus, Check } from "lucide-react";
import { getAssessment, addEvidenceLink, listEvidenceLinks, type Assessment, type AssessmentEvidenceLink } from "@/lib/assessments";

type EvidenceType = "observation" | "experience" | "teacher_reflection" | "student_feedback" | "portfolio_artifact" | "attendance_session" | "attendance_record";

export default function EvidenceManagementPage() {
  const params = useParams();
  const router = useRouter();
  const assessmentId = params.id as string;

  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [evidenceLinks, setEvidenceLinks] = useState<AssessmentEvidenceLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [evidenceType, setEvidenceType] = useState<EvidenceType>("observation");
  const [candidates, setCandidates] = useState<Array<{ id: string; title?: string | null; description?: string | null; created_at: string }>>([]);
  const [selectedCandidateId, setSelectedCandidateId] = useState<string>("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const assessmentData = await getAssessment(assessmentId);
        if (!assessmentData) {
          router.push("/sis/assessments");
          return;
        }
        setAssessment(assessmentData);

        const evidenceData = await listEvidenceLinks(assessmentId);
        setEvidenceLinks(evidenceData);

        await fetchCandidates();
      } catch (error: any) {
        console.error("Error fetching data:", error);
        setError(error.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    if (assessmentId) {
      fetchData();
    }
  }, [assessmentId, router]);

  const fetchCandidates = async () => {
    if (!assessment) return;

    try {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id, is_super_admin")
        .eq("id", (await supabase.auth.getSession()).data.session?.user.id || "")
        .single();

      if (!profile) return;

      let query;
      const tableName = evidenceType === "observation" ? "observations"
        : evidenceType === "experience" ? "experiences"
        : evidenceType === "teacher_reflection" ? "teacher_reflections"
        : evidenceType === "student_feedback" ? "student_feedback"
        : evidenceType === "portfolio_artifact" ? "portfolio_artifacts"
        : evidenceType === "attendance_session" ? "attendance_sessions"
        : "attendance_records";

      query = supabase
        .from(tableName)
        .select("id, title, description, created_at")
        .is("archived_at", null);

      if (!profile.is_super_admin && profile.organization_id) {
        query = query.eq("organization_id", profile.organization_id);
      }

      // Filter by learner if assessment has one
      if (assessment.learner_id && (evidenceType === "observation" || evidenceType === "portfolio_artifact" || evidenceType === "attendance_record")) {
        query = query.eq("learner_id", assessment.learner_id);
      }

      // Filter by teacher for teacher_reflection
      if (evidenceType === "teacher_reflection" && assessment.teacher_id) {
        query = query.eq("teacher_id", assessment.teacher_id);
      }

      const { data } = await query.order("created_at", { ascending: false }).limit(50);
      setCandidates(data || []);
    } catch (err: any) {
      console.error("Error fetching candidates:", err);
      setError(err.message || "Failed to load evidence candidates");
    }
  };

  useEffect(() => {
    if (assessment && evidenceType) {
      fetchCandidates();
    }
  }, [evidenceType, assessment]);

  const handleAddEvidence = async () => {
    if (!selectedCandidateId) {
      setError("Please select an evidence item");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);

      const linkPayload: any = {
        evidence_type: evidenceType,
        notes: notes.trim() || null,
      };

      // Set the appropriate ID field based on evidence type
      switch (evidenceType) {
        case "observation":
          linkPayload.observation_id = selectedCandidateId;
          break;
        case "experience":
          linkPayload.experience_id = selectedCandidateId;
          break;
        case "teacher_reflection":
          linkPayload.teacher_reflection_id = selectedCandidateId;
          break;
        case "student_feedback":
          linkPayload.student_feedback_id = selectedCandidateId;
          break;
        case "portfolio_artifact":
          linkPayload.portfolio_artifact_id = selectedCandidateId;
          break;
        case "attendance_session":
          linkPayload.attendance_session_id = selectedCandidateId;
          break;
        case "attendance_record":
          linkPayload.attendance_record_id = selectedCandidateId;
          break;
      }

      await addEvidenceLink(assessmentId, linkPayload);

      // Refresh evidence links
      const updated = await listEvidenceLinks(assessmentId);
      setEvidenceLinks(updated);

      // Reset form
      setSelectedCandidateId("");
      setNotes("");
    } catch (err: any) {
      console.error("Error adding evidence:", err);
      setError(err.message || "Failed to add evidence link");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Manage Evidence</h1>
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
          onClick={() => router.push(`/sis/assessments/${assessmentId}`)}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Manage Evidence</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Link evidence to support this assessment
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

      {/* Current Evidence Links */}
      <Card>
        <CardHeader>
          <CardTitle>Current Evidence Links</CardTitle>
        </CardHeader>
        <CardContent>
          {evidenceLinks.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              No evidence links yet.
            </div>
          ) : (
            <div className="space-y-3">
              {evidenceLinks.map((link) => (
                <div
                  key={link.id}
                  className="border rounded-lg p-4"
                >
                  <div className="font-medium capitalize">{link.evidence_type.replace(/_/g, " ")}</div>
                  {link.notes && (
                    <div className="text-sm text-muted-foreground mt-1">{link.notes}</div>
                  )}
                  <div className="text-xs text-muted-foreground mt-1">
                    Linked {new Date(link.created_at).toLocaleDateString()}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Add Evidence Form */}
      <Card>
        <CardHeader>
          <CardTitle>Add Evidence Link</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="evidence_type">Evidence Type</Label>
            <Select
              value={evidenceType}
              onValueChange={(value) => {
                setEvidenceType(value as EvidenceType);
                setSelectedCandidateId("");
              }}
              disabled={submitting}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="observation">Observation</SelectItem>
                <SelectItem value="experience">Experience</SelectItem>
                <SelectItem value="teacher_reflection">Teacher Reflection</SelectItem>
                <SelectItem value="student_feedback">Student Feedback</SelectItem>
                <SelectItem value="portfolio_artifact">Portfolio Artifact</SelectItem>
                <SelectItem value="attendance_session">Attendance Session</SelectItem>
                <SelectItem value="attendance_record">Attendance Record</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="candidate">Select Evidence</Label>
            <Select
              value={selectedCandidateId}
              onValueChange={setSelectedCandidateId}
              disabled={submitting || candidates.length === 0}
            >
              <SelectTrigger>
                <SelectValue placeholder={candidates.length === 0 ? "No evidence available" : "Select evidence"} />
              </SelectTrigger>
              <SelectContent>
                {candidates.map((candidate) => (
                  <SelectItem key={candidate.id} value={candidate.id}>
                    {candidate.title || `Evidence ${candidate.id.slice(0, 8)}`}
                    {candidate.description && ` - ${candidate.description.slice(0, 50)}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {candidates.length === 0 && (
              <p className="text-sm text-muted-foreground">
                No {evidenceType.replace(/_/g, " ")} evidence available to link.
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Why this evidence?)</Label>
            <Textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Optional: Explain why this evidence supports your assessment..."
              rows={3}
              disabled={submitting}
            />
          </div>

          <Button
            onClick={handleAddEvidence}
            disabled={submitting || !selectedCandidateId}
            className="gap-2"
          >
            <Plus className="size-4" />
            {submitting ? "Adding..." : "Add Evidence Link"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}

