"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Plus, Pencil, Trash2 } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { supabase } from "@/lib/supabase/client";
import {
  listPeriods,
  createPeriod,
  updatePeriod,
  deletePeriod,
  type Period,
  type CreatePeriodPayload,
  type UpdatePeriodPayload,
} from "@/lib/phase6/scheduling";
import { Toast, ToastContainer } from "@/components/ui/toast";

export default function PeriodsPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [toasts, setToasts] = useState<Toast[]>([]);

  const showToast = (message: string, type: Toast["type"] = "success") => {
    const id = Math.random().toString(36).substring(7);
    setToasts((prev) => [...prev, { id, message, type }]);
  };

  const removeToast = (id: string) => {
    setToasts((prev) => prev.filter((toast) => toast.id !== id));
  };
  
  const [periods, setPeriods] = useState<Period[]>([]);
  const [loading, setLoading] = useState(true);
  const [schools, setSchools] = useState<Array<{ id: string; name: string }>>([]);
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; year_label: string }>>([]);
  
  // Filters from URL
  const [filters, setFilters] = useState({
    school_id: searchParams.get("school") || "",
    school_year_id: searchParams.get("term") || "",
  });

  // Create/Edit dialog
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingPeriod, setEditingPeriod] = useState<Period | null>(null);
  const [formData, setFormData] = useState<Partial<CreatePeriodPayload>>({
    name: "",
    start_time: "",
    end_time: "",
    sort_order: 0,
  });
  const [submitting, setSubmitting] = useState(false);

  // Fetch schools and school years
  useEffect(() => {
    const fetchOptions = async () => {
      if (orgLoading || !organizationId) return;

      // Fetch schools
      let schoolsQuery = supabase
        .from("schools")
        .select("id, name")
        .eq("is_active", true)
        .order("name");
      
      if (!isSuperAdmin) {
        schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
      }

      const { data: schoolsData } = await schoolsQuery;
      setSchools((schoolsData || []) as Array<{ id: string; name: string }>);

      // Fetch school years
      let yearsQuery = supabase
        .from("school_years")
        .select("id, year_label")
        .order("year_label", { ascending: false });
      
      if (!isSuperAdmin) {
        yearsQuery = yearsQuery.eq("organization_id", organizationId);
      }

      const { data: yearsData } = await yearsQuery;
      setSchoolYears((yearsData || []) as Array<{ id: string; year_label: string }>);
    };

    fetchOptions();
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Fetch periods
  useEffect(() => {
    const fetchPeriods = async () => {
      if (orgLoading || !organizationId) return;
      if (!filters.school_id || !filters.school_year_id) {
        setPeriods([]);
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await listPeriods({
          school_id: filters.school_id,
          school_year_id: filters.school_year_id,
        });
        setPeriods(data);
      } catch (error: any) {
        console.error("Error fetching periods:", error);
        showToast(error.message || "Failed to load periods", "error");
      } finally {
        setLoading(false);
      }
    };

    fetchPeriods();
  }, [organizationId, orgLoading, filters, toast]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.school_id) params.set("school", filters.school_id);
    if (filters.school_year_id) params.set("term", filters.school_year_id);
    router.replace(`/sis/operations/scheduling/periods?${params.toString()}`);
  }, [filters, router]);

  const handleOpenCreate = () => {
    if (!filters.school_id || !filters.school_year_id) {
      showToast("You must select a school and term before creating periods", "error");
      return;
    }

    setEditingPeriod(null);
    setFormData({
      name: "",
      start_time: "",
      end_time: "",
      sort_order: periods.length,
    });
    setDialogOpen(true);
  };

  const handleOpenEdit = (period: Period) => {
    setEditingPeriod(period);
    setFormData({
      name: period.name,
      start_time: period.start_time,
      end_time: period.end_time,
      sort_order: period.sort_order,
    });
    setDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!organizationId || !filters.school_id || !filters.school_year_id) {
      return;
    }

    if (!formData.name || !formData.start_time || !formData.end_time) {
      showToast("Please fill in all required fields", "error");
      return;
    }

    setSubmitting(true);
    try {
      if (editingPeriod) {
        await updatePeriod(editingPeriod.id, formData as UpdatePeriodPayload);
        showToast("Period updated successfully", "success");
      } else {
        await createPeriod({
          organization_id: organizationId,
          school_id: filters.school_id,
          school_year_id: filters.school_year_id,
          ...formData,
        } as CreatePeriodPayload);
        showToast("Period created successfully", "success");
      }
      setDialogOpen(false);
      // Refresh list
      const data = await listPeriods({
        school_id: filters.school_id,
        school_year_id: filters.school_year_id,
      });
      setPeriods(data);
    } catch (error: any) {
      console.error("Error saving period:", error);
      showToast(error.message || "Failed to save period", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (period: Period) => {
    if (!confirm(`Are you sure you want to delete period "${period.name}"?`)) {
      return;
    }

    try {
      await deletePeriod(period.id);
      showToast("Period deleted successfully", "success");
      // Refresh list
      const data = await listPeriods({
        school_id: filters.school_id,
        school_year_id: filters.school_year_id,
      });
      setPeriods(data);
    } catch (error: any) {
      console.error("Error deleting period:", error);
      showToast(error.message || "Failed to delete period", "error");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Periods / Time Blocks</h1>
        <Button onClick={handleOpenCreate}>
          <Plus className="mr-2 h-4 w-4" />
          Create Period
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>School</Label>
              <Select
                value={filters.school_id || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, school_id: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select school" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Term / School Year</Label>
              <Select
                value={filters.school_year_id || "all"}
                onValueChange={(value) =>
                  setFilters({ ...filters, school_year_id: value === "all" ? "" : value })
                }
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select term" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All terms</SelectItem>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Periods List */}
      {loading ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">Loading...</div>
          </CardContent>
        </Card>
      ) : periods.length === 0 ? (
        <Card>
          <CardContent className="py-8">
            <div className="text-center text-muted-foreground">
              {filters.school_id && filters.school_year_id
                ? "No periods found. Create your first period."
                : "Please select a school and term to view periods."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Periods ({periods.length})</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {periods.map((period) => (
                <div
                  key={period.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div className="flex-1">
                    <div className="font-medium">{period.name}</div>
                    <div className="text-sm text-muted-foreground">
                      {period.start_time} - {period.end_time}
                      {period.sort_order !== null && (
                        <span className="ml-2">(Order: {period.sort_order})</span>
                      )}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleOpenEdit(period)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDelete(period)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingPeriod ? "Edit Period" : "Create Period"}
            </DialogTitle>
            <DialogDescription>
              Define a time block for scheduling. Periods are scoped to a school and term.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Name *</Label>
              <Input
                value={formData.name || ""}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="e.g., P1, Period 1, Morning Block"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Start Time *</Label>
                <Input
                  type="time"
                  value={formData.start_time || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, start_time: e.target.value })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label>End Time *</Label>
                <Input
                  type="time"
                  value={formData.end_time || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, end_time: e.target.value })
                  }
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Sort Order</Label>
              <Input
                type="number"
                value={formData.sort_order ?? 0}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    sort_order: parseInt(e.target.value) || 0,
                  })
                }
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={() => setDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleSubmit} disabled={submitting}>
                {submitting ? "Saving..." : editingPeriod ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Toast Container */}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </div>
  );
}
