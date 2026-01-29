"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { getMyFeedback, type StudentFeedback } from "@/lib/student/student-data";

export default function ViewFeedbackPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [feedback, setFeedback] = useState<StudentFeedback | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = params.id as string;
        const feedbackList = await getMyFeedback();
        const foundFeedback = feedbackList.find((f) => f.id === id);

        if (!foundFeedback) {
          setNotFound(true);
          return;
        }

        setFeedback(foundFeedback);
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (notFound || !feedback) {
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

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "completed":
        return "default";
      case "draft":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <Button asChild variant="ghost" className="mb-4">
          <Link href="/student/feedback">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Feedback
          </Link>
        </Button>
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold">Feedback Details</h1>
            <p className="text-muted-foreground mt-2">
              {feedback.status === "completed" ? "Submitted feedback" : "Draft feedback"}
            </p>
          </div>
          {feedback.status === "draft" && (
            <Button asChild>
              <Link href={`/student/feedback/${feedback.id}/edit`}>
                Edit Feedback
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Feedback Information</CardTitle>
            <Badge variant={getStatusBadgeVariant(feedback.status)}>
              {feedback.status === "completed" ? "Submitted" : "Draft"}
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm font-medium text-muted-foreground">Quarter</p>
            <p className="mt-1">{feedback.quarter}</p>
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Feedback Dimension</p>
            <p className="mt-1">
              {feedback.feedback_dimension?.dimension_name || "Unknown"}
            </p>
            {feedback.feedback_dimension?.description && (
              <p className="text-sm text-muted-foreground mt-1">
                {feedback.feedback_dimension.description}
              </p>
            )}
          </div>

          <div>
            <p className="text-sm font-medium text-muted-foreground">Feedback Text</p>
            <div className="mt-1 p-3 bg-muted rounded-md">
              <p className="whitespace-pre-wrap">{feedback.feedback_text}</p>
            </div>
          </div>

          {feedback.teacher && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Teacher</p>
              <p className="mt-1">
                {feedback.teacher.first_name} {feedback.teacher.last_name}
              </p>
            </div>
          )}

          {feedback.experience_type && (
            <div>
              <p className="text-sm font-medium text-muted-foreground">Experience Type</p>
              <p className="mt-1 capitalize">{feedback.experience_type}</p>
            </div>
          )}

          <div className="flex items-center gap-2">
            <p className="text-sm font-medium text-muted-foreground">Anonymous:</p>
            <Badge variant={feedback.is_anonymous ? "default" : "outline"}>
              {feedback.is_anonymous ? "Yes" : "No"}
            </Badge>
          </div>

          <div className="border-t pt-4 space-y-2">
            <div className="text-xs text-muted-foreground">
              Created: {new Date(feedback.created_at).toLocaleString()}
            </div>
            {feedback.status === "completed" && feedback.provided_at && (
              <div className="text-xs text-muted-foreground">
                Submitted: {new Date(feedback.provided_at).toLocaleString()}
              </div>
            )}
            {feedback.updated_at && feedback.updated_at !== feedback.created_at && (
              <div className="text-xs text-muted-foreground">
                Last updated: {new Date(feedback.updated_at).toLocaleString()}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
