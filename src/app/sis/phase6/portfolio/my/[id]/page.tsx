"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
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
} from "@/components/ui/dialog";
import { ArrowLeft, Edit2, Archive, ExternalLink } from "lucide-react";
import {
  getMyPortfolioArtifact,
  archiveMyPortfolioArtifact,
  listPortfolioArtifactTags,
  listPortfolioArtifactLinks,
  type PortfolioArtifact,
  type PortfolioArtifactTag,
  type PortfolioArtifactLink,
} from "@/lib/phase6/portfolio";

export default function PortfolioArtifactDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

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
        const artifactData = await getMyPortfolioArtifact(id);
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

    fetchData();
  }, [id]);

  const handleArchive = async () => {
    if (!artifact) return;
    setArchiving(true);
    try {
      await archiveMyPortfolioArtifact(id);
      router.push("/sis/phase6/portfolio/my");
    } catch (err: any) {
      console.error("Error archiving artifact:", err);
      setError(err.message || "Failed to archive artifact");
    } finally {
      setArchiving(false);
      setShowArchiveDialog(false);
    }
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
        <h1 className="text-2xl font-semibold">Portfolio Artifact</h1>
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      </div>
    );
  }

  if (!artifact) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Portfolio Artifact</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/sis/phase6/portfolio/my/${id}/edit`)}
        >
          <Edit2 className="mr-2 h-4 w-4" />
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

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>{artifact.title}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-2">
            <Badge variant="outline">{artifact.artifact_type}</Badge>
            <Badge variant="secondary">{artifact.visibility}</Badge>
          </div>

          {artifact.description && (
            <div>
              <p className="text-sm text-muted-foreground">{artifact.description}</p>
            </div>
          )}

          {artifact.artifact_type === "upload" && artifact.file_url && (
            <div>
              <Label className="text-muted-foreground">File</Label>
              <div className="mt-1">
                <a
                  href={artifact.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  {artifact.file_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {artifact.artifact_type === "link" && artifact.file_url && (
            <div>
              <Label className="text-muted-foreground">Link</Label>
              <div className="mt-1">
                <a
                  href={artifact.file_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-sm text-blue-600 hover:underline flex items-center gap-1"
                >
                  {artifact.file_url}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          )}

          {artifact.artifact_type === "text" && artifact.text_content && (
            <div>
              <Label className="text-muted-foreground">Content</Label>
              <div className="mt-1 p-3 bg-muted rounded-md">
                <p className="text-sm whitespace-pre-wrap">{artifact.text_content}</p>
              </div>
            </div>
          )}

          {tags.length > 0 && (
            <div>
              <Label className="text-muted-foreground">Tags</Label>
              <div className="mt-1 flex flex-wrap gap-2">
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
              <Label className="text-muted-foreground">Linked References</Label>
              <div className="mt-1 space-y-1">
                {links.map((link) => (
                  <div key={link.id} className="text-sm">
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
        </CardContent>
      </Card>

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Portfolio Artifact</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this portfolio artifact? This action can be undone.
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
