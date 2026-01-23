"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Plus, Search, Filter } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import { listAssessments, type Assessment, type ListAssessmentsFilters } from "@/lib/assessments";

type Role = "principal" | "admin" | "teacher";

export default function AssessmentsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [assessments, setAssessments] = useState<Assessment[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [learnerFilter, setLearnerFilter] = useState<string>("all");
  const [students, setStudents] = useState<Array<{ id: string; first_name: string | null; last_name: string | null }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      // Fetch user role
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

      // Fetch students for filter
      let studentsQuery = supabase
        .from("students")
        .select("id, first_name, last_name");
      
      if (!isSuperAdmin && organizationId) {
        studentsQuery = studentsQuery.eq("organization_id", organizationId);
      }
      
      const { data: studentsData } = await studentsQuery.order("last_name", { ascending: true });
      setStudents(studentsData || []);

      // Fetch assessments
      await fetchAssessments();
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, role]);

  const fetchAssessments = async () => {
    try {
      setLoading(true);
      const scope = role === "teacher" ? "mine" : "org";
      const filters: ListAssessmentsFilters = {
        scope,
        // Pass organization context to avoid re-fetching profile
        organization_id: organizationId,
        role: originalRole || role,
        is_super_admin: isSuperAdmin,
      };

      if (statusFilter !== "all") {
        filters.status = statusFilter as "draft" | "confirmed" | "archived";
      }
      if (learnerFilter !== "all") {
        filters.learner_id = learnerFilter;
      }

      const data = await listAssessments(filters);
      
      // Apply search filter
      let filtered = data;
      if (searchQuery) {
        filtered = data.filter((assessment) =>
          assessment.rationale?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          assessment.learner?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          assessment.learner?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          assessment.label?.label_text?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setAssessments(filtered);
    } catch (error) {
      console.error("Error fetching assessments:", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgLoading) {
      fetchAssessments();
    }
  }, [statusFilter, learnerFilter, searchQuery, role, orgLoading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Assessments</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const canCreate = role === "teacher" || role === "principal" || (role === "admin" && originalRole !== "registrar");
  const canEdit = role === "teacher" || role === "principal" || (role === "admin" && originalRole !== "registrar");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Assessments</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Qualitative judgment layer: Document human judgment about learner progress
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/sis/assessments/new")} className="gap-2">
            <Plus className="size-4" />
            Create Assessment
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <div className="relative">
                <Search className="absolute left-2 top-2.5 size-4 text-muted-foreground" />
                <Input
                  placeholder="Search rationale, learner, or label..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <Select value={statusFilter} onValueChange={setStatusFilter}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="draft">Draft</SelectItem>
                <SelectItem value="confirmed">Confirmed</SelectItem>
                <SelectItem value="archived">Archived</SelectItem>
              </SelectContent>
            </Select>
            <Select value={learnerFilter} onValueChange={setLearnerFilter}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Learner" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Learners</SelectItem>
                {students.map((student) => (
                  <SelectItem key={student.id} value={student.id}>
                    {student.last_name}, {student.first_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {assessments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No assessments found</div>
            <div className="text-sm text-muted-foreground">
              {canCreate
                ? "Create your first assessment to document learner progress."
                : "No assessments have been created yet."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Learner</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Teacher</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Judgment Label</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Updated</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {assessments.map((assessment) => (
                <tr key={assessment.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">
                    {assessment.learner
                      ? `${assessment.learner.last_name || ""}, ${assessment.learner.first_name || ""}`.trim() || "—"
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {assessment.teacher
                      ? `${assessment.teacher.first_name || ""} ${assessment.teacher.last_name || ""}`.trim() || "—"
                      : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {assessment.label?.label_text || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ${
                        assessment.status === "confirmed"
                          ? "bg-green-100 text-green-800"
                          : assessment.status === "draft"
                          ? "bg-yellow-100 text-yellow-800"
                          : "bg-gray-100 text-gray-800"
                      }`}
                    >
                      {assessment.status}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {new Date(assessment.updated_at).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/sis/assessments/${assessment.id}`)}
                      className="gap-1"
                    >
                      View
                      <ExternalLink className="size-3" />
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

