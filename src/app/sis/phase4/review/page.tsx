"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listStudentGrades,
  finalizeStudentGrade,
  overrideGradeEntry,
  listGradeJustifications,
  listGradeEntries,
  type StudentGrade,
} from "@/lib/phase4/grades";
import { GradeFinalizePanel } from "@/components/phase4/grade-finalize-panel";
import { getObservations } from "@/lib/ams";

export default function ReviewPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [grades, setGrades] = useState<StudentGrade[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [currentProfileId, setCurrentProfileId] = useState<string | null>(null);
  const [selectedGrade, setSelectedGrade] = useState<StudentGrade | null>(null);
  const [showFinalizePanel, setShowFinalizePanel] = useState(false);

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

      // Fetch pending grades
      try {
        const data = await listStudentGrades(
          isSuperAdmin ? null : organizationId || null,
          { status: "pending_confirmation" }
        );
        setGrades(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching grades:", err);
        setError(err.message || "Failed to load grades");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canConfirm = role === "principal" || role === "admin";
  const canView = canConfirm || role === "teacher"; // Registrar read-only handled by RLS

  const handleConfirm = async (gradeId: string, justificationText: string) => {
    if (!currentProfileId) return;

    try {
      await finalizeStudentGrade(gradeId, {
        confirmed_by: currentProfileId,
        justification_text: justificationText,
        updated_by: currentProfileId,
      });

      // Refresh list
      const updated = await listStudentGrades(
        isSuperAdmin ? null : organizationId || null,
        { status: "pending_confirmation" }
      );
      setGrades(updated);
      setShowFinalizePanel(false);
      setSelectedGrade(null);
    } catch (err: any) {
      console.error("Error confirming grade:", err);
      setError(err.message || "Failed to confirm grade");
    }
  };

  const handleOverride = async (
    gradeId: string,
    overrideReason: string,
    newScaleId?: string
  ) => {
    if (!currentProfileId) return;

    try {
      await overrideGradeEntry(gradeId, {
        override_by: currentProfileId,
        override_reason: overrideReason,
        new_grading_scale_id: newScaleId,
        updated_by: currentProfileId,
      });

      // Refresh list
      const updated = await listStudentGrades(
        isSuperAdmin ? null : organizationId || null,
        { status: "pending_confirmation" }
      );
      setGrades(updated);
      setShowFinalizePanel(false);
      setSelectedGrade(null);
    } catch (err: any) {
      console.error("Error overriding grade:", err);
      setError(err.message || "Failed to override grade");
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
      <h1 className="text-3xl font-bold mb-6">Review & Finalize Grades</h1>

      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded text-red-800">
          {error}
        </div>
      )}

      {grades.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-gray-500">
            No pending grades requiring confirmation.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {grades.map((grade) => (
            <Card key={grade.id}>
              <CardHeader>
                <div className="flex justify-between items-start">
                  <div>
                    <CardTitle>
                      {grade.student?.first_name} {grade.student?.last_name}
                    </CardTitle>
                    <p className="text-sm text-gray-600 mt-1">
                      {grade.school_year?.year_label} • {grade.term_period} •{" "}
                      {grade.grade_policy?.policy_name}
                    </p>
                  </div>
                  {canConfirm && (
                    <Button
                      onClick={() => {
                        setSelectedGrade(grade);
                        setShowFinalizePanel(true);
                      }}
                    >
                      Review & Confirm
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
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
                  <div>
                    <strong>Status:</strong> {grade.status}
                  </div>
                  <div>
                    <strong>Created:</strong>{" "}
                    {new Date(grade.created_at).toLocaleString()}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {showFinalizePanel && selectedGrade && (
        <GradeFinalizePanel
          grade={selectedGrade}
          onConfirm={handleConfirm}
          onOverride={handleOverride}
          onCancel={() => {
            setShowFinalizePanel(false);
            setSelectedGrade(null);
          }}
          organizationId={isSuperAdmin ? null : organizationId || null}
        />
      )}
    </div>
  );
}
