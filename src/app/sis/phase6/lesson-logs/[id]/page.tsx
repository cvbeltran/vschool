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
import { ArrowLeft, Edit2, Archive, UserCheck } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import {
  getLessonLog,
  listLessonLogItems,
  listLearnerVerifications,
  upsertLessonLogLearnerVerification,
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
  const [selectedLearnerId, setSelectedLearnerId] = useState<string | null>(null);
  const [verificationForm, setVerificationForm] = useState({
    accomplished_flag: false,
    evidence_text: "",
  });

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
            <CardTitle>Lesson Items</CardTitle>
          </CardHeader>
          <CardContent>
            {items.length === 0 ? (
              <p className="text-sm text-muted-foreground">No items added yet.</p>
            ) : (
              <div className="space-y-4">
                {items.map((item, index) => (
                  <div key={item.id} className="border rounded p-3">
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
              Record whether this learner accomplished the lesson objectives.
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
    </div>
  );
}
