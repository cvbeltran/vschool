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

interface School {
  id: string;
  code: string;
  name: string;
  type: string;
  location: string;
  is_active: boolean;
}

export default function SchoolsPage() {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null); // Store original role for RBAC differentiation
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSchool, setEditingSchool] = useState<School | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    code: "",
    name: "",
    type: "",
    location: "",
    is_active: true,
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      // Fetch user role
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
          setOriginalRole(profile.role); // Store original role for RBAC differentiation
        }
      }

      // Fetch schools
      const { data, error: fetchError } = await supabase
        .from("schools")
        .select("id, code, name, type, location, is_active")
        .order("name", { ascending: true });

      if (fetchError) {
        // Safely extract error information
        const errorMessage = fetchError?.message || fetchError?.toString() || "Unknown error";
        const errorCode = fetchError?.code || "unknown";
        const errorDetails = fetchError?.details || null;
        const errorHint = fetchError?.hint || null;
        
        // Try to stringify the error object with all properties
        let fullErrorString = "Unable to serialize error";
        try {
          fullErrorString = JSON.stringify(fetchError, Object.getOwnPropertyNames(fetchError));
        } catch (e) {
          fullErrorString = String(fetchError);
        }
        
        console.error("Error fetching schools:", {
          message: errorMessage,
          code: errorCode,
          details: errorDetails,
          hint: errorHint,
          fullError: fullErrorString,
          errorObject: fetchError,
        });
        
        setError(errorMessage || "Failed to fetch schools. Please check your permissions.");
        setLoading(false);
        return;
      }

      setSchools(data || []);
      setError(null);
      setLoading(false);
    };

    fetchData();
  }, []);

  const handleCreate = () => {
    setEditingSchool(null);
    setFormData({
      code: "",
      name: "",
      type: "",
      location: "",
      is_active: true,
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (school: School) => {
    setEditingSchool(school);
    setFormData({
      code: school.code,
      name: school.name,
      type: school.type,
      location: school.location,
      is_active: school.is_active,
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.code || !formData.name || !formData.type || !formData.location) {
      return;
    }

      if (editingSchool) {
      // Update existing school
      const { error: updateError } = await supabase
        .from("schools")
        .update({
          code: formData.code,
          name: formData.name,
          type: formData.type,
          location: formData.location,
          is_active: formData.is_active,
        })
        .eq("id", editingSchool.id);

      if (updateError) {
        const errorDetails = {
          message: updateError.message,
          details: updateError.details,
          hint: updateError.hint,
          code: updateError.code,
        };
        console.error("Error updating school:", errorDetails);
        setError(updateError.message || "Failed to update school. Please check your permissions.");
        return;
      }
    } else {
      // Get user's organization_id for the school
      const {
        data: { session },
      } = await supabase.auth.getSession();
      let organizationId: string | null = null;
      
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", session.user.id)
          .single();
        organizationId = profile?.organization_id || null;
      }

      if (!organizationId) {
        setError("User is not associated with an organization.");
        return;
      }

      // Create new school
      const { error: createError } = await supabase.from("schools").insert([
        {
          code: formData.code,
          name: formData.name,
          type: formData.type,
          location: formData.location,
          is_active: formData.is_active,
          organization_id: organizationId,
        },
      ]);

      if (createError) {
        const errorDetails = {
          message: createError.message,
          details: createError.details,
          hint: createError.hint,
          code: createError.code,
        };
        console.error("Error creating school:", errorDetails);
        setError(createError.message || "Failed to create school. Please check your permissions.");
        return;
      }
    }

    // Refresh schools list
    const { data: refreshData, error: refreshError } = await supabase
      .from("schools")
      .select("id, code, name, type, location, is_active")
      .order("name", { ascending: true });

    if (refreshError) {
      const errorDetails = {
        message: refreshError.message,
        details: refreshError.details,
        hint: refreshError.hint,
        code: refreshError.code,
      };
      console.error("Error refreshing schools:", errorDetails);
      setError(refreshError.message || "Failed to refresh schools list.");
    } else if (refreshData) {
      setSchools(refreshData);
      setError(null);
    }

    setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Schools</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Use explicit RBAC check for create/update permissions (pass originalRole to differentiate registrar)
  const canCreate = canPerform(role, "create", "schools", originalRole);
  const canUpdate = canPerform(role, "update", "schools", originalRole);
  const canEdit = canCreate || canUpdate; // Show edit UI if can create or update

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Schools</h1>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add School
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {!error && schools.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No schools yet
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Location
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Status
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody>
              {schools.map((school) => (
                <tr key={school.id} className="border-b">
                  <td className="px-4 py-3 text-sm">{school.name}</td>
                  <td className="px-4 py-3 text-sm">{school.type}</td>
                  <td className="px-4 py-3 text-sm">{school.location}</td>
                  <td className="px-4 py-3 text-sm">
                    {school.is_active ? (
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
                        onClick={() => handleEdit(school)}
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
              {editingSchool ? "Edit School" : "Add School"}
            </DialogTitle>
            <DialogDescription>
              {editingSchool
                ? "Update the school information."
                : "Create a new school entry."}
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
                placeholder="School name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="type">Type</Label>
              {mounted && (
                <Select
                  value={formData.type}
                  onValueChange={(value) =>
                    setFormData({ ...formData, type: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Academy">Academy</SelectItem>
                    <SelectItem value="College">College</SelectItem>
                    <SelectItem value="CLC">CLC</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="location">Location</Label>
              <Input
                id="location"
                value={formData.location}
                onChange={(e) =>
                  setFormData({ ...formData, location: e.target.value })
                }
                placeholder="School location"
              />
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
                placeholder="MAGNA_MAIN"
                required
              />
              <p className="text-muted-foreground text-xs">
                Internal identifier used for reports and exports (e.g. MAGNA_MAIN)
              </p>
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
              {editingSchool ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

