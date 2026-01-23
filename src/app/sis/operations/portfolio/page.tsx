"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Plus, Edit, Archive, Search, X, Tag, Link as LinkIcon, FileText, Upload } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import {
  listPortfolioItems,
  createPortfolioItem,
  updatePortfolioItem,
  deletePortfolioItem,
  listPortfolioArtifactTags,
  addArtifactTag,
  removeArtifactTag,
  type PortfolioArtifact,
  type PortfolioArtifactTag,
  type CreateMyPortfolioArtifactPayload,
  type UpdateMyPortfolioArtifactPayload,
  type PortfolioArtifactAttachment,
} from "@/lib/phase6/portfolio";
import { normalizeRole } from "@/lib/rbac";
import { ToastContainer, type Toast } from "@/components/ui/toast";

export default function PortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [artifacts, setArtifacts] = useState<PortfolioArtifact[]>([]);
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<"principal" | "admin" | "teacher" | null>(null);
  const [originalRole, setOriginalRole] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    artifact_type: searchParams.get("type") || "",
    visibility: searchParams.get("visibility") || "",
    search: searchParams.get("search") || "",
  });

  // Selected student (for admin/teacher view) - read from URL
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [students, setStudents] = useState<
    Array<{ id: string; first_name: string | null; last_name: string | null; student_number: string | null; admission_id?: string | null }>
  >([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingArtifact, setEditingArtifact] = useState<PortfolioArtifact | null>(null);
  const [formData, setFormData] = useState<Partial<CreateMyPortfolioArtifactPayload> & {
    occurred_on?: string;
    evidence_type?: string;
    attachments?: PortfolioArtifactAttachment[];
  }>({
    artifact_type: "text",
    title: "",
    description: "",
    file_url: "",
    text_content: "",
    visibility: "internal",
    occurred_on: "",
    evidence_type: "",
    attachments: [],
  });
  const [saving, setSaving] = useState(false);

  // Tagging dialog
  const [tagDialogOpen, setTagDialogOpen] = useState(false);
  const [selectedArtifact, setSelectedArtifact] = useState<PortfolioArtifact | null>(null);
  const [artifactTags, setArtifactTags] = useState<PortfolioArtifactTag[]>([]);
  const [loadingTags, setLoadingTags] = useState(false);
  const [newTagType, setNewTagType] = useState<"competency" | "domain" | "experience">("competency");
  const [newTagId, setNewTagId] = useState("");
  const [competencies, setCompetencies] = useState<Array<{ id: string; name: string }>>([]);
  const [domains, setDomains] = useState<Array<{ id: string; name: string }>>([]);
  const [experiences, setExperiences] = useState<Array<{ id: string; name: string }>>([]);

  // Toast notifications
  const [toasts, setToasts] = useState<Toast[]>([]);

  // Confirmation dialog state
  const [isRemoveTagDialogOpen, setIsRemoveTagDialogOpen] = useState(false);
  const [tagToRemove, setTagToRemove] = useState<string | null>(null);
  const [isRemovingTag, setIsRemovingTag] = useState(false);

  const showToast = (message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };

  // Fetch user role
  useEffect(() => {
    const fetchRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile, error } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (error) {
          console.error("Error fetching role:", error);
        }
        if (profile?.role) {
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          setOriginalRole(profile.role);
          console.log("Role fetched:", { original: profile.role, normalized: normalizedRole });
        } else {
          console.warn("No role found in profile");
        }
      }
    };
    fetchRole();
  }, []);

  // Fetch students (for admin/teacher) - allow teachers too
  useEffect(() => {
    const fetchStudents = async () => {
      if (orgLoading || !organizationId) return;
      if (role !== "admin" && role !== "principal" && role !== "teacher") return;
      
      let query = supabase
        .from("students")
        .select("id, first_name, last_name, student_number, admission_id")
        .eq("organization_id", organizationId)
        .order("first_name");
      
      const { data } = await query;
      setStudents(
        (data || []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          student_number: string | null;
          admission_id?: string | null;
        }>
      );
    };
    if (!orgLoading && organizationId) {
      fetchStudents();
    }
  }, [organizationId, orgLoading, role]);

  // Sync selectedStudentId with URL - this ensures URL changes update state
  useEffect(() => {
    const studentParam = searchParams.get("student");
    if (studentParam !== selectedStudentId) {
      setSelectedStudentId(studentParam);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  // Update URL when student is selected
  const handleStudentSelect = (studentId: string | null) => {
    console.log("handleStudentSelect called with:", studentId);
    setSelectedStudentId(studentId);
    // Clear search when selecting
    if (studentId) {
      setStudentSearch("");
    }
    const params = new URLSearchParams();
    // Preserve existing filters
    if (filters.artifact_type) params.set("type", filters.artifact_type);
    if (filters.visibility) params.set("visibility", filters.visibility);
    if (filters.search) params.set("search", filters.search);
    // Set or remove student param
    if (studentId) {
      params.set("student", studentId);
    }
    router.replace(`/sis/operations/portfolio?${params.toString()}`, { scroll: false });
  };

  // Fetch artifacts - only if student is selected
  useEffect(() => {
    const fetchArtifacts = async () => {
      if (orgLoading || !organizationId || !selectedStudentId) {
        setArtifacts([]);
        setLoading(false);
        return;
      }
      setLoading(true);
      try {
        const data = await listPortfolioItems({
          scope: "student",
          studentId: selectedStudentId,
          filters: {
            artifact_type: filters.artifact_type || undefined,
            visibility: filters.visibility || undefined,
            search: filters.search || undefined,
          },
        });
        setArtifacts(data);
      } catch (error: any) {
        console.error("Error fetching artifacts:", error);
        setArtifacts([]);
      } finally {
        setLoading(false);
      }
    };
    if (!orgLoading && organizationId) {
      fetchArtifacts();
    }
  }, [organizationId, orgLoading, filters, selectedStudentId]);

  // Update URL when filters change (preserve student param)
  useEffect(() => {
    const params = new URLSearchParams();
    if (selectedStudentId) params.set("student", selectedStudentId);
    if (filters.artifact_type) params.set("type", filters.artifact_type);
    if (filters.visibility) params.set("visibility", filters.visibility);
    if (filters.search) params.set("search", filters.search);
    router.replace(`/sis/operations/portfolio?${params.toString()}`, { scroll: false });
  }, [filters, router, selectedStudentId]);

  const canManage = role === "admin" || role === "principal" || role === "teacher";
  
  // Debug: Log role and selectedStudentId to help troubleshoot
  useEffect(() => {
    if (selectedStudentId) {
      console.log("Operations Portfolio Debug:", { 
        role, 
        selectedStudentId, 
        canManage, 
        organizationId,
        roleLoaded: role !== null 
      });
    }
  }, [role, selectedStudentId, canManage, organizationId]);

  // If we have selectedStudentId but student not in array, fetch it
  // MUST be before any early returns
  const selectedStudent = students.find((s) => s.id === selectedStudentId);
  useEffect(() => {
    const fetchSelectedStudent = async () => {
      if (selectedStudentId && !selectedStudent && organizationId) {
        const { data } = await supabase
          .from("students")
          .select("id, first_name, last_name, student_number, admission_id")
          .eq("id", selectedStudentId)
          .eq("organization_id", organizationId)
          .single();
        
        if (data && !students.find(s => s.id === data.id)) {
          setStudents(prev => [...prev, data]);
        }
      }
    };
    if (!orgLoading && organizationId && selectedStudentId) {
      fetchSelectedStudent();
    }
  }, [selectedStudentId, selectedStudent, organizationId, orgLoading, students]);

  const handleOpenDialog = (artifact?: PortfolioArtifact) => {
    if (artifact) {
      setEditingArtifact(artifact);
      setFormData({
        artifact_type: artifact.artifact_type,
        title: artifact.title,
        description: artifact.description || "",
        file_url: artifact.file_url || "",
        text_content: artifact.text_content || "",
        visibility: artifact.visibility,
        occurred_on: artifact.occurred_on || "",
        evidence_type: artifact.evidence_type || "",
        attachments: artifact.attachments || [],
      });
    } else {
      setEditingArtifact(null);
      setFormData({
        artifact_type: "text",
        title: "",
        description: "",
        file_url: "",
        text_content: "",
        visibility: "internal",
        occurred_on: "",
        evidence_type: "",
        attachments: [],
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingArtifact(null);
    setFormData({
      artifact_type: "text",
      title: "",
      description: "",
      file_url: "",
      text_content: "",
      visibility: "internal",
      occurred_on: "",
      evidence_type: "",
      attachments: [],
    });
  };

  const handleSave = async () => {
    if (!organizationId || !formData.title || !selectedStudentId) return;
    setSaving(true);
    try {
      if (editingArtifact) {
        const payload: UpdateMyPortfolioArtifactPayload = {
          title: formData.title,
          description: formData.description || null,
          file_url: formData.file_url || null,
          text_content: formData.text_content || null,
          visibility: formData.visibility || "internal",
          occurred_on: formData.occurred_on || null,
          evidence_type: formData.evidence_type || null,
          attachments: formData.attachments && formData.attachments.length > 0 ? formData.attachments : null,
        };
        await updatePortfolioItem({
          scope: "student",
          studentId: selectedStudentId,
          itemId: editingArtifact.id,
          patch: payload,
        });
      } else {
        const payload: CreateMyPortfolioArtifactPayload = {
          organization_id: organizationId,
          artifact_type: formData.artifact_type!,
          title: formData.title!,
          description: formData.description || null,
          file_url: formData.file_url || null,
          text_content: formData.text_content || null,
          visibility: formData.visibility || "internal",
          occurred_on: formData.occurred_on || null,
          evidence_type: formData.evidence_type || null,
          attachments: formData.attachments && formData.attachments.length > 0 ? formData.attachments : null,
        };
        await createPortfolioItem({
          scope: "student",
          studentId: selectedStudentId,
          payload,
        });
      }
      handleCloseDialog();
      // Refetch artifacts
      const data = await listPortfolioItems({
        scope: "student",
        studentId: selectedStudentId,
        filters: {
          artifact_type: filters.artifact_type || undefined,
          visibility: filters.visibility || undefined,
          search: filters.search || undefined,
        },
      });
      setArtifacts(data);
      showToast(editingArtifact ? "Artifact updated successfully" : "Artifact created successfully", "success");
    } catch (error: any) {
      console.error("Error saving artifact:", error);
      showToast(error.message || "Failed to save artifact", "error");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (artifact: PortfolioArtifact) => {
    if (!selectedStudentId || !confirm(`Are you sure you want to archive "${artifact.title}"?`)) return;
    try {
      await deletePortfolioItem({
        scope: "student",
        studentId: selectedStudentId,
        itemId: artifact.id,
      });
      // Refetch artifacts
      const data = await listPortfolioItems({
        scope: "student",
        studentId: selectedStudentId,
        filters: {
          artifact_type: filters.artifact_type || undefined,
          visibility: filters.visibility || undefined,
          search: filters.search || undefined,
        },
      });
      setArtifacts(data);
      showToast("Artifact archived successfully", "success");
    } catch (error: any) {
      console.error("Error archiving artifact:", error);
      showToast(error.message || "Failed to archive artifact", "error");
    }
  };

  const handleOpenTagDialog = async (artifact: PortfolioArtifact) => {
    setSelectedArtifact(artifact);
    setTagDialogOpen(true);
    setLoadingTags(true);
    try {
      const tags = await listPortfolioArtifactTags(artifact.id);
      setArtifactTags(tags);
      // Fetch options for tagging
      if (organizationId) {
        const [competenciesData, domainsData, experiencesData] = await Promise.all([
          supabase.from("competencies").select("id, name").eq("organization_id", organizationId).limit(100),
          supabase.from("domains").select("id, name").eq("organization_id", organizationId).limit(100),
          supabase.from("experiences").select("id, name").eq("organization_id", organizationId).limit(100),
        ]);
        setCompetencies((competenciesData.data || []) as Array<{ id: string; name: string }>);
        setDomains((domainsData.data || []) as Array<{ id: string; name: string }>);
        setExperiences((experiencesData.data || []) as Array<{ id: string; name: string }>);
      }
    } catch (error: any) {
      console.error("Error loading tags:", error);
    } finally {
      setLoadingTags(false);
    }
  };

  const handleAddTag = async () => {
    if (!selectedArtifact || !newTagId) return;
    try {
      await addArtifactTag(selectedArtifact.id, {
        tag_type: newTagType,
        competency_id: newTagType === "competency" ? newTagId : null,
        domain_id: newTagType === "domain" ? newTagId : null,
        experience_id: newTagType === "experience" ? newTagId : null,
      });
      // Refetch tags
      const tags = await listPortfolioArtifactTags(selectedArtifact.id);
      setArtifactTags(tags);
      setNewTagId("");
      showToast("Tag added successfully", "success");
    } catch (error: any) {
      console.error("Error adding tag:", error);
      showToast(error.message || "Failed to add tag", "error");
    }
  };

  const handleRemoveTagClick = (tagId: string) => {
    setTagToRemove(tagId);
    setIsRemoveTagDialogOpen(true);
  };

  const handleRemoveTagConfirm = async () => {
    if (!tagToRemove) return;
    setIsRemovingTag(true);
    try {
      await removeArtifactTag(tagToRemove);
      // Refetch tags
      if (selectedArtifact) {
        const tags = await listPortfolioArtifactTags(selectedArtifact.id);
        setArtifactTags(tags);
      }
      setIsRemoveTagDialogOpen(false);
      setTagToRemove(null);
      showToast("Tag removed successfully", "success");
    } catch (error: any) {
      console.error("Error removing tag:", error);
      showToast(error.message || "Failed to remove tag", "error");
      setIsRemoveTagDialogOpen(false);
      setTagToRemove(null);
    } finally {
      setIsRemovingTag(false);
    }
  };

  const getArtifactTypeIcon = (type: string) => {
    switch (type) {
      case "upload":
        return <Upload className="h-4 w-4" />;
      case "link":
        return <LinkIcon className="h-4 w-4" />;
      case "text":
        return <FileText className="h-4 w-4" />;
      default:
        return null;
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Portfolio</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Filter students by search (exclude selected student from search results)
  const filteredStudents = students.filter((student) => {
    // Don't show selected student in search results
    if (selectedStudentId && student.id === selectedStudentId) {
      return false;
    }
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.toLowerCase();
    const studentNumber = student.student_number?.toLowerCase() || "";
    const admissionId = student.admission_id?.toLowerCase() || "";
    const search = studentSearch.toLowerCase();
    return (
      fullName.includes(search) ||
      studentNumber.includes(search) ||
      admissionId.includes(search)
    );
  });


  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Operations Portfolio</h1>
        {selectedStudentId && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Artifact
          </Button>
        )}
      </div>

      {/* Student Picker */}
      <Card>
        <CardHeader>
          <CardTitle>Select Student</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-2">
            <Label>Search Students</Label>
            <div className="relative">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by name, student number, or admission ID..."
                value={studentSearch}
                onChange={(e) => setStudentSearch(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>
          {selectedStudentId && (
            <div className="flex items-center justify-between p-3 bg-muted rounded-md">
              <div>
                {selectedStudent ? (
                  <>
                    <p className="font-medium">
                      {selectedStudent.first_name} {selectedStudent.last_name}
                    </p>
                    {selectedStudent.student_number && (
                      <p className="text-sm text-muted-foreground">
                        Student #: {selectedStudent.student_number}
                      </p>
                    )}
                  </>
                ) : (
                  <p className="font-medium">Student ID: {selectedStudentId}</p>
                )}
              </div>
              <Button variant="outline" size="sm" onClick={() => handleStudentSelect(null)}>
                Clear
              </Button>
            </div>
          )}
          {!selectedStudentId && filteredStudents.length > 0 && (
            <div className="max-h-60 overflow-y-auto border rounded-md">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                  onClick={() => handleStudentSelect(student.id)}
                >
                  <p className="font-medium">
                    {student.first_name} {student.last_name}
                  </p>
                  {student.student_number && (
                    <p className="text-sm text-muted-foreground">
                      Student #: {student.student_number}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
          {!selectedStudentId && filteredStudents.length === 0 && studentSearch && (
            <p className="text-sm text-muted-foreground text-center py-4">
              No students found matching "{studentSearch}"
            </p>
          )}
          {!selectedStudentId && filteredStudents.length === 0 && !studentSearch && (
            <p className="text-sm text-muted-foreground text-center py-4">
              Start typing to search for students
            </p>
          )}
        </CardContent>
      </Card>

      {/* Empty state if no student selected */}
      {!selectedStudentId && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              Please select a student above to view and manage their portfolio items.
            </p>
          </CardContent>
        </Card>
      )}

      {/* Show selected student info when student is selected */}
      {selectedStudentId && (
        <Card>
          <CardContent className="py-4">
            <p className="text-sm text-muted-foreground">
              Viewing portfolio for: <span className="font-medium">
                {selectedStudent 
                  ? `${selectedStudent.first_name} ${selectedStudent.last_name}`
                  : `Student ID: ${selectedStudentId}`
                }
              </span>
            </p>
          </CardContent>
        </Card>
      )}

      {/* Filters - only show if student is selected */}
      {selectedStudentId && (
        <Card>
          <CardHeader>
            <CardTitle>Filters</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>Type</Label>
              <Select
                value={filters.artifact_type || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, artifact_type: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All types" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="upload">Upload</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Visibility</Label>
              <Select
                value={filters.visibility || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, visibility: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All visibility" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All visibility</SelectItem>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search artifacts..."
                  value={filters.search}
                  onChange={(e) =>
                    setFilters({ ...filters, search: e.target.value })
                  }
                  className="pl-8"
                />
                {filters.search && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="absolute right-1 top-1 h-7 w-7 p-0"
                    onClick={() => setFilters({ ...filters, search: "" })}
                  >
                    <X className="h-4 w-4" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </CardContent>
        </Card>
      )}

      {/* Artifacts List */}
      {selectedStudentId && loading && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">Loading portfolio artifacts...</p>
          </CardContent>
        </Card>
      )}
      {selectedStudentId && !loading && artifacts.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No portfolio artifacts found for this student.{" "}
              {canManage && "Create your first artifact to get started."}
            </p>
          </CardContent>
        </Card>
      )}
      {selectedStudentId && !loading && artifacts.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {artifacts.map((artifact) => (
            <Card key={artifact.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-2">
                    {getArtifactTypeIcon(artifact.artifact_type)}
                    <CardTitle className="text-lg">{artifact.title}</CardTitle>
                  </div>
                  <Badge variant="outline">{artifact.artifact_type}</Badge>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {artifact.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2">
                    {artifact.description}
                  </p>
                )}
                {artifact.student && (
                  <p className="text-sm">
                    <span className="font-medium">Student:</span>{" "}
                    {artifact.student.first_name} {artifact.student.last_name}
                  </p>
                )}
                <div className="flex items-center gap-2">
                  <Badge variant="secondary">{artifact.visibility}</Badge>
                  {canManage && (
                    <div className="flex gap-1 ml-auto">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenTagDialog(artifact)}
                      >
                        <Tag className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleOpenDialog(artifact)}
                      >
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleArchive(artifact)}
                      >
                        <Archive className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingArtifact ? "Edit Artifact" : "Create Artifact"}
            </DialogTitle>
            <DialogDescription>
              {editingArtifact
                ? "Update artifact information"
                : "Create a new portfolio artifact"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="artifact_type">Type *</Label>
              <Select
                value={formData.artifact_type || "text"}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, artifact_type: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="upload">Upload</SelectItem>
                  <SelectItem value="link">Link</SelectItem>
                  <SelectItem value="text">Text</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="title">Title *</Label>
              <Input
                id="title"
                value={formData.title || ""}
                onChange={(e) =>
                  setFormData({ ...formData, title: e.target.value })
                }
                placeholder="Artifact title"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Description..."
                rows={3}
              />
            </div>
            {formData.artifact_type === "upload" && (
              <div className="space-y-2">
                <Label htmlFor="file_url">File URL</Label>
                <Input
                  id="file_url"
                  value={formData.file_url || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, file_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
            )}
            {formData.artifact_type === "link" && (
              <div className="space-y-2">
                <Label htmlFor="file_url">Link URL</Label>
                <Input
                  id="file_url"
                  value={formData.file_url || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, file_url: e.target.value })
                  }
                  placeholder="https://..."
                />
              </div>
            )}
            {formData.artifact_type === "text" && (
              <div className="space-y-2">
                <Label htmlFor="text_content">Content</Label>
                <Textarea
                  id="text_content"
                  value={formData.text_content || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, text_content: e.target.value })
                  }
                  placeholder="Text content..."
                  rows={5}
                />
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="occurred_on">Occurred On</Label>
              <Input
                id="occurred_on"
                type="date"
                value={formData.occurred_on || ""}
                onChange={(e) =>
                  setFormData({ ...formData, occurred_on: e.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="evidence_type">Evidence Type</Label>
              <Input
                id="evidence_type"
                value={formData.evidence_type || ""}
                onChange={(e) =>
                  setFormData({ ...formData, evidence_type: e.target.value })
                }
                placeholder="e.g., observation, assessment, reflection, project"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="visibility">Visibility</Label>
              <Select
                value={formData.visibility || "internal"}
                onValueChange={(value: any) =>
                  setFormData({ ...formData, visibility: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="internal">Internal</SelectItem>
                  <SelectItem value="private">Private</SelectItem>
                  <SelectItem value="shared">Shared</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.title}>
                {saving ? "Saving..." : editingArtifact ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Tagging Dialog */}
      <Dialog open={tagDialogOpen} onOpenChange={setTagDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Manage Tags - {selectedArtifact?.title}</DialogTitle>
            <DialogDescription>
              Tag this artifact with competencies, domains, or experiences
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {/* Current Tags */}
            <div>
              <h3 className="font-medium mb-2">Current Tags</h3>
              {loadingTags ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : artifactTags.length === 0 ? (
                <div className="text-sm text-muted-foreground">No tags</div>
              ) : (
                <div className="space-y-2">
                  {artifactTags.map((tag) => (
                    <div
                      key={tag.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div>
                        <Badge variant="outline" className="mr-2">
                          {tag.tag_type}
                        </Badge>
                        <span>
                          {tag.competency?.name ||
                            tag.domain?.name ||
                            tag.experience?.name ||
                            "Unknown"}
                        </span>
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveTagClick(tag.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Tag */}
            {canManage && (
              <div>
                <h3 className="font-medium mb-2">Add Tag</h3>
                <div className="flex gap-2">
                  <Select
                    value={newTagType}
                    onValueChange={(value: any) => {
                      setNewTagType(value);
                      setNewTagId("");
                    }}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="competency">Competency</SelectItem>
                      <SelectItem value="domain">Domain</SelectItem>
                      <SelectItem value="experience">Experience</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select value={newTagId} onValueChange={setNewTagId}>
                    <SelectTrigger className="flex-1">
                      <SelectValue placeholder={`Select ${newTagType}`} />
                    </SelectTrigger>
                    <SelectContent>
                      {newTagType === "competency" &&
                        competencies.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id}>
                            {comp.name}
                          </SelectItem>
                        ))}
                      {newTagType === "domain" &&
                        domains.map((domain) => (
                          <SelectItem key={domain.id} value={domain.id}>
                            {domain.name}
                          </SelectItem>
                        ))}
                      {newTagType === "experience" &&
                        experiences.map((exp) => (
                          <SelectItem key={exp.id} value={exp.id}>
                            {exp.name}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button onClick={handleAddTag} disabled={!newTagId}>
                    Add
                  </Button>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Remove Tag Confirmation Dialog */}
      <ConfirmDialog
        open={isRemoveTagDialogOpen}
        onOpenChange={(open) => {
          setIsRemoveTagDialogOpen(open);
          if (!open) {
            setTagToRemove(null);
          }
        }}
        title="Remove Tag"
        description="Are you sure you want to remove this tag? This action cannot be undone."
        confirmText="Remove"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleRemoveTagConfirm}
        isLoading={isRemovingTag}
      />

      {/* Toast Notifications */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
