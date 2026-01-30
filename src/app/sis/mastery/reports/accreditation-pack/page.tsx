"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { type AccreditationPackData } from "@/lib/mastery";
import { Printer, Download, ArrowLeft, FileText, Users, BarChart3, Calendar } from "lucide-react";
import Link from "next/link";

export default function AccreditationPackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const snapshotRunId = searchParams.get("snapshot_run_id");

  const [pack, setPack] = useState<AccreditationPackData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPack = async () => {
      if (!snapshotRunId) {
        setError("Missing required parameter: snapshot_run_id");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(
          `/api/mastery/reports/accreditation-pack?snapshot_run_id=${snapshotRunId}`,
          {
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          }
        );

        if (!response.ok) {
          const errorData = await response.json();
          throw new Error(errorData.error || "Failed to fetch accreditation pack");
        }

        const data = await response.json();
        setPack(data);
      } catch (err) {
        console.error("Error fetching accreditation pack", err);
        setError(err instanceof Error ? err.message : "Failed to load accreditation pack");
      } finally {
        setLoading(false);
      }
    };

    fetchPack();
  }, [snapshotRunId]);

  const handlePrint = () => {
    window.print();
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Accreditation Evidence Pack</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !pack) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Accreditation Evidence Pack</h1>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-destructive">
              {error || "Accreditation pack not found"}
            </div>
            <div className="text-center">
              <Button onClick={() => router.back()} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Go Back
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalMasteryItems = Object.values(pack.mastery_distribution).reduce((a, b) => a + b, 0);

  return (
    <div className="space-y-6 print:space-y-4">
      {/* Print Header */}
      <div className="hidden print:block border-b pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-2xl font-semibold">Accreditation Evidence Pack</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Snapshot Run: {pack.snapshot_run.id.slice(0, 8)}...
            </p>
          </div>
          <div className="text-right text-sm text-muted-foreground">
            <div>Snapshot Date: {new Date(pack.snapshot_run.snapshot_date).toLocaleDateString()}</div>
            <div>Scope: {pack.snapshot_run.scope_type}</div>
            {pack.snapshot_run.term && <div>Term: {pack.snapshot_run.term}</div>}
            {pack.snapshot_run.quarter && <div>Quarter: {pack.snapshot_run.quarter}</div>}
          </div>
        </div>
      </div>

      {/* Screen Header */}
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="text-2xl font-semibold">Accreditation Evidence Pack</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Comprehensive mastery evidence package for accreditation
          </p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handlePrint} variant="outline">
            <Printer className="h-4 w-4 mr-2" />
            Print
          </Button>
          <Button onClick={() => router.back()} variant="outline">
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
        </div>
      </div>

      {/* Snapshot Run Metadata */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Snapshot Run Metadata
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <div className="text-muted-foreground">Snapshot Date</div>
              <div className="font-medium">
                {new Date(pack.snapshot_run.snapshot_date).toLocaleDateString()}
              </div>
            </div>
            <div>
              <div className="text-muted-foreground">Scope Type</div>
              <Badge variant="outline">{pack.snapshot_run.scope_type}</Badge>
            </div>
            {pack.snapshot_run.term && (
              <div>
                <div className="text-muted-foreground">Term</div>
                <div className="font-medium">{pack.snapshot_run.term}</div>
              </div>
            )}
            {pack.snapshot_run.quarter && (
              <div>
                <div className="text-muted-foreground">Quarter</div>
                <div className="font-medium">{pack.snapshot_run.quarter}</div>
              </div>
            )}
            {pack.snapshot_run.school_year && (
              <div>
                <div className="text-muted-foreground">School Year</div>
                <div className="font-medium">{pack.snapshot_run.school_year.year_label}</div>
              </div>
            )}
            {pack.snapshot_run.created_by && (
              <div>
                <div className="text-muted-foreground">Created By</div>
                <div className="font-medium">
                  {pack.snapshot_run.created_by.first_name} {pack.snapshot_run.created_by.last_name}
                </div>
              </div>
            )}
            <div>
              <div className="text-muted-foreground">Snapshot Run ID</div>
              <div className="font-mono text-xs">{pack.snapshot_run.id}</div>
            </div>
            <div>
              <div className="text-muted-foreground">Created At</div>
              <div className="font-medium">
                {new Date(pack.snapshot_run.created_at).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student List */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" />
            Students Included ({pack.students.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {pack.students.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No students found in this snapshot run
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
              {pack.students.map((student) => (
                <div
                  key={student.id}
                  className="p-2 border rounded text-sm"
                >
                  {student.first_name} {student.last_name}
                  {student.student_number && ` (${student.student_number})`}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Mastery Distribution */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <BarChart3 className="h-5 w-5" />
            Mastery Distribution Summary
          </CardTitle>
        </CardHeader>
        <CardContent>
          {Object.keys(pack.mastery_distribution).length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No mastery data available
            </div>
          ) : (
            <div className="space-y-4">
              {Object.entries(pack.mastery_distribution)
                .sort(([, a], [, b]) => b - a)
                .map(([level, count]) => {
                  const percentage = totalMasteryItems > 0
                    ? Math.round((count / totalMasteryItems) * 100)
                    : 0;
                  return (
                    <div key={level} className="space-y-2">
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex items-center gap-2">
                          <Badge variant="default">{level}</Badge>
                          <span className="text-muted-foreground">{count} items</span>
                        </div>
                        <span className="font-medium">{percentage}%</span>
                      </div>
                      <div className="w-full bg-muted rounded-full h-2">
                        <div
                          className="bg-primary h-2 rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Student Summaries */}
      <Card>
        <CardHeader>
          <CardTitle>Per-Student Progress Report Links</CardTitle>
        </CardHeader>
        <CardContent>
          {pack.student_summaries.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No student summaries available
            </div>
          ) : (
            <div className="space-y-2">
              {pack.student_summaries.map((summary) => (
                <div
                  key={summary.student_id}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{summary.student_name}</div>
                    <div className="text-sm text-muted-foreground mt-1">
                      {summary.competency_count} competencies assessed
                    </div>
                    <div className="flex gap-2 mt-2">
                      {Object.entries(summary.mastery_counts).map(([level, count]) => (
                        <Badge key={level} variant="outline" className="text-xs">
                          {level}: {count}
                        </Badge>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 print:hidden">
                    <Link
                      href={`/sis/mastery/reports/progress?student_id=${summary.student_id}&snapshot_run_id=${snapshotRunId}`}
                    >
                      <Button variant="outline" size="sm">
                        View Report
                      </Button>
                    </Link>
                    <Link
                      href={`/sis/mastery/reports/evidence-pack?student_id=${summary.student_id}&snapshot_run_id=${snapshotRunId}`}
                    >
                      <Button variant="outline" size="sm">
                        Evidence Pack
                      </Button>
                    </Link>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Print Footer */}
      <div className="hidden print:block border-t pt-4 mt-4 text-sm text-muted-foreground text-center">
        <div>Snapshot Run ID: {pack.snapshot_run.id}</div>
        <div>Generated: {new Date().toLocaleString()}</div>
        <div className="mt-2">
          This document is a read-only snapshot-based report. All mastery values are tied to snapshot
          run {pack.snapshot_run.id} as of {new Date(pack.snapshot_run.snapshot_date).toLocaleDateString()}.
        </div>
      </div>
    </div>
  );
}
