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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Edit2, Archive, UserCheck, Plus, Trash2, Calendar, FolderOpen, Eye, BookOpen } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import {
  getLessonLog,
  listLessonLogItems,
  listLearnerVerifications,
  upsertLessonLogLearnerVerification,
  upsertLessonLogItem,
  deleteLessonLogItem,
  archiveLessonLog,
  type LessonLog,
  type LearnerVerification,
} from "@/lib/phase6/lesson-logs";
import { normalizeRole } from "@/lib/rbac";

interface Student {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
}

export default function LessonLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();

  const [log, setLog] = useState<LessonLog | null>(null);
  const [items, setItems] = useState<any[]>([]);
  const [verifications, setVerifications] = useState<LearnerVerification[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("teacher");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [canEdit, setCanEdit] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [showItemDialog, setShowItemDialog] = useState(false);
  const [editingItem, setEditingItem] = useState<any | null>(null);
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [verificationForm, setVerificationForm] = useState({
    accomplished_flag: false,
    evidence_text: "",
  });
  const [itemForm, setItemForm] = useState({
    objective: "",
    activity: "",
    verification_method: "",
  });
  const [savingItem, setSavingItem] = useState(false);
  const [deletingItem, setDeletingItem] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      try {
        // Get user role
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
            // Teachers, admins, and principals can edit (registrar is view-only)
            setCanEdit(
              (normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "principal") &&
              profile.role !== "registrar"
            );
          }
        }

        // Fetch lesson log
        const logData = await getLessonLog(id);
        if (!logData) {
          setError("Lesson log not found");
          setLoading(false);
          return;
        }
        setLog(logData);

        // Check if current user can edit (teacher can only edit their own, registrar cannot edit)
        if (session) {
          if (originalRole === "registrar") {
            setCanEdit(false);
          } else if (role === "teacher") {
            setCanEdit(logData.teacher_id === session.user.id);
          }
        }

        // Fetch items
        const itemsData = await listLessonLogItems(id);
        setItems(itemsData);

        // Fetch verifications
        const verificationsData = await listLearnerVerifications(id);
        setVerifications(verificationsData);

        // Fetch students for this organization
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
        console.error("Error fetching lesson log:", err);
        setError(err.message || "Failed to load lesson log");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id, organizationId, isSuperAdmin, orgLoading, role]);

  const handleArchive = async () => {
    if (!log) return;
    setArchiving(true);
    try {
      await archiveLessonLog(id);
      router.push("/sis/phase6/lesson-logs");
    } catch (err: any) {
      console.error("Error archiving lesson log:", err);
      setError(err.message || "Failed to archive lesson log");
    } finally {
      setArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const handleOpenVerificationDialog = (learnerId: string) => {
    const existing = verifications.find((v) => v.learner_id === learnerId);
    setSelectedLearnerId(learnerId);
    setVerificationForm({
      accomplished_flag: existing?.accomplished_flag || false,
      evidence_text: existing?.evidence_text || "",
    });
    setShowVerificationDialog(true);
  };

  const handleSaveVerification = async () => {
    if (!selectedLearnerId || !log) return;

    try {
      await upsertLessonLogLearnerVerification(id, selectedLearnerId, {
        accomplished_flag: verificationForm.accomplished_flag,
        evidence_text: verificationForm.evidence_text || null,
      });

      // Refresh verifications
      const verificationsData = await listLearnerVerifications(id);
      setVerifications(verificationsData);

      setShowVerificationDialog(false);
      setSelectedLearnerId(null);
    } catch (err: any) {
      console.error("Error saving verification:", err);
      setError(err.message || "Failed to save verification");
    }
  };

  const handleSaveItem = async () => {
    if (!itemForm.objective.trim() || !itemForm.activity.trim()) {
      setError("Objective and Activity are required");
      return;
    }

    setSavingItem(true);
    setError(null);

    try {
      await upsertLessonLogItem(id, {
        id: editingItem?.id,
        objective: itemForm.objective.trim(),
        activity: itemForm.activity.trim(),
        verification_method: itemForm.verification_method.trim() || null,
        display_order: editingItem?.display_order || items.length,
      });

      // Refresh items
      const itemsData = await listLessonLogItems(id);
      setItems(itemsData);

      setShowItemDialog(false);
      setEditingItem(null);
      setItemForm({ objective: "", activity: "", verification_method: "" });
    } catch (err: any) {
      console.error("Error saving item:", err);
      setError(err.message || "Failed to save item");
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (itemId: string) => {
    if (!confirm("Are you sure you want to delete this item?")) {
      return;
    }

    setDeletingItem(itemId);
    setError(null);

    try {
      await deleteLessonLogItem(itemId);

      // Refresh items
      const itemsData = await listLessonLogItems(id);
      setItems(itemsData);
    } catch (err: any) {
      console.error("Error deleting item:", err);
      setError(err.message || "Failed to delete item");
    } finally {
      setDeletingItem(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Lesson Log Details</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !log) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Lesson Log Details</h1>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      </div>
    );
  }

  if (!log) {
    return null;
  }

  const getStudentName = (studentId: string) => {
    const student = students.find((s) => s.id === studentId);
    if (!student) return "Unknown";
    return `${student.first_name || ""} ${student.last_name || ""}`.trim() || student.student_number || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Lesson Log Details</h1>
        {canEdit && (
          <>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/sis/phase6/lesson-logs/${id}/edit`)}
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

      {/* Quick Links */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Links</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {log.id && (
              <Button
                variant="outline"
                size="sm"
                onClick={async () => {
                  // Find related attendance session
                  const { data: sessions } = await supabase
                    .from("attendance_sessions")
                    .select("id")
                    .eq("lesson_log_id", log.id)
                    .is("archived_at", null)
                    .limit(1);
                  
                  if (sessions && sessions.length > 0) {
                    router.push(`/sis/phase6/attendance/sessions/${sessions[0].id}`);
                  } else {
                    // No attendance session found, show message
                    alert("No related attendance session found for this lesson log.");
                  }
                }}
              >
                <Calendar className="h-4 w-4 mr-2" />
                View Related Attendance Session
              </Button>
            )}
            {log.syllabus && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => router.push(`/sis/phase6/syllabus/${log.syllabus!.id}`)}
              >
                <BookOpen className="h-4 w-4 mr-2" />
                View Syllabus
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/sis/ams/experiences?lesson_log_id=${log.id}`)}
            >
              <Eye className="h-4 w-4 mr-2" />
              Create Observation (Phase 2)
            </Button>
            {verifications.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  const learnerId = verifications[0].learner_id;
                  router.push(`/sis/phase6/portfolio/my?student=${learnerId}`);
                }}
              >
                <FolderOpen className="h-4 w-4 mr-2" />
                View Learner Portfolio
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Lesson Log Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label className="text-muted-foreground">Week Range</Label>
              <p className="font-medium">
                {log.week_start_date} - {log.week_end_date}
              </p>
            </div>
            {log.syllabus && (
              <div>
                <Label className="text-muted-foreground">Syllabus</Label>
                <p className="font-medium">{log.syllabus.name}</p>
              </div>
            )}
            {log.teacher && (
              <div>
                <Label className="text-muted-foreground">Teacher</Label>
                <p className="font-medium">
                  {log.teacher.first_name} {log.teacher.last_name}
                </p>
              </div>
            )}
            <div>
              <Label className="text-muted-foreground">Status</Label>
              <div className="mt-1">
                <Badge variant={log.status === "submitted" ? "default" : "secondary"}>
                  {log.status}
                </Badge>
              </div>
            </div>
            {log.notes && (
              <div>
                <Label className="text-muted-foreground">Notes</Label>
                <p className="text-sm">{log.notes}</p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Lesson Items</CardTitle>
              {canEdit && (
                <Button
                  size="sm"
                  onClick={() => {
                    setEditingItem(null);
                    setItemForm({ objective: "", activity: "", verification_method: "" });
                    setShowItemDialog(true);
                  }}
                >
                  <Plus className="h-4 w-4 mr-2" />
                  Add Item
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items added yet.</p>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="border rounded p-3">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <p className="font-medium text-sm">Item {index + 1}</p>
                        <p className="text-sm mt-1">
                          <strong>Objective:</strong> {item.objective}
                        </p>
                        <p className="text-sm mt-1">
                          <strong>Activity:</strong> {item.activity}
                        </p>
                        {item.verification_method && (
                          <p className="text-sm mt-1">
                            <strong>Verification:</strong> {item.verification_method}
                          </p>
                        )}
                      </div>
                      {canEdit && (
                        <div className="flex gap-2 ml-4">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              setEditingItem(item);
                              setItemForm({
                                objective: item.objective,
                                activity: item.activity,
                                verification_method: item.verification_method || "",
                              });
                              setShowItemDialog(true);
                            }}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDeleteItem(item.id)}
                            disabled={deletingItem === item.id}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {canEdit && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <UserCheck className="h-5 w-5" />
              Learner Verifications
            </CardTitle>
          </CardHeader>
          <CardContent>
            {students.length === 0 ? (
              <p className="text-sm text-muted-foreground">No students found.</p>
            ) : (
              <div className="space-y-2">
                {students.map((student) => {
                  const verification = verifications.find((v) => v.learner_id === student.id);
                  return (
                    <div
                      key={student.id}
                      className="flex items-center justify-between p-3 border rounded hover:bg-muted/50 cursor-pointer"
                      onClick={() => handleOpenVerificationDialog(student.id)}
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
                        {verification && (
                          <div className="mt-1 flex items-center gap-2">
                            <Badge variant={verification.accomplished_flag ? "default" : "secondary"}>
                              {verification.accomplished_flag ? "Accomplished" : "Not Accomplished"}
                            </Badge>
                            {verification.evidence_text && (
                              <span className="text-xs text-muted-foreground line-clamp-1">
                                {verification.evidence_text}
                              </span>
                            )}
                          </div>
                        )}
                      </div>
                      <Button variant="ghost" size="sm">
                        {verification ? "Edit" : "Add"}
                      </Button>
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
            <DialogTitle>Archive Lesson Log</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this lesson log? This action can be undone.
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

      {/* Verification Dialog */}
      <Dialog open={showVerificationDialog} onOpenChange={setShowVerificationDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              Verification for {selectedLearnerId && getStudentName(selectedLearnerId)}
            </DialogTitle>
            <DialogDescription>
              Verification records teaching evidence. It is not a grade. Record whether this learner accomplished the lesson objectives.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="flex items-center space-x-2">
              <Switch
                id="accomplished"
                checked={verificationForm.accomplished_flag}
                onCheckedChange={(checked) =>
                  setVerificationForm({ ...verificationForm, accomplished_flag: checked })
                }
              />
              <Label htmlFor="accomplished">Accomplished</Label>
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence_text">Evidence / Verification Notes</Label>
              <Textarea
                id="evidence_text"
                value={verificationForm.evidence_text}
                onChange={(e) =>
                  setVerificationForm({ ...verificationForm, evidence_text: e.target.value })
                }
                placeholder="Describe evidence or verification method..."
                rows={4}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowVerificationDialog(false)}>
              Cancel
            </Button>
            <Button onClick={handleSaveVerification}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Item Dialog */}
      <Dialog open={showItemDialog} onOpenChange={setShowItemDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingItem ? "Edit Item" : "Add Item"}</DialogTitle>
            <DialogDescription>
              Add or edit a lesson item with objective, activity, and verification method.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="objective">
                Objective <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="objective"
                value={itemForm.objective}
                onChange={(e) =>
                  setItemForm({ ...itemForm, objective: e.target.value })
                }
                placeholder="Enter the learning objective..."
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="activity">
                Activity <span className="text-destructive">*</span>
              </Label>
              <Textarea
                id="activity"
                value={itemForm.activity}
                onChange={(e) =>
                  setItemForm({ ...itemForm, activity: e.target.value })
                }
                placeholder="Describe the activity..."
                rows={3}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="verification_method">Verification Method (Optional)</Label>
              <Textarea
                id="verification_method"
                value={itemForm.verification_method}
                onChange={(e) =>
                  setItemForm({ ...itemForm, verification_method: e.target.value })
                }
                placeholder="How will you verify learning? (e.g., observation, quiz, project)..."
                rows={2}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowItemDialog(false);
                setEditingItem(null);
                setItemForm({ objective: "", activity: "", verification_method: "" });
              }}
              disabled={savingItem}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveItem} disabled={savingItem}>
              {savingItem ? "Saving..." : editingItem ? "Update" : "Add"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
