"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Plus, Edit2, Archive } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  listMyTeacherAttendance,
  createMyTeacherAttendance,
  updateMyTeacherAttendance,
  archiveMyTeacherAttendance,
  type TeacherAttendance,
  type CreateMyTeacherAttendancePayload,
} from "@/lib/phase6/attendance";

export default function MyAttendancePage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [attendance, setAttendance] = useState<TeacherAttendance[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [formData, setFormData] = useState({
    attendance_date: "",
    status: "present" as "present" | "absent" | "late",
    notes: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      try {
        const data = await listMyTeacherAttendance();
        setAttendance(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching teacher attendance:", err);
        setError(err.message || "Failed to load attendance");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading]);

  const handleOpenCreate = () => {
    setFormData({
      attendance_date: new Date().toISOString().split("T")[0],
      status: "present",
      notes: "",
    });
    setEditingId(null);
    setShowCreateDialog(true);
  };

  const handleOpenEdit = (record: TeacherAttendance) => {
    setFormData({
      attendance_date: record.attendance_date,
      status: record.status,
      notes: record.notes || "",
    });
    setEditingId(record.id);
    setShowCreateDialog(true);
  };

  const handleSubmit = async () => {
    if (!organizationId) {
      setError("Missing organization context");
      return;
    }

    if (!formData.attendance_date) {
      setError("Date is required");
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      if (editingId) {
        await updateMyTeacherAttendance(editingId, {
          attendance_date: formData.attendance_date,
          status: formData.status,
          notes: formData.notes || null,
        });
      } else {
        const payload: CreateMyTeacherAttendancePayload = {
          organization_id: organizationId,
          attendance_date: formData.attendance_date,
          status: formData.status,
          notes: formData.notes || null,
        };
        await createMyTeacherAttendance(payload);
      }

      // Refresh list
      const data = await listMyTeacherAttendance();
      setAttendance(data);
      setShowCreateDialog(false);
      setEditingId(null);
    } catch (err: any) {
      console.error("Error saving attendance:", err);
      setError(err.message || "Failed to save attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this attendance record?")) {
      return;
    }

    setArchivingId(id);
    try {
      await archiveMyTeacherAttendance(id);
      const data = await listMyTeacherAttendance();
      setAttendance(data);
    } catch (err: any) {
      console.error("Error archiving attendance:", err);
      setError(err.message || "Failed to archive attendance");
    } finally {
      setArchivingId(null);
    }
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

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Attendance</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Attendance</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Log Attendance
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {attendance.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No attendance records found. Log your first attendance to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Attendance History</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {attendance.map((record) => (
                <div
                  key={record.id}
                  className="flex items-center justify-between p-3 border rounded"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <p className="font-medium">{record.attendance_date}</p>
                      <Badge variant={getStatusBadgeVariant(record.status)}>
                        {record.status}
                      </Badge>
                    </div>
                    {record.notes && (
                      <p className="text-sm text-muted-foreground mt-1">{record.notes}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(record)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchive(record.id)}
                      disabled={archivingId === record.id}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      {archivingId === record.id ? "Archiving..." : "Archive"}
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingId ? "Edit Attendance" : "Log Attendance"}
            </DialogTitle>
            <DialogDescription>
              {editingId
                ? "Update your attendance record."
                : "Record your attendance for a specific date."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="attendance_date">
                Date <span className="text-destructive">*</span>
              </Label>
              <Input
                id="attendance_date"
                type="date"
                value={formData.attendance_date}
                onChange={(e) =>
                  setFormData({ ...formData, attendance_date: e.target.value })
                }
                required
                disabled={submitting}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "present" | "absent" | "late") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Present</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="late">Late</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="notes">Notes (Optional)</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional notes about your attendance"
                rows={3}
                disabled={submitting}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowCreateDialog(false);
                setEditingId(null);
              }}
              disabled={submitting}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit} disabled={submitting}>
              {submitting ? "Saving..." : editingId ? "Save Changes" : "Log Attendance"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
