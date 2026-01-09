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

interface Program {
  id: string;
  school_id: string;
  code: string;
  name: string;
  type: "ACADEMY" | "COLLEGE" | "CLC";
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
}

interface School {
  id: string;
  name: string;
}

export default function ProgramsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [programs, setPrograms] = useState<Program[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null); // Store original role for RBAC differentiation
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingProgram, setEditingProgram] = useState<Program | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    school_id: "",
    code: "",
    name: "",
    type: "" as "ACADEMY" | "COLLEGE" | "CLC" | "",
    sort_order: null as number | null,
    is_active: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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

      // Fetch programs - filter by organization_id unless super admin
      let query = supabase
        .from("programs")
        .select("id, school_id, code, name, type, sort_order, is_active, created_at");
      
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
        console.error("Error fetching programs:", {
          message: errorMessage,
          code: fetchError?.code,
          details: fetchError?.details,
          hint: fetchError?.hint,
        });
        setError(errorMessage || "Failed to fetch programs. Please check your permissions.");
        setLoading(false);
        return;
      }

      setPrograms(data || []);
      setError(null);
      setLoading(false);
    };

    if (!orgLoading) {
      fetchData();
    }
  }, [selectedSchoolId, organizationId, isSuperAdmin, orgLoading]);

  const handleCreate = () => {
    setEditingProgram(null);
    // Auto-set school_id from filter if a specific school is selected
    const defaultSchoolId = selectedSchoolId !== "all" ? selectedSchoolId : "";
    setFormData({
      school_id: defaultSchoolId,
      code: "",
      name: "",
      type: "",
      sort_order: null,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (program: Program) => {
    setEditingProgram(program);
    setFormData({
      school_id: program.school_id,
      code: program.code,
      name: program.name,
      type: program.type,
      sort_order: program.sort_order,
      is_active: program.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    // Validate required fields
    if (!formData.name || !formData.type || !formData.code) {
      setError("Please fill in all required fields.");
      return;
    }

    // For creation, ensure school_id is set (from filter or form)
    if (!editingProgram) {
      // Determine school_id: use form selection if "all" is selected, otherwise use filter
      const schoolId = selectedSchoolId !== "all" ? selectedSchoolId : formData.school_id;
      
      if (!schoolId) {
        setError("Please select a school first.");
        return;
      }

      // Create new program - ensure all required fields are included
      const insertPayload = {
        school_id: schoolId,
        name: formData.name,
        code: formData.code,
        type: formData.type,
        sort_order: formData.sort_order ?? null,
        is_active: formData.is_active ?? true,
      };

      const { error: createError } = await supabase.from("programs").insert([insertPayload]);

      if (createError) {
        console.error("Create program error:", createError);
        setError(createError.message || "Failed to create program. Please check your permissions.");
        return;
      }
    } else {
      // Update existing program
      const { error: updateError } = await supabase
        .from("programs")
        .update({
          school_id: formData.school_id,
          code: formData.code,
          name: formData.name,
          type: formData.type,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        })
        .eq("id", editingProgram.id);

      if (updateError) {
        console.error("Update program error:", updateError);
        setError(updateError.message || "Failed to update program. Please check your permissions.");
        return;
      }
    }

    // Refresh programs list
    let query = supabase
      .from("programs")
      .select("id, school_id, code, name, type, sort_order, is_active, created_at")
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
      console.error("Error refreshing programs:", errorDetails);
      setError(refreshError.message || "Failed to refresh programs list.");
    } else if (refreshData) {
      setPrograms(refreshData);
      setError(null);
    }

    setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Programs</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Use explicit RBAC check for create/update permissions
  const canCreate = canPerform(role, "create", "programs", originalRole);
  const canUpdate = canPerform(role, "update", "programs", originalRole);
  const canEdit = canCreate || canUpdate;

  // Filter programs by selected school
  const filteredPrograms = selectedSchoolId === "all" 
    ? programs 
    : programs.filter((p) => p.school_id === selectedSchoolId);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Programs</h1>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add Program
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

      {!error && filteredPrograms.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No programs yet
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Type</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {filteredPrograms.map((program) => (
                <tr key={program.id} className="border-b">
                  <td className="px-4 py-3 text-sm">{program.code}</td>
                  <td className="px-4 py-3 text-sm">{program.name}</td>
                  <td className="px-4 py-3 text-sm">{program.type}</td>
                  <td className="px-4 py-3 text-sm">
                    {program.is_active ? (
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
                        onClick={() => handleEdit(program)}
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
              {editingProgram ? "Edit Program" : "Add Program"}
            </DialogTitle>
            <DialogDescription>
              {editingProgram
                ? "Update the program information."
                : "Create a new program entry."}
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
                placeholder="Program name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              {mounted && (
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value as "ACADEMY" | "COLLEGE" | "CLC" })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ACADEMY">Academy</SelectItem>
                    <SelectItem value="COLLEGE">College</SelectItem>
                    <SelectItem value="CLC">CLC</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
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
                placeholder="GRADE_6"
                required
              />
              <p className="text-muted-foreground text-xs">
                Internal identifier (e.g. GRADE_6, BS_CS, CLC_FOUNDATION)
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
            {mounted && schools.length > 0 && selectedSchoolId === "all" && (
              <div className="space-y-2">
                <Label htmlFor="school_id">School</Label>
                <Select
                  value={formData.school_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, school_id: value })
                  }
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
              {editingProgram ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

