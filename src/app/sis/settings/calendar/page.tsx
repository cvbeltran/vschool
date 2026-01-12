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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { normalizeRole, canPerform } from "@/lib/rbac";
import { fetchTaxonomyItems, getSmartDefault } from "@/lib/taxonomies";
import type { TaxonomyItem } from "@/lib/taxonomies";
import { useOrganization } from "@/lib/hooks/use-organization";

interface SchoolYear {
  id: string;
  start_date: string;
  end_date: string;
  year_label: string;
  status_id: string;
  status_label: string;
  created_at: string;
  updated_at: string;
}

/**
 * Generate year label from start and end dates
 * Format: "YYYY-YYYY" (e.g., "2026-2027")
 */
function generateYearLabel(startDate: string, endDate: string): string {
  if (!startDate || !endDate) return "";
  
  const start = new Date(startDate);
  const end = new Date(endDate);
  
  const startYear = start.getFullYear();
  const endYear = end.getFullYear();
  
  return `${startYear}-${endYear}`;
}

export default function CalendarSettingsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]);
  const [statusOptions, setStatusOptions] = useState<TaxonomyItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [editingSchoolYear, setEditingSchoolYear] = useState<SchoolYear | null>(null);
  const [deletingSchoolYear, setDeletingSchoolYear] = useState<SchoolYear | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    start_date: "",
    end_date: "",
    year_label: "",
    status_id: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return; // Wait for organization context
      
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
          setOriginalRole(profile.role);
        }
      }

      // Fetch status taxonomy options
      const statusResult = await fetchTaxonomyItems("school_year_status");
      if (statusResult.items.length > 0) {
        setStatusOptions(statusResult.items);
      }

      // Fetch school years with status label - filter by organization_id unless super admin
      let schoolYearsQuery = supabase
        .from("school_years")
        .select(`
          id,
          start_date,
          end_date,
          year_label,
          status_id,
          created_at,
          updated_at,
          taxonomy_items:status_id (
            label
          )
        `);
      
      if (!isSuperAdmin && organizationId) {
        schoolYearsQuery = schoolYearsQuery.eq("organization_id", organizationId);
      }
      
      const { data: schoolYearsData, error: schoolYearsError } = await schoolYearsQuery
        .order("start_date", { ascending: false });

      if (schoolYearsError) {
        console.error("Error fetching school years:", schoolYearsError);
        setError(schoolYearsError.message || "Failed to fetch school years.");
        setLoading(false);
        return;
      }

      // Transform data to include status label
      const transformedData: SchoolYear[] = (schoolYearsData || []).map((sy: any) => ({
        id: sy.id,
        start_date: sy.start_date,
        end_date: sy.end_date,
        year_label: sy.year_label,
        status_id: sy.status_id,
        status_label: sy.taxonomy_items?.label || "Unknown",
        created_at: sy.created_at,
        updated_at: sy.updated_at,
      }));

      setSchoolYears(transformedData);
      setError(null);
      setLoading(false);
    };

    if (!orgLoading) {
      fetchData();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Auto-generate year_label when dates change and validate dates
  useEffect(() => {
    if (formData.start_date && formData.end_date) {
      const startDate = new Date(formData.start_date);
      const endDate = new Date(formData.end_date);
      
      // Generate year label
      const generatedLabel = generateYearLabel(formData.start_date, formData.end_date);
      setFormData((prev) => ({ ...prev, year_label: generatedLabel }));
      
      // Real-time validation feedback (only show if dialog is open)
      if (isDialogOpen) {
        // Clear previous date/year validation errors
        setError((prevError) => {
          if (prevError && (prevError.includes("date") || prevError.includes("year"))) {
            return null;
          }
          return prevError;
        });
        
        // Validate dates
        if (endDate <= startDate) {
          setError("End date must be after start date.");
          return;
        }
        
        const startYear = startDate.getFullYear();
        const endYear = endDate.getFullYear();
        
        if (startYear === endYear) {
          setError("School year must span two different years (e.g., 2026-2027). Start and end dates cannot be in the same year.");
          return;
        }
      }
    }
  }, [formData.start_date, formData.end_date, isDialogOpen]);

  const handleCreate = () => {
    setEditingSchoolYear(null);
    setError(null); // Clear any previous errors
    const planningStatus = statusOptions.find((s) => s.code === "PLANNING");
    setFormData({
      start_date: "",
      end_date: "",
      year_label: "",
      status_id: planningStatus?.id || "",
    });
    setIsDialogOpen(true);
  };

  const handleEdit = (schoolYear: SchoolYear) => {
    setEditingSchoolYear(schoolYear);
    setError(null); // Clear any previous errors
    setFormData({
      start_date: schoolYear.start_date,
      end_date: schoolYear.end_date,
      year_label: schoolYear.year_label,
      status_id: schoolYear.status_id,
    });
    setIsDialogOpen(true);
  };

  const handleDelete = (schoolYear: SchoolYear) => {
    setDeletingSchoolYear(schoolYear);
    setIsDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!deletingSchoolYear) return;

    // Check if there are any admissions using this school year
    let admissionsQuery = supabase
      .from("admissions")
      .select("id")
      .eq("school_year_id", deletingSchoolYear.id)
      .limit(1);
    
    // Filter by organization_id unless super admin
    if (!isSuperAdmin && organizationId) {
      admissionsQuery = admissionsQuery.eq("organization_id", organizationId);
    }
    
    const { data: admissionsData, error: admissionsError } = await admissionsQuery;

    if (admissionsError) {
      console.error("Error checking admissions:", admissionsError);
      setError("Failed to check if school year is in use. Please try again.");
      setIsDeleteDialogOpen(false);
      return;
    }

    if (admissionsData && admissionsData.length > 0) {
      setError(`Cannot delete school year "${deletingSchoolYear.year_label}" because it is being used by existing admission applications. Please remove or reassign the admissions first.`);
      setIsDeleteDialogOpen(false);
      setDeletingSchoolYear(null);
      return;
    }

    const { error: deleteError } = await supabase
      .from("school_years")
      .delete()
      .eq("id", deletingSchoolYear.id);

    if (deleteError) {
      console.error("Error deleting school year:", deleteError);
      setError(deleteError.message || "Failed to delete school year.");
      setIsDeleteDialogOpen(false);
      return;
    }

    // Refresh list - filter by organization_id unless super admin
    let refreshQuery = supabase
      .from("school_years")
      .select(`
        id,
        start_date,
        end_date,
        year_label,
        status_id,
        created_at,
        updated_at,
        taxonomy_items:status_id (
          label
        )
      `);
    
    if (!isSuperAdmin && organizationId) {
      refreshQuery = refreshQuery.eq("organization_id", organizationId);
    }
    
    const { data: schoolYearsData, error: schoolYearsError } = await refreshQuery
      .order("start_date", { ascending: false });

    if (!schoolYearsError && schoolYearsData) {
      const transformedData: SchoolYear[] = schoolYearsData.map((sy: any) => ({
        id: sy.id,
        start_date: sy.start_date,
        end_date: sy.end_date,
        year_label: sy.year_label,
        status_id: sy.status_id,
        status_label: sy.taxonomy_items?.label || "Unknown",
        created_at: sy.created_at,
        updated_at: sy.updated_at,
      }));
      setSchoolYears(transformedData);
      setError(null); // Clear any previous errors on successful delete
    } else if (schoolYearsError) {
      setError(schoolYearsError.message || "Failed to refresh school years list.");
    }

    setIsDeleteDialogOpen(false);
    setDeletingSchoolYear(null);
  };

  const handleSubmit = async () => {
    // Clear any previous errors
    setError(null);

    // Validate required fields
    if (!formData.start_date || !formData.end_date || !formData.status_id) {
      setError("Please fill in all required fields.");
      return;
    }

    // Validate dates
    const startDate = new Date(formData.start_date);
    const endDate = new Date(formData.end_date);
    
    // Rule 1: End date must be after start date
    if (endDate <= startDate) {
      setError("End date must be after start date.");
      return;
    }

    // Rule 2: Start and end dates must be in different years
    const startYear = startDate.getFullYear();
    const endYear = endDate.getFullYear();
    
    if (startYear === endYear) {
      setError("School year must span two different years (e.g., 2026-2027). Start and end dates cannot be in the same year.");
      return;
    }

    // Generate year_label if not already set
    const yearLabel = formData.year_label || generateYearLabel(formData.start_date, formData.end_date);

    // Check if setting to ACTIVE - if so, set all other ACTIVE ones to INACTIVE
    const selectedStatus = statusOptions.find((s) => s.id === formData.status_id);
    const isSettingToActive = selectedStatus?.code === "ACTIVE";

    if (isSettingToActive) {
      // Find all currently ACTIVE school years (excluding the one being edited)
      const activeStatus = statusOptions.find((s) => s.code === "ACTIVE");
      if (activeStatus) {
        let activeSchoolYearsQuery = supabase
          .from("school_years")
          .select("id")
          .eq("status_id", activeStatus.id);
        
        // Filter by organization_id unless super admin
        if (!isSuperAdmin && organizationId) {
          activeSchoolYearsQuery = activeSchoolYearsQuery.eq("organization_id", organizationId);
        }
        
        const { data: activeSchoolYears } = await activeSchoolYearsQuery;

        if (activeSchoolYears && activeSchoolYears.length > 0) {
          // Filter out the current school year if editing
          const otherActiveIds = editingSchoolYear
            ? activeSchoolYears.filter((sy) => sy.id !== editingSchoolYear.id).map((sy) => sy.id)
            : activeSchoolYears.map((sy) => sy.id);

          // Set all other ACTIVE school years to INACTIVE
          if (otherActiveIds.length > 0) {
            const inactiveStatus = statusOptions.find((s) => s.code === "INACTIVE");
            if (inactiveStatus) {
              const { error: updateError } = await supabase
                .from("school_years")
                .update({ status_id: inactiveStatus.id })
                .in("id", otherActiveIds);

              if (updateError) {
                console.error("Error updating other school years:", updateError);
                setError("Failed to update other school years. Please try again.");
                return;
              }
            }
          }
        }
      }
    }

    if (!editingSchoolYear) {
      // Determine organization_id: use from hook if available
      if (!organizationId && !isSuperAdmin) {
        setError("User is not associated with an organization.");
        return;
      }

      // Create new school year
      const insertPayload: any = {
        start_date: formData.start_date,
        end_date: formData.end_date,
        year_label: yearLabel,
        status_id: formData.status_id,
      };

      // Include organization_id if available (required for non-super admins)
      if (organizationId) {
        insertPayload.organization_id = organizationId;
      }

      const { error: createError } = await supabase.from("school_years").insert([insertPayload]);

      if (createError) {
        console.error("Create school year error:", createError);
        setError(createError.message || "Failed to create school year. Please check your permissions.");
        return;
      }
    } else {
      // Update existing school year
      const { error: updateError } = await supabase
        .from("school_years")
        .update({
          start_date: formData.start_date,
          end_date: formData.end_date,
          year_label: yearLabel,
          status_id: formData.status_id,
        })
        .eq("id", editingSchoolYear.id);

      if (updateError) {
        console.error("Update school year error:", updateError);
        setError(updateError.message || "Failed to update school year. Please check your permissions.");
        return;
      }
    }

    // Refresh school years list - filter by organization_id unless super admin
    let refreshQuery = supabase
      .from("school_years")
      .select(`
        id,
        start_date,
        end_date,
        year_label,
        status_id,
        created_at,
        updated_at,
        taxonomy_items:status_id (
          label
        )
      `);
    
    if (!isSuperAdmin && organizationId) {
      refreshQuery = refreshQuery.eq("organization_id", organizationId);
    }
    
    const { data: schoolYearsData, error: schoolYearsError } = await refreshQuery
      .order("start_date", { ascending: false });

    if (schoolYearsError) {
      console.error("Error refreshing school years:", schoolYearsError);
      setError(schoolYearsError.message || "Failed to refresh school years list.");
    } else if (schoolYearsData) {
      const transformedData: SchoolYear[] = schoolYearsData.map((sy: any) => ({
        id: sy.id,
        start_date: sy.start_date,
        end_date: sy.end_date,
        year_label: sy.year_label,
        status_id: sy.status_id,
        status_label: sy.taxonomy_items?.label || "Unknown",
        created_at: sy.created_at,
        updated_at: sy.updated_at,
      }));
      setSchoolYears(transformedData);
      setError(null);
    }

    setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Calendar Settings</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Use explicit RBAC check for create/update permissions
  const canCreate = canPerform(role, "create", "school_years", originalRole);
  const canUpdate = canPerform(role, "update", "school_years", originalRole);
  const canDelete = canPerform(role, "delete", "school_years", originalRole);
  const canEdit = canCreate || canUpdate;

  const getStatusBadge = (statusLabel: string) => {
    const statusLower = statusLabel.toLowerCase();
    if (statusLower === "active") {
      return <span className="text-green-600 font-medium">Active</span>;
    } else if (statusLower === "planning") {
      return <span className="text-blue-600 font-medium">Planning</span>;
    } else {
      return <span className="text-muted-foreground">Inactive</span>;
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Calendar Settings</h1>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add School Year
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

      {!error && schoolYears.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No school years yet. Create your first school year to get started.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Year Label</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Start Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">End Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {schoolYears.map((schoolYear) => (
                <tr key={schoolYear.id} className="border-b">
                  <td className="px-4 py-3 text-sm font-medium">{schoolYear.year_label}</td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(schoolYear.start_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {new Date(schoolYear.end_date).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(schoolYear.status_label)}</td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(schoolYear)}
                          className="gap-2"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                        {canDelete && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(schoolYear)}
                            className="gap-2 text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                            Delete
                          </Button>
                        )}
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Dialog */}
      <Dialog 
        open={isDialogOpen} 
        onOpenChange={(open) => {
          setIsDialogOpen(open);
          if (!open) {
            setError(null); // Clear errors when dialog closes
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingSchoolYear ? "Edit School Year" : "Add School Year"}
            </DialogTitle>
            <DialogDescription>
              {editingSchoolYear
                ? "Update the school year information."
                : "Create a new school year. Status will default to Planning."}
            </DialogDescription>
          </DialogHeader>
          {error && (error.includes("date") || error.includes("year")) && (
            <div className="px-6 pt-2">
              <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                {error}
              </div>
            </div>
          )}
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="start_date">Start Date</Label>
              <Input
                id="start_date"
                type="date"
                value={formData.start_date}
                onChange={(e) =>
                  setFormData({ ...formData, start_date: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="end_date">End Date</Label>
              <Input
                id="end_date"
                type="date"
                value={formData.end_date}
                onChange={(e) =>
                  setFormData({ ...formData, end_date: e.target.value })
                }
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="year_label">Year Label</Label>
              <Input
                id="year_label"
                value={formData.year_label}
                readOnly
                className="bg-muted"
                placeholder="Auto-generated from dates"
              />
              <p className="text-xs text-muted-foreground">
                Year label is automatically generated from start and end dates.
              </p>
            </div>
            {mounted && (
              <div className="space-y-2">
                <Label htmlFor="status_id">Status</Label>
                <Select
                  value={formData.status_id}
                  onValueChange={(value) =>
                    setFormData({ ...formData, status_id: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select status" />
                  </SelectTrigger>
                  <SelectContent>
                    {statusOptions.map((status) => (
                      <SelectItem key={status.id} value={status.id}>
                        {status.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {editingSchoolYear && (
                  <p className="text-xs text-muted-foreground">
                    {statusOptions.find((s) => s.id === formData.status_id)?.code === "ACTIVE"
                      ? "Setting this to Active will automatically set all other Active school years to Inactive."
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingSchoolYear ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog 
        open={isDeleteDialogOpen} 
        onOpenChange={(open) => {
          setIsDeleteDialogOpen(open);
          if (!open) {
            setError(null); // Clear errors when dialog closes
            setDeletingSchoolYear(null);
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete School Year</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the school year "{deletingSchoolYear?.year_label}"?
              This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDeleteDialogOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
