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
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Search, Filter, Target, TrendingUp } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import { 
  getCurrentSnapshots, 
  listMasteryModels,
  createSnapshotRun,
  type MasteryModel 
} from "@/lib/mastery";
import { getActiveSchoolYear } from "@/lib/student-portal";
import { useToast } from "@/hooks/use-toast";

type Role = "principal" | "admin" | "teacher";

interface CurrentSnapshot {
  learner_id: string;
  outcome_id: string | null;
  competency_id: string | null;
  mastery_level_label: string;
  mastery_level_display_order: number;
  evidence_count: number;
  last_evidence_at: string | null;
  snapshot_date: string;
  learner?: {
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  };
  outcome?: {
    id: string;
    name: string;
  };
  competency?: {
    id: string;
    name: string;
  };
}

export default function MasteryDashboardPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [snapshots, setSnapshots] = useState<CurrentSnapshot[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("principal");
  const [searchQuery, setSearchQuery] = useState("");
  const [schoolYearFilter, setSchoolYearFilter] = useState<string>("all");
  const [scopeTypeFilter, setScopeTypeFilter] = useState<string>("all");
  const [scopeIdFilter, setScopeIdFilter] = useState<string>("all");
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; year_label: string }>>([]);
  const [experiences, setExperiences] = useState<Array<{ id: string; name: string }>>([]);
  const [syllabi, setSyllabi] = useState<Array<{ id: string; name: string }>>([]);
  const [masteryModels, setMasteryModels] = useState<MasteryModel[]>([]);
  
  // Snapshot generation dialog state
  const [snapshotDialogOpen, setSnapshotDialogOpen] = useState(false);
  const [generatingSnapshot, setGeneratingSnapshot] = useState(false);
  const [snapshotFormData, setSnapshotFormData] = useState({
    scope_type: "experience" as "experience" | "syllabus" | "program" | "section",
    scope_id: "",
    mastery_model_id: "",
    school_year_id: "",
    quarter: "",
    term: "",
  });

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
        }
      }

      // Fetch school years
      let schoolYearsQuery = supabase
        .from("school_years")
        .select("id, year_label");
      
      if (!isSuperAdmin && organizationId) {
        schoolYearsQuery = schoolYearsQuery.eq("organization_id", organizationId);
      }
      
      const { data: yearsData } = await schoolYearsQuery.order("year_label", { ascending: false });
      setSchoolYears(yearsData || []);

      // Fetch active school year as default
      if (organizationId) {
        const activeYear = await getActiveSchoolYear(organizationId);
        if (activeYear) {
          setSchoolYearFilter(activeYear.id);
          setSnapshotFormData((prev) => ({ ...prev, school_year_id: activeYear.id }));
        }
      }

      // Fetch experiences
      let experiencesQuery = supabase
        .from("experiences")
        .select("id, name")
        .is("archived_at", null);
      
      if (!isSuperAdmin && organizationId) {
        experiencesQuery = experiencesQuery.eq("organization_id", organizationId);
      }
      
      const { data: experiencesData } = await experiencesQuery.order("name", { ascending: true });
      setExperiences(experiencesData || []);

      // Fetch syllabi
      let syllabiQuery = supabase
        .from("syllabi")
        .select("id, name")
        .is("archived_at", null);
      
      if (!isSuperAdmin && organizationId) {
        syllabiQuery = syllabiQuery.eq("organization_id", organizationId);
      }
      
      const { data: syllabiData } = await syllabiQuery.order("name", { ascending: true });
      setSyllabi(syllabiData || []);

      // Fetch mastery models
      if (organizationId) {
        const models = await listMasteryModels(organizationId, { isActive: true });
        setMasteryModels(models);
        if (models.length > 0) {
          setSnapshotFormData((prev) => ({ ...prev, mastery_model_id: models[0].id }));
        }
      }

      // Fetch snapshots
      await fetchSnapshots();
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, role]);

  const fetchSnapshots = async () => {
    try {
      setLoading(true);
      const filters: any = {};
      
      if (schoolYearFilter !== "all") {
        filters.schoolYearId = schoolYearFilter;
      }

      const data = await getCurrentSnapshots(organizationId, filters);
      
      // Apply scope filters
      let filtered = data;
      if (scopeTypeFilter !== "all" && scopeIdFilter !== "all") {
        filtered = filtered.filter((snapshot: any) => 
          snapshot.scope_type === scopeTypeFilter && snapshot.scope_id === scopeIdFilter
        );
      }

      // Apply search filter
      if (searchQuery) {
        filtered = filtered.filter((snapshot: CurrentSnapshot) =>
          snapshot.learner?.first_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          snapshot.learner?.last_name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          snapshot.outcome?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          snapshot.competency?.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
          snapshot.mastery_level_label?.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }

      setSnapshots(filtered);
    } catch (error) {
      console.error("Error fetching snapshots", error);
      toast({
        title: "Error",
        description: "Failed to load mastery snapshots",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!orgLoading) {
      fetchSnapshots();
    }
  }, [schoolYearFilter, scopeTypeFilter, scopeIdFilter, searchQuery, role, orgLoading]);

  const handleGenerateSnapshot = async () => {
    if (!snapshotFormData.scope_id || !snapshotFormData.mastery_model_id) {
      toast({
        title: "Error",
        description: "Please select scope and mastery model",
        variant: "destructive",
      });
      return;
    }

    try {
      setGeneratingSnapshot(true);
      
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/mastery/snapshot/run", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          ...snapshotFormData,
          organization_id: organizationId,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to generate snapshot");
      }

      const result = await response.json();
      
      toast({
        title: "Success",
        description: `Successfully generated ${result.snapshot_count} snapshots`,
      });

      setSnapshotDialogOpen(false);
      setSnapshotFormData({
        scope_type: "experience",
        scope_id: "",
        mastery_model_id: masteryModels[0]?.id || "",
        school_year_id: snapshotFormData.school_year_id,
        quarter: "",
        term: "",
      });
      
      // Refresh snapshots
      await fetchSnapshots();
    } catch (error: any) {
      console.error("Error generating snapshot", error);
      toast({
        title: "Error",
        description: error.message || "Failed to generate snapshot",
        variant: "destructive",
      });
    } finally {
      setGeneratingSnapshot(false);
    }
  };

  const getMasteryLevelColor = (label: string) => {
    const lower = label.toLowerCase();
    if (lower.includes("mastered") || lower.includes("proficient")) {
      return "bg-green-100 text-green-800";
    }
    if (lower.includes("developing")) {
      return "bg-blue-100 text-blue-800";
    }
    if (lower.includes("emerging")) {
      return "bg-yellow-100 text-yellow-800";
    }
    if (lower.includes("not_started")) {
      return "bg-gray-100 text-gray-800";
    }
    return "bg-gray-100 text-gray-800";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mastery Dashboard</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const canGenerateSnapshot = role === "teacher" || role === "principal" || (role === "admin");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Mastery Dashboard</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View learner mastery snapshots by outcome/competency
          </p>
        </div>
        {canGenerateSnapshot && (
          <Dialog open={snapshotDialogOpen} onOpenChange={setSnapshotDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="size-4" />
                Generate Snapshot
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
              <DialogHeader>
                <DialogTitle>Generate Mastery Snapshot</DialogTitle>
                <DialogDescription>
                  Create a new snapshot run for a specific scope (experience, syllabus, program, or section)
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="mastery_model">Mastery Model *</Label>
                  <Select
                    value={snapshotFormData.mastery_model_id}
                    onValueChange={(value) =>
                      setSnapshotFormData((prev) => ({ ...prev, mastery_model_id: value }))
                    }
                  >
                    <SelectTrigger id="mastery_model">
                      <SelectValue placeholder="Select mastery model" />
                    </SelectTrigger>
                    <SelectContent>
                      {masteryModels.map((model) => (
                        <SelectItem key={model.id} value={model.id}>
                          {model.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope_type">Scope Type *</Label>
                  <Select
                    value={snapshotFormData.scope_type}
                    onValueChange={(value: any) =>
                      setSnapshotFormData((prev) => ({ ...prev, scope_type: value, scope_id: "" }))
                    }
                  >
                    <SelectTrigger id="scope_type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="experience">Experience</SelectItem>
                      <SelectItem value="syllabus">Syllabus</SelectItem>
                      <SelectItem value="program">Program</SelectItem>
                      <SelectItem value="section">Section</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="scope_id">Scope *</Label>
                  <Select
                    value={snapshotFormData.scope_id}
                    onValueChange={(value) =>
                      setSnapshotFormData((prev) => ({ ...prev, scope_id: value }))
                    }
                  >
                    <SelectTrigger id="scope_id">
                      <SelectValue placeholder="Select scope" />
                    </SelectTrigger>
                    <SelectContent>
                      {snapshotFormData.scope_type === "experience" &&
                        experiences.map((exp) => (
                          <SelectItem key={exp.id} value={exp.id}>
                            {exp.name}
                          </SelectItem>
                        ))}
                      {snapshotFormData.scope_type === "syllabus" &&
                        syllabi.map((syllabus) => (
                          <SelectItem key={syllabus.id} value={syllabus.id}>
                            {syllabus.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="school_year">School Year</Label>
                  <Select
                    value={snapshotFormData.school_year_id}
                    onValueChange={(value) =>
                      setSnapshotFormData((prev) => ({ ...prev, school_year_id: value }))
                    }
                  >
                    <SelectTrigger id="school_year">
                      <SelectValue placeholder="Auto (active year)" />
                    </SelectTrigger>
                    <SelectContent>
                      {schoolYears.map((year) => (
                        <SelectItem key={year.id} value={year.id}>
                          {year.year_label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="quarter">Quarter (Optional)</Label>
                    <Input
                      id="quarter"
                      value={snapshotFormData.quarter}
                      onChange={(e) =>
                        setSnapshotFormData((prev) => ({ ...prev, quarter: e.target.value }))
                      }
                      placeholder="Q1, Q2, etc."
                    />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="term">Term (Optional)</Label>
                    <Input
                      id="term"
                      value={snapshotFormData.term}
                      onChange={(e) =>
                        setSnapshotFormData((prev) => ({ ...prev, term: e.target.value }))
                      }
                      placeholder="Fall, Spring, etc."
                    />
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => setSnapshotDialogOpen(false)}
                  disabled={generatingSnapshot}
                >
                  Cancel
                </Button>
                <Button onClick={handleGenerateSnapshot} disabled={generatingSnapshot}>
                  {generatingSnapshot ? "Generating..." : "Generate Snapshot"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label htmlFor="search">Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  id="search"
                  placeholder="Search learners, outcomes..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="school_year">School Year</Label>
              <Select value={schoolYearFilter} onValueChange={setSchoolYearFilter}>
                <SelectTrigger id="school_year">
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All years</SelectItem>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="scope_type">Scope Type</Label>
              <Select value={scopeTypeFilter} onValueChange={setScopeTypeFilter}>
                <SelectTrigger id="scope_type">
                  <SelectValue placeholder="All scopes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All scopes</SelectItem>
                  <SelectItem value="experience">Experience</SelectItem>
                  <SelectItem value="syllabus">Syllabus</SelectItem>
                  <SelectItem value="program">Program</SelectItem>
                  <SelectItem value="section">Section</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {scopeTypeFilter !== "all" && (
              <div className="space-y-2">
                <Label htmlFor="scope_id">Scope</Label>
                <Select value={scopeIdFilter} onValueChange={setScopeIdFilter}>
                  <SelectTrigger id="scope_id">
                    <SelectValue placeholder="Select scope" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All</SelectItem>
                    {scopeTypeFilter === "experience" &&
                      experiences.map((exp) => (
                        <SelectItem key={exp.id} value={exp.id}>
                          {exp.name}
                        </SelectItem>
                      ))}
                    {scopeTypeFilter === "syllabus" &&
                      syllabi.map((syllabus) => (
                        <SelectItem key={syllabus.id} value={syllabus.id}>
                          {syllabus.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Snapshots Table */}
      <Card>
        <CardContent className="pt-6">
          {snapshots.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No mastery snapshots found. Generate a snapshot to get started.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-2">Learner</th>
                    <th className="text-left p-2">Outcome/Competency</th>
                    <th className="text-left p-2">Mastery Level</th>
                    <th className="text-left p-2">Evidence Count</th>
                    <th className="text-left p-2">Last Evidence</th>
                    <th className="text-left p-2">Snapshot Date</th>
                  </tr>
                </thead>
                <tbody>
                  {snapshots.map((snapshot) => (
                    <tr key={`${snapshot.learner_id}-${snapshot.outcome_id || snapshot.competency_id}`} className="border-b hover:bg-muted/50">
                      <td className="p-2">
                        {snapshot.learner
                          ? `${snapshot.learner.first_name || ""} ${snapshot.learner.last_name || ""}`.trim() || "Unknown"
                          : "Unknown"}
                      </td>
                      <td className="p-2">
                        {snapshot.outcome?.name || snapshot.competency?.name || "Unknown"}
                      </td>
                      <td className="p-2">
                        <Badge className={getMasteryLevelColor(snapshot.mastery_level_label)}>
                          {snapshot.mastery_level_label}
                        </Badge>
                      </td>
                      <td className="p-2">{snapshot.evidence_count}</td>
                      <td className="p-2">
                        {snapshot.last_evidence_at
                          ? new Date(snapshot.last_evidence_at).toLocaleDateString()
                          : "N/A"}
                      </td>
                      <td className="p-2">
                        {new Date(snapshot.snapshot_date).toLocaleDateString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
