"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listStudentGrades,
  createStudentGradeHeader,
  updateStudentGradeHeader,
  listGradeEntries,
  addGradeEntry,
  type StudentGrade,
  type GradeEntry,
} from "@/lib/phase4/grades";
import { listGradePolicies, listGradingScales } from "@/lib/phase4/policies";
import { getObservations } from "@/lib/ams";
import { GradeEntryEditor } from "@/components/phase4/grade-entry-editor";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function GradeEntryPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Selection state
  const [selectedSchoolYearId, setSelectedSchoolYearId] = useState<string>("");
  const [selectedTermPeriod, setSelectedTermPeriod] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [selectedPolicyId, setSelectedPolicyId] = useState<string>("");

  // Data
  const [schoolYears, setSchoolYears] = useState<
    Array<{ id: string; year_label: string }>
  >([]);
  const [students, setStudents] = useState<
    Array<{ id: string; first_name: string | null; last_name: string | null }>
  >([]);
  const [policies, setPolicies] = useState<
    Array<{ id: string; policy_name: string; policy_type: string }>
  >([]);
  const [scales, setScales] = useState<
    Array<{ id: string; grade_value: string; grade_label: string | null }>
  >([]);
  const [scalesLoading, setScalesLoading] = useState(false);
  const [currentGrade, setCurrentGrade] = useState<StudentGrade | null>(null);
  const [gradeEntries, setGradeEntries] = useState<GradeEntry[]>([]);
  const [observations, setObservations] = useState<any[]>([]);

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

      // Fetch students
      let studentsQuery = supabase
        .from("students")
        .select("id, first_name, last_name")
        .order("last_name", { ascending: true });

      if (!isSuperAdmin && organizationId) {
        studentsQuery = studentsQuery.eq("organization_id", organizationId);
      }

      const { data: studentsData } = await studentsQuery;
      setStudents(studentsData || []);

      // Fetch policies
      const policiesData = await listGradePolicies(
        isSuperAdmin ? null : organizationId || null,
        { isActive: true }
      );
      setPolicies(policiesData);

      setLoading(false);
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  useEffect(() => {
    const fetchScales = async () => {
      if (!selectedPolicyId) {
        setScales([]);
        setScalesLoading(false);
        return;
      }

      setScalesLoading(true);
      setError(null); // Clear any previous errors when fetching scales
      try {
        const scalesData = await listGradingScales(
          selectedPolicyId,
          isSuperAdmin ? null : organizationId || null
        );
        setScales(scalesData);
        if (scalesData.length === 0) {
          setError("This policy has no grading scales. Please create scales first.");
        }
      } catch (err: any) {
        console.error("Error fetching scales:", err);
        setError(err.message || "Failed to load grading scales");
      } finally {
        setScalesLoading(false);
      }
    };

    fetchScales();
  }, [selectedPolicyId, organizationId, isSuperAdmin]);

  useEffect(() => {
    const findOrCreateGrade = async () => {
      if (
        !selectedSchoolYearId ||
        !selectedTermPeriod ||
        !selectedStudentId ||
        !selectedPolicyId ||
        !currentProfileId
      ) {
        setCurrentGrade(null);
        setGradeEntries([]);
        return;
      }

      // Wait for scales to finish loading before creating a new grade
      if (scalesLoading) {
        return;
      }

      try {
        // Try to find existing draft grade
        const existingGrades = await listStudentGrades(
          isSuperAdmin ? null : organizationId || null,
          {
            schoolYearId: selectedSchoolYearId,
            termPeriod: selectedTermPeriod,
            studentId: selectedStudentId,
            status: "draft",
          }
        );

        let grade = existingGrades.find(
          (g) => g.grade_policy_id === selectedPolicyId
        );

        if (!grade) {
          // Create new draft grade - but only if scales are available
          if (scales.length === 0) {
            // Don't set error here - it's already set in fetchScales if needed
            return;
          }

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

          // Get first scale as default
          const defaultScale = scales[0];
          if (!defaultScale) {
            setError("This policy has no grading scales. Please create scales first.");
            return;
          }

          grade = await createStudentGradeHeader({
            organization_id: orgId,
            student_id: selectedStudentId,
            school_year_id: selectedSchoolYearId,
            term_period: selectedTermPeriod,
            grade_policy_id: selectedPolicyId,
            grading_scale_id: defaultScale.id,
            created_by: currentProfileId,
          });
        }

        setCurrentGrade(grade);
        setError(null); // Clear error on success

        // Fetch grade entries
        const entries = await listGradeEntries(grade.id, organizationId || null);
        setGradeEntries(entries);

        // Fetch observations for context (read-only)
        const obs = await getObservations(
          isSuperAdmin ? null : organizationId || null,
          {
            learnerId: selectedStudentId,
          }
        );
        setObservations(obs || []);
      } catch (err: any) {
        console.error("Error finding/creating grade:", err);
        setError(err.message || "Failed to load grade");
      }
    };

    findOrCreateGrade();
  }, [
    selectedSchoolYearId,
    selectedTermPeriod,
    selectedStudentId,
    selectedPolicyId,
    scales,
    scalesLoading,
    currentProfileId,
    organizationId,
    isSuperAdmin,
  ]);

  if (orgLoading || loading) {
    return (
      <div className="container mx-auto p-6">
        <p>Loading...</p>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold mb-6">Grade Entry</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Select Context</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="school_year">School Year *</Label>
              <Select
                value={selectedSchoolYearId}
                onValueChange={setSelectedSchoolYearId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school year" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="term_period">Term Period *</Label>
              <Select
                value={selectedTermPeriod}
                onValueChange={setSelectedTermPeriod}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
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
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="student">Student *</Label>
              <Select
                value={selectedStudentId}
                onValueChange={setSelectedStudentId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select student" />
                </SelectTrigger>
                <SelectContent>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="policy">Grade Policy *</Label>
              <Select
                value={selectedPolicyId}
                onValueChange={setSelectedPolicyId}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select policy" />
                </SelectTrigger>
                <SelectContent>
                  {policies.map((policy) => (
                    <SelectItem key={policy.id} value={policy.id}>
                      {policy.policy_name} ({policy.policy_type.replace("_", " ")})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {currentGrade && (
        <GradeEntryEditor
          grade={currentGrade}
          gradeEntries={gradeEntries}
          observations={observations}
          scales={scales}
          organizationId={isSuperAdmin ? null : organizationId || null}
          currentProfileId={currentProfileId}
          onGradeUpdate={async (updatedGrade) => {
            setCurrentGrade(updatedGrade);
            const entries = await listGradeEntries(
              updatedGrade.id,
              organizationId || null
            );
            setGradeEntries(entries);
          }}
          onEntriesUpdate={async () => {
            if (currentGrade) {
              const entries = await listGradeEntries(
                currentGrade.id,
                organizationId || null
              );
              setGradeEntries(entries);
            }
          }}
        />
      )}

      {!currentGrade &&
        selectedSchoolYearId &&
        selectedTermPeriod &&
        selectedStudentId &&
        selectedPolicyId &&
        (scalesLoading ? (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              Loading grading scales...
            </CardContent>
          </Card>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-gray-500">
              Creating grade draft...
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
