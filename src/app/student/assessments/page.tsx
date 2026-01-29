"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { getMyAssessments, getAssessmentEvidenceLinks, type Assessment } from "@/lib/student/student-data";

interface AssessmentWithEvidence extends Assessment {
  evidenceTitles?: string[];
}

export default function AssessmentsPage() {
  const [loading, setLoading] = useState(true);
  const [assessments, setAssessments] = useState<AssessmentWithEvidence[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getMyAssessments();
        // Fetch evidence links for each assessment
        const assessmentsWithEvidence = await Promise.all(
          data.map(async (assessment) => {
            const evidenceLinks = await getAssessmentEvidenceLinks(assessment.id);
            const evidenceTitles = evidenceLinks
              .filter(link => link.portfolio_artifact?.title)
              .map(link => link.portfolio_artifact!.title);
            return { ...assessment, evidenceTitles };
          })
        );
        setAssessments(assessmentsWithEvidence);
      } catch (error) {
        console.error("Error fetching assessments:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

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

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold">My Assessments</h1>
        <p className="text-muted-foreground mt-2">
          View your assessment records
        </p>
      </div>

      {/* Assessments List */}
      <Card>
        <CardHeader>
          <CardTitle>Assessments ({assessments.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {assessments.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No assessments found.
            </div>
          ) : (
            <div className="space-y-4">
              {assessments.map((assessment) => (
                <Link
                  key={assessment.id}
                  href={`/student/assessments/${assessment.id}`}
                  className="block"
                >
                  <div className="flex items-start justify-between border-b pb-4 last:border-b-0 last:pb-0 hover:bg-muted/50 p-3 rounded transition-colors">
                    <div className="space-y-1 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-medium">
                          {assessment.label?.label_text || "Assessment"}
                        </h3>
                        <Badge variant={getStatusBadgeVariant(assessment.status)}>
                          {assessment.status}
                        </Badge>
                      </div>
                      {assessment.label?.description && (
                        <p className="text-sm text-muted-foreground">
                          {assessment.label.description}
                        </p>
                      )}
                      {assessment.teacher && (
                        <p className="text-sm text-muted-foreground">
                          Teacher: {assessment.teacher.first_name} {assessment.teacher.last_name}
                        </p>
                      )}
                      {assessment.school_year && (
                        <p className="text-sm text-muted-foreground">
                          School Year: {assessment.school_year.year_label}
                        </p>
                      )}
                      {assessment.term_period && (
                        <p className="text-sm text-muted-foreground">
                          Term: {assessment.term_period}
                        </p>
                      )}
                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {assessment.rationale}
                      </p>
                      {assessment.evidenceTitles && assessment.evidenceTitles.length > 0 && (
                        <div className="mt-2 space-y-1">
                          <p className="text-xs font-medium text-muted-foreground">Linked Evidence:</p>
                          <div className="flex flex-wrap gap-1">
                            {assessment.evidenceTitles.map((title, idx) => (
                              <Badge key={idx} variant="outline" className="text-xs">
                                {title}
                              </Badge>
                            ))}
                          </div>
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            Used for assessment
                          </Badge>
                        </div>
                      )}
                      <div className="text-xs text-muted-foreground">
                        Created: {new Date(assessment.created_at).toLocaleDateString()}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
