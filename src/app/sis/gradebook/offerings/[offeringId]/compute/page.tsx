"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
import { Calculator, Plus, ExternalLink, Clock, ArrowLeft } from "lucide-react";
import { getOfferingContext } from "@/lib/gradebook-offerings";
import type { OfferingContext } from "@/lib/gradebook-offerings";
import { OfferingContextHeader } from "@/components/gradebook/OfferingContextHeader";
import type { GradebookComputeRun } from "@/lib/gradebook";

export default function OfferingComputePage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const offeringId = params.offeringId as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();

  const [offeringContext, setOfferingContext] = useState<OfferingContext | null>(null);
  const [runs, setRuns] = useState<GradebookComputeRun[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  // Form state
  const [schemes, setSchemes] = useState<Array<{ id: string; name: string; scheme_type: string; version: number }>>([]);
  const [weightProfiles, setWeightProfiles] = useState<Array<{ id: string; profile_label: string }>>([]);
  const [transmutationTables, setTransmutationTables] = useState<Array<{ id: string; version: number; published_at: string | null }>>([]);

  const [formData, setFormData] = useState({
    scheme_id: "",
    weight_profile_id: "",
    transmutation_table_id: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !organizationId || !offeringId) return;

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // Fetch offering context
        const context = await getOfferingContext(offeringId);
        if (!context) throw new Error("Offering not found");
        setOfferingContext(context);

        // Fetch schemes
        const { data: schemesData } = await supabase
          .from("gradebook_schemes")
          .select("id, name, scheme_type, version")
          .eq("organization_id", organizationId)
          .not("published_at", "is", null)
          .is("archived_at", null)
          .order("name");

        setSchemes(schemesData || []);

        // Fetch compute runs for this offering
        const response = await fetch("/api/gradebook/compute-runs", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (response.ok) {
          const { runs: runsData } = await response.json();
          // Filter runs for this offering
          const offeringRuns = (runsData || []).filter(
            (run: GradebookComputeRun) => run.section_subject_offering_id === offeringId
          );
          setRuns(offeringRuns);
        }
      } catch (error: any) {
        console.error("Error fetching data", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading, organizationId, offeringId, toast]);

  useEffect(() => {
    const fetchWeightProfiles = async () => {
      if (!formData.scheme_id || !organizationId) {
        setWeightProfiles([]);
        return;
      }

      try {
        const { data: profilesData } = await supabase
          .from("gradebook_weight_profiles")
          .select("id, profile_label")
          .eq("organization_id", organizationId)
          .eq("scheme_id", formData.scheme_id)
          .is("archived_at", null)
          .order("profile_label");

        setWeightProfiles(profilesData || []);
      } catch (error: any) {
        console.error("Error fetching weight profiles", error);
      }
    };

    fetchWeightProfiles();
  }, [formData.scheme_id, organizationId]);

  useEffect(() => {
    const fetchTransmutationTables = async () => {
      if (!formData.scheme_id || !organizationId) {
        setTransmutationTables([]);
        return;
      }

      const selectedScheme = schemes.find((s) => s.id === formData.scheme_id);
      if (selectedScheme?.scheme_type !== "deped_k12" && selectedScheme?.scheme_type !== "ched_hei") {
        setTransmutationTables([]);
        return;
      }

      try {
        const { data: tablesData } = await supabase
          .from("gradebook_transmutation_tables")
          .select("id, version, published_at")
          .eq("organization_id", organizationId)
          .eq("scheme_id", formData.scheme_id)
          .is("archived_at", null)
          .order("version", { ascending: false });

        setTransmutationTables(tablesData || []);
      } catch (error: any) {
        console.error("Error fetching transmutation tables", error);
      }
    };

    fetchTransmutationTables();
  }, [formData.scheme_id, organizationId, schemes]);

  const handleCreateRun = async () => {
    if (!formData.scheme_id || !offeringContext) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    // Validate transmutation table for DepEd schemes
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
      if (!session) throw new Error("Not authenticated");

      const response = await fetch("/api/gradebook/compute-runs", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section_subject_offering_id: offeringId,
          section_id: offeringContext.section_id, // Also include for backwards compatibility
          school_year_id: offeringContext.school_year_id,
          term_period: offeringContext.term_period,
          scheme_id: formData.scheme_id,
          weight_profile_id: formData.weight_profile_id === "__auto__" || !formData.weight_profile_id ? null : formData.weight_profile_id,
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
        scheme_id: "",
        weight_profile_id: "",
        transmutation_table_id: "",
      });

      // Refresh runs list
      const refreshResponse = await fetch("/api/gradebook/compute-runs", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (refreshResponse.ok) {
        const { runs: runsData } = await refreshResponse.json();
        const offeringRuns = (runsData || []).filter(
          (run: GradebookComputeRun) => run.section_subject_offering_id === offeringId
        );
        setRuns(offeringRuns);
      }

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
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  if (!offeringContext) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Offering not found</h3>
            <p className="text-muted-foreground">The subject offering could not be loaded.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Compute Grades</h1>
            <p className="text-muted-foreground mt-1">
              Compute grades for {offeringContext.subject_name}
            </p>
          </div>
        </div>
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
                Compute grades for this subject offering using a published scheme
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="bg-muted p-4 rounded-md">
                <div className="text-sm space-y-1">
                  <p><strong>Section:</strong> {offeringContext.section_name}</p>
                  <p><strong>Subject:</strong> {offeringContext.subject_name}</p>
                  <p><strong>School Year:</strong> {offeringContext.school_year_label}</p>
                  <p><strong>Term Period:</strong> {offeringContext.term_period}</p>
                </div>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="scheme">Scheme *</Label>
                <Select
                  value={formData.scheme_id}
                  onValueChange={(value) => setFormData({ ...formData, scheme_id: value, weight_profile_id: "", transmutation_table_id: "" })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select scheme" />
                  </SelectTrigger>
                  <SelectContent>
                    {schemes.map((scheme) => (
                      <SelectItem key={scheme.id} value={scheme.id}>
                        {scheme.name} ({scheme.scheme_type})
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
                      <SelectValue placeholder="Auto-select from classification" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__auto__">Auto-select from classification</SelectItem>
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
                const needsTransmutation = selectedScheme?.scheme_type === "deped_k12" || selectedScheme?.scheme_type === "ched_hei";
                
                return needsTransmutation ? (
                  <div className="grid gap-2">
                    <Label htmlFor="transmutation_table">Transmutation Table ({selectedScheme?.scheme_type === "deped_k12" ? "DepEd" : "CHED"}) *</Label>
                    <Select
                      value={formData.transmutation_table_id}
                      onValueChange={(value) => setFormData({ ...formData, transmutation_table_id: value })}
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
                  </div>
                ) : null;
              })()}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button
                onClick={handleCreateRun}
                disabled={
                  creating ||
                  !formData.scheme_id ||
                  (() => {
                    const selectedScheme = schemes.find((s) => s.id === formData.scheme_id);
                    return (selectedScheme?.scheme_type === "deped_k12" || selectedScheme?.scheme_type === "ched_hei") && !formData.transmutation_table_id;
                  })()
                }
              >
                {creating ? "Computing..." : "Compute Grades"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Offering Context Header */}
      <OfferingContextHeader offeringId={offeringId} />

      {/* Compute Runs List */}
      <Card>
        <CardHeader>
          <CardTitle>Compute Runs</CardTitle>
        </CardHeader>
        <CardContent>
          {runs.length === 0 ? (
            <div className="text-center py-8">
              <Calculator className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <h3 className="text-lg font-semibold mb-2">No compute runs yet</h3>
              <p className="text-muted-foreground mb-4">
                Create your first compute run to compute grades for this subject offering
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              {runs.map((run) => (
                <Card key={run.id} className="hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">
                            {(run.scheme as any)?.name || "Unknown Scheme"}
                          </h3>
                          {getStatusBadge(run.status)}
                        </div>
                        <div className="text-sm text-muted-foreground space-y-1">
                          <p>
                            <strong>Term:</strong> {run.term_period}
                          </p>
                          <p>
                            <strong>Created:</strong>{" "}
                            {new Date(run.created_at).toLocaleString()}
                          </p>
                          {run.status === "completed" && (
                            <p>
                              <strong>Computed:</strong>{" "}
                              {new Date(run.updated_at).toLocaleString()}
                            </p>
                          )}
                          {run.status === "failed" && run.error_message && (
                            <p className="text-red-600">
                              <strong>Error:</strong> {run.error_message}
                            </p>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => router.push(`/sis/gradebook/compute-runs/${run.id}`)}
                        >
                          <ExternalLink className="mr-2 h-4 w-4" />
                          View Details
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
