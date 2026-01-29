"use client";

import { useEffect, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Plus, ExternalLink, FileText, Edit, Eye, Archive } from "lucide-react";
import { getMyPortfolio, archiveArtifact, getMyStudentRow, isArtifactLinkedToAssessment, type PortfolioArtifact } from "@/lib/student/student-data";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";

function MyPortfolioContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [loading, setLoading] = useState(true);
  const [artifacts, setArtifacts] = useState<PortfolioArtifact[]>([]);
  const [canCreate, setCanCreate] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [artifactToArchive, setArtifactToArchive] = useState<string | null>(null);
  const [linkedArtifacts, setLinkedArtifacts] = useState<Set<string>>(new Set());
  const [showSuccess, setShowSuccess] = useState(false);

  useEffect(() => {
    // Check for success message
    if (searchParams.get("created") === "true") {
      setShowSuccess(true);
      // Remove query param from URL
      router.replace("/student/my-portfolio");
      // Hide success message after 5 seconds
      setTimeout(() => setShowSuccess(false), 5000);
    }
  }, [searchParams, router]);

  useEffect(() => {
    let cancelled = false;

    const fetchData = async () => {
      try {
        // First get student row (which includes student ID)
        const student = await getMyStudentRow();
        
        if (!cancelled) {
          if (student) {
            setCanCreate(true);
            // Use student ID to fetch portfolio (avoids redundant lookup)
            const data = await getMyPortfolio(student.id);
            if (!cancelled) {
              setArtifacts(data);
              // Check which artifacts are linked to assessments
              const linkedSet = new Set<string>();
              await Promise.all(
                data.map(async (artifact) => {
                  const isLinked = await isArtifactLinkedToAssessment(artifact.id);
                  if (isLinked) {
                    linkedSet.add(artifact.id);
                  }
                })
              );
              if (!cancelled) {
                setLinkedArtifacts(linkedSet);
              }
            }
          } else {
            // Still try to fetch portfolio even if student row fails
            const data = await getMyPortfolio();
            if (!cancelled) {
              setArtifacts(data);
              // Check which artifacts are linked to assessments
              const linkedSet = new Set<string>();
              await Promise.all(
                data.map(async (artifact) => {
                  const isLinked = await isArtifactLinkedToAssessment(artifact.id);
                  if (isLinked) {
                    linkedSet.add(artifact.id);
                  }
                })
              );
              if (!cancelled) {
                setLinkedArtifacts(linkedSet);
              }
            }
          }
        }
      } catch (error) {
        if (!cancelled) {
          console.error("Error fetching portfolio:", error);
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
  }, []);

  const handleArchive = async () => {
    if (!artifactToArchive) return;

    // Check if artifact is linked to assessment
    const isLinked = linkedArtifacts.has(artifactToArchive);
    if (isLinked) {
      alert("Cannot archive artifact that is linked to an assessment");
      setShowArchiveDialog(false);
      setArtifactToArchive(null);
      return;
    }

    setArchivingId(artifactToArchive);
    try {
      await archiveArtifact(artifactToArchive);
      setArtifacts(artifacts.filter(a => a.id !== artifactToArchive));
      setLinkedArtifacts(prev => {
        const next = new Set(prev);
        next.delete(artifactToArchive);
        return next;
      });
      setShowArchiveDialog(false);
      setArtifactToArchive(null);
    } catch (error: any) {
      console.error("Error archiving artifact:", error);
      alert(error.message || "Failed to archive artifact");
    } finally {
      setArchivingId(null);
    }
  };

  const handleArchiveClick = (id: string) => {
    setArtifactToArchive(id);
    setShowArchiveDialog(true);
  };

  const getArtifactTypeIcon = (type: string) => {
    switch (type) {
      case "link":
        return <ExternalLink className="h-4 w-4" />;
      case "text":
        return <FileText className="h-4 w-4" />;
      default:
        return <FileText className="h-4 w-4" />;
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

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">My Portfolio</h1>
          <p className="text-muted-foreground mt-2">
            View and manage your portfolio artifacts
          </p>
        </div>
        {canCreate && (
          <Button onClick={() => router.push("/student/my-portfolio/create")}>
            <Plus className="mr-2 h-4 w-4" />
            Add Artifact
          </Button>
        )}
      </div>

      {/* Success Message */}
      {showSuccess && (
        <div className="bg-green-50 border border-green-200 text-green-800 p-4 rounded-md">
          Artifact created successfully!
        </div>
      )}

      {/* Portfolio Artifacts */}
      <Card>
        <CardHeader>
          <CardTitle>Portfolio Artifacts ({artifacts.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {artifacts.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <p className="mb-4">No artifacts yet — submit evidence of your learning</p>
              {canCreate && (
                <Button onClick={() => router.push("/student/my-portfolio/create")} variant="outline">
                  <Plus className="mr-2 h-4 w-4" />
                  Create Your First Artifact
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {artifacts.map((artifact) => (
                <div
                  key={artifact.id}
                  className="flex items-start justify-between border-b pb-4 last:border-b-0 last:pb-0"
                >
                  <div className="space-y-2 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      {getArtifactTypeIcon(artifact.artifact_type)}
                      <Link
                        href={`/student/my-portfolio/${artifact.id}`}
                        className="font-medium hover:underline"
                      >
                        {artifact.title}
                      </Link>
                      <Badge variant={getStatusBadgeVariant(artifact.status)}>
                        {artifact.status === "draft" ? "Draft" : "Submitted"}
                      </Badge>
                      <Badge variant={getVisibilityBadgeVariant(artifact.visibility)}>
                        {artifact.visibility}
                      </Badge>
                      {linkedArtifacts.has(artifact.id) && (
                        <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200">
                          Used for assessment
                        </Badge>
                      )}
                    </div>
                    {artifact.description && (
                      <p className="text-sm text-muted-foreground line-clamp-2">{artifact.description}</p>
                    )}
                    {artifact.artifact_type === "link" && artifact.file_url && (
                      <a
                        href={artifact.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                      >
                        <ExternalLink className="h-3 w-3" />
                        {artifact.file_url}
                      </a>
                    )}
                    {artifact.artifact_type === "text" && artifact.text_content && (
                      <div className="text-sm text-muted-foreground bg-muted p-3 rounded line-clamp-3">
                        {artifact.text_content}
                      </div>
                    )}
                    {artifact.artifact_type === "upload" && artifact.file_url && (
                      <a
                        href={artifact.file_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sm text-blue-600 hover:underline"
                      >
                        View file
                      </a>
                    )}
                    <div className="text-xs text-muted-foreground">
                      Created: {new Date(artifact.created_at).toLocaleDateString()}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 ml-4">
                    <Link href={`/student/my-portfolio/${artifact.id}`}>
                      <Button variant="ghost" size="sm">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </Link>
                    {artifact.status === "draft" && !linkedArtifacts.has(artifact.id) && (
                      <Link href={`/student/my-portfolio/${artifact.id}/edit`}>
                        <Button variant="ghost" size="sm">
                          <Edit className="h-4 w-4" />
                        </Button>
                      </Link>
                    )}
                    {!linkedArtifacts.has(artifact.id) && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchiveClick(artifact.id)}
                        disabled={archivingId === artifact.id}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Archive Confirmation Dialog */}
      <ConfirmDialog
        open={showArchiveDialog}
        onOpenChange={(open) => {
          setShowArchiveDialog(open);
          if (!open) {
            setArtifactToArchive(null);
          }
        }}
        title="Archive Artifact"
        description="Are you sure you want to archive this artifact? You can't undo this action."
        confirmText="Archive"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleArchive}
        isLoading={archivingId !== null}
      />
    </div>
  );
}

export default function MyPortfolioPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <MyPortfolioContent />
    </Suspense>
  );
}
