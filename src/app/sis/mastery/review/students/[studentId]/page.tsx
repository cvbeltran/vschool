"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrganization } from "@/lib/hooks/use-organization";
import { getCompetencies } from "@/lib/obs";
import { listMasteryModels, listMasteryLevels, type MasteryModel, type MasteryLevel } from "@/lib/mastery";
import { ArrowLeft, Save, Send, CheckCircle2, Eye, Download, ExternalLink, File } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

interface CompetencyProposal {
  competency_id: string;
  competency_name: string;
  mastery_level_id: string;
  rationale: string;
  selected_evidence_ids: string[];
}

export default function StudentMasteryReviewPage() {
  const router = useRouter();
  const params = useParams();
  const studentId = params.studentId as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();

  const [student, setStudent] = useState<any>(null);
  const [competencies, setCompetencies] = useState<any[]>([]);
  const [masteryModels, setMasteryModels] = useState<MasteryModel[]>([]);
  const [selectedModelId, setSelectedModelId] = useState<string>("");
  const [masteryLevels, setMasteryLevels] = useState<MasteryLevel[]>([]);
  const [proposals, setProposals] = useState<Record<string, CompetencyProposal>>({});
  const [evidencePacks, setEvidencePacks] = useState<Record<string, any[]>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEvidence, setLoadingEvidence] = useState<Record<string, boolean>>({});
  const [selectedEvidence, setSelectedEvidence] = useState<{ item: any; competencyId: string } | null>(null);
  
  // Track what we've already fetched to prevent re-fetching
  const fetchedRef = useRef<{ studentId?: string; organizationId?: string }>({});

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    // Reset fetched ref if studentId changed
    if (fetchedRef.current.studentId !== studentId) {
      fetchedRef.current = {};
    }
    
    const fetchData = async () => {
      // Wait for organization to load and required data to be available
      if (orgLoading) {
        // Still loading organization, keep loading state
        // Add a timeout to prevent infinite loading (30 seconds)
        timeoutId = setTimeout(() => {
          if (isMounted && orgLoading) {
            console.warn("Organization loading timeout - proceeding anyway");
            setLoading(false);
            toast({
              title: "Warning",
              description: "Organization loading is taking longer than expected. Please refresh the page.",
              variant: "destructive",
            });
          }
        }, 30000);
        return;
      }
      
      // Clear timeout if organization finished loading
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!studentId) {
        // No studentId available, stop loading and show error
        if (isMounted) {
          setLoading(false);
          toast({
            title: "Error",
            description: "Student ID is missing",
            variant: "destructive",
          });
          setTimeout(() => {
            if (isMounted) {
              router.push("/sis/mastery");
            }
          }, 1000);
        }
        return;
      }
      
      if (!organizationId) {
        // No organizationId available, stop loading and show error
        if (isMounted) {
          setLoading(false);
          toast({
            title: "Error",
            description: "Organization context is missing",
            variant: "destructive",
          });
        }
        return;
      }
      
      // Check if we've already fetched data for this exact combination
      // Only skip if we've fetched for the same studentId AND same organizationId
      const alreadyFetched = 
        fetchedRef.current.studentId === studentId && 
        fetchedRef.current.organizationId === organizationId &&
        organizationId !== null &&
        organizationId !== undefined;
      
      if (alreadyFetched) {
        // Already fetched for this combination, skip to prevent infinite loop
        if (isMounted) {
          setLoading(false);
        }
        return;
      }
      
      console.log("Fetching student mastery review data", { studentId, organizationId });
      
      // Mark as fetching (only if we have valid organizationId)
      if (organizationId) {
        fetchedRef.current = { studentId, organizationId };
      }
      
      try {
        setLoading(true);

        // Fetch student
        const { data: studentData, error: studentError } = await supabase
          .from("students")
          .select("id, first_name, last_name, student_number")
          .eq("id", studentId)
          .single();
        
        if (studentError) {
          throw new Error(`Failed to fetch student: ${studentError.message}`);
        }
        setStudent(studentData);

        // Fetch competencies
        try {
          const competenciesData = await getCompetencies(organizationId);
          setCompetencies(competenciesData || []);
        } catch (error: any) {
          console.error("Error fetching competencies:", error);
          // Continue with empty competencies - don't block the page
          setCompetencies([]);
        }

        // Fetch mastery models
        try {
          const models = await listMasteryModels(organizationId, { isActive: true });
          setMasteryModels(models);
          if (models.length > 0) {
            setSelectedModelId(models[0].id);
            try {
              const levels = await listMasteryLevels(models[0].id);
              setMasteryLevels(levels);
            } catch (error: any) {
              console.error("Error fetching mastery levels:", error);
              // Continue with empty levels
              setMasteryLevels([]);
            }
          }
        } catch (error: any) {
          console.error("Error fetching mastery models:", error);
          // Continue with empty models - don't block the page
          setMasteryModels([]);
        }

        // Load existing drafts
        const { data: { session } } = await supabase.auth.getSession();
        if (session) {
          try {
            const response = await fetch(`/api/mastery/proposals?type=drafts&teacher_id=${session.user.id}`, {
              headers: {
                Authorization: `Bearer ${session.access_token}`,
              },
            });
            if (!response.ok) {
              const errorData = await response.json().catch(() => ({}));
              throw new Error(errorData.error || "Failed to load drafts");
            }
            const { proposals: drafts } = await response.json();
          
          const existingProposals: Record<string, CompetencyProposal> = {};
          for (const draft of drafts || []) {
            if (draft.learner_id === studentId && draft.competency_id) {
              // Load evidence highlights
              const { data: evidenceLinks } = await supabase
                .from("mastery_snapshot_evidence_links")
                .select("*")
                .eq("snapshot_id", draft.id)
                .is("archived_at", null);

              const evidenceIds = (evidenceLinks || []).map((link: any) => {
                if (link.observation_id) return `observation:${link.observation_id}`;
                if (link.portfolio_artifact_id) return `portfolio_artifact:${link.portfolio_artifact_id}`;
                if (link.assessment_id) return `assessment:${link.assessment_id}`;
                return null;
              }).filter(Boolean) as string[];

              existingProposals[draft.competency_id] = {
                competency_id: draft.competency_id,
                competency_name: draft.competency?.name || "",
                mastery_level_id: draft.mastery_level_id,
                rationale: draft.rationale_text || "",
                selected_evidence_ids: evidenceIds,
              };
            }
          }
            setProposals(existingProposals);
          } catch (error: any) {
            console.error("Error loading drafts:", error);
            // Continue without drafts - don't block the page
          }
        }
      } catch (error: any) {
        if (!isMounted) return;
        
        console.error("Error fetching data", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load data",
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [studentId, organizationId, orgLoading]);

  useEffect(() => {
    if (selectedModelId) {
      listMasteryLevels(selectedModelId).then(setMasteryLevels);
    }
  }, [selectedModelId]);

  const loadEvidencePack = async (competencyId: string, forceReload = false) => {
    // Allow reloading if forceReload is true, otherwise skip if already loaded
    if (!forceReload && evidencePacks[competencyId]) {
      console.log("Evidence already loaded for competency", competencyId);
      return; // Already loaded
    }

    // Set loading state
    setLoadingEvidence((prev) => ({ ...prev, [competencyId]: true }));

    try {
      console.log("Loading evidence pack", { studentId, competencyId });
      
      // Get session for authentication
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        toast({
          title: "Error",
          description: "You must be logged in to load evidence",
          variant: "destructive",
        });
        return;
      }

      const response = await fetch(
        `/api/mastery/evidence-pack?learner_id=${studentId}&competency_id=${competencyId}`,
        {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }
      );

      console.log("Evidence pack response", { status: response.status, ok: response.ok });

      if (!response.ok) {
        if (response.status === 401) {
          toast({
            title: "Error",
            description: "You are not authorized to view this evidence",
            variant: "destructive",
          });
          return;
        }
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `Failed to load evidence: ${response.statusText}`);
      }

      const data = await response.json();
      console.log("Evidence pack data", data);
      
      // Log debug info if available (development mode)
      if (data.debug) {
        console.log("🔍 Evidence Pack Debug Info:", data.debug);
        console.log("  - Total assessments (any status):", data.debug.assessments?.total || 0);
        console.log("  - Assessment status breakdown:", data.debug.assessments?.byStatus || {});
        console.log("  - Total portfolio artifacts:", data.debug.portfolioArtifacts?.total || 0);
        console.log("  - Evidence found:", data.debug.evidenceCount || 0);
      }
      
      const evidence = data.evidence || [];
      console.log("Setting evidence pack", { competencyId, evidenceCount: evidence.length });
      
      setEvidencePacks((prev) => ({ ...prev, [competencyId]: evidence }));
      
      // Show success message if evidence was loaded
      if (evidence.length > 0) {
        toast({
          title: "Success",
          description: `Loaded ${evidence.length} evidence item${evidence.length !== 1 ? "s" : ""}`,
        });
      } else {
        toast({
          title: "No Evidence",
          description: "No evidence found for this competency",
          variant: "default",
        });
      }
    } catch (error: any) {
      console.error("Error loading evidence pack", error);
      toast({
        title: "Error",
        description: error.message || "Failed to load evidence pack",
        variant: "destructive",
      });
    } finally {
      // Clear loading state
      setLoadingEvidence((prev) => ({ ...prev, [competencyId]: false }));
    }
  };

  const updateProposal = (competencyId: string, updates: Partial<CompetencyProposal>) => {
    setProposals((prev) => ({
      ...prev,
      [competencyId]: {
        ...prev[competencyId],
        competency_id: competencyId,
        competency_name: competencies.find((c) => c.id === competencyId)?.name || "",
        mastery_level_id: "",
        rationale: "",
        selected_evidence_ids: [],
        ...prev[competencyId],
        ...updates,
      },
    }));
  };

  const toggleEvidenceHighlight = (competencyId: string, evidenceId: string) => {
    const proposal = proposals[competencyId];
    if (!proposal) return;

    const currentIds = proposal.selected_evidence_ids || [];
    const newIds = currentIds.includes(evidenceId)
      ? currentIds.filter((id) => id !== evidenceId)
      : [...currentIds, evidenceId].slice(0, 5); // Max 5 highlights

    updateProposal(competencyId, { selected_evidence_ids: newIds });
  };

  const handleSaveDraft = async () => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const proposalEntries = Object.values(proposals).filter(
        (p) => p.mastery_level_id && p.rationale
      );

      if (proposalEntries.length === 0) {
        toast({
          title: "Info",
          description: "No proposals to save. Please select a mastery level and add rationale for at least one competency.",
          variant: "default",
        });
        setSaving(false);
        return;
      }

      const savePromises = proposalEntries.map(async (proposal) => {
        const response = await fetch("/api/mastery/proposals", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${session.access_token}`,
          },
          body: JSON.stringify({
            learner_id: studentId,
            competency_id: proposal.competency_id,
            mastery_level_id: proposal.mastery_level_id,
            rationale_text: proposal.rationale,
            highlight_evidence_ids: proposal.selected_evidence_ids.map((id) => {
              const [type, eid] = id.split(":");
              return { type, id: eid };
            }),
          }),
        });

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
          throw new Error(errorData.error || `Failed to save proposal for competency ${proposal.competency_id}`);
        }

        return response.json();
      });

      await Promise.all(savePromises);

      toast({
        title: "Success",
        description: `Successfully saved ${proposalEntries.length} draft${proposalEntries.length > 1 ? "s" : ""}`,
      });
    } catch (error: any) {
      console.error("Error saving draft:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save draft",
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // First save all drafts
      await handleSaveDraft();

      // Then submit each proposal
      const proposalEntries = Object.values(proposals).filter(
        (p) => p.mastery_level_id && p.rationale
      );

      // Get draft snapshot IDs
      const response = await fetch(`/api/mastery/proposals?type=drafts&teacher_id=${session.user.id}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (!response.ok) {
        throw new Error("Failed to load drafts");
      }
      const { proposals: drafts } = await response.json();
      
      for (const proposal of proposalEntries) {
        const draft = drafts.find(
          (d: any) => d.learner_id === studentId && d.competency_id === proposal.competency_id
        );
        if (draft) {
          await fetch(`/api/mastery/proposals/${draft.id}/submit`, {
            method: "POST",
            headers: {
              Authorization: `Bearer ${session.access_token}`,
            },
          });
        }
      }

      toast({
        title: "Success",
        description: "Proposals submitted for review",
      });

      router.push("/sis/mastery");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to submit proposals",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || orgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student Mastery Review</h1>
        <div className="text-muted-foreground text-sm">
          {orgLoading ? "Loading organization..." : "Loading student data..."}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sis/mastery")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">Student Mastery Review</h1>
            <p className="text-sm text-muted-foreground mt-1">
              {student
                ? `${student.first_name || ""} ${student.last_name || ""}`.trim() || "Unknown Student"
                : "Unknown Student"}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={handleSaveDraft} disabled={saving}>
            <Save className="h-4 w-4 mr-2" />
            {saving ? "Saving..." : "Save Draft"}
          </Button>
          <Button onClick={handleSubmit} disabled={submitting}>
            <Send className="h-4 w-4 mr-2" />
            {submitting ? "Submitting..." : "Submit for Review"}
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Mastery Model</CardTitle>
        </CardHeader>
        <CardContent>
          <Select value={selectedModelId} onValueChange={setSelectedModelId}>
            <SelectTrigger>
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
        </CardContent>
      </Card>

      {competencies.map((competency) => {
        const proposal = proposals[competency.id];
        const evidence = evidencePacks[competency.id] || [];

        return (
          <Card key={competency.id}>
            <CardHeader>
              <CardTitle>{competency.name}</CardTitle>
              {competency.domain && (
                <p className="text-sm text-muted-foreground">{competency.domain.name}</p>
              )}
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Evidence Pack */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <Label>Evidence Pack</Label>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => loadEvidencePack(competency.id, evidence.length > 0)}
                    disabled={loadingEvidence[competency.id]}
                  >
                    {loadingEvidence[competency.id] 
                      ? "Loading..." 
                      : evidence.length > 0 
                        ? "Reload Evidence" 
                        : "Load Evidence"}
                  </Button>
                </div>
                {loadingEvidence[competency.id] ? (
                  <div className="text-sm text-muted-foreground p-2">Loading evidence...</div>
                ) : evidence.length > 0 ? (
                  <div className="space-y-2 max-h-60 overflow-y-auto border rounded-md p-2">
                    {evidence.map((item) => {
                      const evidenceId = `${item.type}:${item.id}`;
                      const isSelected = !!(proposal?.selected_evidence_ids?.includes(evidenceId));
                      return (
                        <div
                          key={item.id}
                          className="flex items-start gap-2 p-2 hover:bg-muted rounded cursor-pointer"
                          onClick={() => setSelectedEvidence({ item, competencyId: competency.id })}
                        >
                          <div onClick={(e) => e.stopPropagation()}>
                            <Checkbox
                              checked={isSelected}
                              onCheckedChange={() => {
                                toggleEvidenceHighlight(competency.id, evidenceId);
                              }}
                              disabled={!proposal || (proposal.selected_evidence_ids?.length || 0) >= 5 && !isSelected}
                            />
                          </div>
                          <div className="flex-1">
                            <div className="flex items-center gap-2">
                              <p className="font-medium text-sm flex-1">{item.title}</p>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="h-6 w-6 p-0"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setSelectedEvidence({ item, competencyId: competency.id });
                                }}
                              >
                                <Eye className="h-3 w-3" />
                              </Button>
                            </div>
                            <p className="text-xs text-muted-foreground">
                              {item.type} • {new Date(item.date).toLocaleDateString()}
                              {item.author_name && ` • ${item.author_name}`}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-sm text-muted-foreground">No evidence found. Click "Load Evidence" to search.</p>
                )}
              </div>

              {/* Mastery Level */}
              <div>
                <Label>Mastery Level *</Label>
                <Select
                  value={proposal?.mastery_level_id || ""}
                  onValueChange={(value) => updateProposal(competency.id, { mastery_level_id: value })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select mastery level" />
                  </SelectTrigger>
                  <SelectContent>
                    {masteryLevels.map((level) => (
                      <SelectItem key={level.id} value={level.id}>
                        {level.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* Rationale */}
              <div>
                <Label>Rationale *</Label>
                <Textarea
                  value={proposal?.rationale || ""}
                  onChange={(e) => updateProposal(competency.id, { rationale: e.target.value })}
                  placeholder="Explain your mastery level assessment..."
                  rows={3}
                />
              </div>

              {/* Selected Highlights Count */}
              {proposal?.selected_evidence_ids && proposal.selected_evidence_ids.length > 0 && (
                <div className="flex items-center gap-2">
                  <Badge variant="outline">
                    {proposal.selected_evidence_ids.length} evidence highlight{proposal.selected_evidence_ids.length !== 1 ? "s" : ""} selected
                  </Badge>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })}

      {/* Evidence Detail Dialog */}
      <Dialog open={!!selectedEvidence} onOpenChange={(open) => !open && setSelectedEvidence(null)}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedEvidence?.item?.title || "Evidence Details"}
            </DialogTitle>
            {selectedEvidence?.item?.type && (
              <div className="mt-2">
                <Badge variant="outline">
                  {selectedEvidence.item.type}
                </Badge>
              </div>
            )}
          </DialogHeader>
          
          {selectedEvidence?.item && (
            <div className="space-y-4">
              <div>
                <Label className="text-sm font-semibold">Date</Label>
                <p className="text-sm text-muted-foreground">
                  {new Date(selectedEvidence.item.date).toLocaleDateString("en-US", {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  })}
                </p>
              </div>
              
              {selectedEvidence.item.description && (
                <div>
                  <Label className="text-sm font-semibold">Description</Label>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {selectedEvidence.item.description}
                  </p>
                </div>
              )}
              
              {selectedEvidence.item.author_name && (
                <div>
                  <Label className="text-sm font-semibold">Author</Label>
                  <p className="text-sm text-muted-foreground">
                    {selectedEvidence.item.author_name}
                  </p>
                </div>
              )}
              
              <div>
                <Label className="text-sm font-semibold">Evidence ID</Label>
                <p className="text-sm text-muted-foreground font-mono">
                  {selectedEvidence.item.id}
                </p>
              </div>
              
              {selectedEvidence.item.observation_id && (
                <div>
                  <Label className="text-sm font-semibold">Observation ID</Label>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedEvidence.item.observation_id}
                  </p>
                </div>
              )}
              
              {selectedEvidence.item.assessment_id && (
                <div>
                  <Label className="text-sm font-semibold">Assessment ID</Label>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedEvidence.item.assessment_id}
                  </p>
                </div>
              )}
              
              {selectedEvidence.item.portfolio_artifact_id && (
                <div>
                  <Label className="text-sm font-semibold">Portfolio Artifact ID</Label>
                  <p className="text-sm text-muted-foreground font-mono">
                    {selectedEvidence.item.portfolio_artifact_id}
                  </p>
                </div>
              )}
              
              {/* Attachments Section */}
              {((selectedEvidence.item.attachments && selectedEvidence.item.attachments.length > 0) || 
                (selectedEvidence.item.file_url && selectedEvidence.item.type === "portfolio_artifact")) && (
                <div className="border-t pt-4">
                  <Label className="text-sm font-semibold mb-3 block">Attachments</Label>
                  <div className="space-y-2">
                    {/* Show direct file_url for portfolio artifacts if no attachments array */}
                    {selectedEvidence.item.file_url && 
                     selectedEvidence.item.type === "portfolio_artifact" && 
                     (!selectedEvidence.item.attachments || selectedEvidence.item.attachments.length === 0) && (
                      <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {selectedEvidence.item.title || "Portfolio File"}
                            </p>
                            {selectedEvidence.item.description && (
                              <p className="text-xs text-muted-foreground truncate">
                                {selectedEvidence.item.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(selectedEvidence.item.file_url!, "_blank")}
                            className="h-8"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = selectedEvidence.item.file_url!;
                              link.download = selectedEvidence.item.title || "portfolio-file";
                              link.click();
                            }}
                            className="h-8"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    )}
                    
                    {/* Show attachments array */}
                    {selectedEvidence.item.attachments && selectedEvidence.item.attachments.map((attachment: any) => (
                      <div 
                        key={attachment.id} 
                        className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors"
                      >
                        <div className="flex items-center gap-3 flex-1 min-w-0">
                          <File className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate">
                              {attachment.file_name || attachment.description || "Attachment"}
                            </p>
                            {attachment.file_type && (
                              <p className="text-xs text-muted-foreground">
                                {attachment.file_type}
                              </p>
                            )}
                            {attachment.description && attachment.description !== attachment.file_name && (
                              <p className="text-xs text-muted-foreground truncate">
                                {attachment.description}
                              </p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => window.open(attachment.file_url, "_blank")}
                            className="h-8"
                          >
                            <ExternalLink className="h-4 w-4 mr-1" />
                            View
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => {
                              const link = document.createElement("a");
                              link.href = attachment.file_url;
                              link.download = attachment.file_name || "attachment";
                              link.click();
                            }}
                            className="h-8"
                          >
                            <Download className="h-4 w-4 mr-1" />
                            Download
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
          
          <div className="flex justify-end gap-2 mt-4">
            <Button
              variant="outline"
              onClick={() => setSelectedEvidence(null)}
            >
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Review
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
