"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import {
  createAttendanceSession,
  type CreateAttendanceSessionPayload,
} from "@/lib/phase6/attendance";

export default function NewAttendanceSessionPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    session_date: "",
    session_time: "",
    syllabus_id: "",
    lesson_log_id: "",
    experience_id: "",
    description: "",
  });

  const [syllabi, setSyllabi] = useState<Array<{ id: string; name: string }>>([]);
  const [lessonLogs, setLessonLogs] = useState<Array<{ id: string; week_start_date: string; week_end_date: string }>>([]);
  const [experiences, setExperiences] = useState<Array<{ id: string; name: string }>>([]);
  const [currentTeacherId, setCurrentTeacherId] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Get current user's teacher ID
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        setCurrentTeacherId(session.user.id);
      }

      // Fetch syllabi
      let syllabiQuery = supabase
        .from("syllabi")
        .select("id, name")
        .eq("status", "published")
        .order("name", { ascending: true });

      if (!isSuperAdmin && organizationId) {
        syllabiQuery = syllabiQuery.eq("organization_id", organizationId);
      }

      const { data: syllabiData } = await syllabiQuery;
      setSyllabi(syllabiData || []);

      // Fetch lesson logs
      let lessonLogsQuery = supabase
        .from("weekly_lesson_logs")
        .select("id, week_start_date, week_end_date")
        .is("archived_at", null)
        .order("week_start_date", { ascending: false })
        .limit(50);

      if (!isSuperAdmin && organizationId) {
        lessonLogsQuery = lessonLogsQuery.eq("organization_id", organizationId);
      }

      const { data: logsData } = await lessonLogsQuery;
      setLessonLogs(logsData || []);

      // Fetch experiences
      let experiencesQuery = supabase
        .from("experiences")
        .select("id, name")
        .is("archived_at", null)
        .order("name", { ascending: true });

      if (!isSuperAdmin && organizationId) {
        experiencesQuery = experiencesQuery.eq("organization_id", organizationId);
      }

      const { data: experiencesData } = await experiencesQuery;
      setExperiences(experiencesData || []);
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentTeacherId || !organizationId) {
      setError("Missing required information");
      return;
    }

    if (!formData.session_date) {
      setError("Session date is required");
      return;
    }

    setLoading(true);

    try {
      const payload: CreateAttendanceSessionPayload = {
        organization_id: organizationId,
        teacher_id: currentTeacherId,
        session_date: formData.session_date,
        session_time: formData.session_time || null,
        syllabus_id: formData.syllabus_id || null,
        lesson_log_id: formData.lesson_log_id || null,
        experience_id: formData.experience_id || null,
        description: formData.description || null,
      };

      const session = await createAttendanceSession(payload);
      router.push(`/sis/phase6/attendance/sessions/${session.id}`);
    } catch (err: any) {
      console.error("Error creating attendance session:", err);
      setError(err.message || "Failed to create attendance session");
    } finally {
      setLoading(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Attendance Session</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Create Attendance Session</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Session Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="session_date">
                  Session Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="session_date"
                  type="date"
                  value={formData.session_date}
                  onChange={(e) =>
                    setFormData({ ...formData, session_date: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="session_time">Session Time (Optional)</Label>
                <Input
                  id="session_time"
                  type="time"
                  value={formData.session_time}
                  onChange={(e) =>
                    setFormData({ ...formData, session_time: e.target.value })
                  }
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="syllabus_id">Syllabus (Optional)</Label>
              <Select
                value={formData.syllabus_id || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, syllabus_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a syllabus" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {syllabi.map((syllabus) => (
                    <SelectItem key={syllabus.id} value={syllabus.id}>
                      {syllabus.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="lesson_log_id">Lesson Log (Optional)</Label>
              <Select
                value={formData.lesson_log_id || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, lesson_log_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a lesson log" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {lessonLogs.map((log) => (
                    <SelectItem key={log.id} value={log.id}>
                      {log.week_start_date} - {log.week_end_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="experience_id">Experience (Optional)</Label>
              <Select
                value={formData.experience_id || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, experience_id: value === "__none__" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an experience" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None</SelectItem>
                  {experiences.map((exp) => (
                    <SelectItem key={exp.id} value={exp.id}>
                      {exp.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Optional description for this session"
                rows={3}
                disabled={loading}
              />
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Creating..." : "Create Session"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
