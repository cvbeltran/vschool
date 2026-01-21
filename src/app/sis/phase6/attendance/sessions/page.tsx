"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import { listAttendanceSessions, type AttendanceSession } from "@/lib/phase6/attendance";
import { normalizeRole } from "@/lib/rbac";

export default function AttendanceSessionsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
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
            // Teachers, admins, and principals can create attendance sessions (registrar is view-only)
            setCanCreate(
              (normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "principal") &&
              profile.role !== "registrar"
            );
          }
        }

        // Fetch attendance sessions - teachers only see their own
        const filters: any = {};
        if (role === "teacher" && currentTeacherId) {
          filters.teacher_id = currentTeacherId;
        }

        const data = await listAttendanceSessions(filters);
        setSessions(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching attendance sessions:", err);
        setError(err.message || "Failed to load attendance sessions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading, role, currentTeacherId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Attendance Sessions</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Attendance Sessions</h1>
        {canCreate && (
          <Button onClick={() => router.push("/sis/phase6/attendance/sessions/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Session
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No attendance sessions found. Create your first session to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => (
            <Card key={session.id}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{session.session_date}</p>
                    {session.description && (
                      <p className="text-sm text-muted-foreground">{session.description}</p>
                    )}
                    {session.teacher && (
                      <p className="text-sm text-muted-foreground">
                        Teacher: {session.teacher.first_name} {session.teacher.last_name}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/sis/phase6/attendance/sessions/${session.id}`)}
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
