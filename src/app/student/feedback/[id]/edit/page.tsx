"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2 } from "lucide-react";
import { getMyFeedback, updateFeedback, submitFeedback, getMyStudentRow } from "@/lib/student/student-data";
import { listFeedbackDimensions } from "@/lib/feedback";
import { supabase } from "@/lib/supabase/client";
import { getActiveSchoolYear } from "@/lib/student-portal";

interface Teacher {
  id: string;
  first_name: string | null;
  last_name: string | null;
}

export default function EditFeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [quarter, setQuarter] = useState("");
  const [feedbackDimensionId, setFeedbackDimensionId] = useState("");
  const [feedbackText, setFeedbackText] = useState("");
  const [teacherId, setTeacherId] = useState<string>("");
  const [experienceId, setExperienceId] = useState<string>("");
  const [experienceType, setExperienceType] = useState<string>("");
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [status, setStatus] = useState<"draft" | "completed">("draft");

  const [feedbackDimensions, setFeedbackDimensions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [activeSchoolYear, setActiveSchoolYear] = useState<{ id: string; year_label: string } | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = params.id as string;
        const feedbackList = await getMyFeedback();
        const feedback = feedbackList.find((f) => f.id === id);

        if (!feedback) {
          setNotFound(true);
          return;
        }

        if (feedback.status !== "draft") {
          setError("Only draft feedback can be edited");
          return;
        }

        setQuarter(feedback.quarter);
        setFeedbackDimensionId(feedback.feedback_dimension_id);
        setFeedbackText(feedback.feedback_text);
        setTeacherId(feedback.teacher_id || "");
        setExperienceId(feedback.experience_id || "");
        setExperienceType(feedback.experience_type || "");
        setIsAnonymous(feedback.is_anonymous);
        setStatus(feedback.status);

        const student = await getMyStudentRow();
        if (student) {
          // Fetch active school year
          const activeYear = await getActiveSchoolYear(student.organization_id);
          setActiveSchoolYear(activeYear);

          // Fetch feedback dimensions
          const dimensions = await listFeedbackDimensions(student.organization_id, { isActive: true });
          setFeedbackDimensions(dimensions);

          // Fetch teachers - use staff table
          const { data: { session } } = await supabase.auth.getSession();
          if (session) {
            // Get teacher profile IDs
            const { data: teacherProfiles } = await supabase
              .from("profiles")
              .select("id")
              .eq("role", "teacher")
              .eq("organization_id", student.organization_id);

            if (teacherProfiles && teacherProfiles.length > 0) {
              const teacherUserIds = teacherProfiles.map(p => p.id);
              // Fetch staff records for these teachers to get names
              const { data: staffData } = await supabase
                .from("staff")
                .select("user_id, first_name, last_name")
                .in("user_id", teacherUserIds)
                .order("first_name", { ascending: true });

              if (staffData) {
                const teachersData = staffData.map((staff) => ({
                  id: staff.user_id,
                  first_name: staff.first_name,
                  last_name: staff.last_name,
                }));
                setTeachers(teachersData as Teacher[]);
              }
            }
          }

        }
      } catch (err: any) {
        console.error("Error fetching feedback:", err);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!quarter || !feedbackDimensionId || !feedbackText.trim()) {
        setError("Please fill in all required fields");
        setSubmitting(false);
        return;
      }

      // Use active school year if available, otherwise keep existing
      const schoolYearIdToUse = activeSchoolYear?.id || null;

      await updateFeedback(params.id as string, {
        quarter,
        feedback_dimension_id: feedbackDimensionId,
        feedback_text: feedbackText.trim(),
        teacher_id: teacherId || null,
        experience_id: experienceId || null,
        experience_type: experienceType || null,
        school_year_id: schoolYearIdToUse,
        is_anonymous: isAnonymous,
      });

      router.push("/student/feedback");
    } catch (err: any) {
      console.error("Error updating feedback:", err);
      setError(err.message || "Failed to update feedback");
      setSubmitting(false);
    }
  };

  const handleSubmitFeedback = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await submitFeedback(params.id as string);
      router.push("/student/feedback");
    } catch (err: any) {
      console.error("Error submitting feedback:", err);
      setError(err.message || "Failed to submit feedback");
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Feedback Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The feedback you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
        <Button asChild>
          <Link href="/student/feedback">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feedback
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/student/feedback">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feedback
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Edit Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Update your feedback entry
        </p>
      </div>

      <form onSubmit={handleSubmit}>
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Feedback Details</CardTitle>
              {activeSchoolYear && (
                <span className="text-sm text-muted-foreground">
                  School Year: {activeSchoolYear.year_label}
                </span>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="quarter">Quarter *</Label>
              <Select value={quarter} onValueChange={setQuarter} required>
                <SelectTrigger id="quarter">
                  <SelectValue placeholder="Select quarter" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Q1</SelectItem>
                  <SelectItem value="Q2">Q2</SelectItem>
                  <SelectItem value="Q3">Q3</SelectItem>
                  <SelectItem value="Q4">Q4</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback_dimension">Feedback Dimension *</Label>
              <Select value={feedbackDimensionId} onValueChange={setFeedbackDimensionId} required>
                <SelectTrigger id="feedback_dimension">
                  <SelectValue placeholder="Select dimension" />
                </SelectTrigger>
                <SelectContent>
                  {feedbackDimensions.map((dim) => (
                    <SelectItem key={dim.id} value={dim.id}>
                      {dim.dimension_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="feedback_text">Feedback Text *</Label>
              <Textarea
                id="feedback_text"
                value={feedbackText}
                onChange={(e) => setFeedbackText(e.target.value)}
                placeholder="Enter your feedback..."
                required
                rows={6}
              />
            </div>

            {activeSchoolYear && (
              <div className="bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800 p-3 rounded text-sm text-blue-800 dark:text-blue-200">
                Your feedback is tied to the current school year ({activeSchoolYear.year_label}).
              </div>
            )}

            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="teacher_id">Teacher (Optional)</Label>
                <Select value={teacherId || "none"} onValueChange={(value) => setTeacherId(value === "none" ? "" : value)}>
                  <SelectTrigger id="teacher_id">
                    <SelectValue placeholder="Select teacher" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    {teachers.map((teacher) => (
                      <SelectItem key={teacher.id} value={teacher.id}>
                        {teacher.first_name} {teacher.last_name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="experience_type">Experience Type (Optional)</Label>
                <Select value={experienceType || "none"} onValueChange={(value) => setExperienceType(value === "none" ? "" : value)}>
                  <SelectTrigger id="experience_type">
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">None</SelectItem>
                    <SelectItem value="mentoring">Mentoring</SelectItem>
                    <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
                    <SelectItem value="lab">Lab</SelectItem>
                    <SelectItem value="studio">Studio</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="flex items-center space-x-2">
              <Switch
                id="is_anonymous"
                checked={isAnonymous}
                onCheckedChange={setIsAnonymous}
              />
              <Label htmlFor="is_anonymous">Submit anonymously</Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button type="submit" disabled={submitting}>
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Changes
              </Button>
              <Button
                type="button"
                onClick={handleSubmitFeedback}
                disabled={submitting}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Feedback
              </Button>
              <Button type="button" variant="outline" asChild>
                <Link href="/student/feedback">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>
    </div>
  );
}
