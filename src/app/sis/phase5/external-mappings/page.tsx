"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listExternalIdMappings,
  createExternalIdMapping,
  updateExternalIdMapping,
  archiveExternalIdMapping,
  getEntityName,
  type ExternalIdMapping,
} from "@/lib/phase5/external-mappings";
import { Plus, Edit2, Archive, Link2 } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function ExternalMappingsPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mappings, setMappings] = useState<ExternalIdMapping[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingMapping, setEditingMapping] = useState<ExternalIdMapping | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Form state
  const [entityType, setEntityType] = useState<
    "student" | "school" | "program" | "section" | "school_year" | "staff"
  >("student");
  const [internalId, setInternalId] = useState("");
  const [externalSystem, setExternalSystem] = useState("");
  const [externalId, setExternalId] = useState("");
  const [externalIdDisplayName, setExternalIdDisplayName] = useState("");
  const [isActive, setIsActive] = useState(true);

  // Entity options
  const [entityOptions, setEntityOptions] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [entityOptionsLoading, setEntityOptionsLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

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
          setRole(normalizeRole(profile.role));
        }
      }

      const canManage = role === "principal" || role === "admin";
      if (!canManage) {
        setError("You do not have permission to manage external ID mappings");
        setLoading(false);
        return;
      }

      try {
        const orgId = isSuperAdmin ? null : organizationId || null;
        const data = await listExternalIdMappings(orgId);
        setMappings(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching mappings:", err);
        setError(err.message || "Failed to load external ID mappings");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, role]);

  useEffect(() => {
    const fetchEntityOptions = async () => {
      if (!entityType || orgLoading) return;

      setEntityOptionsLoading(true);
      try {
        const orgId = isSuperAdmin ? null : organizationId || null;
        let query;

        switch (entityType) {
          case "student":
            query = supabase
              .from("students")
              .select("id, first_name, last_name, student_number")
              .eq("archived_at", null)
              .order("last_name", { ascending: true });
            break;
          case "school":
            query = supabase
              .from("schools")
              .select("id, name")
              .eq("archived_at", null)
              .order("name", { ascending: true });
            break;
          case "program":
            query = supabase
              .from("programs")
              .select("id, name")
              .eq("archived_at", null)
              .order("name", { ascending: true });
            break;
          case "section":
            query = supabase
              .from("sections")
              .select("id, name")
              .eq("archived_at", null)
              .order("name", { ascending: true });
            break;
          case "school_year":
            query = supabase
              .from("school_years")
              .select("id, year_label")
              .eq("archived_at", null)
              .order("start_date", { ascending: false });
            break;
          case "staff":
            query = supabase
              .from("staff")
              .select("id, first_name, last_name")
              .eq("archived_at", null)
              .order("last_name", { ascending: true });
            break;
        }

        if (orgId && query) {
          query = query.eq("organization_id", orgId);
        }

        const { data } = await query;
        if (data) {
          setEntityOptions(
            data.map((item: any) => ({
              id: item.id,
              name:
                entityType === "student" || entityType === "staff"
                  ? `${item.first_name || ""} ${item.last_name || ""}`.trim() ||
                    item.student_number ||
                    item.id
                  : item.name || item.year_label || item.id,
            }))
          );
        }
      } catch (err) {
        console.error("Error fetching entity options:", err);
      } finally {
        setEntityOptionsLoading(false);
      }
    };

    fetchEntityOptions();
  }, [entityType, organizationId, isSuperAdmin, orgLoading]);

  const canManage = role === "principal" || role === "admin";

  const handleCreate = () => {
    setEditingMapping(null);
    setEntityType("student");
    setInternalId("");
    setExternalSystem("");
    setExternalId("");
    setExternalIdDisplayName("");
    setIsActive(true);
    setIsFormOpen(true);
  };

  const handleEdit = (mapping: ExternalIdMapping) => {
    setEditingMapping(mapping);
    setEntityType(mapping.entity_type);
    setInternalId(mapping.internal_id);
    setExternalSystem(mapping.external_system);
    setExternalId(mapping.external_id);
    setExternalIdDisplayName(mapping.external_id_display_name || "");
    setIsActive(mapping.is_active);
    setIsFormOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const orgId =
        isSuperAdmin && organizationId
          ? organizationId
          : (await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", session.user.id)
              .single()).data?.organization_id;

      if (!orgId) {
        throw new Error("Organization ID not found");
      }

      if (editingMapping) {
        await updateExternalIdMapping(editingMapping.id, {
          external_id: externalId,
          external_id_display_name: externalIdDisplayName || null,
          is_active: isActive,
          updated_by: session.user.id,
        });
      } else {
        await createExternalIdMapping({
          organization_id: orgId,
          entity_type: entityType,
          internal_id: internalId,
          external_system: externalSystem,
          external_id: externalId,
          external_id_display_name: externalIdDisplayName || null,
          is_active: isActive,
          created_by: session.user.id,
        });
      }

      setIsFormOpen(false);
      setEditingMapping(null);

      // Refresh list
      const orgIdForRefresh = isSuperAdmin ? null : organizationId || null;
      const updated = await listExternalIdMappings(orgIdForRefresh);
      setMappings(updated);
    } catch (err: any) {
      console.error("Error saving mapping:", err);
      setError(err.message || "Failed to save external ID mapping");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this mapping?")) {
      return;
    }

    setArchivingId(id);
    try {
      await archiveExternalIdMapping(id);
      const orgId = isSuperAdmin ? null : organizationId || null;
      const updated = await listExternalIdMappings(orgId);
      setMappings(updated);
    } catch (err: any) {
      console.error("Error archiving mapping:", err);
      alert(err.message || "Failed to archive mapping");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error && !canManage) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">External ID Mappings</h1>
          <p className="text-muted-foreground mt-1">
            Map internal entities to external system identifiers
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Mapping
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingMapping ? "Edit Mapping" : "Create Mapping"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="entity-type">Entity Type *</Label>
                <Select
                  value={entityType}
                  onValueChange={(value: any) => {
                    setEntityType(value);
                    setInternalId("");
                  }}
                  disabled={!!editingMapping}
                >
                  <SelectTrigger id="entity-type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="student">Student</SelectItem>
                    <SelectItem value="school">School</SelectItem>
                    <SelectItem value="program">Program</SelectItem>
                    <SelectItem value="section">Section</SelectItem>
                    <SelectItem value="school_year">School Year</SelectItem>
                    <SelectItem value="staff">Staff</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="internal-id">Internal Entity *</Label>
                <Select
                  value={internalId}
                  onValueChange={setInternalId}
                  disabled={!!editingMapping || entityOptionsLoading}
                  required
                >
                  <SelectTrigger id="internal-id">
                    <SelectValue placeholder="Select entity" />
                  </SelectTrigger>
                  <SelectContent>
                    {entityOptions.map((option) => (
                      <SelectItem key={option.id} value={option.id}>
                        {option.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="external-system">External System *</Label>
                <Input
                  id="external-system"
                  value={externalSystem}
                  onChange={(e) => setExternalSystem(e.target.value)}
                  disabled={!!editingMapping}
                  required
                  placeholder="e.g., deped_sis, ched_portal"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="external-id">External ID *</Label>
                <Input
                  id="external-id"
                  value={externalId}
                  onChange={(e) => setExternalId(e.target.value)}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="external-id-display-name">
                  External ID Display Name (Optional)
                </Label>
                <Input
                  id="external-id-display-name"
                  value={externalIdDisplayName}
                  onChange={(e) => setExternalIdDisplayName(e.target.value)}
                  placeholder="Human-readable label"
                />
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="is-active">Active</Label>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Mapping"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingMapping(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Mappings List */}
      <Card>
        <CardHeader>
          <CardTitle>Mappings</CardTitle>
        </CardHeader>
        <CardContent>
          {mappings.length === 0 ? (
            <div className="text-center py-12">
              <Link2 className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No mappings found</p>
              <p className="text-sm text-muted-foreground">
                Create your first mapping to get started
              </p>
              {canManage && (
                <Button className="mt-4" onClick={handleCreate}>
                  Create Mapping
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {mappings.map((mapping) => (
                <Card key={mapping.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold capitalize">{mapping.entity_type}</h3>
                          {mapping.is_active && (
                            <Badge variant="default">Active</Badge>
                          )}
                          <Badge variant="outline">{mapping.external_system}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          External ID: {mapping.external_id}
                          {mapping.external_id_display_name && ` (${mapping.external_id_display_name})`}
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Created {new Date(mapping.created_at).toLocaleDateString()}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(mapping)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(mapping.id)}
                            disabled={archivingId === mapping.id}
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
        </CardContent>
      </Card>
    </div>
  );
}
