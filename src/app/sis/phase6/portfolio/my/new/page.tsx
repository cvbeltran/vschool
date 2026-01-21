"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  createMyPortfolioArtifact,
  type CreateMyPortfolioArtifactPayload,
} from "@/lib/phase6/portfolio";

export default function NewPortfolioArtifactPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    artifact_type: "text" as "upload" | "link" | "text",
    title: "",
    description: "",
    file_url: "",
    text_content: "",
    visibility: "internal" as "internal" | "private" | "shared",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!organizationId) {
      setError("Missing organization context");
      return;
    }

    if (!formData.title.trim()) {
      setError("Title is required");
      return;
    }

    // Validate based on artifact type
    if (formData.artifact_type === "upload" && !formData.file_url.trim()) {
      setError("File URL is required for upload type");
      return;
    }
    if (formData.artifact_type === "link" && !formData.file_url.trim()) {
      setError("Link URL is required for link type");
      return;
    }
    if (formData.artifact_type === "text" && !formData.text_content.trim()) {
      setError("Text content is required for text type");
      return;
    }

    setLoading(true);

    try {
      const payload: CreateMyPortfolioArtifactPayload = {
        organization_id: organizationId,
        artifact_type: formData.artifact_type,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        file_url: formData.artifact_type === "upload" || formData.artifact_type === "link" ? formData.file_url.trim() || null : null,
        text_content: formData.artifact_type === "text" ? formData.text_content.trim() || null : null,
        visibility: formData.visibility,
      };

      const artifact = await createMyPortfolioArtifact(payload);
      router.push(`/sis/phase6/portfolio/my/${artifact.id}`);
    } catch (err: any) {
      console.error("Error creating portfolio artifact:", err);
      setError(err.message || "Failed to create portfolio artifact");
    } finally {
      setLoading(false);
    }
  };

  if (orgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Portfolio Artifact</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Create Portfolio Artifact</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Artifact Form</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="artifact_type">Artifact Type</Label>
              <Select
                value={formData.artifact_type}
                onValueChange={(value: "upload" | "link" | "text") =>
                  setFormData({ ...formData, artifact_type: value, file_url: "", text_content: "" })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload">Upload (File)</SelectItem>
                  <SelectItem value="link">Link (URL)</SelectItem>
                  <SelectItem value="text">Text Entry</SelectItem>
                </SelectContent>
              </Select>
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
                placeholder="e.g., My Resume, Project Reflection, Certificate"
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
                placeholder="Optional description of this artifact"
                rows={3}
                disabled={loading}
              />
            </div>

            {formData.artifact_type === "upload" && (
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
                  placeholder="https://example.com/file.pdf or storage path"
                  required
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  Note: File upload functionality will be implemented with storage integration.
                </p>
              </div>
            )}

            {formData.artifact_type === "link" && (
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
                  placeholder="https://example.com/project"
                  required
                  disabled={loading}
                />
              </div>
            )}

            {formData.artifact_type === "text" && (
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
                  placeholder="Enter your text content here..."
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
                {loading ? "Creating..." : "Create Artifact"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
