"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  listTeacherFeedbackFromView,
  listStudentFeedback,
  type TeacherFeedbackView,
  type StudentFeedback,
} from "@/lib/feedback";
import { listFeedbackDimensions, type FeedbackDimension } from "@/lib/feedback";
import { getExperiences, type Experience } from "@/lib/ams";
import { normalizeRole } from "@/lib/rbac";

type FeedbackItem = TeacherFeedbackView | StudentFeedback;

export default function TeacherFeedbackPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [feedback, setFeedback] = useState<FeedbackItem[]>([]);
  const [feedbackDimensions, setFeedbackDimensions] = useState<
    FeedbackDimension[]
  >([]);
  const [experiences, setExperiences] = useState<Experience[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher" | null>(null);
  const [quarterFilter, setQuarterFilter] = useState<string>("all");
  const [experienceTypeFilter, setExperienceTypeFilter] =
    useState<string>("all");
  const [experienceFilter, setExperienceFilter] = useState<string>("all");
  const [dimensionFilter, setDimensionFilter] = useState<string>("all");

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
          setRole(normalizeRole(profile.role));
        }
      }
    };
    fetchRole();
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !role) return;

      // Fetch feedback dimensions and experiences for filters
      try {
        const [dimensionsData, experiencesData] = await Promise.all([
          listFeedbackDimensions(
            isSuperAdmin ? null : organizationId || null
          ),
          getExperiences(isSuperAdmin ? null : organizationId || null),
        ]);
        setFeedbackDimensions(dimensionsData);
        setExperiences(experiencesData);
      } catch (err: any) {
        console.error("Error fetching filter data:", err);
      }

      // Fetch feedback based on user role
      try {
        const isAdmin = role === "admin" || role === "principal";
        
        if (isAdmin) {
          // For admins/principals: use listStudentFeedback with completed status filter
          const filters: any = {
            status: "completed", // Only show completed feedback
          };
          if (quarterFilter !== "all") {
            filters.quarter = quarterFilter;
          }
          if (experienceFilter !== "all") {
            filters.experienceId = experienceFilter;
          }
          // Note: dimensionFilter and experienceTypeFilter need to be handled differently
          // since listStudentFeedback doesn't have these exact filters
          
          const data = await listStudentFeedback(
            isSuperAdmin ? null : organizationId || null,
            filters
          );
          
          // Apply additional filters that aren't supported by the function
          let filteredData = data;
          if (dimensionFilter !== "all") {
            filteredData = filteredData.filter(
              (item) => item.feedback_dimension_id === dimensionFilter
            );
          }
          if (experienceTypeFilter !== "all") {
            filteredData = filteredData.filter(
              (item) => item.experience_type === experienceTypeFilter
            );
          }
          
          setFeedback(filteredData);
        } else {
          // For teachers: use listTeacherFeedbackFromView (existing behavior)
          const filters: any = {};
          if (quarterFilter !== "all") {
            filters.quarter = quarterFilter;
          }
          if (experienceTypeFilter !== "all") {
            filters.experienceType = experienceTypeFilter;
          }
          if (experienceFilter !== "all") {
            filters.experienceId = experienceFilter;
          }
          if (dimensionFilter !== "all") {
            filters.feedbackDimensionId = dimensionFilter;
          }

          const data = await listTeacherFeedbackFromView(
            isSuperAdmin ? null : organizationId || null,
            filters
          );
          setFeedback(data);
        }
        setError(null);
      } catch (err: any) {
        console.error("Error fetching feedback:", err);
        setError(err.message || "Failed to load feedback");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [
    organizationId,
    isSuperAdmin,
    orgLoading,
    role,
    quarterFilter,
    experienceTypeFilter,
    experienceFilter,
    dimensionFilter,
  ]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student Feedback</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Student Feedback</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Completed feedback from students (anonymized when requested)
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-4 gap-4">
        <div className="space-y-2">
          <label className="text-sm font-medium">Quarter</label>
          <Select value={quarterFilter} onValueChange={setQuarterFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="Q1">Q1</SelectItem>
              <SelectItem value="Q2">Q2</SelectItem>
              <SelectItem value="Q3">Q3</SelectItem>
              <SelectItem value="Q4">Q4</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Experience Type</label>
          <Select
            value={experienceTypeFilter}
            onValueChange={setExperienceTypeFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              <SelectItem value="mentoring">Mentoring</SelectItem>
              <SelectItem value="apprenticeship">Apprenticeship</SelectItem>
              <SelectItem value="lab">Lab</SelectItem>
              <SelectItem value="studio">Studio</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Experience</label>
          <Select
            value={experienceFilter}
            onValueChange={setExperienceFilter}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {experiences.map((exp) => (
                <SelectItem key={exp.id} value={exp.id}>
                  {exp.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium">Dimension</label>
          <Select value={dimensionFilter} onValueChange={setDimensionFilter}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All</SelectItem>
              {feedbackDimensions
                .filter((d) => d.is_active)
                .map((dimension) => (
                  <SelectItem key={dimension.id} value={dimension.id}>
                    {dimension.dimension_name}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {feedback.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No feedback yet</div>
            <div className="text-sm text-muted-foreground">
              Completed student feedback will appear here once students submit
              their quarterly feedback.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Dimension
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Experience
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Quarter
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Feedback
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Anonymous
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Provided At
                </th>
              </tr>
            </thead>
            <tbody>
              {feedback.map((item) => {
                // Handle both StudentFeedback and TeacherFeedbackView types
                // Both types have the same structure for display purposes
                const feedbackText = item.feedback_text || "";
                const providedAt = item.provided_at || "";
                
                return (
                  <tr key={item.id} className="border-b hover:bg-muted/50">
                    <td className="px-4 py-3 text-sm font-medium">
                      {item.feedback_dimension?.dimension_name || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.experience?.name || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.experience_type || (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {item.quarter}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {feedbackText.length > 150
                        ? feedbackText.substring(0, 150) + "..."
                        : feedbackText}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {item.is_anonymous || !item.student_id ? (
                        <Badge variant="secondary">Anonymous</Badge>
                      ) : (
                        <span className="text-muted-foreground">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-muted-foreground">
                      {providedAt ? new Date(providedAt).toLocaleDateString() : "—"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
