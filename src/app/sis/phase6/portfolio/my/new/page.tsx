"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  createMyPortfolioArtifact,
  type CreateMyPortfolioArtifactPayload,
  type PortfolioArtifactAttachment,
} from "@/lib/phase6/portfolio";
import { uploadPortfolioFile, isImageFile, getFileNameFromUrl } from "@/lib/student/file-upload";
import { supabase } from "@/lib/supabase/client";

export default function NewPortfolioArtifactPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [studentId, setStudentId] = useState<string | null>(null);
  
  const [formData, setFormData] = useState({
    artifact_type: "text" as "upload" | "link" | "text",
    title: "",
    description: "",
    file_url: "",
    text_content: "",
    visibility: "private" as "internal" | "private" | "shared",
    occurred_on: "",
    evidence_type: "",
    attachments: [] as PortfolioArtifactAttachment[],
  });
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");

  // Get student ID for file upload (staff may have student records)
  useEffect(() => {
    const fetchStudentId = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError("Not authenticated");
          setLoading(false);
          return;
        }

        const { data: profile } = await supabase
          .from("profiles")
          .select("id, organization_id")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          setLoading(false);
          return;
        }

        const { data: user } = await supabase.auth.getUser();
        if (user?.user?.email && profile.organization_id) {
          const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("primary_email", user.user.email)
            .eq("organization_id", profile.organization_id)
            .maybeSingle();
          if (student) {
            setStudentId(student.id);
          }
        }
      } catch (err: any) {
        // Non-critical - file upload just won't work if no student ID
        console.error("Error fetching student ID:", err);
      } finally {
        setLoading(false);
      }
    };

    if (!orgLoading && organizationId) {
      fetchStudentId();
    }
  }, [orgLoading, organizationId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!studentId) {
      setError("File upload requires a student account. Please use the link or text options, or contact support.");
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setError(null);

    try {
      const result = await uploadPortfolioFile(file, studentId);
      if (result.error) {
        setError(result.error);
        setSelectedFile(null);
        return;
      }

      setFormData({ ...formData, file_url: result.url });
      setUploadedFileName(file.name);
    } catch (err: any) {
      setError(err.message || "Failed to upload file");
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFormData({ ...formData, file_url: "" });
    setUploadedFileName("");
  };

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

    if (formData.artifact_type === "upload" && !formData.file_url.trim()) {
      setError("Please upload a file or wait for upload to complete");
      return;
    }

    setSubmitting(true);

    try {
      const payload: CreateMyPortfolioArtifactPayload = {
        organization_id: organizationId,
        artifact_type: formData.artifact_type,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        file_url: formData.artifact_type === "upload" || formData.artifact_type === "link" ? formData.file_url.trim() || null : null,
        text_content: formData.artifact_type === "text" ? formData.text_content.trim() || null : null,
        visibility: formData.visibility,
        occurred_on: formData.occurred_on || null,
        evidence_type: formData.evidence_type || null,
        attachments: formData.attachments.length > 0 ? formData.attachments : null,
        source: "staff_added",
      };

      const artifact = await createMyPortfolioArtifact(payload);
      router.push(`/sis/phase6/portfolio/my/${artifact.id}`);
    } catch (err: any) {
      setError(err.message || "Failed to create portfolio artifact");
    } finally {
      setSubmitting(false);
    }
  };

  if (orgLoading || loading) {
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
                disabled={submitting}
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
                disabled={submitting}
              />
            </div>

            {formData.artifact_type === "upload" && (
              <div className="space-y-2">
                <Label htmlFor="fileUpload">
                  Upload File <span className="text-destructive">*</span>
                </Label>
                {!formData.file_url ? (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <Input
                        id="fileUpload"
                        type="file"
                        onChange={handleFileSelect}
                        disabled={uploading || submitting}
                        className="cursor-pointer"
                        accept="image/*,application/pdf,.doc,.docx,.txt"
                      />
                      {uploading && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">
                      Upload an image, PDF, or document file (max size: 10MB)
                      {!studentId && " - Note: File upload requires a student account linked to your profile"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate" title={uploadedFileName || getFileNameFromUrl(formData.file_url)}>
                          {uploadedFileName || getFileNameFromUrl(formData.file_url)}
                        </span>
                      </div>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleRemoveFile}
                        disabled={uploading || submitting}
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                    {isImageFile(formData.file_url) && (
                      <div className="mt-2">
                        <img
                          src={formData.file_url}
                          alt="Preview"
                          className="max-w-full max-h-64 rounded-md border"
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
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
                  disabled={submitting}
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
                  disabled={submitting}
                />
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="occurred_on">Occurred On</Label>
              <Input
                id="occurred_on"
                type="date"
                value={formData.occurred_on}
                onChange={(e) =>
                  setFormData({ ...formData, occurred_on: e.target.value })
                }
                disabled={submitting}
              />
              <p className="text-xs text-muted-foreground">
                Date when this artifact/evidence occurred (not when uploaded)
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="evidence_type">Evidence Type</Label>
              <Input
                id="evidence_type"
                value={formData.evidence_type}
                onChange={(e) =>
                  setFormData({ ...formData, evidence_type: e.target.value })
                }
                placeholder="e.g., observation, assessment, reflection, project"
                disabled={submitting}
              />
            </div>

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
                disabled={submitting || uploading}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={submitting || uploading}>
                {submitting ? "Creating..." : "Create Artifact"}
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
