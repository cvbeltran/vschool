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
  createLessonLog,
  type CreateLessonLogPayload,
} from "@/lib/phase6/lesson-logs";

export default function NewLessonLogPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    syllabus_id: "",
    syllabus_week_id: "",
    week_start_date: "",
    week_end_date: "",
    status: "draft" as "draft" | "submitted",
    notes: "",
  });

  const [syllabi, setSyllabi] = useState<Array<{ id: string; name: string }>>([]);
  const [syllabusWeeks, setSyllabusWeeks] = useState<Array<{ id: string; week_number: number; week_start_date: string; week_end_date: string }>>([]);
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
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  useEffect(() => {
    const fetchSyllabusWeeks = async () => {
      if (!formData.syllabus_id) {
        setSyllabusWeeks([]);
        return;
      }

      const { data } = await supabase
        .from("syllabus_weeks")
        .select("id, week_number, week_start_date, week_end_date")
        .eq("syllabus_id", formData.syllabus_id)
        .is("archived_at", null)
        .order("week_number", { ascending: true });

      setSyllabusWeeks(data || []);
    };

    fetchSyllabusWeeks();
  }, [formData.syllabus_id]);

  const handleSyllabusWeekChange = (weekId: string) => {
    const week = syllabusWeeks.find((w) => w.id === weekId);
    if (week) {
      setFormData({
        ...formData,
        syllabus_week_id: weekId,
        week_start_date: week.week_start_date || "",
        week_end_date: week.week_end_date || "",
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!currentTeacherId || !organizationId) {
      setError("Missing required information");
      return;
    }

    if (!formData.week_start_date || !formData.week_end_date) {
      setError("Week start and end dates are required");
      return;
    }

    setLoading(true);

    try {
      const payload: CreateLessonLogPayload = {
        organization_id: organizationId,
        teacher_id: currentTeacherId,
        syllabus_id: formData.syllabus_id || null,
        syllabus_week_id: formData.syllabus_week_id || null,
        week_start_date: formData.week_start_date,
        week_end_date: formData.week_end_date,
        status: formData.status,
        notes: formData.notes || null,
      };

      const log = await createLessonLog(payload);
      router.push(`/sis/phase6/lesson-logs/${log.id}`);
    } catch (err: any) {
      console.error("Error creating lesson log:", err);
      setError(err.message || "Failed to create lesson log");
    } finally {
      setLoading(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Lesson Log</h1>
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
        <h1 className="text-2xl font-semibold">Create Lesson Log</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Log Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="syllabus_id">Syllabus (Optional)</Label>
              <Select
                value={formData.syllabus_id || "__none__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, syllabus_id: value === "__none__" ? "" : value, syllabus_week_id: "" })
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

            {formData.syllabus_id && (
              <div className="space-y-2">
                <Label htmlFor="syllabus_week_id">Syllabus Week (Optional - will auto-fill dates)</Label>
                <Select
                  value={formData.syllabus_week_id || "__none__"}
                  onValueChange={(value) => {
                    if (value === "__none__") {
                      setFormData({ ...formData, syllabus_week_id: "" });
                    } else {
                      handleSyllabusWeekChange(value);
                    }
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select a week" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">None</SelectItem>
                    {syllabusWeeks.map((week) => (
                      <SelectItem key={week.id} value={week.id}>
                        Week {week.week_number} ({week.week_start_date} - {week.week_end_date})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="week_start_date">
                  Week Start Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="week_start_date"
                  type="date"
                  value={formData.week_start_date}
                  onChange={(e) =>
                    setFormData({ ...formData, week_start_date: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="week_end_date">
                  Week End Date <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="week_end_date"
                  type="date"
                  value={formData.week_end_date}
                  onChange={(e) =>
                    setFormData({ ...formData, week_end_date: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status}
                onValueChange={(value: "draft" | "submitted") =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Draft</SelectItem>
                  <SelectItem value="submitted">Submitted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Optional notes about this lesson log"
                rows={4}
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
                {loading ? "Creating..." : "Create Lesson Log"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
