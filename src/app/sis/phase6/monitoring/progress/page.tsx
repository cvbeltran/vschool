"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { normalizeRole } from "@/lib/rbac";
import { supabase } from "@/lib/supabase/client";
import { getProgressOverview, type ProgressOverview } from "@/lib/phase6/monitoring";

export default function ProgressMonitoringPage() {
  const router = useRouter();
  const [overview, setOverview] = useState<ProgressOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");

  useEffect(() => {
    const fetchData = async () => {
      // Check role - teachers should not access this page
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
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          if (normalizedRole === "teacher") {
            router.push("/sis/phase6/lesson-logs");
            return;
          }
        }
      }

      try {
        const data = await getProgressOverview();
        setOverview(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching progress overview:", err);
        setError(err.message || "Failed to load progress overview");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Progress Monitoring</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Progress Monitoring</h1>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {overview && (
        <>
          <div className="grid gap-4 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle>Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-muted-foreground">
                  Total Syllabi: {overview.total_syllabi}
                </p>
                <p className="text-sm text-muted-foreground">
                  Total Lesson Logs: {overview.total_lesson_logs}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Missing Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.missing_logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No missing logs</p>
              ) : (
                <div className="space-y-2">
                  {overview.missing_logs.map((log, idx) => (
                    <div key={idx} className="text-sm">
                      <p className="font-medium">{log.syllabus_name} - Week {log.week_number}</p>
                      <p className="text-muted-foreground">
                        {log.week_start_date} - {log.week_end_date}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Off-Track Logs</CardTitle>
            </CardHeader>
            <CardContent>
              {overview.off_track_logs.length === 0 ? (
                <p className="text-sm text-muted-foreground">No off-track logs</p>
              ) : (
                <div className="space-y-2">
                  {overview.off_track_logs.map((log) => (
                    <div key={log.lesson_log_id} className="text-sm">
                      <p className="font-medium">
                        {log.teacher_name} - {log.week_start_date} to {log.week_end_date}
                      </p>
                      <p className="text-muted-foreground">
                        Not accomplished entries: {log.not_accomplished_count}
                      </p>
                      {log.reflection_id && (
                        <p className="text-xs text-muted-foreground">Reflection provided</p>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
