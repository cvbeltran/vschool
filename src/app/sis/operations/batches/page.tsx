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
import { Plus, Edit, Archive, Search, X } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  listBatches,
  createBatch,
  updateBatch,
  archiveBatch,
  type Batch,
  type CreateBatchPayload,
  type UpdateBatchPayload,
} from "@/lib/phase6/operations";
import { normalizeRole } from "@/lib/rbac";

export default function BatchesPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("admin");
  const [originalRole, setOriginalRole] = useState<string | null>(null);

  // Filters
  const [filters, setFilters] = useState({
    program_id: searchParams.get("program") || "",
    status: searchParams.get("status") || "",
    search: searchParams.get("search") || "",
  });

  // Programs for filter
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);

  // Dialog state
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingBatch, setEditingBatch] = useState<Batch | null>(null);
  const [formData, setFormData] = useState<Partial<CreateBatchPayload>>({
    name: "",
    code: "",
    status: "active",
    notes: "",
  });
  const [saving, setSaving] = useState(false);

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

  // Fetch programs
  useEffect(() => {
    const fetchPrograms = async () => {
      if (orgLoading) return;
      let query = supabase.from("programs").select("id, name").order("name");
      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      const { data } = await query;
      setPrograms((data || []) as Array<{ id: string; name: string }>);
    };
    if (!orgLoading) {
      fetchPrograms();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Fetch batches
  useEffect(() => {
    const fetchBatches = async () => {
      if (orgLoading || !organizationId) return;
      setLoading(true);
      try {
        const data = await listBatches({
          program_id: filters.program_id || undefined,
          status: filters.status || undefined,
          search: filters.search || undefined,
          school_id: undefined, // Add school filter if needed
        });
        setBatches(data);
      } catch (error: any) {
        console.error("Error fetching batches:", error);
      } finally {
        setLoading(false);
      }
    };
    if (!orgLoading && organizationId) {
      fetchBatches();
    }
  }, [organizationId, orgLoading, filters]);

  // Update URL when filters change
  useEffect(() => {
    const params = new URLSearchParams();
    if (filters.program_id) params.set("program", filters.program_id);
    if (filters.status) params.set("status", filters.status);
    if (filters.search) params.set("search", filters.search);
    router.replace(`/sis/operations/batches?${params.toString()}`, { scroll: false });
  }, [filters, router]);

  const canManage = role === "admin" || role === "principal" || originalRole === "registrar";

  const handleOpenDialog = (batch?: Batch) => {
    if (batch) {
      setEditingBatch(batch);
      setFormData({
        name: batch.name,
        code: batch.code || "",
        status: batch.status || "active",
        notes: batch.notes || "",
        start_date: batch.start_date || undefined,
        end_date: batch.end_date || undefined,
      });
    } else {
      setEditingBatch(null);
      setFormData({
        name: "",
        code: "",
        status: "active",
        notes: "",
      });
    }
    setDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setDialogOpen(false);
    setEditingBatch(null);
    setFormData({
      name: "",
      code: "",
      status: "active",
      notes: "",
    });
  };

  const handleSave = async () => {
    if (!organizationId || !formData.name) return;
    setSaving(true);
    try {
      if (editingBatch) {
        const payload: UpdateBatchPayload = {
          name: formData.name,
          code: formData.code,
          status: formData.status || null,
          notes: formData.notes || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        };
        await updateBatch(editingBatch.id, payload);
      } else {
        const payload: CreateBatchPayload = {
          organization_id: organizationId,
          name: formData.name!,
          code: formData.code || "",
          status: formData.status || "active",
          notes: formData.notes || null,
          start_date: formData.start_date || null,
          end_date: formData.end_date || null,
        };
        await createBatch(payload);
      }
      handleCloseDialog();
      // Refetch batches
      const data = await listBatches({
        program_id: filters.program_id || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      setBatches(data);
    } catch (error: any) {
      console.error("Error saving batch:", error);
      alert(error.message || "Failed to save batch");
    } finally {
      setSaving(false);
    }
  };

  const handleArchive = async (batch: Batch) => {
    if (!confirm(`Are you sure you want to archive "${batch.name}"?`)) return;
    try {
      await archiveBatch(batch.id);
      // Refetch batches
      const data = await listBatches({
        program_id: filters.program_id || undefined,
        status: filters.status || undefined,
        search: filters.search || undefined,
      });
      setBatches(data);
    } catch (error: any) {
      console.error("Error archiving batch:", error);
      alert(error.message || "Failed to archive batch");
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Batches</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Batches</h1>
        {canManage && (
          <Button onClick={() => handleOpenDialog()}>
            <Plus className="mr-2 h-4 w-4" />
            Create Batch
          </Button>
        )}
      </div>

      {/* Filters */}
      <Card>
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
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
                  placeholder="Search batches..."
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

      {/* Batches Table */}
      {batches.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No batches found. {canManage && "Create your first batch to get started."}
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
                    <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                    <th className="px-4 py-3 text-left text-sm font-medium">Date Range</th>
                    {canManage && (
                      <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  {batches.map((batch) => (
                    <tr key={batch.id} className="border-b">
                      <td className="px-4 py-3 text-sm">{batch.code || "—"}</td>
                      <td className="px-4 py-3 text-sm font-medium">{batch.name}</td>
                      <td className="px-4 py-3 text-sm">
                        <Badge
                          variant={
                            batch.status === "active" ? "default" : "secondary"
                          }
                        >
                          {batch.status || "active"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {batch.start_date && batch.end_date
                          ? `${new Date(batch.start_date).toLocaleDateString()} - ${new Date(batch.end_date).toLocaleDateString()}`
                          : batch.start_date
                          ? `${new Date(batch.start_date).toLocaleDateString()} - —`
                          : "—"}
                      </td>
                      {canManage && (
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenDialog(batch)}
                            >
                              <Edit className="h-4 w-4" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleArchive(batch)}
                            >
                              <Archive className="h-4 w-4" />
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
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingBatch ? "Edit Batch" : "Create Batch"}
            </DialogTitle>
            <DialogDescription>
              {editingBatch
                ? "Update batch information"
                : "Create a new batch for student cohorts"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code || ""}
                onChange={(e) =>
                  setFormData({ ...formData, code: e.target.value })
                }
                placeholder="BATCH-2024"
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
                placeholder="Batch 2024"
                required
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Start Date</Label>
                <Input
                  id="start_date"
                  type="date"
                  value={formData.start_date || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, start_date: e.target.value || undefined })
                  }
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">End Date</Label>
                <Input
                  id="end_date"
                  type="date"
                  value={formData.end_date || ""}
                  onChange={(e) =>
                    setFormData({ ...formData, end_date: e.target.value || undefined })
                  }
                />
              </div>
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
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea
                id="notes"
                value={formData.notes || ""}
                onChange={(e) =>
                  setFormData({ ...formData, notes: e.target.value })
                }
                placeholder="Additional notes..."
                rows={3}
              />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" onClick={handleCloseDialog}>
                Cancel
              </Button>
              <Button onClick={handleSave} disabled={saving || !formData.name}>
                {saving ? "Saving..." : editingBatch ? "Update" : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
