"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2 } from "lucide-react";
import { createFeedback, getMyStudentRow, getMyExperiences, type Experience } from "@/lib/student/student-data";
import { listFeedbackDimensions } from "@/lib/feedback";
import { supabase } from "@/lib/supabase/client";
import { getActiveSchoolYear } from "@/lib/student-portal";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

interface Teacher {
  id: string;
  first_name: string | null;
  last_name: string | null;
}


export default function CreateFeedbackPage() {
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

  const [feedbackDimensions, setFeedbackDimensions] = useState<any[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [activeSchoolYear, setActiveSchoolYear] = useState<{ id: string; year_label: string } | null>(null);
  const [schoolYearError, setSchoolYearError] = useState<string | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const student = await getMyStudentRow();
        if (!student) {
          router.push("/student/login");
          return;
        }

        setOrganizationId(student.organization_id);

        // Fetch active school year
        const activeYear = await getActiveSchoolYear(student.organization_id);
        if (!activeYear) {
          setSchoolYearError("No active school year is configured. Please contact your administrator.");
        } else {
          setActiveSchoolYear(activeYear);
        }

        // Fetch feedback dimensions and experiences
        const [dimensions, expData] = await Promise.all([
          listFeedbackDimensions(student.organization_id, { isActive: true }),
          getMyExperiences(),
        ]);
        setFeedbackDimensions(dimensions);
        setExperiences(expData);
        
        // Log for debugging
        if (expData.length === 0) {
          console.warn("No experiences found for student organization:", student.organization_id);
        } else {
          console.log("Found experiences:", expData.length);
        }

        // Fetch teachers
        // First get teacher profile IDs, then fetch staff records for names
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          // Get teacher profile IDs
          const { data: teacherProfiles } = await supabase
            .from("profiles")
            .select("id")
            .eq("role", "teacher")
            .eq("organization_id", student.organization_id);

          if (teacherProfiles && teacherProfiles.length > 0) {
            // Get user IDs from profiles
            const teacherUserIds = teacherProfiles.map(p => p.id);

            // Fetch staff records for these teachers to get names
            const { data: staffData } = await supabase
              .from("staff")
              .select("user_id, first_name, last_name")
              .in("user_id", teacherUserIds)
              .order("first_name", { ascending: true });

            if (staffData) {
              // Map staff data to Teacher format
              const teachersData = staffData.map((staff) => ({
                id: staff.user_id,
                first_name: staff.first_name,
                last_name: staff.last_name,
              }));
              setTeachers(teachersData as Teacher[]);
            }
          }
        }

      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load form data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);

    try {
      if (!quarter || !feedbackDimensionId || !feedbackText.trim()) {
        setError("Please fill in all required fields");
        setSubmitting(false);
        return;
      }

      // Check for active school year
      if (!activeSchoolYear) {
        setError("No active school year is configured. Please contact your administrator.");
        setSubmitting(false);
        return;
      }

      await createFeedback({
        quarter,
        feedback_dimension_id: feedbackDimensionId,
        feedback_text: feedbackText.trim(),
        teacher_id: teacherId || null,
        experience_id: experienceId || null,
        experience_type: experienceType || null,
        school_year_id: activeSchoolYear.id,
        is_anonymous: isAnonymous,
        status: "draft",
      });

      router.push("/student/feedback");
    } catch (err: any) {
      console.error("Error creating feedback:", err);
      setError(err.message || "Failed to save draft");
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setError(null);

    if (!quarter || !feedbackDimensionId || !feedbackText.trim() || !experienceId) {
      setError("Please fill in all required fields (including Experience)");
      return;
    }

    // Check for active school year
    if (!activeSchoolYear) {
      setError("No active school year is configured. Please contact your administrator.");
      return;
    }

    setShowSubmitDialog(true);
  };

  const handleConfirmSubmit = async () => {
    setError(null);
    setSubmitting(true);

    try {
      await createFeedback({
        quarter,
        feedback_dimension_id: feedbackDimensionId,
        feedback_text: feedbackText.trim(),
        teacher_id: teacherId || null,
        experience_id: experienceId,
        experience_type: experienceType || null,
        school_year_id: activeSchoolYear!.id,
        is_anonymous: isAnonymous,
        status: "completed",
      });

      router.push("/student/feedback?submitted=true");
    } catch (err: any) {
      console.error("Error submitting feedback:", err);
      setError(err.message || "Failed to submit feedback");
      setShowSubmitDialog(false);
    } finally {
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

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/student/feedback">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feedback
          </Link>
        </Button>
        <h1 className="text-3xl font-bold">Create Feedback</h1>
        <p className="text-muted-foreground mt-2">
          Provide feedback on your learning experiences
        </p>
      </div>

      <form onSubmit={handleSaveDraft}>
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
            {(error || schoolYearError) && (
              <div className="bg-destructive/10 text-destructive p-3 rounded text-sm">
                {error || schoolYearError}
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
                placeholder="Reflect on your learning experience and how it supported your growth..."
                required
                rows={6}
              />
              <p className="text-xs text-muted-foreground">
                Reflect on your learning experience and how it supported your growth.
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience_id">Experience *</Label>
              {experiences.length === 0 ? (
                <div className="space-y-2">
                  <div className="p-3 border border-dashed rounded-md bg-muted/50">
                    <p className="text-sm text-muted-foreground">
                      No experiences available. Please contact your administrator if you believe this is an error.
                    </p>
                  </div>
                  <p className="text-xs text-muted-foreground">
                    Select the learning experience you're reflecting on.
                  </p>
                </div>
              ) : (
                <>
                  <Select value={experienceId} onValueChange={setExperienceId} required>
                    <SelectTrigger id="experience_id">
                      <SelectValue placeholder="Select an experience" />
                    </SelectTrigger>
                    <SelectContent>
                      {experiences.map((exp) => (
                        <SelectItem key={exp.id} value={exp.id}>
                          {exp.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    Select the learning experience you're reflecting on.
                  </p>
                </>
              )}
            </div>

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
              <Button 
                type="submit" 
                variant="outline" 
                disabled={submitting || !activeSchoolYear} 
                onClick={handleSaveDraft}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Save Draft
              </Button>
              <Button 
                type="button" 
                disabled={submitting || !activeSchoolYear || !experienceId || experiences.length === 0} 
                onClick={handleSubmit}
              >
                {submitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Submit Feedback
              </Button>
              {experiences.length === 0 && (
                <p className="text-xs text-destructive mt-1">
                  Cannot submit feedback without an experience. Please contact your administrator.
                </p>
              )}
              <Button type="button" variant="outline" asChild>
                <Link href="/student/feedback">Cancel</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </form>

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        title="Submit Feedback"
        description="Are you sure you want to submit this feedback? Once submitted, you won't be able to edit it."
        confirmText="Submit"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleConfirmSubmit}
        isLoading={submitting}
      />
    </div>
  );
}
