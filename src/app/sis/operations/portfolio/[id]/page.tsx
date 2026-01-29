"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { ArrowLeft, Edit, Archive, ExternalLink, FileText, Upload, Download } from "lucide-react";
import { isImageFile, getFileNameFromUrl } from "@/lib/student/file-upload";
import {
  getPortfolioArtifactById,
  deletePortfolioItem,
  listPortfolioArtifactTags,
  listPortfolioArtifactLinks,
  type PortfolioArtifact,
  type PortfolioArtifactTag,
  type PortfolioArtifactLink,
} from "@/lib/phase6/portfolio";

export default function PortfolioArtifactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const searchParams = useSearchParams();
  const id = params.id as string;
  const studentId = searchParams.get("student");

  const [artifact, setArtifact] = useState<PortfolioArtifact | null>(null);
  const [tags, setTags] = useState<PortfolioArtifactTag[]>([]);
  const [links, setLinks] = useState<PortfolioArtifactLink[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const artifactData = await getPortfolioArtifactById(id);
        if (!artifactData) {
          setError("Portfolio artifact not found");
          setLoading(false);
          return;
        }
        setArtifact(artifactData);

        // Fetch tags and links
        const [tagsData, linksData] = await Promise.all([
          listPortfolioArtifactTags(id),
          listPortfolioArtifactLinks(id),
        ]);
        setTags(tagsData);
        setLinks(linksData);
      } catch (err: any) {
        console.error("Error fetching portfolio artifact:", err);
        setError(err.message || "Failed to load portfolio artifact");
      } finally {
        setLoading(false);
      }
    };

    if (id) {
      fetchData();
    }
  }, [id]);

  const handleArchive = async () => {
    if (!artifact || !studentId) return;
    setArchiving(true);
    try {
      await deletePortfolioItem({
        scope: "student",
        studentId: studentId,
        itemId: artifact.id,
      });
      // Navigate back to portfolio list
      router.push(`/sis/operations/portfolio?student=${studentId}`);
    } catch (err: any) {
      console.error("Error archiving artifact:", err);
      setError(err.message || "Failed to archive artifact");
      setArchiving(false);
      setShowArchiveDialog(false);
    }
  };

  const getArtifactTypeIcon = (type: string) => {
    switch (type) {
      case "upload":
        return <Upload className="h-5 w-5" />;
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

  const getStatusBadgeVariant = (status?: string | null) => {
    if (!status) return "outline";
    switch (status) {
      case "submitted":
        return "default";
      case "draft":
        return "secondary";
      default:
        return "outline";
    }
  };

  const getBackUrl = () => {
    if (studentId) {
      return `/sis/operations/portfolio?student=${studentId}`;
    }
    return "/sis/operations/portfolio";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Portfolio Artifact</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !artifact) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push(getBackUrl())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Portfolio Artifact</h1>
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
          <Button variant="ghost" size="sm" onClick={() => router.push(getBackUrl())}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">{artifact.title}</h1>
            <p className="text-muted-foreground mt-2">
              Portfolio Artifact
              {artifact.student && (
                <> - {artifact.student.first_name} {artifact.student.last_name}</>
              )}
            </p>
          </div>
        </div>
        {studentId && (
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                const params = new URLSearchParams();
                params.set("student", studentId);
                router.push(`/sis/operations/portfolio?${params.toString()}`);
              }}
            >
              <Edit className="mr-2 h-4 w-4" />
              Edit
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowArchiveDialog(true)}
            >
              <Archive className="mr-2 h-4 w-4" />
              Archive
            </Button>
          </div>
        )}
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
            {artifact.status && (
              <Badge variant={getStatusBadgeVariant(artifact.status)}>
                {artifact.status === "draft" ? "Draft" : "Submitted"}
              </Badge>
            )}
            <Badge variant={getVisibilityBadgeVariant(artifact.visibility)}>
              {artifact.visibility}
            </Badge>
            <Badge variant="outline">{artifact.artifact_type}</Badge>
            {artifact.source && (
              <Badge variant="outline" className="text-xs">
                {artifact.source === "student_upload" ? "Student Created" : "Staff Added"}
              </Badge>
            )}
          </div>

          {artifact.student && (
            <div>
              <h3 className="font-medium mb-2">Student</h3>
              <p className="text-muted-foreground">
                {artifact.student.first_name} {artifact.student.last_name}
                {artifact.student.student_number && (
                  <> (Student #: {artifact.student.student_number})</>
                )}
              </p>
            </div>
          )}

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
                        const link = parent.querySelector("a");
                        if (link) {
                          link.style.display = "flex";
                        }
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

          {artifact.occurred_on && (
            <div>
              <h3 className="font-medium mb-2">Occurred On</h3>
              <p className="text-muted-foreground">
                {new Date(artifact.occurred_on).toLocaleDateString()}
              </p>
            </div>
          )}

          {artifact.evidence_type && (
            <div>
              <h3 className="font-medium mb-2">Evidence Type</h3>
              <p className="text-muted-foreground">{artifact.evidence_type}</p>
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Tags</h3>
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <Badge key={tag.id} variant="outline">
                    {tag.tag_type}:{" "}
                    {tag.competency?.name ||
                      tag.domain?.name ||
                      tag.experience?.name ||
                      "Unknown"}
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {links.length > 0 && (
            <div>
              <h3 className="font-medium mb-2">Linked References</h3>
              <div className="space-y-1">
                {links.map((link) => (
                  <div key={link.id} className="text-sm text-muted-foreground">
                    {link.observation && (
                      <p>
                        Observation: {link.observation.notes?.substring(0, 50) || "N/A"} (
                        {new Date(link.observation.observed_at).toLocaleDateString()})
                      </p>
                    )}
                    {link.experience && <p>Experience: {link.experience.name}</p>}
                  </div>
                ))}
              </div>
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

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Portfolio Artifact</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive "{artifact.title}"? This action can be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowArchiveDialog(false)}
              disabled={archiving}
            >
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleArchive} disabled={archiving}>
              {archiving ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
