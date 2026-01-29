"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, Loader2, Upload, X } from "lucide-react";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  getMyArtifact,
  updateArtifact,
  submitArtifact,
  getMyExperiences,
  getMyStudentRow,
  type PortfolioArtifact,
  type Experience,
} from "@/lib/student/student-data";
import { uploadPortfolioFile, isImageFile, getFileNameFromUrl } from "@/lib/student/file-upload";

export default function EditArtifactPage() {
  const router = useRouter();
  const params = useParams();
  const artifactId = params.id as string;

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [artifact, setArtifact] = useState<PortfolioArtifact | null>(null);
  const [showSubmitDialog, setShowSubmitDialog] = useState(false);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [artifactType, setArtifactType] = useState<"upload" | "link" | "text">("text");
  const [fileUrl, setFileUrl] = useState("");
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [uploadedFileName, setUploadedFileName] = useState<string>("");
  const [textContent, setTextContent] = useState("");
  const [visibility, setVisibility] = useState<"internal" | "private" | "shared">("internal");
  const [studentId, setStudentId] = useState<string | null>(null);

  const [experiences, setExperiences] = useState<Experience[]>([]);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [artifactData, expData, student] = await Promise.all([
          getMyArtifact(artifactId),
          getMyExperiences(),
          getMyStudentRow(),
        ]);

        if (!artifactData) {
          setError("Artifact not found");
          setLoading(false);
          return;
        }

        if (artifactData.status !== "draft") {
          setError("Only draft artifacts can be edited");
          setLoading(false);
          return;
        }

        if (student) {
          setStudentId(student.id);
        }

        setArtifact(artifactData);
        setTitle(artifactData.title);
        setDescription(artifactData.description || "");
        setArtifactType(artifactData.artifact_type);
        setFileUrl(artifactData.file_url || "");
        if (artifactData.file_url) {
          setUploadedFileName(getFileNameFromUrl(artifactData.file_url));
        }
        setTextContent(artifactData.text_content || "");
        setVisibility(artifactData.visibility);
        setExperiences(expData);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load artifact");
      } finally {
        setLoading(false);
      }
    };

    if (artifactId) {
      fetchData();
    }
  }, [artifactId]);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!studentId) {
      setError("Student information not loaded. Please refresh the page.");
      return;
    }

    setSelectedFile(file);
    setUploading(true);
    setError(null);

    try {
      const result = await uploadPortfolioFile(file, studentId, artifactId);
      if (result.error) {
        setError(result.error);
        setSelectedFile(null);
        return;
      }

      setFileUrl(result.url);
      setUploadedFileName(file.name);
    } catch (err: any) {
      console.error("Error uploading file:", err);
      setError(err.message || "Failed to upload file");
      setSelectedFile(null);
    } finally {
      setUploading(false);
    }
  };

  const handleRemoveFile = () => {
    setSelectedFile(null);
    setFileUrl("");
    setUploadedFileName("");
  };

  const handleSaveDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!title.trim()) {
      setError("Title is required");
      return;
    }

    // Validate based on artifact type
    if (artifactType === "upload" && !fileUrl.trim() && !selectedFile) {
      setError("Please upload a file or wait for upload to complete");
      return;
    }
    if (artifactType === "link" && !fileUrl.trim()) {
      setError("Link URL is required for link type");
      return;
    }
    if (artifactType === "text" && !textContent.trim()) {
      setError("Text content is required for text type");
      return;
    }

    setSubmitting(true);

    try {
      await updateArtifact(artifactId, {
        title: title.trim(),
        description: description.trim() || null,
        artifact_type: artifactType,
        file_url: artifactType === "upload" || artifactType === "link" ? fileUrl.trim() || null : null,
        text_content: artifactType === "text" ? textContent.trim() || null : null,
        visibility,
      });

      router.push(`/student/my-portfolio/${artifactId}`);
    } catch (err: any) {
      console.error("Error updating artifact:", err);
      setError(err.message || "Failed to update artifact");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError(null);

    try {
      await submitArtifact(artifactId);
      setShowSubmitDialog(false);
      router.push(`/student/my-portfolio/${artifactId}`);
    } catch (err: any) {
      console.error("Error submitting artifact:", err);
      setError(err.message || "Failed to submit artifact");
    } finally {
      setSubmitting(false);
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href={`/student/my-portfolio/${artifactId}`}>
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
        </Link>
        <div>
          <h1 className="text-3xl font-bold">Edit Artifact</h1>
          <p className="text-muted-foreground mt-2">
            Update your learning evidence
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Artifact Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSaveDraft} className="space-y-6">
            {error && (
              <div className="bg-destructive/10 text-destructive p-3 rounded-md text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Enter artifact title"
                required
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="description">Description / Reflection</Label>
              <Textarea
                id="description"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Describe your learning evidence or reflection..."
                rows={4}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="artifactType">Artifact Type *</Label>
              <Select
                value={artifactType}
                onValueChange={(value) => {
                  setArtifactType(value as "upload" | "link" | "text");
                  if (value === "text") {
                    setFileUrl("");
                    setSelectedFile(null);
                    setUploadedFileName("");
                  } else {
                    setTextContent("");
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="text">Text</SelectItem>
                  <SelectItem value="link">External Link</SelectItem>
                  <SelectItem value="upload">File Upload</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {artifactType === "text" && (
              <div className="space-y-2">
                <Label htmlFor="textContent">Text Content *</Label>
                <Textarea
                  id="textContent"
                  value={textContent}
                  onChange={(e) => setTextContent(e.target.value)}
                  placeholder="Enter your text content..."
                  rows={6}
                  required
                />
              </div>
            )}

            {artifactType === "upload" && (
              <div className="space-y-2">
                <Label htmlFor="fileUpload">Upload File *</Label>
                {!fileUrl ? (
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
                    </p>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center justify-between p-3 border rounded-md bg-muted/50">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Upload className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                        <span className="text-sm truncate" title={uploadedFileName || getFileNameFromUrl(fileUrl)}>
                          {uploadedFileName || getFileNameFromUrl(fileUrl)}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          id="fileUpload"
                          type="file"
                          onChange={handleFileSelect}
                          disabled={uploading || submitting}
                          className="cursor-pointer w-auto"
                          accept="image/*,application/pdf,.doc,.docx,.txt"
                        />
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
                    </div>
                    {isImageFile(fileUrl) && (
                      <div className="mt-2">
                        <img
                          src={fileUrl}
                          alt="Preview"
                          className="max-w-full max-h-64 rounded-md border"
                          onError={(e) => {
                            // Hide image if it fails to load
                            (e.target as HTMLImageElement).style.display = "none";
                          }}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {artifactType === "link" && (
              <div className="space-y-2">
                <Label htmlFor="fileUrl">Link URL *</Label>
                <Input
                  id="fileUrl"
                  type="url"
                  value={fileUrl}
                  onChange={(e) => setFileUrl(e.target.value)}
                  placeholder="https://..."
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Provide a link to external content
                </p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={visibility}
                onValueChange={(value) => setVisibility(value as "internal" | "private" | "shared")}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="private">Private (Only me)</SelectItem>
                  <SelectItem value="internal">Internal (Me + Teachers)</SelectItem>
                  <SelectItem value="shared">Shared (Me + Teachers + Admin)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="flex gap-4">
              <Button
                type="submit"
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Saving...
                  </>
                ) : (
                  "Save Draft"
                )}
              </Button>
              <Button
                type="button"
                onClick={handleSubmit}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Submitting...
                  </>
                ) : (
                  "Submit Evidence"
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/student/my-portfolio/${artifactId}`)}
                disabled={submitting}
              >
                Cancel
              </Button>
            </div>
          </form>
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
    </div>
  );
}
