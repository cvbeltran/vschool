"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listStudentGrades,
  type StudentGrade,
} from "@/lib/phase4/grades";
import {
  listTranscriptRecords,
  generateTranscriptRecordFromConfirmedGrades,
  finalizeTranscriptRecord,
  type TranscriptRecord,
} from "@/lib/phase4/reports";
import { TranscriptGeneratorPanel } from "@/components/phase4/transcript-generator-panel";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function ReportsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [showGenerator, setShowGenerator] = useState(false);
  const [filterSchoolYearId, setFilterSchoolYearId] = useState<string>("");
  const [filterTermPeriod, setFilterTermPeriod] = useState<string>("");
  const [schoolYears, setSchoolYears] = useState<
    Array<{ id: string; year_label: string }>
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Fetch user role and profile ID
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setCurrentProfileId(session.user.id);
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setRole(normalizeRole(profile.role));
        }
      }

      // Fetch school years
      let schoolYearsQuery = supabase
        .from("school_years")
        .select("id, year_label")
        .order("start_date", { ascending: false });

      if (!isSuperAdmin && organizationId) {
        schoolYearsQuery = schoolYearsQuery.eq("organization_id", organizationId);
      }

      const { data: schoolYearsData } = await schoolYearsQuery;
      setSchoolYears(schoolYearsData || []);

      // Fetch transcripts
      try {
        const data = await listTranscriptRecords(
          isSuperAdmin ? null : organizationId || null,
          {
            transcriptStatus: "finalized",
            schoolYearId: filterSchoolYearId || null,
            termPeriod: filterTermPeriod || null,
          }
        );
        setTranscripts(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching transcripts:", err);
        setError(err.message || "Failed to load transcripts");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    organizationId,
    isSuperAdmin,
    orgLoading,
    filterSchoolYearId,
    filterTermPeriod,
  ]);

  const canGenerate = role === "principal" || role === "admin";

  const handleGenerate = async (
    studentId: string,
    schoolYearId: string,
    termPeriod: string
  ) => {
    if (!currentProfileId || !organizationId) return;

    try {
      // Get confirmed grades for this student/term
      const confirmedGrades = await listStudentGrades(
        isSuperAdmin ? null : organizationId || null,
        {
          studentId,
          schoolYearId,
          termPeriod,
          status: "confirmed",
        }
      );

      if (confirmedGrades.length === 0) {
        setError("No confirmed grades found for this selection");
        return;
      }

      // Generate transcript records for each confirmed grade
      const orgId =
        isSuperAdmin && organizationId
          ? organizationId
          : (await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", currentProfileId)
              .single()).data?.organization_id;

      if (!orgId) {
        throw new Error("Organization ID not found");
      }

      for (const grade of confirmedGrades) {
        await generateTranscriptRecordFromConfirmedGrades({
          organization_id: orgId,
          student_id: grade.student_id,
          student_grade_id: grade.id,
          school_year_id: grade.school_year_id,
          term_period: grade.term_period || "",
          grade_value: grade.grading_scale?.grade_value || "",
          created_by: currentProfileId,
        });
      }

      // Refresh list
      const updated = await listTranscriptRecords(
        isSuperAdmin ? null : organizationId || null,
        {
          transcriptStatus: "finalized",
        }
      );
      setTranscripts(updated);
      setShowGenerator(false);
    } catch (err: any) {
      console.error("Error generating transcript:", err);
      setError(err.message || "Failed to generate transcript");
    }
  };

  const handleFinalize = async (transcriptId: string) => {
    if (!currentProfileId) return;

    try {
      await finalizeTranscriptRecord(transcriptId, {
        finalized_by: currentProfileId,
        updated_by: currentProfileId,
      });

      // Refresh list
      const updated = await listTranscriptRecords(
        isSuperAdmin ? null : organizationId || null,
        {
          transcriptStatus: "finalized",
        }
      );
      setTranscripts(updated);
    } catch (err: any) {
      console.error("Error finalizing transcript:", err);
      setError(err.message || "Failed to finalize transcript");
    }
  };

  if (orgLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-3xl font-bold">Reports & Transcripts</h1>
        {canGenerate && (
          <Button onClick={() => setShowGenerator(true)}>
            Generate Transcript
          </Button>
        )}
      </div>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 gap-4">
          <div>
            <Label htmlFor="school_year">School Year</Label>
            <Select
              value={filterSchoolYearId || "all"}
              onValueChange={(value) => setFilterSchoolYearId(value === "all" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All years" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All years</SelectItem>
                {schoolYears.map((year) => (
                  <SelectItem key={year.id} value={year.id}>
                    {year.year_label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="term_period">Term Period</Label>
            <Select
              value={filterTermPeriod || "all"}
              onValueChange={(value) => setFilterTermPeriod(value === "all" ? "" : value)}
            >
              <SelectTrigger>
                <SelectValue placeholder="All terms" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All terms</SelectItem>
                <SelectItem value="Q1">Q1</SelectItem>
                <SelectItem value="Q2">Q2</SelectItem>
                <SelectItem value="Q3">Q3</SelectItem>
                <SelectItem value="Q4">Q4</SelectItem>
                <SelectItem value="Semester 1">Semester 1</SelectItem>
                <SelectItem value="Semester 2">Semester 2</SelectItem>
                <SelectItem value="Full Year">Full Year</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {transcripts.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No finalized transcripts found.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {transcripts.map((transcript) => (
            <Card key={transcript.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      {transcript.student?.first_name}{" "}
                      {transcript.student?.last_name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {transcript.school_year?.year_label} • {transcript.term_period}
                    </p>
                  </div>
                  <div className="text-sm">
                    Status: <strong>{transcript.transcript_status}</strong>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  <div>
                    <strong>Grade:</strong> {transcript.grade_value}
                  </div>
                  {transcript.course_name && (
                    <div>
                      <strong>Course:</strong> {transcript.course_name}
                    </div>
                  )}
                  {transcript.credits && (
                    <div>
                      <strong>Credits:</strong> {transcript.credits}
                    </div>
                  )}
                  {transcript.finalized_at && (
                    <div>
                      <strong>Finalized:</strong>{" "}
                      {new Date(transcript.finalized_at).toLocaleString()}
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showGenerator && (
        <TranscriptGeneratorPanel
          onGenerate={handleGenerate}
          onCancel={() => setShowGenerator(false)}
          organizationId={isSuperAdmin ? null : organizationId || null}
        />
      )}
    </div>
  );
}
