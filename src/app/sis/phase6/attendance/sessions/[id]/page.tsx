"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Edit2, Archive, CheckCircle2, Lock } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import {
  getAttendanceSession,
  listAttendanceRecords,
  upsertAttendanceRecord,
  archiveAttendanceSession,
  updateAttendanceSession,
  type AttendanceSession,
  type AttendanceRecord,
} from "@/lib/phase6/attendance";
import { normalizeRole } from "@/lib/rbac";

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
}

export default function AttendanceSessionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();

  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [records, setRecords] = useState<AttendanceRecord[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("teacher");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [saving, setSaving] = useState<string | null>(null);
  const [finalizing, setFinalizing] = useState(false);
  const [isFinalized, setIsFinalized] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      try {
        // Get user role
        const {
          data: { session: authSession },
        } = await supabase.auth.getSession();
        if (authSession) {
          const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", authSession.user.id)
            .single();
          if (profile?.role) {
            const normalizedRole = normalizeRole(profile.role);
            setRole(normalizedRole);
            setOriginalRole(profile.role);
            // Teachers, admins, and principals can edit (registrar is view-only)
            setCanEdit(
              (normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "principal") &&
              profile.role !== "registrar"
            );
          }
        }

        // Fetch session
        const sessionData = await getAttendanceSession(id);
        if (!sessionData) {
          setError("Attendance session not found");
          setLoading(false);
          return;
        }
        setSession(sessionData);
        
        // Check if finalized (description contains [FINALIZED] marker)
        setIsFinalized(sessionData.description?.includes("[FINALIZED]") || false);

        // Check if current user can edit (teacher can only edit their own, registrar cannot edit)
        if (authSession) {
          if (originalRole === "registrar") {
            setCanEdit(false);
          } else if (role === "teacher") {
            setCanEdit(sessionData.teacher_id === authSession.user.id);
          }
        }

        // Fetch records
        const recordsData = await listAttendanceRecords(id);
        setRecords(recordsData);

        // Fetch students
        let studentsQuery = supabase
          .from("students")
          .select("id, first_name, last_name, student_number")
          .order("last_name", { ascending: true });

        if (!isSuperAdmin && organizationId) {
          studentsQuery = studentsQuery.eq("organization_id", organizationId);
        }

        const { data: studentsData } = await studentsQuery;
        setStudents(studentsData || []);
      } catch (err: any) {
        console.error("Error fetching attendance session:", err);
        setError(err.message || "Failed to load attendance session");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, organizationId, isSuperAdmin, orgLoading, role]);

  const handleArchive = async () => {
    if (!session) return;
    setArchiving(true);
    try {
      await archiveAttendanceSession(id);
      router.push("/sis/phase6/attendance/sessions");
    } catch (err: any) {
      console.error("Error archiving session:", err);
      setError(err.message || "Failed to archive session");
    } finally {
      setArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handleStatusChange = async (learnerId: string, status: "present" | "absent" | "late", notes?: string) => {
    if (isFinalized) return; // Don't allow edits if finalized
    
    setSaving(learnerId);
    try {
      await upsertAttendanceRecord(id, learnerId, status, notes);
      // Refresh records
      const recordsData = await listAttendanceRecords(id);
      setRecords(recordsData);
    } catch (err: any) {
      console.error("Error updating attendance:", err);
      setError(err.message || "Failed to update attendance");
    } finally {
      setSaving(null);
    }
  };

  const handleFinalizeSession = async () => {
    if (!session) return;
    if (!confirm("Finalize this attendance session? Once finalized, attendance records cannot be edited.")) {
      return;
    }

    setFinalizing(true);
    try {
      const currentDescription = session.description || "";
      const finalizedDescription = currentDescription.includes("[FINALIZED]")
        ? currentDescription
        : `${currentDescription} [FINALIZED]`.trim();
      
      await updateAttendanceSession(id, {
        description: finalizedDescription,
      });
      
      // Refresh session
      const sessionData = await getAttendanceSession(id);
      if (sessionData) {
        setSession(sessionData);
        setIsFinalized(true);
      }
    } catch (err: any) {
      console.error("Error finalizing session:", err);
      setError(err.message || "Failed to finalize session");
    } finally {
      setFinalizing(false);
    }
  };

  const handleMarkAllPresent = async () => {
    if (!confirm("Mark all students as present?")) return;
    setSaving("bulk");
    try {
      const promises = students.map((student) =>
        upsertAttendanceRecord(id, student.id, "present")
      );
      await Promise.all(promises);
      // Refresh records
      const recordsData = await listAttendanceRecords(id);
      setRecords(recordsData);
    } catch (err: any) {
      console.error("Error marking all present:", err);
      setError(err.message || "Failed to mark all present");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Attendance Session</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !session) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Attendance Session</h1>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      </div>
    );
  }

  if (!session) {
    return null;
  }

  const getRecordForStudent = (studentId: string): AttendanceRecord | undefined => {
    return records.find((r) => r.learner_id === studentId);
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "present":
        return "default";
      case "absent":
        return "destructive";
      case "late":
        return "secondary";
      default:
        return "outline";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Attendance Session</h1>
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/sis/phase6/attendance/sessions/${id}/edit`)}
            >
              <Edit2 className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchiveDialog(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {isFinalized && (
        <div className="flex items-center gap-3 p-4 border border-blue-200 bg-blue-50 rounded-md">
          <Lock className="h-5 w-5 text-blue-600" />
          <p className="text-blue-800 font-medium">
            Session finalized — attendance locked. Records cannot be edited.
          </p>
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Session Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label className="text-muted-foreground">Date</Label>
            <p className="font-medium">{session.session_date}</p>
          </div>
          {session.session_time && (
            <div>
              <Label className="text-muted-foreground">Time</Label>
              <p className="font-medium">{session.session_time}</p>
            </div>
          )}
          {session.syllabus && (
            <div>
              <Label className="text-muted-foreground">Syllabus</Label>
              <p className="font-medium">{session.syllabus.name}</p>
            </div>
          )}
          {session.teacher && (
            <div>
              <Label className="text-muted-foreground">Teacher</Label>
              <p className="font-medium">
                {session.teacher.first_name} {session.teacher.last_name}
              </p>
            </div>
          )}
          {session.description && (
            <div>
              <Label className="text-muted-foreground">Description</Label>
              <p className="text-sm">{session.description}</p>
            </div>
          )}
        </CardContent>
      </Card>

      {canEdit && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="h-5 w-5" />
                Mark Attendance
              </CardTitle>
              <div className="flex gap-2">
                {students.length > 0 && !isFinalized && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleMarkAllPresent}
                    disabled={saving === "bulk"}
                  >
                    {saving === "bulk" ? "Saving..." : "Mark All Present"}
                  </Button>
                )}
                {!isFinalized && (
                  <Button
                    variant="default"
                    size="sm"
                    onClick={handleFinalizeSession}
                    disabled={finalizing}
                  >
                    {finalizing ? "Finalizing..." : "Finalize Session"}
                  </Button>
                )}
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students found.</p>
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const record = getRecordForStudent(student.id);
                  const currentStatus = record?.status || "present";
                  const isSaving = saving === student.id;

                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 border rounded"
                    >
                      <div className="flex-1">
                        <p className="font-medium">
                          {student.first_name} {student.last_name}
                          {student.student_number && (
                            <span className="text-muted-foreground text-sm ml-2">
                              ({student.student_number})
                            </span>
                          )}
                        </p>
                        {record?.notes && (
                          <p className="text-xs text-muted-foreground mt-1">{record.notes}</p>
                        )}
                      </div>
                      <div className="flex items-center gap-2">
                        {isFinalized ? (
                          <Badge variant={getStatusBadgeVariant(currentStatus)}>
                            {currentStatus}
                          </Badge>
                        ) : (
                          <>
                            <Select
                              value={currentStatus}
                              onValueChange={(value: "present" | "absent" | "late") =>
                                handleStatusChange(student.id, value, record?.notes || undefined)
                              }
                              disabled={isSaving || isFinalized}
                            >
                              <SelectTrigger className="w-32">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="present">Present</SelectItem>
                                <SelectItem value="absent">Absent</SelectItem>
                                <SelectItem value="late">Late</SelectItem>
                              </SelectContent>
                            </Select>
                            {isSaving && (
                              <span className="text-xs text-muted-foreground">Saving...</span>
                            )}
                            {record && !isSaving && (
                              <Badge variant={getStatusBadgeVariant(record.status)}>
                                {record.status}
                              </Badge>
                            )}
                          </>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Attendance Session</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this attendance session? This action can be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(false)}
              disabled={archiving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
