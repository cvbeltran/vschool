"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
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
import { Plus, Pencil, Settings } from "lucide-react";
import { normalizeRole } from "@/lib/rbac";
import { useOrganization } from "@/lib/hooks/use-organization";
import { fetchTaxonomyItems } from "@/lib/taxonomies";

interface Subject {
  id: string;
  organization_id: string;
  school_id: string | null;
  code: string;
  name: string;
  description: string | null;
  grade_level: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface School {
  id: string;
  name: string;
}

export default function SubjectsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [selectedSchoolId, setSelectedSchoolId] = useState<string>("all");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSubject, setEditingSubject] = useState<Subject | null>(null);
  const [mounted, setMounted] = useState(false);
  const [gradeLevels, setGradeLevels] = useState<Array<{ id: string; label: string }>>([]);
  const [formData, setFormData] = useState({
    school_id: "" as string | null,
    code: "",
    name: "",
    description: "" as string | null,
    grade_level: "" as string | null,
    sort_order: null as number | null,
    is_active: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/sis/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role) {
        const normalizedRole = normalizeRole(profile.role);
        setRole(normalizedRole);

        // Check if user has access (admin, principal, registrar, or super_admin)
        const allowedRoles = ["admin", "principal", "registrar", "super_admin"];
        if (!allowedRoles.includes(profile.role) && !isSuperAdmin) {
          router.push("/sis");
          return;
        }
      }
    };

    checkAccess();
  }, [router, isSuperAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      setLoading(true);

      // Fetch grade levels from taxonomies
      const gradeLevelResult = await fetchTaxonomyItems("grade_level", null, organizationId || null);
      if (gradeLevelResult.items && gradeLevelResult.items.length > 0) {
        setGradeLevels(gradeLevelResult.items.map(item => ({ id: item.id, label: item.label })));
      } else {
        // Fallback to empty array if no taxonomies found
        setGradeLevels([]);
      }

      // Fetch schools
      let schoolsQuery = supabase.from("schools").select("id, name");
      if (!isSuperAdmin && organizationId) {
        schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
      }
      const { data: schoolsData } = await schoolsQuery.order("name", { ascending: true });
      setSchools(schoolsData || []);

      // Fetch subjects - check if table exists first
      let subjectsQuery = supabase
        .from("subjects")
        .select("id, organization_id, school_id, code, name, description, grade_level, sort_order, is_active, created_at, updated_at")
        .is("archived_at", null)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("code", { ascending: true });

      if (!isSuperAdmin && organizationId) {
        subjectsQuery = subjectsQuery.eq("organization_id", organizationId);
      }

      const { data: subjectsData, error: subjectsError } = await subjectsQuery;

      if (subjectsError) {
        // Check if error is due to missing table (migration not run)
        if (subjectsError.message.includes("does not exist") || 
            subjectsError.message.includes("relation") && subjectsError.message.includes("not found")) {
          setError(
            "⚠️ Database migration required: The subjects table doesn't exist yet. " +
            "Please run the migration: migrations/20260203132000_create_subjects_table.sql " +
            "You can run it via Supabase Dashboard SQL Editor or using psql."
          );
          setLoading(false);
          return;
        }
        setError(`Failed to fetch subjects: ${subjectsError.message}`);
        setLoading(false);
        return;
      }

      setSubjects(subjectsData || []);
      setError(null);
      setLoading(false);
    };

    if (!orgLoading) {
      fetchData();
    }
  }, [selectedSchoolId, organizationId, isSuperAdmin, orgLoading]);

  const handleCreate = () => {
    setEditingSubject(null);
    const defaultSchoolId = selectedSchoolId !== "all" ? selectedSchoolId : null;
    setFormData({
      school_id: defaultSchoolId,
      code: "",
      name: "",
      description: null,
      grade_level: null,
      sort_order: null,
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (subject: Subject) => {
    setEditingSubject(subject);
    setFormData({
      school_id: subject.school_id || null,
      code: subject.code,
      name: subject.name,
      description: subject.description,
      grade_level: subject.grade_level,
      sort_order: subject.sort_order,
      is_active: subject.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.code) {
      setError("Please fill in all required fields (code and name).");
      return;
    }

    setError(null);

    // Determine organization_id
    let finalOrganizationId = organizationId;
    if (!finalOrganizationId && formData.school_id) {
      const { data: schoolData } = await supabase
        .from("schools")
        .select("organization_id")
        .eq("id", formData.school_id)
        .single();
      
      if (schoolData?.organization_id) {
        finalOrganizationId = schoolData.organization_id;
      }
    }

    if (!finalOrganizationId) {
      setError("Unable to determine organization. Please try again.");
      return;
    }

    if (editingSubject) {
      // Update existing subject
      const { error: updateError } = await supabase
        .from("subjects")
        .update({
          school_id: formData.school_id || null,
          code: formData.code.toUpperCase().trim(),
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          grade_level: formData.grade_level || null,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        })
        .eq("id", editingSubject.id);

      if (updateError) {
        setError(`Failed to update subject: ${updateError.message}`);
        return;
      }
    } else {
      // Create new subject
      const { error: createError } = await supabase.from("subjects").insert([
        {
          organization_id: finalOrganizationId,
          school_id: formData.school_id || null,
          code: formData.code.toUpperCase().trim(),
          name: formData.name.trim(),
          description: formData.description?.trim() || null,
          grade_level: formData.grade_level || null,
          sort_order: formData.sort_order,
          is_active: formData.is_active,
        },
      ]);

      if (createError) {
        setError(`Failed to create subject: ${createError.message}`);
        return;
      }
    }

    // Refresh subjects list
    const { data: refreshData, error: refreshError } = await supabase
      .from("subjects")
      .select("*")
      .is("archived_at", null)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("code", { ascending: true });

    if (!isSuperAdmin && organizationId) {
      const { data } = await supabase
        .from("subjects")
        .select("*")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("code", { ascending: true });
      setSubjects(data || []);
    } else {
      setSubjects(refreshData || []);
    }

    setIsDialogOpen(false);
    setEditingSubject(null);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Subjects</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Filter subjects by selected school
  const filteredSubjects = selectedSchoolId === "all" 
    ? subjects 
    : subjects.filter((s) => s.school_id === selectedSchoolId);

  const getSchoolName = (schoolId: string | null) => {
    if (!schoolId) return "All Schools";
    return schools.find((s) => s.id === schoolId)?.name || "Unknown";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Subjects</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage academic subjects with codes, names, and grade levels
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => router.push("/sis/settings/subjects/classification")}
            className="gap-2"
          >
            <Settings className="size-4" />
            Classification Setup
          </Button>
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add Subject
          </Button>
        </div>
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
        <Card className={error.includes("migration") ? "border-yellow-500" : ""}>
          <CardContent className="py-4">
            <div className="text-sm text-destructive mb-3">{error}</div>
            {error.includes("migration") && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="font-semibold mb-2">How to run the migration:</div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Open your Supabase Dashboard</li>
                  <li>Go to SQL Editor</li>
                  <li>Copy and paste the contents of <code className="bg-background px-1 rounded">migrations/20260203132000_create_subjects_table.sql</code></li>
                  <li>Click "Run" to execute the migration</li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {!error && filteredSubjects.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No subjects yet. Click "Add Subject" to create one.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Grade Level</th>
                <th className="px-4 py-3 text-left text-sm font-medium">School</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.map((subject) => (
                <tr key={subject.id} className="border-b">
                  <td className="px-4 py-3 text-sm font-mono">{subject.code}</td>
                  <td className="px-4 py-3 text-sm">{subject.name}</td>
                  <td className="px-4 py-3 text-sm">
                    {subject.grade_level || <span className="text-muted-foreground">All Levels</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">{getSchoolName(subject.school_id)}</td>
                  <td className="px-4 py-3 text-sm">
                    {subject.is_active ? (
                      <span className="text-green-600">Active</span>
                    ) : (
                      <span className="text-muted-foreground">Inactive</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleEdit(subject)}
                      className="gap-2"
                    >
                      <Pencil className="size-4" />
                      Edit
                    </Button>
                  </td>
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
              {editingSubject ? "Edit Subject" : "Add Subject"}
            </DialogTitle>
            <DialogDescription>
              {editingSubject
                ? "Update the subject information."
                : "Create a new subject entry."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {mounted && schools.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="school_id">School (Optional)</Label>
                <Select
                  value={formData.school_id || "__all__"}
                  onValueChange={(value) =>
                    setFormData({ ...formData, school_id: value === "__all__" ? null : value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="All Schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__all__">All Schools</SelectItem>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="code">Subject Code *</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => {
                  const processedValue = e.target.value.toUpperCase().replace(/\s+/g, "_");
                  setFormData({ ...formData, code: processedValue });
                }}
                placeholder="MATH"
                required
              />
              <p className="text-muted-foreground text-xs">
                Unique identifier (e.g., MATH, SCI, ENG)
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name">Subject Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                placeholder="Mathematics"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Input
                id="description"
                value={formData.description || ""}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value || null })
                }
                placeholder="Brief description of the subject"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="grade_level">Grade Level (Optional)</Label>
              <Select
                value={formData.grade_level || "__all__"}
                onValueChange={(value) =>
                  setFormData({ ...formData, grade_level: value === "__all__" ? null : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="All Levels" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All Levels</SelectItem>
                  {gradeLevels.map((level) => (
                    <SelectItem key={level.id} value={level.label}>
                      {level.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Leave as "All Levels" if subject applies to all grade levels
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order (Optional)</Label>
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
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingSubject ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
