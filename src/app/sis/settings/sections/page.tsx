"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Plus, Pencil } from "lucide-react";
import { normalizeRole, canPerform } from "@/lib/rbac";
import { useOrganization } from "@/lib/hooks/use-organization";

interface Section {
  id: string;
  school_id: string;
  program_id: string;
  code: string;
  name: string;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
}

interface School {
  id: string;
  name: string;
}

interface Program {
  id: string;
  school_id: string;
  name: string;
  code: string;
}

export default function SectionsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [sections, setSections] = useState<Section[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null); // Store original role for RBAC differentiation
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    school_id: "",
    program_id: "",
    code: "",
    name: "",
    sort_order: null as number | null,
    is_active: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  // Refresh programs when school changes in form
  useEffect(() => {
    if (!isDialogOpen || !formData.school_id || orgLoading) return;

    const fetchProgramsForSchool = async () => {
      let query = supabase
        .from("programs")
        .select("id, school_id, name, code")
        .eq("school_id", formData.school_id);
      
      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      
      const { data: programsData, error: programsError } = await query.order("name", { ascending: true });

      if (!programsError && programsData) {
        setPrograms(programsData);
      }
    };

    fetchProgramsForSchool();
  }, [formData.school_id, isDialogOpen, organizationId, isSuperAdmin, orgLoading]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return; // Wait for organization context
      
      // Fetch user role
      let userRole: "principal" | "admin" | "teacher" = "principal";
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
          userRole = normalizedRole;
          setRole(normalizedRole);
          setOriginalRole(profile.role); // Store original role for RBAC differentiation
        }
      }

      // Fetch schools for filter - filter by organization_id unless super admin
      let schoolsQuery = supabase
        .from("schools")
        .select("id, name");
      
      if (!isSuperAdmin && organizationId) {
        schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
      }
      
      const { data: schoolsData, error: schoolsError } = await schoolsQuery.order("name", { ascending: true });

      if (schoolsError) {
        console.error("Error fetching schools:", schoolsError);
        setError("Failed to load schools.");
      } else {
        setSchools(schoolsData || []);
        // Set default school_id if admin/registrar (own school only) and not already set
        if (userRole === "admin" && schoolsData && schoolsData.length > 0 && selectedSchoolId === "all") {
          setSelectedSchoolId(schoolsData[0].id);
        }
      }

      // Fetch programs for display and form - filter by organization_id unless super admin
      let programsQuery = supabase
        .from("programs")
        .select("id, school_id, name, code");
      
      if (!isSuperAdmin && organizationId) {
        programsQuery = programsQuery.eq("organization_id", organizationId);
      }
      
      programsQuery = programsQuery.order("name", { ascending: true });

      if (selectedSchoolId !== "all") {
        programsQuery = programsQuery.eq("school_id", selectedSchoolId);
      }

      const { data: programsData, error: programsError } = await programsQuery;

      if (programsError) {
        console.error("Error fetching programs:", programsError);
      } else {
        setPrograms(programsData || []);
      }

      // Fetch sections - filter by organization_id unless super admin
      let query = supabase
        .from("sections")
        .select("id, school_id, program_id, code, name, sort_order, is_active, created_at");
      
      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      
      query = query.order("sort_order", { ascending: true, nullsFirst: false })
        .order("name", { ascending: true });

      // Filter by school if selected
      if (selectedSchoolId !== "all") {
        query = query.eq("school_id", selectedSchoolId);
      }

      const { data, error: fetchError } = await query;

      if (fetchError) {
        const errorMessage = fetchError?.message || fetchError?.toString() || "Unknown error";
        console.error("Error fetching sections:", {
          message: errorMessage,
          code: fetchError?.code,
          details: fetchError?.details,
          hint: fetchError?.hint,
        });
        setError(errorMessage || "Failed to fetch sections. Please check your permissions.");
        setLoading(false);
        return;
      }

      setSections(data || []);
      setError(null);
      setLoading(false);
    };

    if (!orgLoading) {
      fetchData();
    }
  }, [selectedSchoolId, organizationId, isSuperAdmin, orgLoading]);

  const handleCreate = () => {
    setEditingSection(null);
    // Auto-set school_id from filter if a specific school is selected
    const defaultSchoolId = selectedSchoolId !== "all" ? selectedSchoolId : "";
    setFormData({
      school_id: defaultSchoolId,
      program_id: "",
      code: "",
      name: "",
      sort_order: null,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (section: Section) => {
    setEditingSection(section);
    setFormData({
      school_id: section.school_id,
      program_id: section.program_id,
      code: section.code,
      name: section.name,
      sort_order: section.sort_order,
      is_active: section.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code || !formData.school_id || !formData.program_id) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);

    if (editingSection) {
      // Update existing section
      const { error: updateError } = await supabase
        .from("sections")
        .update({
          school_id: formData.school_id,
          program_id: formData.program_id,
          code: formData.code,
          name: formData.name,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        })
        .eq("id", editingSection.id);

      if (updateError) {
        const errorDetails = {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        };
        console.error("Error updating section:", errorDetails);
        setError(updateError.message || "Failed to update section. Please check your permissions.");
        return;
      }
    } else {
      // Create new section
      const { error: createError } = await supabase.from("sections").insert([
        {
          school_id: formData.school_id,
          program_id: formData.program_id,
          code: formData.code,
          name: formData.name,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        },
      ]);

      if (createError) {
        const errorDetails = {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code,
        };
        console.error("Error creating section:", errorDetails);
        setError(createError.message || "Failed to create section. Please check your permissions.");
        return;
      }
    }

    // Refresh sections list
    let query = supabase
      .from("sections")
      .select("id, school_id, program_id, code, name, sort_order, is_active, created_at")
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("name", { ascending: true });

    if (selectedSchoolId !== "all") {
      query = query.eq("school_id", selectedSchoolId);
    }

    const { data: refreshData, error: refreshError } = await query;

    if (refreshError) {
      const errorDetails = {
        message: refreshError.message,
        details: refreshError.details,
        hint: refreshError.hint,
        code: refreshError.code,
      };
      console.error("Error refreshing sections:", errorDetails);
      setError(refreshError.message || "Failed to refresh sections list.");
    } else if (refreshData) {
      setSections(refreshData);
      setError(null);
    }

    setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Sections</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Use explicit RBAC check for create/update permissions
  const canCreate = canPerform(role, "create", "sections", originalRole);
  const canUpdate = canPerform(role, "update", "sections", originalRole);
  const canEdit = canCreate || canUpdate;

  // Filter sections by selected school
  const filteredSections = selectedSchoolId === "all" 
    ? sections 
    : sections.filter((s) => s.school_id === selectedSchoolId);

  // Helper to get school name for display
  const getSchoolName = (schoolId: string) => {
    return schools.find((s) => s.id === schoolId)?.name || "Unknown";
  };

  // Helper to get program name for display
  const getProgramName = (programId: string) => {
    return programs.find((p) => p.id === programId)?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Sections</h1>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add Section
          </Button>
        )}
      </div>

      {/* School Filter */}
      {mounted && schools.length > 0 && (
        <div className="flex items-center gap-2">
          <Label htmlFor="school-filter" className="text-sm font-medium">
            School:
          </Label>
          <Select value={selectedSchoolId} onValueChange={setSelectedSchoolId}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder="All Schools" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Schools</SelectItem>
              {schools.map((school) => (
                <SelectItem key={school.id} value={school.id}>
                  {school.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {!error && filteredSections.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No sections yet
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">School</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Program</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredSections.map((section) => (
                <tr key={section.id} className="border-b">
                  <td className="px-4 py-3 text-sm">{getSchoolName(section.school_id)}</td>
                  <td className="px-4 py-3 text-sm">{getProgramName(section.program_id)}</td>
                  <td className="px-4 py-3 text-sm">{section.code}</td>
                  <td className="px-4 py-3 text-sm">{section.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {section.is_active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => handleEdit(section)}
                        className="gap-2"
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSection ? "Edit Section" : "Add Section"}
            </DialogTitle>
            <DialogDescription>
              {editingSection
                ? "Update the section information."
                : "Create a new section entry."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Section name"
                required
              />
            </div>
            {mounted && schools.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="school_id">School</Label>
                <Select
                  value={formData.school_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, school_id: value, program_id: "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {mounted && formData.school_id && (
              <div className="space-y-2">
                <Label htmlFor="program_id">Program</Label>
                <Select
                  value={formData.program_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, program_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs
                      .filter((p) => p.school_id === formData.school_id)
                      .map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name} ({program.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code" className="text-muted-foreground">
                Code
              </Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => {
                  // Auto-uppercase and replace spaces with underscores
                  const processedValue = e.target.value
                    .toUpperCase()
                    .replace(/\s+/g, "_");
                  setFormData({ ...formData, code: processedValue });
                }}
                placeholder="SECTION_A"
                required
              />
              <p className="text-muted-foreground text-xs">
                Internal identifier (e.g. SECTION_A, GRADE_6_A)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order ?? ""}
                onChange={(e) => {
                  const value = e.target.value === "" ? null : parseInt(e.target.value, 10);
                  setFormData({ ...formData, sort_order: isNaN(value as number) ? null : value });
                }}
                placeholder="Optional"
              />
            </div>
            <div className="flex items-center gap-2">
              <Switch
                id="is_active"
                checked={formData.is_active}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_active: checked })
                }
              />
              <Label htmlFor="is_active" className="cursor-pointer">
                Active
              </Label>
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingSection ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
