"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  listStudentGrades,
  type StudentGrade,
} from "@/lib/phase4/grades";
import {
  listTranscriptRecords,
  type TranscriptRecord,
} from "@/lib/phase4/reports";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function MyReportsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [transcripts, setTranscripts] = useState<TranscriptRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [filterSchoolYearId, setFilterSchoolYearId] = useState<string>("");
  const [filterTermPeriod, setFilterTermPeriod] = useState<string>("");
  const [schoolYears, setSchoolYears] = useState<
    Array<{ id: string; year_label: string }>
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Get current user's student ID
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("student_id")
          .eq("id", session.user.id)
          .single();

        if (profile?.student_id) {
          setCurrentStudentId(profile.student_id);
        } else {
          // Try to match by email
          const { data: user } = await supabase.auth.getUser();
          if (user?.user?.email) {
            const { data: student } = await supabase
              .from("students")
              .select("id")
              .eq("primary_email", user.user.email)
              .eq("organization_id", organizationId || "")
              .single();
            if (student) {
              setCurrentStudentId(student.id);
            }
          }
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

      setLoading(false);
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  useEffect(() => {
    const fetchGradesAndTranscripts = async () => {
      if (!currentStudentId) {
        setGrades([]);
        setTranscripts([]);
        return;
      }

      try {
        // Fetch finalized grades only
        const gradesData = await listStudentGrades(
          isSuperAdmin ? null : organizationId || null,
          {
            studentId: currentStudentId,
            status: "confirmed",
            schoolYearId: filterSchoolYearId || null,
            termPeriod: filterTermPeriod || null,
          }
        );
        setGrades(gradesData);

        // Fetch finalized transcripts only
        const transcriptsData = await listTranscriptRecords(
          isSuperAdmin ? null : organizationId || null,
          {
            studentId: currentStudentId,
            transcriptStatus: "finalized",
            schoolYearId: filterSchoolYearId || null,
            termPeriod: filterTermPeriod || null,
          }
        );
        setTranscripts(transcriptsData);

        setError(null);
      } catch (err: any) {
        console.error("Error fetching grades/transcripts:", err);
        setError(err.message || "Failed to load data");
      }
    };

    fetchGradesAndTranscripts();
  }, [
    currentStudentId,
    organizationId,
    isSuperAdmin,
    filterSchoolYearId,
    filterTermPeriod,
  ]);

  if (orgLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  if (!currentStudentId) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            Student profile not found. Please contact your administrator.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">My Grades & Reports</h1>

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

      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-semibold mb-4">Finalized Grades</h2>
          {grades.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No finalized grades available.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {grades.map((grade) => (
                <Card key={grade.id}>
                  <CardHeader>
                    <CardTitle>
                      {grade.school_year?.year_label} • {grade.term_period}
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div>
                        <strong>Policy:</strong> {grade.grade_policy?.policy_name}
                      </div>
                      <div>
                        <strong>Grade:</strong>{" "}
                        {grade.grading_scale?.grade_label ||
                          grade.grading_scale?.grade_value}
                      </div>
                      {grade.notes && (
                        <div>
                          <strong>Notes:</strong> {grade.notes}
                        </div>
                      )}
                      {grade.confirmed_at && (
                        <div>
                          <strong>Confirmed:</strong>{" "}
                          {new Date(grade.confirmed_at).toLocaleString()}
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        <div>
          <h2 className="text-2xl font-semibold mb-4">Transcripts</h2>
          {transcripts.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-gray-500">
                No finalized transcripts available.
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-4">
              {transcripts.map((transcript) => (
                <Card key={transcript.id}>
                  <CardHeader>
                    <CardTitle>
                      {transcript.school_year?.year_label} • {transcript.term_period}
                    </CardTitle>
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
        </div>
      </div>
    </div>
  );
}
