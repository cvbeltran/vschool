"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";
import { getMyAssessment, type Assessment } from "@/lib/student/student-data";

export default function AssessmentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [assessment, setAssessment] = useState<Assessment | null>(null);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const id = params.id as string;
        const data = await getMyAssessment(id);
        
        if (!data) {
          setNotFound(true);
          return;
        }

        setAssessment(data);
      } catch (error) {
        console.error("Error fetching assessment:", error);
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    };

    if (params.id) {
      fetchData();
    }
  }, [params.id]);

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "confirmed":
        return "default";
      case "draft":
        return "secondary";
      case "archived":
        return "outline";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (notFound || !assessment) {
    return (
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Assessment Not Found</h1>
          <p className="text-muted-foreground mt-2">
            The assessment you're looking for doesn't exist or you don't have access to it.
          </p>
        </div>
        <Button asChild>
          <Link href="/student/assessments">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Assessments
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <Button asChild variant="ghost" className="mb-4">
            <Link href="/student/assessments">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Assessments
            </Link>
          </Button>
          <h1 className="text-3xl font-bold">Assessment Details</h1>
        </div>
        <Badge variant={getStatusBadgeVariant(assessment.status)}>
          {assessment.status}
        </Badge>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Assessment Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <h3 className="text-lg font-semibold mb-2">
              {assessment.label?.label_text || "Assessment"}
            </h3>
            {assessment.label?.description && (
              <p className="text-muted-foreground">{assessment.label.description}</p>
            )}
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {assessment.teacher && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Teacher</p>
                <p>{assessment.teacher.first_name} {assessment.teacher.last_name}</p>
              </div>
            )}

            {assessment.school_year && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">School Year</p>
                <p>{assessment.school_year.year_label}</p>
              </div>
            )}

            {assessment.term_period && (
              <div>
                <p className="text-sm font-medium text-muted-foreground">Term Period</p>
                <p>{assessment.term_period}</p>
              </div>
            )}

            <div>
              <p className="text-sm font-medium text-muted-foreground">Status</p>
              <Badge variant={getStatusBadgeVariant(assessment.status)}>
                {assessment.status}
              </Badge>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Created</p>
              <p>{new Date(assessment.created_at).toLocaleDateString()}</p>
            </div>

            <div>
              <p className="text-sm font-medium text-muted-foreground">Last Updated</p>
              <p>{new Date(assessment.updated_at).toLocaleDateString()}</p>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Rationale</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="whitespace-pre-wrap">{assessment.rationale}</p>
        </CardContent>
      </Card>

      <div className="text-sm text-muted-foreground">
        <p>Note: Evidence links and additional details are managed by your teachers.</p>
      </div>
    </div>
  );
}
