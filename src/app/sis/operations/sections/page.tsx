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
  DialogFooter,
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
import { Plus, Edit, Archive, Search, X, Users } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  listSections,
  createSection,
  updateSection,
  archiveSection,
  listSectionStudents,
  addStudentToSection,
  removeStudentFromSection,
  type Section,
  type CreateSectionPayload,
  type UpdateSectionPayload,
  type SectionStudent,
} from "@/lib/phase6/operations";
import { normalizeRole } from "@/lib/rbac";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { AlertDialog } from "@/components/ui/alert-dialog";

export default function SectionsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [sections, setSections] = useState<Section[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("admin");
  const [originalRole, setOriginalRole] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    batch_id: searchParams.get("batch") || "",
    program_id: searchParams.get("program") || "",
    status: searchParams.get("status") || "",
    search: searchParams.get("search") || "",
  });

  // Options for filters
  const [batches, setBatches] = useState<Array<{ id: string; name: string }>>([]);
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [formData, setFormData] = useState<Partial<CreateSectionPayload>>({
    code: "",
    name: "",
    capacity: null,
    status: "active",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [archiveError, setArchiveError] = useState<string | null>(null);
  const [archivingId, setArchivingId] = useState<string | null>(null);
  
  // Confirmation dialog state
  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    variant?: "default" | "destructive";
    onConfirm: () => Promise<void>;
    isLoading?: boolean;
  }>({
    open: false,
    title: "",
    description: "",
    variant: "destructive",
    onConfirm: async () => {},
    isLoading: false,
  });

  // Error alert dialog state
  const [errorDialog, setErrorDialog] = useState<{
    open: boolean;
    title: string;
    message: string;
  }>({
    open: false,
    title: "",
    message: "",
  });

  // Student management dialog
  const [studentDialogOpen, setStudentDialogOpen] = useState(false);
  const [selectedSection, setSelectedSection] = useState<Section | null>(null);
  const [sectionStudents, setSectionStudents] = useState<SectionStudent[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [availableStudents, setAvailableStudents] = useState<
    Array<{ id: string; first_name: string | null; last_name: string | null; student_number: string | null }>
  >([]);
  const [studentSearch, setStudentSearch] = useState("");

  // Fetch user role
  useEffect(() => {
    const fetchRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
          setOriginalRole(profile.role);
        }
      }
    };
    fetchRole();
  }, []);

  // Fetch batches and programs
  useEffect(() => {
    const fetchOptions = async () => {
      if (orgLoading) return;
      let batchesQuery = supabase.from("batches").select("id, name").order("name");
      let programsQuery = supabase.from("programs").select("id, name").order("name");
      if (!isSuperAdmin && organizationId) {
        batchesQuery = batchesQuery.eq("organization_id", organizationId);
        programsQuery = programsQuery.eq("organization_id", organizationId);
      }
      const [batchesData, programsData] = await Promise.all([
        batchesQuery,
        programsQuery,
      ]);
      setBatches((batchesData.data || []) as Array<{ id: string; name: string }>);
      setPrograms((programsData.data || []) as Array<{ id: string; name: string }>);
    };
    if (!orgLoading) {
      fetchOptions();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Fetch sections
  useEffect(() => {
    const fetchSections = async () => {
      if (orgLoading || !organizationId) return;
      setLoading(true);
      try {
        const data = await listSections({
          batch_id: filters.batch_id || undefined,
          program_id: filters.program_id || undefined,
          status: filters.status || undefined,
          search: filters.search || undefined,
        });
        setSections(data);
      } catch (error: any) {
        console.error("Error fetching sections:", error);
      } finally {
        setLoading(false);
      }
    };
    if (!orgLoading && organizationId) {
      fetchSections();
    }
  }, [organizationId, orgLoading, filters]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.batch_id) params.set("batch", filters.batch_id);
    if (filters.program_id) params.set("program", filters.program_id);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);
    router.replace(`/sis/operations/sections?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  const canManage = role === "admin" || role === "principal" || originalRole === "registrar";

  const handleOpenDialog = (section?: Section) => {
    if (section) {
      setEditingSection(section);
      setFormData({
        code: section.code,
        name: section.name,
        capacity: section.capacity,
        status: section.status || "active",
        batch_id: section.batch_id || undefined,
        program_id: section.program_id || filters.program_id || undefined,
      });
    } else {
      setEditingSection(null);
      setFormData({
        code: "",
        name: "",
        capacity: null,
        status: "active",
        batch_id: filters.batch_id || undefined,
        program_id: filters.program_id || undefined,
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingSection(null);
    setError(null);
    setFormData({
      code: "",
      name: "",
      capacity: null,
      status: "active",
      program_id: undefined,
      batch_id: undefined,
    });
  };

  const handleSave = async () => {
    if (!organizationId || !formData.name || !formData.batch_id || !formData.program_id) {
      setError("Please fill in all required fields (name, program, and batch)");
      return;
    }

    const programId = formData.program_id;

    setSaving(true);
    setError(null);
    try {
      // Get school_id from the program (programs have school_id)
      const { data: programData, error: programError } = await supabase
        .from("programs")
        .select("school_id, organization_id")
        .eq("id", programId)
        .single();

      if (programError) {
        throw new Error(`Failed to fetch program: ${programError.message}`);
      }

      if (!programData) {
        throw new Error("Program data not found");
      }

      const schoolId = programData.school_id;
      if (!schoolId || schoolId === "") {
        throw new Error("Program must have a school_id. Please check the program configuration.");
      }

      if (editingSection) {
        const payload: UpdateSectionPayload = {
          name: formData.name,
          code: formData.code,
          capacity: formData.capacity,
          status: formData.status || null,
          batch_id: formData.batch_id,
        };
        await updateSection(editingSection.id, payload);
      } else {
        const payload: CreateSectionPayload = {
          organization_id: organizationId,
          school_id: schoolId,
          program_id: programId,
          batch_id: formData.batch_id!,
          name: formData.name!,
          code: formData.code || "",
          capacity: formData.capacity,
          status: formData.status || "active",
        };
        await createSection(payload);
      }
      handleCloseDialog();
      // Refetch sections
      const data = await listSections({
        batch_id: filters.batch_id || undefined,
        program_id: filters.program_id || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      setSections(data);
    } catch (error: any) {
      console.error("Error saving section:", error);
      const errorMessage = error.message || "Failed to save section";
      // Provide user-friendly error messages
      if (errorMessage.includes("batch_id") && errorMessage.includes("schema cache")) {
        setError("The batch_id column is not available. Please ensure the database migration has been applied.");
      } else if (errorMessage.includes("invalid input syntax for type uuid")) {
        setError("Invalid data format. Please ensure all required fields are properly filled and the batch has a valid school and program assigned.");
      } else {
        setError(errorMessage);
      }
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (section: Section) => {
    setConfirmDialog({
      open: true,
      title: "Archive Section",
      description: `Are you sure you want to archive "${section.name}"?`,
      variant: "destructive",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        setArchivingId(section.id);
        setArchiveError(null);
        
        try {
          await archiveSection(section.id);
          // Refetch sections to update the list
          const data = await listSections({
            batch_id: filters.batch_id || undefined,
            program_id: filters.program_id || undefined,
            status: filters.status || undefined,
            search: filters.search || undefined,
          });
          setSections(data);
          // Close dialog on success
          setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
          // Show success message
          console.log(`Section "${section.name}" archived successfully`);
        } catch (error: any) {
          console.error("Error archiving section:", error);
          const errorMessage = error.message || "Failed to archive section";
          setArchiveError(errorMessage);
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          // Keep error visible for a few seconds
          setTimeout(() => setArchiveError(null), 5000);
        } finally {
          setArchivingId(null);
        }
      },
    });
  };

  const handleOpenStudentDialog = async (section: Section) => {
    setSelectedSection(section);
    setStudentDialogOpen(true);
    setLoadingStudents(true);
    try {
      const students = await listSectionStudents(section.id);
      setSectionStudents(students);
      // Fetch available students
      let studentsQuery = supabase
        .from("students")
        .select("id, first_name, last_name, student_number")
        .eq("organization_id", organizationId!)
        .order("first_name");
      const { data: available } = await studentsQuery;
      setAvailableStudents(
        (available || []) as Array<{
          id: string;
          first_name: string | null;
          last_name: string | null;
          student_number: string | null;
        }>
      );
    } catch (error: any) {
      console.error("Error loading students:", error);
    } finally {
      setLoadingStudents(false);
    }
  };

  const handleAddStudent = async (studentId: string) => {
    if (!selectedSection || !organizationId) return;
    try {
      // Get school_id from section (sections have school_id)
      await addStudentToSection({
        organization_id: organizationId,
        school_id: selectedSection.school_id,
        section_id: selectedSection.id,
        student_id: studentId,
        start_date: new Date().toISOString().split("T")[0],
        status: "active",
      });
      // Refetch students
      const students = await listSectionStudents(selectedSection.id);
      setSectionStudents(students);
    } catch (error: any) {
      console.error("Error adding student:", error);
      const errorMessage = error.message || "Failed to add student";
      // Check if it's a schema cache error
      if (errorMessage.includes("section_students") && errorMessage.includes("schema cache")) {
        setErrorDialog({
          open: true,
          title: "Database Schema Error",
          message: "The section_students table is not available. Please ensure the database migration has been applied.",
        });
      } else {
        setErrorDialog({
          open: true,
          title: "Error Adding Student",
          message: errorMessage,
        });
      }
    }
  };

  const handleRemoveStudent = async (enrollmentId: string) => {
    // Store the enrollment ID to use after confirmation
    const enrollmentToRemove = enrollmentId;
    
    setConfirmDialog({
      open: true,
      title: "Remove Student",
      description: "Are you sure you want to remove this student from the section?",
      variant: "destructive",
      isLoading: false,
      onConfirm: async () => {
        setConfirmDialog((prev) => ({ ...prev, isLoading: true }));
        try {
          await removeStudentFromSection(enrollmentToRemove);
          // Refetch students
          if (selectedSection) {
            const students = await listSectionStudents(selectedSection.id);
            setSectionStudents(students);
          }
          // Close dialog on success
          setConfirmDialog((prev) => ({ ...prev, open: false, isLoading: false }));
        } catch (error: any) {
          console.error("Error removing student:", error);
          const errorMessage = error.message || "Failed to remove student";
          setArchiveError(errorMessage);
          setConfirmDialog((prev) => ({ ...prev, isLoading: false }));
          // Show error in alert dialog for better visibility
          setErrorDialog({
            open: true,
            title: "Error Removing Student",
            message: errorMessage,
          });
          setTimeout(() => setArchiveError(null), 5000);
        }
      },
    });
  };

  const filteredAvailableStudents = availableStudents.filter((student) => {
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.toLowerCase();
    const studentNumber = student.student_number?.toLowerCase() || "";
    const search = studentSearch.toLowerCase();
    return (
      fullName.includes(search) ||
      studentNumber.includes(search)
    );
  });

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Sections</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sections</h1>
        {canManage && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Section
          </Button>
        )}
      </div>

      {/* Archive Error Display */}
      {archiveError && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {archiveError}
        </div>
      )}

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="space-y-2">
              <Label>Batch</Label>
              <Select
                value={filters.batch_id || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, batch_id: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All batches" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All batches</SelectItem>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Program</Label>
              <Select
                value={filters.program_id || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, program_id: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All programs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={filters.status || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, status: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All statuses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All statuses</SelectItem>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Search</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search sections..."
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

      {/* Sections Table */}
      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No sections found. {canManage && "Create your first section to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Batch</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Capacity</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    {canManage && (
                      <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sections.map((section) => (
                    <tr key={section.id} className="border-b">
                      <td className="px-4 py-3 text-sm">{section.code}</td>
                      <td className="px-4 py-3 text-sm font-medium">{section.name}</td>
                      <td className="px-4 py-3 text-sm">
                        {batches.find((b) => b.id === section.batch_id)?.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {section.capacity || "—"}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            section.is_active && section.status !== "archived"
                              ? "default"
                              : "secondary"
                          }
                        >
                          {section.status || (section.is_active ? "active" : "inactive")}
                        </Badge>
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenStudentDialog(section)}
                            >
                              <Users className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(section)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(section)}
                              disabled={archivingId === section.id}
                              title="Archive section"
                            >
                              {archivingId === section.id ? (
                                <span className="text-xs">Archiving...</span>
                              ) : (
                                <Archive className="h-4 w-4" />
                              )}
                            </Button>
                          </div>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={dialogOpen} 
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) {
            setError(null); // Clear errors when dialog closes
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edit Section" : "Create Section"}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? "Update section information"
                : "Create a new section within a batch"}
            </DialogDescription>
          </DialogHeader>
          {error && (
            <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
              {error}
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="program_id">Program *</Label>
              <Select
                value={formData.program_id || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, program_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a program" />
                </SelectTrigger>
                <SelectContent>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="batch_id">Batch *</Label>
              <Select
                value={formData.batch_id || ""}
                onValueChange={(value) =>
                  setFormData({ ...formData, batch_id: value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select a batch" />
                </SelectTrigger>
                <SelectContent>
                  {batches.map((batch) => (
                    <SelectItem key={batch.id} value={batch.id}>
                      {batch.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code || ""}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="SEC-001"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Section A"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="capacity">Capacity</Label>
              <Input
                id="capacity"
                type="number"
                value={formData.capacity || ""}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    capacity: e.target.value ? parseInt(e.target.value) : null,
                  })
                }
                placeholder="30"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="status">Status</Label>
              <Select
                value={formData.status || "active"}
                onValueChange={(value) =>
                  setFormData({ ...formData, status: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Active</SelectItem>
                  <SelectItem value="archived">Archived</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={saving || !formData.name || !formData.batch_id || !formData.program_id}
            >
              {saving ? "Saving..." : editingSection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Student Management Dialog */}
      <Dialog open={studentDialogOpen} onOpenChange={setStudentDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              Manage Students - {selectedSection?.name}
            </DialogTitle>
            <DialogDescription>
              Add or remove students from this section
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Current Students */}
            <div>
              <h3 className="font-medium mb-2">Current Students ({sectionStudents.length})</h3>
              {loadingStudents ? (
                <div className="text-sm text-muted-foreground">Loading...</div>
              ) : sectionStudents.length === 0 ? (
                <div className="text-sm text-muted-foreground">No students in this section</div>
              ) : (
                <div className="space-y-2">
                  {sectionStudents.map((enrollment) => (
                    <div
                      key={enrollment.id}
                      className="flex items-center justify-between p-2 border rounded"
                    >
                      <div>
                        <span className="font-medium">
                          {enrollment.student?.first_name} {enrollment.student?.last_name}
                        </span>
                        {enrollment.student?.student_number && (
                          <span className="text-sm text-muted-foreground ml-2">
                            ({enrollment.student.student_number})
                          </span>
                        )}
                      </div>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleRemoveStudent(enrollment.id)}
                        >
                          Remove
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Add Students */}
            {canManage && (
              <div>
                <h3 className="font-medium mb-2">Add Students</h3>
                <div className="space-y-2">
                  <Input
                    placeholder="Search students..."
                    value={studentSearch}
                    onChange={(e) => setStudentSearch(e.target.value)}
                  />
                  <div className="max-h-60 overflow-y-auto space-y-1">
                    {filteredAvailableStudents
                      .filter(
                        (student) =>
                          !sectionStudents.some((e) => e.student_id === student.id)
                      )
                      .map((student) => (
                        <div
                          key={student.id}
                          className="flex items-center justify-between p-2 border rounded hover:bg-muted"
                        >
                          <div>
                            <span className="font-medium">
                              {student.first_name} {student.last_name}
                            </span>
                            {student.student_number && (
                              <span className="text-sm text-muted-foreground ml-2">
                                ({student.student_number})
                              </span>
                            )}
                          </div>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleAddStudent(student.id)}
                          >
                            Add
                          </Button>
                        </div>
                      ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog */}
      <ConfirmDialog
        open={confirmDialog.open}
        onOpenChange={(open) => {
          if (!open && !confirmDialog.isLoading) {
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          }
        }}
        title={confirmDialog.title}
        description={confirmDialog.description}
        variant={confirmDialog.variant}
        confirmText="Confirm"
        cancelText="Cancel"
        onConfirm={confirmDialog.onConfirm}
        isLoading={confirmDialog.isLoading}
      />

      {/* Error Alert Dialog */}
      <AlertDialog
        open={errorDialog.open}
        onOpenChange={(open) => setErrorDialog({ ...errorDialog, open })}
        title={errorDialog.title}
        message={errorDialog.message}
        type="error"
        buttonText="OK"
      />
    </div>
  );
}
