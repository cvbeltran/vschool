"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit, Archive, ExternalLink, FileText, Download } from "lucide-react";
import { isImageFile, getFileNameFromUrl } from "@/lib/student/file-upload";
import {
  getMyArtifact,
  submitArtifact,
  archiveArtifact,
  isArtifactLinkedToAssessment,
  type PortfolioArtifact,
} from "@/lib/student/student-data";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

export default function ViewArtifactPage() {
  const router = useRouter();
  const params = useParams();
  const artifactId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<PortfolioArtifact | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isLinkedToAssessment, setIsLinkedToAssessment] = useState(false);

  useEffect(() => {
    if (!artifactId) {
      setLoading(false);
      setError("Artifact ID is required");
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError(null);
    setArtifact(null); // Reset artifact when ID changes

    const fetchData = async () => {
      try {
        const artifactData = await getMyArtifact(artifactId);
        
        if (!cancelled) {
          if (!artifactData) {
            setError("Artifact not found");
            setArtifact(null);
          } else {
            setArtifact(artifactData);
            setError(null);
            // Check if artifact is linked to assessment
            const linked = await isArtifactLinkedToAssessment(artifactId);
            if (!cancelled) {
              setIsLinkedToAssessment(linked);
            }
          }
        }
      } catch (err: any) {
        if (!cancelled) {
          console.error("Error fetching artifact:", err);
          setError(err.message || "Failed to load artifact");
          setArtifact(null);
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    fetchData();

    return () => {
      cancelled = true;
    };
  }, [artifactId]); // Only depend on artifactId

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await submitArtifact(artifactId);
      // Refresh artifact data
      const updated = await getMyArtifact(artifactId);
      if (updated) {
        setArtifact(updated);
      }
      setShowSubmitDialog(false);
    } catch (err: any) {
      console.error("Error submitting artifact:", err);
      setError(err.message || "Failed to submit artifact");
    } finally {
      setSubmitting(false);
    }
  };

  const handleArchive = async () => {
    if (isLinkedToAssessment) {
      setError("Cannot archive artifact that is linked to an assessment");
      setShowArchiveDialog(false);
      return;
    }

    setArchiving(true);
    setError(null);

    try {
      await archiveArtifact(artifactId);
      router.push("/student/my-portfolio");
    } catch (err: any) {
      console.error("Error archiving artifact:", err);
      setError(err.message || "Failed to archive artifact");
      setShowArchiveDialog(false);
    } finally {
      setArchiving(false);
    }
  };

  const getArtifactTypeIcon = (type: string) => {
    switch (type) {
      case "link":
        return <ExternalLink className="h-5 w-5" />;
      case "text":
        return <FileText className="h-5 w-5" />;
      default:
        return <FileText className="h-5 w-5" />;
    }
  };

  const getVisibilityBadgeVariant = (visibility: string) => {
    switch (visibility) {
      case "shared":
        return "default";
      case "internal":
        return "secondary";
      case "private":
        return "outline";
      default:
        return "outline";
    }
  };

  const getStatusBadgeVariant = (status: string) => {
    switch (status) {
      case "submitted":
        return "default";
      case "draft":
        return "secondary";
      default:
        return "outline";
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  if (error && !artifact) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/student/my-portfolio">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>
        <Card>
          <CardContent className="pt-6">
            <div className="text-destructive">{error}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!artifact) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/student/my-portfolio">
            <Button variant="ghost" size="sm">
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back
            </Button>
          </Link>
          <div>
            <h1 className="text-3xl font-bold">{artifact.title}</h1>
            <p className="text-muted-foreground mt-2">
              Portfolio Artifact
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {artifact.status === "draft" && !isLinkedToAssessment && (
            <>
              <Link href={`/student/my-portfolio/${artifactId}/edit`}>
                <Button variant="outline" size="sm">
                  <Edit className="mr-2 h-4 w-4" />
                  Edit
                </Button>
              </Link>
              <Button
                variant="default"
                size="sm"
                onClick={() => setShowSubmitDialog(true)}
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Evidence"}
              </Button>
            </>
          )}
          {!isLinkedToAssessment && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setShowArchiveDialog(true)}
              disabled={archiving}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          )}
        </div>
      </div>

      {error && (
        <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            {getArtifactTypeIcon(artifact.artifact_type)}
            <CardTitle>{artifact.title}</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant={getStatusBadgeVariant(artifact.status)}>
              {artifact.status === "draft" ? "Draft" : "Submitted"}
            </Badge>
            <Badge variant={getVisibilityBadgeVariant(artifact.visibility)}>
              {artifact.visibility}
            </Badge>
            <Badge variant="outline">
              {artifact.artifact_type}
            </Badge>
            {isLinkedToAssessment && (
              <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                Used for assessment
              </Badge>
            )}
          </div>

          {artifact.description && (
            <div>
              <h3 className="font-medium mb-2">Description / Reflection</h3>
              <p className="text-muted-foreground whitespace-pre-wrap">{artifact.description}</p>
            </div>
          )}

          {artifact.artifact_type === "text" && artifact.text_content && (
            <div>
              <h3 className="font-medium mb-2">Content</h3>
              <div className="bg-muted p-4 rounded-md">
                <p className="whitespace-pre-wrap">{artifact.text_content}</p>
              </div>
            </div>
          )}

          {artifact.artifact_type === "link" && artifact.file_url && (
            <div>
              <h3 className="font-medium mb-2">External Link</h3>
              <a
                href={artifact.file_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-600 hover:underline flex items-center gap-2"
              >
                <ExternalLink className="h-4 w-4" />
                {artifact.file_url}
              </a>
            </div>
          )}

          {artifact.artifact_type === "upload" && artifact.file_url && (
            <div>
              <h3 className="font-medium mb-2">File</h3>
              {isImageFile(artifact.file_url) ? (
                <div className="space-y-2">
                  <img
                    src={artifact.file_url}
                    alt={artifact.title}
                    className="max-w-full max-h-96 rounded-md border object-contain"
                    onError={(e) => {
                      // Fallback to link if image fails to load
                      const target = e.target as HTMLImageElement;
                      target.style.display = "none";
                      const parent = target.parentElement;
                      if (parent) {
                        parent.innerHTML = `
                          <a href="${artifact.file_url}" target="_blank" rel="noopener noreferrer" class="text-blue-600 hover:underline flex items-center gap-2">
                            <FileText class="h-4 w-4" />
                            View file
                          </a>
                        `;
                      }
                    }}
                  />
                  <a
                    href={artifact.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-2 text-sm"
                  >
                    <Download className="h-4 w-4" />
                    Download {getFileNameFromUrl(artifact.file_url)}
                  </a>
                </div>
              ) : (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 p-3 border rounded-md bg-muted/50">
                    <FileText className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm font-medium">{getFileNameFromUrl(artifact.file_url)}</span>
                  </div>
                  <a
                    href={artifact.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:underline flex items-center gap-2"
                  >
                    <Download className="h-4 w-4" />
                    Download file
                  </a>
                </div>
              )}
            </div>
          )}

          <div className="pt-4 border-t">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <span className="text-muted-foreground">Created:</span>{" "}
                {new Date(artifact.created_at).toLocaleString()}
              </div>
              <div>
                <span className="text-muted-foreground">Last Updated:</span>{" "}
                {new Date(artifact.updated_at).toLocaleString()}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Submit Confirmation Dialog */}
      <ConfirmDialog
        open={showSubmitDialog}
        onOpenChange={setShowSubmitDialog}
        title="Submit Artifact"
        description="Are you sure you want to submit this artifact? Once submitted, you won't be able to edit it."
        confirmText="Submit"
        cancelText="Cancel"
        variant="default"
        onConfirm={handleSubmit}
        isLoading={submitting}
      />

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={showArchiveDialog}
        onOpenChange={setShowArchiveDialog}
        title="Archive Artifact"
        description="Are you sure you want to archive this artifact? You can't undo this action."
        confirmText="Archive"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleArchive}
        isLoading={archiving}
      />
    </div>
  );
}
