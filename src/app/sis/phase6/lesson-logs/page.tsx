"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import { listLessonLogs, type LessonLog } from "@/lib/phase6/lesson-logs";
import { normalizeRole } from "@/lib/rbac";

export default function LessonLogsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [logs, setLogs] = useState<LessonLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("teacher");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      try {
        // Get user role and teacher ID
        const {
          data: { session },
        } = await supabase.auth.getSession();
        if (session) {
          setCurrentTeacherId(session.user.id);
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", session.user.id)
            .single();
          if (profile?.role) {
            const normalizedRole = normalizeRole(profile.role);
            setRole(normalizedRole);
            setOriginalRole(profile.role);
            // Teachers, admins, and principals can create lesson logs (registrar is view-only)
            setCanCreate(
              (normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "principal") &&
              profile.role !== "registrar"
            );
          }
        }

        // Fetch lesson logs - teachers only see their own
        const filters: any = {};
        if (role === "teacher" && currentTeacherId) {
          filters.teacher_id = currentTeacherId;
        }

        const data = await listLessonLogs(filters);
        setLogs(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching lesson logs:", err);
        setError(err.message || "Failed to load lesson logs");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading, role, currentTeacherId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Lesson Logs</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Lesson Logs</h1>
        {canCreate && (
          <Button onClick={() => router.push("/sis/phase6/lesson-logs/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Lesson Log
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {logs.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No lesson logs found. Create your first lesson log to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {logs.map((log) => (
            <Card key={log.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">
                      {log.week_start_date} - {log.week_end_date}
                    </p>
                    {log.syllabus && (
                      <p className="text-sm text-muted-foreground">
                        Syllabus: {log.syllabus.name}
                      </p>
                    )}
                    {log.teacher && (
                      <p className="text-sm text-muted-foreground">
                        Teacher: {log.teacher.first_name} {log.teacher.last_name}
                      </p>
                    )}
                    <div className="mt-2">
                      <Badge variant={log.status === "submitted" ? "default" : "secondary"}>
                        {log.status}
                      </Badge>
                    </div>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/sis/phase6/lesson-logs/${log.id}`)}
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
