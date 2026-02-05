"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { Calculator, Plus, ExternalLink, Clock, RefreshCw, Trash2, Edit } from "lucide-react";
import type { GradebookComputeRun } from "@/lib/gradebook";

export default function ComputeRunsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [runs, setRuns] = useState<GradebookComputeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [editDialogOpen, setEditDialogOpen] = useState(false);
  const [editingRun, setEditingRun] = useState<GradebookComputeRun | null>(null);
  const [updating, setUpdating] = useState(false);
  
  // Pre-populate section_id from URL params
  const sectionIdFromUrl = searchParams.get("section");

  // Form state
  const [sections, setSections] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [schemes, setSchemes] = useState<Array<{ id: string; name: string; scheme_type: string; version: number }>>([]);
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; year_label: string }>>([]);
  const [weightProfiles, setWeightProfiles] = useState<Array<{ id: string; profile_label: string }>>([]);
  const [transmutationTables, setTransmutationTables] = useState<Array<{ id: string; version: number; published_at: string | null }>>([]);

  const [formData, setFormData] = useState({
    section_id: "",
    school_year_id: "",
    term_period: "",
    scheme_id: "",
    weight_profile_id: "",
    transmutation_table_id: "",
  });

  const fetchRuns = useCallback(async () => {
    if (orgLoading || !organizationId) return;
    try {
      setLoading(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      console.log("Fetching compute runs for organization:", organizationId);

      const response = await fetch("/api/gradebook/compute-runs", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to fetch compute runs");
      }

      const { runs: data } = await response.json();
      console.log("Fetched compute runs:", data?.length || 0, "runs");
      setRuns(data || []);
    } catch (error: any) {
      console.error("Error fetching compute runs", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load compute runs",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [orgLoading, organizationId, toast]);

  useEffect(() => {
    fetchRuns();
  }, [fetchRuns]);

  useEffect(() => {
    const fetchFormData = async () => {
      if (orgLoading || (!createDialogOpen && !editDialogOpen)) return;

      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) return;

        // Fetch sections
        const { data: sectionsData } = await supabase
          .from("sections")
          .select("id, name, code")
          .eq("organization_id", organizationId!)
          .is("archived_at", null)
          .order("name");

        setSections(sectionsData || []);

        // Pre-populate section_id from URL if provided
        if (sectionIdFromUrl && sectionsData?.some(s => s.id === sectionIdFromUrl)) {
          setFormData(prev => ({ ...prev, section_id: sectionIdFromUrl }));
        }

        // Fetch published schemes
        const { data: schemesData } = await supabase
          .from("gradebook_schemes")
          .select("id, name, scheme_type, version")
          .eq("organization_id", organizationId!)
          .not("published_at", "is", null)
          .is("archived_at", null)
          .order("name");

        setSchemes(schemesData || []);

        // Fetch school years
        const { data: yearsData } = await supabase
          .from("school_years")
          .select("id, year_label")
          .order("year_label", { ascending: false });

        setSchoolYears(yearsData || []);

        // Fetch weight profiles (will be filtered by scheme)
        if (formData.scheme_id) {
          const { data: profilesData } = await supabase
            .from("gradebook_weight_profiles")
            .select("id, profile_label")
            .eq("scheme_id", formData.scheme_id)
            .is("archived_at", null);

          setWeightProfiles(profilesData || []);

          // Fetch transmutation tables if DepEd or CHED (show both published and unpublished)
          const selectedScheme = schemesData?.find((s) => s.id === formData.scheme_id);
          if (selectedScheme?.scheme_type === "deped_k12" || selectedScheme?.scheme_type === "ched_hei") {
            const { data: tablesData } = await supabase
              .from("gradebook_transmutation_tables")
              .select("id, version, published_at")
              .eq("scheme_id", formData.scheme_id)
              .is("archived_at", null)
              .order("version", { ascending: false });

            setTransmutationTables(tablesData || []);
          } else {
            setTransmutationTables([]);
          }
        }
      } catch (error) {
        console.error("Error fetching form data", error);
      }
    };

    fetchFormData();
  }, [orgLoading, createDialogOpen, editDialogOpen, formData.scheme_id, organizationId, sectionIdFromUrl]);

  const handleCreateRun = async () => {
    if (!formData.section_id || !formData.school_year_id || !formData.term_period || !formData.scheme_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate transmutation table for DepEd and CHED schemes
    const selectedScheme = schemes.find((s) => s.id === formData.scheme_id);
    if ((selectedScheme?.scheme_type === "deped_k12" || selectedScheme?.scheme_type === "ched_hei") && !formData.transmutation_table_id) {
      toast({
        title: "Error",
        description: `Transmutation table is required for ${selectedScheme?.scheme_type === "deped_k12" ? "DepEd K-12" : "CHED"} schemes`,
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch("/api/gradebook/compute-runs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section_id: formData.section_id,
          school_year_id: formData.school_year_id,
          term_period: formData.term_period,
          scheme_id: formData.scheme_id,
          weight_profile_id: formData.weight_profile_id || null,
          transmutation_table_id: formData.transmutation_table_id || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to create compute run");
      }

      const { run, computedGrades } = await response.json();

      toast({
        title: "Success",
        description: `Computed grades for ${computedGrades.length} students`,
      });

      setCreateDialogOpen(false);
      setFormData({
        section_id: "",
        school_year_id: "",
        term_period: "",
        scheme_id: "",
        weight_profile_id: "",
        transmutation_table_id: "",
      });

      // Refresh runs list before navigating
      await fetchRuns();

      // Navigate to run details
      router.push(`/sis/gradebook/compute-runs/${run.id}`);
    } catch (error: any) {
      console.error("Error creating compute run", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create compute run",
        variant: "destructive",
      });
    } finally {
      setCreating(false);
    }
  };

  const handleEditRun = (run: GradebookComputeRun) => {
    setEditingRun(run);
    setFormData({
      section_id: run.section_id || "",
      school_year_id: run.school_year_id || "",
      term_period: run.term_period || "",
      scheme_id: run.scheme_id || "",
      weight_profile_id: run.weight_profile_id || "",
      transmutation_table_id: run.transmutation_table_id || "",
    });
    setEditDialogOpen(true);
  };

  const handleUpdateRun = async () => {
    if (!editingRun || !formData.section_id || !formData.school_year_id || !formData.term_period || !formData.scheme_id) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate transmutation table for DepEd and CHED schemes
    const selectedScheme = schemes.find((s) => s.id === formData.scheme_id);
    if ((selectedScheme?.scheme_type === "deped_k12" || selectedScheme?.scheme_type === "ched_hei") && !formData.transmutation_table_id) {
      toast({
        title: "Error",
        description: `Transmutation table is required for ${selectedScheme?.scheme_type === "deped_k12" ? "DepEd K-12" : "CHED"} schemes`,
        variant: "destructive",
      });
      return;
    }

    try {
      setUpdating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/gradebook/compute-runs/${editingRun.id}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section_id: formData.section_id,
          school_year_id: formData.school_year_id,
          term_period: formData.term_period,
          scheme_id: formData.scheme_id,
          weight_profile_id: formData.weight_profile_id || null,
          transmutation_table_id: formData.transmutation_table_id || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to update compute run");
      }

      const { run, computedGrades } = await response.json();

      toast({
        title: "Success",
        description: `Updated and recomputed grades for ${computedGrades.length} students`,
      });

      setEditDialogOpen(false);
      setEditingRun(null);
      setFormData({
        section_id: "",
        school_year_id: "",
        term_period: "",
        scheme_id: "",
        weight_profile_id: "",
        transmutation_table_id: "",
      });

      // Refresh runs list before navigating
      await fetchRuns();

      // Navigate to run details
      router.push(`/sis/gradebook/compute-runs/${run.id}`);
    } catch (error: any) {
      console.error("Error updating compute run", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update compute run",
        variant: "destructive",
      });
    } finally {
      setUpdating(false);
    }
  };

  const handleDeleteRun = async (runId: string) => {
    if (!confirm("Are you sure you want to delete this compute run? This action cannot be undone.")) {
      return;
    }

    try {
      setDeletingId(runId);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      const response = await fetch(`/api/gradebook/compute-runs/${runId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to delete compute run");
      }

      toast({
        title: "Success",
        description: "Compute run deleted successfully",
      });

      // Refresh runs list
      await fetchRuns();
    } catch (error: any) {
      console.error("Error deleting compute run", error);
      toast({
        title: "Error",
        description: error.message || "Failed to delete compute run",
        variant: "destructive",
      });
    } finally {
      setDeletingId(null);
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-green-500">Completed</Badge>;
      case "failed":
        return <Badge className="bg-red-500">Failed</Badge>;
      case "created":
        return <Badge className="bg-yellow-500">Created</Badge>;
      default:
        return <Badge>{status}</Badge>;
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading compute runs...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gradebook Compute Runs</h1>
          <p className="text-muted-foreground mt-1">
            View and create grade computation runs
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => fetchRuns()}
            disabled={loading}
          >
            <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Compute Run
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Compute Run</DialogTitle>
              <DialogDescription>
                Compute grades for a section and term period using a published scheme
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="section">Section *</Label>
                <Select
                  value={formData.section_id}
                  onValueChange={(value) => setFormData({ ...formData, section_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name} ({section.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="school_year">School Year *</Label>
                <Select
                  value={formData.school_year_id}
                  onValueChange={(value) => setFormData({ ...formData, school_year_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school year" />
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

              <div className="grid gap-2">
                <Label htmlFor="term_period">Term Period *</Label>
                <Select
                  value={formData.term_period}
                  onValueChange={(value) => setFormData({ ...formData, term_period: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select term period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                    <SelectItem value="Semester 1">Semester 1</SelectItem>
                    <SelectItem value="Semester 2">Semester 2</SelectItem>
                    <SelectItem value="Full Year">Full Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="scheme">Scheme *</Label>
                <Select
                  value={formData.scheme_id}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      scheme_id: value,
                      weight_profile_id: "",
                      transmutation_table_id: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemes.map((scheme) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {scheme.name} ({scheme.scheme_type}) v{scheme.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.scheme_id && weightProfiles.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="weight_profile">Weight Profile (Optional)</Label>
                  <Select
                    value={formData.weight_profile_id}
                    onValueChange={(value) => setFormData({ ...formData, weight_profile_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select weight profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {weightProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profile_label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.scheme_id && (() => {
                const selectedScheme = schemes.find((s) => s.id === formData.scheme_id);
                const isDepEd = selectedScheme?.scheme_type === "deped_k12";
                
                if (isDepEd) {
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor="transmutation_table">Transmutation Table (DepEd) *</Label>
                      {transmutationTables.length === 0 ? (
                        <div className="space-y-2">
                          <Select disabled>
                            <SelectTrigger>
                              <SelectValue placeholder="No transmutation tables available" />
                            </SelectTrigger>
                          </Select>
                          <p className="text-sm text-red-500">
                            Please publish a transmutation table for this scheme first
                          </p>
                        </div>
                      ) : (
                        <Select
                          value={formData.transmutation_table_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, transmutation_table_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select transmutation table" />
                          </SelectTrigger>
                          <SelectContent>
                            {transmutationTables.map((table) => (
                              <SelectItem key={table.id} value={table.id}>
                                Version {table.version} {table.published_at ? "(Published)" : "(Draft)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateRun} disabled={creating}>
                {creating ? "Computing..." : "Create & Compute"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        <Dialog open={editDialogOpen} onOpenChange={setEditDialogOpen}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Edit Compute Run</DialogTitle>
              <DialogDescription>
                Update compute run parameters and recompute grades
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="section">Section *</Label>
                <Select
                  value={formData.section_id}
                  onValueChange={(value) => setFormData({ ...formData, section_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name} ({section.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="school_year">School Year *</Label>
                <Select
                  value={formData.school_year_id}
                  onValueChange={(value) => setFormData({ ...formData, school_year_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school year" />
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

              <div className="grid gap-2">
                <Label htmlFor="term_period">Term Period *</Label>
                <Select
                  value={formData.term_period}
                  onValueChange={(value) => setFormData({ ...formData, term_period: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select term period" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Q1">Q1</SelectItem>
                    <SelectItem value="Q2">Q2</SelectItem>
                    <SelectItem value="Q3">Q3</SelectItem>
                    <SelectItem value="Q4">Q4</SelectItem>
                    <SelectItem value="Semester 1">Semester 1</SelectItem>
                    <SelectItem value="Semester 2">Semester 2</SelectItem>
                    <SelectItem value="Full Year">Full Year</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="scheme">Scheme *</Label>
                <Select
                  value={formData.scheme_id}
                  onValueChange={(value) =>
                    setFormData({
                      ...formData,
                      scheme_id: value,
                      weight_profile_id: "",
                      transmutation_table_id: "",
                    })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemes.map((scheme) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {scheme.name} ({scheme.scheme_type}) v{scheme.version}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {formData.scheme_id && weightProfiles.length > 0 && (
                <div className="grid gap-2">
                  <Label htmlFor="weight_profile">Weight Profile (Optional)</Label>
                  <Select
                    value={formData.weight_profile_id}
                    onValueChange={(value) => setFormData({ ...formData, weight_profile_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select weight profile" />
                    </SelectTrigger>
                    <SelectContent>
                      {weightProfiles.map((profile) => (
                        <SelectItem key={profile.id} value={profile.id}>
                          {profile.profile_label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {formData.scheme_id && (() => {
                const selectedScheme = schemes.find((s) => s.id === formData.scheme_id);
                const isDepEd = selectedScheme?.scheme_type === "deped_k12";
                
                if (isDepEd) {
                  return (
                    <div className="grid gap-2">
                      <Label htmlFor="transmutation_table">Transmutation Table (DepEd) *</Label>
                      {transmutationTables.length === 0 ? (
                        <div className="space-y-2">
                          <Select disabled>
                            <SelectTrigger>
                              <SelectValue placeholder="No transmutation tables available" />
                            </SelectTrigger>
                          </Select>
                          <p className="text-sm text-red-500">
                            Please publish a transmutation table for this scheme first
                          </p>
                        </div>
                      ) : (
                        <Select
                          value={formData.transmutation_table_id}
                          onValueChange={(value) =>
                            setFormData({ ...formData, transmutation_table_id: value })
                          }
                        >
                          <SelectTrigger>
                            <SelectValue placeholder="Select transmutation table" />
                          </SelectTrigger>
                          <SelectContent>
                            {transmutationTables.map((table) => (
                              <SelectItem key={table.id} value={table.id}>
                                Version {table.version} {table.published_at ? "(Published)" : "(Draft)"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      )}
                    </div>
                  );
                }
                return null;
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => {
                setEditDialogOpen(false);
                setEditingRun(null);
              }}>
                Cancel
              </Button>
              <Button onClick={handleUpdateRun} disabled={updating}>
                {updating ? "Updating..." : "Update & Recompute"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
        </div>
      </div>

      {runs.length === 0 ? (
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <Calculator className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">No compute runs yet</p>
            <p className="text-sm text-muted-foreground mt-2">
              Create your first compute run to generate computed grades
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {runs.map((run) => (
            <Card key={run.id}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div>
                    <CardTitle className="text-lg">
                      {run.section?.name || "Section"} - {run.term_period}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      Scheme: {run.scheme?.name || "N/A"} v{run.scheme_version}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    {getStatusBadge(run.status)}
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/sis/gradebook/compute-runs/${run.id}`)}
                    >
                      <ExternalLink className="mr-2 h-4 w-4" />
                      View
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEditRun(run)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => handleDeleteRun(run.id)}
                      disabled={deletingId === run.id}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="flex items-center gap-4 text-sm text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-4 w-4" />
                    {new Date(run.created_at).toLocaleString()}
                  </div>
                  {run.error_message && (
                    <p className="text-red-500">Error: {run.error_message}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
