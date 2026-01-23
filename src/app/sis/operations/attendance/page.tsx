"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Check, X, Clock, FileCheck, Search } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  listAttendanceSessions,
  createAttendanceSession,
  postAttendanceSession,
  listAttendanceRecords,
  bulkUpdateAttendanceRecords,
  type AttendanceSession,
  type AttendanceRecord,
  type CreateAttendanceSessionPayload,
  type BulkUpdateAttendanceRecordsPayload,
} from "@/lib/phase6/operations";
import { listSections, type Section } from "@/lib/phase6/operations";
import { normalizeRole } from "@/lib/rbac";

export default function AttendancePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [sessions, setSessions] = useState<AttendanceSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("admin");
  const [originalRole, setOriginalRole] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    section_id: searchParams.get("section") || "",
    session_date: searchParams.get("date") || "",
  });

  // Options
  const [sections, setSections] = useState<Section[]>([]);
  const [terms, setTerms] = useState<Array<{ id: string; name: string }>>([]);

  // Create session dialog
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [sessionFormData, setSessionFormData] = useState<
    Partial<CreateAttendanceSessionPayload>
  >({
    section_id: "",
    session_date: new Date().toISOString().split("T")[0],
    session_type: "daily",
  });
  const [creating, setCreating] = useState(false);

  // Post attendance dialog
  const [postDialogOpen, setPostDialogOpen] = useState(false);
  const [selectedSession, setSelectedSession] = useState<AttendanceSession | null>(null);
  const [attendanceRecords, setAttendanceRecords] = useState<AttendanceRecord[]>([]);
  const [loadingRecords, setLoadingRecords] = useState(false);
  const [bulkStatus, setBulkStatus] = useState<"present" | "absent" | "late" | "excused" | "">("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  // Fetch user role
  useEffect(() => {
    const fetchRole = async () => {
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
          setOriginalRole(profile.role);
        }
      }
    };
    fetchRole();
  }, []);

  // Fetch sections and terms
  useEffect(() => {
    const fetchOptions = async () => {
      if (orgLoading || !organizationId) return;
      try {
        const sectionsData = await listSections();
        setSections(sectionsData);
        // Fetch terms (school_years or terms table)
        let termsQuery = supabase
          .from("school_years")
          .select("id, name")
          .order("name");
        if (!isSuperAdmin) {
          termsQuery = termsQuery.eq("organization_id", organizationId);
        }
        const { data: termsData } = await termsQuery;
        setTerms((termsData || []) as Array<{ id: string; name: string }>);
      } catch (error) {
        console.error("Error fetching options:", error);
      }
    };
    if (!orgLoading && organizationId) {
      fetchOptions();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Fetch sessions
  useEffect(() => {
    const fetchSessions = async () => {
      if (orgLoading || !organizationId) return;
      setLoading(true);
      try {
        const data = await listAttendanceSessions({
          section_id: filters.section_id || undefined,
          session_date: filters.session_date || undefined,
        });
        setSessions(data);
      } catch (error: any) {
        console.error("Error fetching sessions:", error);
      } finally {
        setLoading(false);
      }
    };
    if (!orgLoading && organizationId) {
      fetchSessions();
    }
  }, [organizationId, orgLoading, filters]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.section_id) params.set("section", filters.section_id);
    if (filters.session_date) params.set("date", filters.session_date);
    router.replace(`/sis/operations/attendance?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  const canManage =
    role === "admin" || role === "principal" || originalRole === "registrar" || role === "teacher";

  const handleCreateSession = async () => {
    if (!organizationId || !sessionFormData.section_id || !sessionFormData.session_date) {
      alert("Please fill in all required fields");
      return;
    }
    setCreating(true);
    try {
      const section = sections.find((s) => s.id === sessionFormData.section_id);
      if (!section) {
        throw new Error("Section not found");
      }
      const payload: CreateAttendanceSessionPayload = {
        organization_id: organizationId,
        section_id: sessionFormData.section_id!,
        session_date: sessionFormData.session_date!,
        session_type: sessionFormData.session_type || "daily",
        term_id: sessionFormData.term_id || null,
        notes: sessionFormData.notes || null,
      };
      await createAttendanceSession(payload);
      setCreateDialogOpen(false);
      setSessionFormData({
        section_id: "",
        session_date: new Date().toISOString().split("T")[0],
        session_type: "daily",
      });
      // Refetch sessions
      const data = await listAttendanceSessions({
        section_id: filters.section_id || undefined,
        session_date: filters.session_date || undefined,
      });
      setSessions(data);
    } catch (error: any) {
      console.error("Error creating session:", error);
      alert(error.message || "Failed to create attendance session");
    } finally {
      setCreating(false);
    }
  };

  const handleOpenPostDialog = async (session: AttendanceSession) => {
    setSelectedSession(session);
    setPostDialogOpen(true);
    setLoadingRecords(true);
    try {
      // Post session to generate records if not already posted
      if (session.status !== "posted") {
        await postAttendanceSession(session.id);
      }
      // Fetch records
      const records = await listAttendanceRecords(session.id);
      setAttendanceRecords(records);
    } catch (error: any) {
      console.error("Error loading attendance records:", error);
      alert(error.message || "Failed to load attendance records");
    } finally {
      setLoadingRecords(false);
    }
  };

  const handleBulkAction = async (action: "mark_all_present" | "mark_selected") => {
    if (!selectedSession) return;
    setSaving(true);
    try {
      if (action === "mark_all_present") {
        const payload: BulkUpdateAttendanceRecordsPayload = {
          session_id: selectedSession.id,
          records: attendanceRecords.map((r) => ({
            student_id: r.student_id,
            status: "present",
          })),
        };
        await bulkUpdateAttendanceRecords(payload);
      } else if (action === "mark_selected" && bulkStatus) {
        const payload: BulkUpdateAttendanceRecordsPayload = {
          session_id: selectedSession.id,
          records: Array.from(selectedStudentIds).map((studentId) => ({
            student_id: studentId,
            status: bulkStatus,
          })),
        };
        await bulkUpdateAttendanceRecords(payload);
      }
      // Refetch records
      const records = await listAttendanceRecords(selectedSession.id);
      setAttendanceRecords(records);
      setSelectedStudentIds(new Set());
      setBulkStatus("");
    } catch (error: any) {
      console.error("Error updating attendance:", error);
      alert(error.message || "Failed to update attendance");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateRecord = async (
    studentId: string,
    status: "present" | "absent" | "late" | "excused"
  ) => {
    if (!selectedSession) return;
    try {
      const payload: BulkUpdateAttendanceRecordsPayload = {
        session_id: selectedSession.id,
        records: [{ student_id: studentId, status }],
      };
      await bulkUpdateAttendanceRecords(payload);
      // Refetch records
      const records = await listAttendanceRecords(selectedSession.id);
      setAttendanceRecords(records);
    } catch (error: any) {
      console.error("Error updating record:", error);
      alert(error.message || "Failed to update attendance record");
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "present":
        return <Check className="h-4 w-4 text-green-600" />;
      case "absent":
        return <X className="h-4 w-4 text-red-600" />;
      case "late":
        return <Clock className="h-4 w-4 text-yellow-600" />;
      case "excused":
        return <FileCheck className="h-4 w-4 text-blue-600" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Attendance</h1>
        {canManage && (
          <Button onClick={() => setCreateDialogOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create Session
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>Section</Label>
              <Select
                value={filters.section_id || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, section_id: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Date</Label>
              <Input
                type="date"
                value={filters.session_date}
                onChange={(e) =>
                  setFilters({ ...filters, session_date: e.target.value })
                }
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Sessions List */}
      {sessions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No attendance sessions found.{" "}
              {canManage && "Create your first session to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Date</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Section</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    {canManage && (
                      <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sessions.map((session) => (
                    <tr key={session.id} className="border-b">
                      <td className="px-4 py-3 text-sm">
                        {new Date(session.session_date).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {session.section?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge variant="outline">{session.session_type}</Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            session.status === "posted" ? "default" : "secondary"
                          }
                        >
                          {session.status || "draft"}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleOpenPostDialog(session)}
                          >
                            Post Attendance
                          </Button>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Session Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Attendance Session</DialogTitle>
            <DialogDescription>
              Create a new attendance session for a section
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="section_id">Section *</Label>
              <Select
                value={sessionFormData.section_id || ""}
                onValueChange={(value) =>
                  setSessionFormData({ ...sessionFormData, section_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a section" />
                </SelectTrigger>
                <SelectContent>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="session_date">Date *</Label>
              <Input
                id="session_date"
                type="date"
                value={sessionFormData.session_date || ""}
                onChange={(e) =>
                  setSessionFormData({
                    ...sessionFormData,
                    session_date: e.target.value,
                  })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="session_type">Type</Label>
              <Select
                value={sessionFormData.session_type || "daily"}
                onValueChange={(value: any) =>
                  setSessionFormData({
                    ...sessionFormData,
                    session_type: value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="daily">Daily</SelectItem>
                  <SelectItem value="period">Period</SelectItem>
                  <SelectItem value="event">Event</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="term_id">Term</Label>
              <Select
                value={sessionFormData.term_id || "none"}
                onValueChange={(value) =>
                  setSessionFormData({
                    ...sessionFormData,
                    term_id: value === "none" ? undefined : value,
                  })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Optional" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">None</SelectItem>
                  {terms.map((term) => (
                    <SelectItem key={term.id} value={term.id}>
                      {term.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={sessionFormData.notes || ""}
                onChange={(e) =>
                  setSessionFormData({
                    ...sessionFormData,
                    notes: e.target.value,
                  })
                }
                placeholder="Optional notes..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button
                variant="outline"
                onClick={() => setCreateDialogOpen(false)}
              >
                Cancel
              </Button>
              <Button
                onClick={handleCreateSession}
                disabled={
                  creating ||
                  !sessionFormData.section_id ||
                  !sessionFormData.session_date
                }
              >
                {creating ? "Creating..." : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Post Attendance Dialog */}
      <Dialog open={postDialogOpen} onOpenChange={setPostDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Post Attendance - {selectedSession?.section?.name} -{" "}
              {selectedSession &&
                new Date(selectedSession.session_date).toLocaleDateString()}
            </DialogTitle>
            <DialogDescription>
              Mark attendance for all students in this section
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Bulk Actions */}
            <div className="flex items-center gap-2 flex-wrap">
              <Button
                variant="outline"
                size="sm"
                onClick={() => handleBulkAction("mark_all_present")}
                disabled={saving || loadingRecords}
              >
                Mark All Present
              </Button>
              <div className="flex items-center gap-2">
                <Select
                  value={bulkStatus}
                  onValueChange={(value: any) => setBulkStatus(value)}
                >
                  <SelectTrigger className="w-32">
                    <SelectValue placeholder="Status" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="absent">Absent</SelectItem>
                    <SelectItem value="late">Late</SelectItem>
                    <SelectItem value="excused">Excused</SelectItem>
                  </SelectContent>
                </Select>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => handleBulkAction("mark_selected")}
                  disabled={
                    saving ||
                    loadingRecords ||
                    !bulkStatus ||
                    selectedStudentIds.size === 0
                  }
                >
                  Mark Selected ({selectedStudentIds.size})
                </Button>
              </div>
            </div>

            {/* Attendance Grid */}
            {loadingRecords ? (
              <div className="text-sm text-muted-foreground">Loading...</div>
            ) : attendanceRecords.length === 0 ? (
              <div className="text-sm text-muted-foreground">
                No students found in this section
              </div>
            ) : (
              <div className="space-y-2">
                {attendanceRecords.map((record) => (
                  <div
                    key={record.id}
                    className="flex items-center justify-between p-3 border rounded"
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="checkbox"
                        checked={selectedStudentIds.has(record.student_id)}
                        onChange={(e) => {
                          const newSet = new Set(selectedStudentIds);
                          if (e.target.checked) {
                            newSet.add(record.student_id);
                          } else {
                            newSet.delete(record.student_id);
                          }
                          setSelectedStudentIds(newSet);
                        }}
                        className="h-4 w-4"
                      />
                      <div>
                        <div className="font-medium">
                          {record.student?.first_name} {record.student?.last_name}
                        </div>
                        {record.student?.student_number && (
                          <div className="text-sm text-muted-foreground">
                            {record.student.student_number}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {getStatusIcon(record.status)}
                      <Select
                        value={record.status}
                        onValueChange={(value: any) =>
                          handleUpdateRecord(record.student_id, value)
                        }
                      >
                        <SelectTrigger className="w-32">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="present">Present</SelectItem>
                          <SelectItem value="absent">Absent</SelectItem>
                          <SelectItem value="late">Late</SelectItem>
                          <SelectItem value="excused">Excused</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
