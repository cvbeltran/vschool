"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Edit2, Archive } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listStudentFeedback,
  createStudentFeedback,
  updateStudentFeedback,
  archiveStudentFeedback,
  type StudentFeedback,
} from "@/lib/feedback";
import {
  listFeedbackDimensions,
  type FeedbackDimension,
} from "@/lib/feedback";
import { getExperiences, type Experience } from "@/lib/ams";
import { StudentFeedbackForm } from "@/components/feedback/student-feedback-form";

interface SchoolYear {
  id: string;
  year_label: string;
}

interface Teacher {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export default function MyFeedbackPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [feedback, setFeedback] = useState<StudentFeedback[]>([]);
  const [feedbackDimensions, setFeedbackDimensions] = useState<
    FeedbackDimension[]
  >([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [currentStudentId, setCurrentStudentId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [dimensionFilter, setDimensionFilter] = useState<string>("all");
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingFeedback, setEditingFeedback] =
    useState<StudentFeedback | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Fetch user role and student ID
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, student_id")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setRole(normalizeRole(profile.role));
        }
        // Try to get student_id from profile
        if (profile?.student_id) {
          setCurrentStudentId(profile.student_id);
        } else {
          // Fallback: try to match by email
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

      // Fetch related data for form
      try {
        const [dimensionsData, experiencesData] = await Promise.all([
          listFeedbackDimensions(
            isSuperAdmin ? null : organizationId || null
          ),
          getExperiences(isSuperAdmin ? null : organizationId || null),
        ]);
        setFeedbackDimensions(dimensionsData);
        setExperiences(experiencesData);
      } catch (err: any) {
        console.error("Error fetching related data:", err);
      }

      // Fetch teachers (profiles with role='teacher')
      try {
        let teachersQuery = supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .eq("role", "teacher");

        if (!isSuperAdmin && organizationId) {
          teachersQuery = teachersQuery.eq("organization_id", organizationId);
        }

        const { data: teachersData } = await teachersQuery;
        setTeachers((teachersData || []) as Teacher[]);
      } catch (err: any) {
        console.error("Error fetching teachers:", err);
      }

      // Fetch school years
      try {
        let schoolYearsQuery = supabase
          .from("school_years")
          .select("id, year_label")
          .order("start_date", { ascending: false });

        if (!isSuperAdmin && organizationId) {
          schoolYearsQuery = schoolYearsQuery.eq(
            "organization_id",
            organizationId
          );
        }

        const { data: schoolYearsData } = await schoolYearsQuery;
        setSchoolYears(schoolYearsData || []);
      } catch (err: any) {
        console.error("Error fetching school years:", err);
      }

      // Fetch student feedback
      try {
        const filters: any = {};
        if (currentStudentId) {
          filters.studentId = currentStudentId;
        }
        if (statusFilter !== "all") {
          filters.status = statusFilter as "draft" | "completed";
        }
        if (quarterFilter !== "all") {
          filters.quarter = quarterFilter;
        }
        if (dimensionFilter !== "all") {
          filters.feedbackDimensionId = dimensionFilter;
        }

        const data = await listStudentFeedback(
          isSuperAdmin ? null : organizationId || null,
          filters
        );
        setFeedback(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching student feedback:", err);
        setError(err.message || "Failed to load feedback");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    organizationId,
    isSuperAdmin,
    orgLoading,
    currentStudentId,
    statusFilter,
    quarterFilter,
    dimensionFilter,
  ]);

  const canCreate = currentStudentId !== null; // Only students can create
  const canEdit = (feedbackItem: StudentFeedback) => {
    return (
      currentStudentId !== null &&
      feedbackItem.student_id === currentStudentId
    );
  };

  const handleCreate = () => {
    setEditingFeedback(null);
    setIsFormOpen(true);
  };

  const handleEdit = (feedbackItem: StudentFeedback) => {
    setEditingFeedback(feedbackItem);
    setIsFormOpen(true);
  };

  const handleSubmit = async (data: {
    feedback_dimension_id: string;
    quarter: string;
    teacher_id: string | null;
    experience_id: string | null;
    experience_type: string | null;
    school_year_id: string | null;
    feedback_text: string;
    provided_at: string;
    status: "draft" | "completed";
    is_anonymous: boolean;
  }) => {
    setIsSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      if (!currentStudentId) {
        throw new Error("Student ID not found. Please contact support.");
      }

      const orgId =
        isSuperAdmin && organizationId
          ? organizationId
          : (
              await supabase
                .from("profiles")
                .select("organization_id")
                .eq("id", session.user.id)
                .single()
            ).data?.organization_id;

      if (!orgId) {
        throw new Error("User is not associated with an organization");
      }

      if (editingFeedback) {
        await updateStudentFeedback(editingFeedback.id, {
          ...data,
          updated_by: session.user.id,
        });
      } else {
        await createStudentFeedback({
          organization_id: orgId,
          student_id: currentStudentId, // Must be current student
          feedback_dimension_id: data.feedback_dimension_id,
          quarter: data.quarter,
          teacher_id: data.teacher_id,
          experience_id: data.experience_id,
          experience_type: data.experience_type,
          school_year_id: data.school_year_id,
          feedback_text: data.feedback_text,
          provided_at: data.provided_at,
          status: data.status,
          is_anonymous: data.is_anonymous,
          created_by: session.user.id,
        });
      }

      // Refresh feedback list
      const filters: any = {};
      if (currentStudentId) {
        filters.studentId = currentStudentId;
      }
      if (statusFilter !== "all") {
        filters.status = statusFilter as "draft" | "completed";
      }
      if (quarterFilter !== "all") {
        filters.quarter = quarterFilter;
      }
      if (dimensionFilter !== "all") {
        filters.feedbackDimensionId = dimensionFilter;
      }

      const updatedFeedback = await listStudentFeedback(
        isSuperAdmin ? null : organizationId || null,
        filters
      );
      setFeedback(updatedFeedback);
      setIsFormOpen(false);
      setEditingFeedback(null);
    } catch (err: any) {
      console.error("Error saving feedback:", err);
      setError(err.message || "Failed to save feedback");
      throw err;
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (feedbackItem: StudentFeedback) => {
    if (
      !confirm(
        `Archive this feedback? This will hide it from the list.`
      )
    ) {
      return;
    }

    setArchivingId(feedbackItem.id);
    setError(null);

    try {
      await archiveStudentFeedback(feedbackItem.id);
      // Refresh feedback list
      const filters: any = {};
      if (currentStudentId) {
        filters.studentId = currentStudentId;
      }
      if (statusFilter !== "all") {
        filters.status = statusFilter as "draft" | "completed";
      }
      if (quarterFilter !== "all") {
        filters.quarter = quarterFilter;
      }
      if (dimensionFilter !== "all") {
        filters.feedbackDimensionId = dimensionFilter;
      }

      const updatedFeedback = await listStudentFeedback(
        isSuperAdmin ? null : organizationId || null,
        filters
      );
      setFeedback(updatedFeedback);
    } catch (err: any) {
      console.error("Error archiving feedback:", err);
      setError(err.message || "Failed to archive feedback");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Feedback</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!currentStudentId && canCreate) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Feedback</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">
              Student profile not found
            </div>
            <div className="text-sm text-muted-foreground">
              Please contact support to link your account to a student record.
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">My Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Quarterly qualitative feedback on your learning experiences
          </p>
        </div>
        {canCreate && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Start Quarterly Feedback
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-3 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Status</label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="draft">Draft</SelectItem>
              <SelectItem value="completed">Completed</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Quarter</label>
          <Select value={quarterFilter} onValueChange={setQuarterFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Q1">Q1</SelectItem>
              <SelectItem value="Q2">Q2</SelectItem>
              <SelectItem value="Q3">Q3</SelectItem>
              <SelectItem value="Q4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Dimension</label>
          <Select value={dimensionFilter} onValueChange={setDimensionFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {feedbackDimensions
                .filter((d) => d.is_active)
                .map((dimension) => (
                  <SelectItem key={dimension.id} value={dimension.id}>
                    {dimension.dimension_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {feedback.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No feedback yet</div>
            <div className="text-sm text-muted-foreground">
              {canCreate
                ? "Provide quarterly qualitative feedback on your learning experiences. Click 'Start Quarterly Feedback' to begin."
                : "Feedback will appear here once created."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Dimension
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Quarter
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Teacher
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Experience
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Feedback
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Provided At
                </th>
                {canCreate && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {feedback.map((item) => (
                <tr key={item.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm font-medium">
                    {item.feedback_dimension?.dimension_name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.quarter}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.teacher
                      ? `${item.teacher.first_name || ""} ${item.teacher.last_name || ""}`.trim() || "—"
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.experience?.name || (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.feedback_text.length > 100
                      ? item.feedback_text.substring(0, 100) + "..."
                      : item.feedback_text}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {item.status === "completed" ? (
                      <span className="text-green-600">Completed</span>
                    ) : (
                      <span className="text-muted-foreground">Draft</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(item.provided_at).toLocaleDateString()}
                  </td>
                  {canEdit(item) && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(item)}
                          className="gap-1"
                        >
                          <Edit2 className="size-4" />
                          Edit
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleArchive(item)}
                          disabled={archivingId === item.id}
                          className="gap-1 text-muted-foreground"
                        >
                          <Archive className="size-4" />
                          {archivingId === item.id ? "Archiving..." : "Archive"}
                        </Button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <StudentFeedbackForm
        open={isFormOpen}
        onOpenChange={setIsFormOpen}
        feedback={editingFeedback}
        feedbackDimensions={feedbackDimensions}
        teachers={teachers}
        experiences={experiences}
        schoolYears={schoolYears}
        organizationId={organizationId}
        isSuperAdmin={isSuperAdmin || false}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}
