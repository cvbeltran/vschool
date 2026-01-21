"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import {
  getMyPortfolioArtifact,
  updateMyPortfolioArtifact,
  type UpdateMyPortfolioArtifactPayload,
} from "@/lib/phase6/portfolio";

export default function EditPortfolioArtifactPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<any>(null);

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    file_url: "",
    text_content: "",
    visibility: "internal" as "internal" | "private" | "shared",
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        const artifactData = await getMyPortfolioArtifact(id);
        if (!artifactData) {
          setError("Portfolio artifact not found");
          setFetching(false);
          return;
        }
        setArtifact(artifactData);
        setFormData({
          title: artifactData.title,
          description: artifactData.description || "",
          file_url: artifactData.file_url || "",
          text_content: artifactData.text_content || "",
          visibility: artifactData.visibility,
        });
      } catch (err: any) {
        console.error("Error fetching portfolio artifact:", err);
        setError(err.message || "Failed to load portfolio artifact");
      } finally {
        setFetching(false);
      }
    };

    fetchData();
  }, [id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    // Validate based on artifact type
    if (artifact?.artifact_type === "upload" && !formData.file_url.trim()) {
      setError("File URL is required for upload type");
      return;
    }
    if (artifact?.artifact_type === "link" && !formData.file_url.trim()) {
      setError("Link URL is required for link type");
      return;
    }
    if (artifact?.artifact_type === "text" && !formData.text_content.trim()) {
      setError("Text content is required for text type");
      return;
    }

    setLoading(true);

    try {
      const payload: UpdateMyPortfolioArtifactPayload = {
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        file_url: artifact?.artifact_type === "upload" || artifact?.artifact_type === "link" ? formData.file_url.trim() || null : null,
        text_content: artifact?.artifact_type === "text" ? formData.text_content.trim() || null : null,
        visibility: formData.visibility,
      };

      await updateMyPortfolioArtifact(id, payload);
      router.push(`/sis/phase6/portfolio/my/${id}`);
    } catch (err: any) {
      console.error("Error updating portfolio artifact:", err);
      setError(err.message || "Failed to update portfolio artifact");
    } finally {
      setLoading(false);
    }
  };

  if (fetching) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit Portfolio Artifact</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !artifact) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Edit Portfolio Artifact</h1>
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
        <h1 className="text-2xl font-semibold">Edit Portfolio Artifact</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Portfolio Artifact</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label>Artifact Type</Label>
              <p className="text-sm text-muted-foreground">{artifact.artifact_type}</p>
              <p className="text-xs text-muted-foreground">Type cannot be changed after creation.</p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="title">
                Title <span className="text-destructive">*</span>
              </Label>
              <Input
                id="title"
                value={formData.title}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                required
                disabled={loading}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                rows={3}
                disabled={loading}
              />
            </div>

            {artifact.artifact_type === "upload" && (
              <div className="space-y-2">
                <Label htmlFor="file_url">
                  File URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="file_url"
                  value={formData.file_url}
                  onChange={(e) =>
                    setFormData({ ...formData, file_url: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>
            )}

            {artifact.artifact_type === "link" && (
              <div className="space-y-2">
                <Label htmlFor="file_url">
                  Link URL <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="file_url"
                  type="url"
                  value={formData.file_url}
                  onChange={(e) =>
                    setFormData({ ...formData, file_url: e.target.value })
                  }
                  required
                  disabled={loading}
                />
              </div>
            )}

            {artifact.artifact_type === "text" && (
              <div className="space-y-2">
                <Label htmlFor="text_content">
                  Text Content <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="text_content"
                  value={formData.text_content}
                  onChange={(e) =>
                    setFormData({ ...formData, text_content: e.target.value })
                  }
                  rows={8}
                  required
                  disabled={loading}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={formData.visibility}
                onValueChange={(value: "internal" | "private" | "shared") =>
                  setFormData({ ...formData, visibility: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal (Student + Teachers)</SelectItem>
                  <SelectItem value="private">Private (Student Only)</SelectItem>
                  <SelectItem value="shared">Shared (Student + Teachers + Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-2 justify-end">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
                disabled={loading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Saving..." : "Save Changes"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
