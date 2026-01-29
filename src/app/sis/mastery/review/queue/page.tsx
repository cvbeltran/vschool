"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter } from "next/navigation";
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
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrganization } from "@/lib/hooks/use-organization";
import { listMasteryLevels, type MasteryLevel, type MasteryProposal, getProposalStatus } from "@/lib/mastery";
import { CheckCircle2, XCircle, AlertTriangle, ArrowLeft } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function MasteryReviewQueuePage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();

  const [proposals, setProposals] = useState<MasteryProposal[]>([]);
  const [selectedProposal, setSelectedProposal] = useState<MasteryProposal | null>(null);
  const [reviewDialogOpen, setReviewDialogOpen] = useState(false);
  const [reviewAction, setReviewAction] = useState<"approve" | "request_changes" | "override">("approve");
  const [reviewerNotes, setReviewerNotes] = useState("");
  const [overrideLevelId, setOverrideLevelId] = useState("");
  const [masteryLevels, setMasteryLevels] = useState<MasteryLevel[]>([]);
  const [evidenceLinks, setEvidenceLinks] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const fetchData = async () => {
      // Wait for organization to load
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
      
      try {
        if (isMounted) {
          setLoading(true);
        }
        
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        const response = await fetch(`/api/mastery/proposals?type=review`, {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch proposals");
        }

        const { proposals: proposalsData } = await response.json();
        if (isMounted) {
          setProposals(proposalsData || []);
        }
      } catch (error) {
        console.error("Error fetching proposals", error);
        if (isMounted) {
          toast({
            title: "Error",
            description: "Failed to load review queue",
            variant: "destructive",
          });
        }
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
  }, [orgLoading, organizationId]);

  const openReviewDialog = async (proposal: MasteryProposal, action: "approve" | "request_changes" | "override") => {
    setSelectedProposal(proposal);
    setReviewAction(action);
    setReviewerNotes("");
    setOverrideLevelId("");

    // Load mastery levels for override
    if (action === "override" && proposal.mastery_level_id) {
      // Get mastery model from the proposal's mastery level
      const { data: level } = await supabase
        .from("mastery_levels")
        .select("mastery_model_id")
        .eq("id", proposal.mastery_level_id)
        .single();

      if (level) {
        const levels = await listMasteryLevels(level.mastery_model_id);
        setMasteryLevels(levels);
      }
    }

    // Load evidence highlights
    const { data: links } = await supabase
      .from("mastery_snapshot_evidence_links")
      .select("*")
      .eq("snapshot_id", proposal.id)
      .is("archived_at", null);
    setEvidenceLinks(links || []);

    setReviewDialogOpen(true);
  };

  const handleReview = async () => {
    if (!selectedProposal) return;

    if (reviewAction === "request_changes" && !reviewerNotes.trim()) {
      toast({
        title: "Error",
        description: "Please provide notes when requesting changes",
        variant: "destructive",
      });
      return;
    }

    if (reviewAction === "override" && (!overrideLevelId || !reviewerNotes.trim())) {
      toast({
        title: "Error",
        description: "Override requires a new level and justification",
        variant: "destructive",
      });
      return;
    }

    setReviewing(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const response = await fetch(`/api/mastery/proposals/${selectedProposal.id}/review`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session.access_token}`,
        },
        body: JSON.stringify({
          action: reviewAction,
          reviewer_notes: reviewerNotes,
          override_level_id: reviewAction === "override" ? overrideLevelId : undefined,
          override_justification: reviewAction === "override" ? reviewerNotes : undefined,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || "Failed to review proposal");
      }

      toast({
        title: "Success",
        description: `Proposal ${reviewAction === "approve" ? "approved" : reviewAction === "override" ? "overridden" : "returned for changes"}`,
      });

      setReviewDialogOpen(false);
      // Refresh proposals
      const refreshResponse = await fetch(`/api/mastery/proposals?type=review`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });
      if (refreshResponse.ok) {
        const { proposals: proposalsData } = await refreshResponse.json();
        setProposals(proposalsData || []);
      }
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to review proposal",
        variant: "destructive",
      });
    } finally {
      setReviewing(false);
    }
  };

  const getStatusBadge = (proposal: MasteryProposal) => {
    const status = getProposalStatus(proposal as any);
    if (status === "submitted") {
      return <Badge className="bg-yellow-100 text-yellow-800">Awaiting Review</Badge>;
    }
    if (status === "approved") {
      return <Badge className="bg-green-100 text-green-800">Approved</Badge>;
    }
    if (status === "changes_requested") {
      return <Badge className="bg-orange-100 text-orange-800">Changes Requested</Badge>;
    }
    return <Badge>Draft</Badge>;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mastery Review Queue</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
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
            <h1 className="text-2xl font-semibold">Mastery Review Queue</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Review and approve mastery proposals from teachers
            </p>
          </div>
        </div>
      </div>

      {proposals.length === 0 ? (
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8 text-muted-foreground">
              No proposals awaiting review.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {proposals.map((proposal) => (
            <Card key={proposal.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle>
                      {proposal.learner?.first_name} {proposal.learner?.last_name}
                    </CardTitle>
                    <p className="text-sm text-muted-foreground mt-1">
                      {proposal.competency?.name || "Unknown Competency"}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Teacher: {proposal.teacher?.id ? `User ${proposal.teacher.id.slice(0, 8)}` : "Unknown"}
                    </p>
                  </div>
                  {getStatusBadge(proposal)}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label>Mastery Level</Label>
                  <Badge className="mt-1">
                    {proposal.mastery_level?.label || "Unknown"}
                  </Badge>
                </div>

                {proposal.rationale_text && (
                  <div>
                    <Label>Rationale</Label>
                    <p className="text-sm mt-1 p-2 bg-muted rounded-md">
                      {proposal.rationale_text}
                    </p>
                  </div>
                )}

                <div className="flex gap-2">
                  <Button
                    size="sm"
                    onClick={() => openReviewDialog(proposal, "approve")}
                    className="bg-green-600 hover:bg-green-700"
                  >
                    <CheckCircle2 className="h-4 w-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReviewDialog(proposal, "request_changes")}
                  >
                    <AlertTriangle className="h-4 w-4 mr-2" />
                    Request Changes
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => openReviewDialog(proposal, "override")}
                  >
                    <XCircle className="h-4 w-4 mr-2" />
                    Override
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Review Dialog */}
      <Dialog open={reviewDialogOpen} onOpenChange={setReviewDialogOpen}>
        <DialogContent className="sm:max-w-[600px]">
          <DialogHeader>
            <DialogTitle>
              {reviewAction === "approve" && "Approve Proposal"}
              {reviewAction === "request_changes" && "Request Changes"}
              {reviewAction === "override" && "Override Proposal"}
            </DialogTitle>
            <DialogDescription>
              {selectedProposal && (
                <>
                  Reviewing mastery proposal for {selectedProposal.learner?.first_name}{" "}
                  {selectedProposal.learner?.last_name} - {selectedProposal.competency?.name}
                </>
              )}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {selectedProposal && (
              <>
                <div>
                  <Label>Current Mastery Level</Label>
                  <Badge className="mt-1">
                    {selectedProposal.mastery_level?.label || "Unknown"}
                  </Badge>
                </div>

                {selectedProposal.rationale_text && (
                  <div>
                    <Label>Teacher Rationale</Label>
                    <p className="text-sm mt-1 p-2 bg-muted rounded-md">
                      {selectedProposal.rationale_text}
                    </p>
                  </div>
                )}

                {evidenceLinks.length > 0 && (
                  <div>
                    <Label>Evidence Highlights ({evidenceLinks.length})</Label>
                    <div className="mt-1 space-y-1">
                      {evidenceLinks.map((link) => (
                        <div key={link.id} className="text-sm p-2 bg-muted rounded-md">
                          {link.evidence_type}: {link.observation_id || link.portfolio_artifact_id || link.assessment_id}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {reviewAction === "override" && (
                  <div>
                    <Label>New Mastery Level *</Label>
                    <Select value={overrideLevelId} onValueChange={setOverrideLevelId}>
                      <SelectTrigger>
                        <SelectValue placeholder="Select new mastery level" />
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
                )}

                <div>
                  <Label>
                    {reviewAction === "override" ? "Justification *" : "Notes"}
                    {reviewAction === "request_changes" && " *"}
                  </Label>
                  <Textarea
                    value={reviewerNotes}
                    onChange={(e) => setReviewerNotes(e.target.value)}
                    placeholder={
                      reviewAction === "override"
                        ? "Explain why you are overriding the teacher's assessment..."
                        : reviewAction === "request_changes"
                        ? "What changes are needed?"
                        : "Optional notes..."
                    }
                    rows={4}
                  />
                </div>
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setReviewDialogOpen(false)} disabled={reviewing}>
              Cancel
            </Button>
            <Button onClick={handleReview} disabled={reviewing}>
              {reviewing
                ? "Processing..."
                : reviewAction === "approve"
                ? "Approve"
                : reviewAction === "override"
                ? "Override"
                : "Request Changes"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
