"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import { listAttendanceSessions, getAttendanceSessionSummary, type AttendanceSession } from "@/lib/phase6/attendance";
import { normalizeRole } from "@/lib/rbac";
import { Badge } from "@/components/ui/badge";
import { Eye, Calendar, User, BookOpen, FileText } from "lucide-react";

export default function AttendanceSessionsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [sessionSummaries, setSessionSummaries] = useState<Map<string, { present: number; absent: number; late: number; missing: number; total: number }>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("teacher");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);
  const [canCreate, setCanCreate] = useState(false);
  
  // Filters
  const [filters, setFilters] = useState({
    session_date_from: "",
    session_date_to: "",
    experience_id: "",
    teacher_id: "",
  });

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
        const sessionFilters: any = {};
        if (role === "teacher" && currentTeacherId) {
          sessionFilters.teacher_id = currentTeacherId;
        }
        if (filters.session_date_from) {
          sessionFilters.session_date_from = filters.session_date_from;
        }
        if (filters.session_date_to) {
          sessionFilters.session_date_to = filters.session_date_to;
        }
        if (filters.experience_id) {
          sessionFilters.experience_id = filters.experience_id;
        }
        if (filters.teacher_id && (role === "admin" || role === "principal")) {
          sessionFilters.teacher_id = filters.teacher_id;
        }

        const data = await listAttendanceSessions(sessionFilters);
        setSessions(data);
        
        // Fetch summaries for each session
        const summaries = new Map();
        for (const session of data) {
          try {
            const summary = await getAttendanceSessionSummary(session.id);
            summaries.set(session.id, summary);
          } catch (err) {
            console.error(`Error fetching summary for session ${session.id}:`, err);
          }
        }
        setSessionSummaries(summaries);
        
        setError(null);
      } catch (err: any) {
        console.error("Error fetching attendance sessions:", err);
        setError(err.message || "Failed to load attendance sessions");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading, role, currentTeacherId, filters]);

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

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Date From</Label>
              <Input
                type="date"
                value={filters.session_date_from}
                onChange={(e) =>
                  setFilters({ ...filters, session_date_from: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Date To</Label>
              <Input
                type="date"
                value={filters.session_date_to}
                onChange={(e) =>
                  setFilters({ ...filters, session_date_to: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label>Experience</Label>
              <Select
                value={filters.experience_id || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, experience_id: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All experiences" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All experiences</SelectItem>
                  {/* Experience options would be loaded here if needed */}
                </SelectContent>
              </Select>
            </div>
            {(role === "admin" || role === "principal") && (
              <div className="space-y-2">
                <Label>Teacher</Label>
                <Select
                  value={filters.teacher_id || "all"}
                  onValueChange={(value) =>
                    setFilters({ ...filters, teacher_id: value === "all" ? "" : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All teachers" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All teachers</SelectItem>
                    {/* Teacher options would be loaded here if needed */}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center space-y-4">
            <FileText className="h-12 w-12 text-muted-foreground mx-auto" />
            <div>
              <p className="font-medium text-lg mb-2">No sessions yet</p>
              <p className="text-muted-foreground">
                Create a session to record learner participation.
              </p>
            </div>
            {canCreate && (
              <Button onClick={() => router.push("/sis/phase6/attendance/sessions/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Create Session
              </Button>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {sessions.map((session) => {
            const summary = sessionSummaries.get(session.id) || { present: 0, absent: 0, late: 0, missing: 0, total: 0 };
            // Check if finalized: if description contains "FINALIZED" marker or all expected learners have records
            const isFinalized = session.description?.includes("[FINALIZED]") || false;
            
            return (
              <Card key={session.id} className="hover:shadow-md transition-shadow">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      <div className="flex items-center gap-3">
                        <Calendar className="h-4 w-4 text-muted-foreground" />
                        <p className="font-medium">{new Date(session.session_date).toLocaleDateString()}</p>
                        {session.session_time && (
                          <p className="text-sm text-muted-foreground">{session.session_time}</p>
                        )}
                        <Badge variant={isFinalized ? "default" : "secondary"}>
                          {isFinalized ? "Finalized" : "Draft"}
                        </Badge>
                      </div>
                      
                      {session.experience && (
                        <div className="flex items-center gap-2 text-sm">
                          <BookOpen className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{session.experience.name}</span>
                          {session.experience.experience_type && (
                            <Badge variant="outline" className="text-xs">
                              {session.experience.experience_type}
                            </Badge>
                          )}
                        </div>
                      )}
                      
                      {session.syllabus && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <BookOpen className="h-4 w-4" />
                          <span>Syllabus: {session.syllabus.name}</span>
                        </div>
                      )}
                      
                      {session.teacher && (
                        <div className="flex items-center gap-2 text-sm text-muted-foreground">
                          <User className="h-4 w-4" />
                          <span>
                            {session.teacher.first_name} {session.teacher.last_name}
                          </span>
                        </div>
                      )}
                      
                      {session.description && (
                        <p className="text-sm text-muted-foreground mt-2">{session.description.replace("[FINALIZED]", "").trim()}</p>
                      )}
                      
                      <div className="flex items-center gap-4 mt-3 text-sm">
                        <span className="text-green-600 font-medium">
                          Present: {summary.present}
                        </span>
                        <span className="text-red-600 font-medium">
                          Absent: {summary.absent}
                        </span>
                        <span className="text-yellow-600 font-medium">
                          Late: {summary.late}
                        </span>
                        {summary.missing > 0 && (
                          <span className="text-muted-foreground font-medium">
                            Missing: {summary.missing}
                          </span>
                        )}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/sis/phase6/attendance/sessions/${session.id}`)}
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      View Session
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
