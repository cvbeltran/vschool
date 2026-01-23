"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getStudentFeedback,
  type StudentFeedback,
} from "@/lib/feedback";

export default function StudentFeedbackDetailPage() {
  const params = useParams();
  const router = useRouter();
  const feedbackId = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [feedback, setFeedback] = useState<StudentFeedback | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !feedbackId) return;

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
          setRole(normalizeRole(profile.role));
        }
      }

      try {
        const feedbackData = await getStudentFeedback(feedbackId);
        if (!feedbackData) {
          setError("Feedback not found");
          setLoading(false);
          return;
        }
        setFeedback(feedbackData);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching feedback:", err);
        setError(err.message || "Failed to load feedback");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [feedbackId, orgLoading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student Feedback</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!feedback) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Feedback Not Found</h1>
        <Button onClick={() => router.push("/sis/feedback/my")}>
          Back to Feedback
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/sis/feedback/my")}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Student Feedback</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View feedback details
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

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Feedback Information */}
        <Card>
          <CardHeader>
            <CardTitle>Feedback Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {feedback.feedback_dimension && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Dimension
                </div>
                <div className="text-base">
                  {feedback.feedback_dimension.dimension_name}
                </div>
                {feedback.feedback_dimension.prompt && (
                  <div className="text-sm text-muted-foreground mt-1">
                    {feedback.feedback_dimension.prompt.prompt_text}
                  </div>
                )}
              </div>
            )}
            {feedback.experience && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Experience
                </div>
                <div className="text-base">{feedback.experience.name}</div>
              </div>
            )}
            {feedback.teacher && !feedback.is_anonymous && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Teacher
                </div>
                <div className="text-base">
                  {feedback.teacher.first_name} {feedback.teacher.last_name}
                </div>
              </div>
            )}
            {feedback.is_anonymous && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Anonymous
                </div>
                <Badge variant="secondary">Yes</Badge>
              </div>
            )}
            {feedback.school_year && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  School Year
                </div>
                <div className="text-base">
                  {feedback.school_year.year_label}
                </div>
              </div>
            )}
            {feedback.quarter && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Quarter
                </div>
                <div className="text-base">{feedback.quarter}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Status
              </div>
              <Badge
                variant={
                  feedback.status === "completed" ? "default" : "secondary"
                }
              >
                {feedback.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Provided At
              </div>
              <div className="text-base">
                {new Date(feedback.provided_at).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Created
              </div>
              <div className="text-base">
                {new Date(feedback.created_at).toLocaleString()}
              </div>
            </div>
            {feedback.updated_at !== feedback.created_at && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </div>
                <div className="text-base">
                  {new Date(feedback.updated_at).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Feedback Text */}
      <Card>
        <CardHeader>
          <CardTitle>Feedback Text</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none whitespace-pre-wrap">
            {feedback.feedback_text || "—"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
