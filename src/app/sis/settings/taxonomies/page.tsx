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
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Settings, Info, Plus, Pencil, Trash2 } from "lucide-react";
import { normalizeRole, canPerform } from "@/lib/rbac";

interface Taxonomy {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

export default function TaxonomiesPage() {
  const router = useRouter();
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTaxonomy, setEditingTaxonomy] = useState<Taxonomy | null>(null);
  const [formData, setFormData] = useState({
    name: "",
    key: "",
    description: "",
    is_active: true,
    is_system: false,
  });

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
          setOriginalRole(profile.role);
        }
      }

      // Fetch taxonomies
      const { data, error: fetchError } = await supabase
        .from("taxonomies")
        .select("id, key, name, description, is_active, is_system, created_at")
        .order("name", { ascending: true });

      if (fetchError) {
        // Log error details explicitly
        console.error("Error fetching taxonomies:", fetchError);
        console.error("Error message:", fetchError.message);
        console.error("Error code:", fetchError.code);
        console.error("Error details:", fetchError.details);
        console.error("Error hint:", fetchError.hint);
        
        // Distinguish between schema mismatch and table not found
        if (fetchError.code === "42703") {
          setError("Schema mismatch: Column does not exist. Please check that the taxonomies table has the expected columns.");
        } else if (fetchError.code === "42P01") {
          setError("Taxonomies table not found. Please run the SQL schema file (supabase_taxonomies_schema.sql) in your Supabase database.");
        } else {
          setError(fetchError.message || "Failed to fetch taxonomies. Please check your permissions.");
        }
        setLoading(false);
        return;
      }

      setTaxonomies(data || []);
      setError(null);
      setLoading(false);
    };

    fetchData();
  }, []);

  const canCreate = canPerform(role, "create", "taxonomies", originalRole);
  const canUpdate = canPerform(role, "update", "taxonomies", originalRole);
  const canDelete = canPerform(role, "delete", "taxonomies", originalRole);
  const canEdit = canCreate || canUpdate || canDelete;

  const handleCreate = () => {
    setFormData({
      name: "",
      key: "",
      description: "",
      is_active: true,
      is_system: false,
    });
    setEditingTaxonomy(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (taxonomy: Taxonomy) => {
    setFormData({
      name: taxonomy.name,
      key: taxonomy.key,
      description: taxonomy.description || "",
      is_active: taxonomy.is_active,
      is_system: taxonomy.is_system,
    });
    setEditingTaxonomy(taxonomy);
    setIsDialogOpen(true);
  };

  const handleDelete = async (taxonomy: Taxonomy) => {
    if (taxonomy.is_system) {
      setError("Cannot delete system taxonomies.");
      return;
    }

    const confirmed = window.confirm(
      `Are you sure you want to delete "${taxonomy.name}"? This will also delete all associated taxonomy items. This action cannot be undone.`
    );

    if (!confirmed) return;

    // First, delete all taxonomy items
    const { data: items } = await supabase
      .from("taxonomy_items")
      .select("id")
      .eq("taxonomy_id", taxonomy.id);

    if (items && items.length > 0) {
      const { error: deleteItemsError } = await supabase
        .from("taxonomy_items")
        .delete()
        .eq("taxonomy_id", taxonomy.id);

      if (deleteItemsError) {
        console.error("Error deleting taxonomy items:", deleteItemsError);
        setError(deleteItemsError.message || "Failed to delete taxonomy items.");
        return;
      }
    }

    // Then delete the taxonomy
    const { error: deleteError } = await supabase
      .from("taxonomies")
      .delete()
      .eq("id", taxonomy.id);

    if (deleteError) {
      console.error("Error deleting taxonomy:", deleteError);
      setError(deleteError.message || "Failed to delete taxonomy.");
      return;
    }

    // Refresh list
    const { data, error: fetchError } = await supabase
      .from("taxonomies")
      .select("id, key, name, description, is_active, is_system, created_at")
      .order("name", { ascending: true });

    if (!fetchError && data) {
      setTaxonomies(data);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!formData.name || !formData.key) {
      setError("Please fill in all required fields.");
      return;
    }

    // Validate key format (should be lowercase, no spaces, alphanumeric + underscore)
    const keyRegex = /^[a-z][a-z0-9_]*$/;
    if (!keyRegex.test(formData.key)) {
      setError("Key must start with a letter and contain only lowercase letters, numbers, and underscores.");
      return;
    }

    setError(null);

    if (editingTaxonomy) {
      // Update existing taxonomy
      const { error: updateError } = await supabase
        .from("taxonomies")
        .update({
          name: formData.name,
          description: formData.description || null,
          is_active: formData.is_active,
          is_system: formData.is_system,
        })
        .eq("id", editingTaxonomy.id);

      if (updateError) {
        console.error("Update taxonomy error:", updateError);
        setError(updateError.message || "Failed to update taxonomy. Please check your permissions.");
        return;
      }
    } else {
      // Create new taxonomy
      const { error: createError } = await supabase
        .from("taxonomies")
        .insert({
          key: formData.key,
          name: formData.name,
          description: formData.description || null,
          is_active: formData.is_active,
          is_system: formData.is_system,
        });

      if (createError) {
        console.error("Create taxonomy error:", createError);
        if (createError.code === "23505") {
          setError("A taxonomy with this key already exists. Please use a different key.");
        } else {
          setError(createError.message || "Failed to create taxonomy. Please check your permissions.");
        }
        return;
      }
    }

    // Refresh list
    const { data, error: fetchError } = await supabase
      .from("taxonomies")
      .select("id, key, name, description, is_active, is_system, created_at")
      .order("name", { ascending: true });

    if (!fetchError && data) {
      setTaxonomies(data);
      setError(null);
    }

    setIsDialogOpen(false);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Taxonomies</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Active
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
        Inactive
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Taxonomies</h1>
        {canCreate && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add Taxonomy
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

      {!error && taxonomies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No taxonomies available yet
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Key</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {taxonomies.map((taxonomy) => (
                <tr key={taxonomy.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{taxonomy.name}</span>
                      {taxonomy.is_system && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          <Info className="size-3" />
                          System
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm font-mono text-xs text-muted-foreground">
                    {taxonomy.key}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {taxonomy.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(taxonomy.is_active)}</td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/sis/settings/taxonomies/${taxonomy.key}`)}
                        className="gap-1"
                      >
                        <Settings className="size-4" />
                        Manage
                      </Button>
                      {canUpdate && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleEdit(taxonomy)}
                          className="gap-1"
                        >
                          <Pencil className="size-4" />
                          Edit
                        </Button>
                      )}
                      {canDelete && !taxonomy.is_system && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDelete(taxonomy)}
                          className="gap-1 text-destructive hover:text-destructive"
                        >
                          <Trash2 className="size-4" />
                          Delete
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Create/Edit Taxonomy Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingTaxonomy ? "Edit Taxonomy" : "Add Taxonomy"}
            </DialogTitle>
            <DialogDescription>
              {editingTaxonomy
                ? editingTaxonomy.is_system
                  ? "Update the taxonomy information. You can toggle the System Taxonomy flag to enable/disable protection."
                  : "Update the taxonomy information."
                : "Create a new taxonomy. The key will be used as a stable identifier and cannot be changed after creation."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) =>
                  setFormData({ ...formData, name: e.target.value })
                }
                placeholder="Human-readable name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="key">Key *</Label>
              <Input
                id="key"
                value={formData.key}
                onChange={(e) => {
                  const processedValue = e.target.value.toLowerCase().replace(/\s+/g, "_");
                  setFormData({ ...formData, key: processedValue });
                }}
                placeholder="stable_identifier"
                required
                disabled={!!editingTaxonomy} // Key is immutable after creation
              />
              <p className="text-muted-foreground text-xs">
                Stable identifier (e.g., student_status, sex). Must start with a letter and contain only lowercase letters, numbers, and underscores. Cannot be changed after creation.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description (Optional)</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) =>
                  setFormData({ ...formData, description: e.target.value })
                }
                placeholder="Additional context or description"
                rows={3}
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
            <div className="flex items-center gap-2">
              <Switch
                id="is_system"
                checked={formData.is_system}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_system: checked })
                }
              />
              <Label htmlFor="is_system" className="cursor-pointer">
                System Taxonomy
              </Label>
            </div>
            {formData.is_system && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">System Taxonomy</p>
                    <p className="text-xs">
                      System taxonomies are protected and cannot be edited or deleted. 
                      Items within system taxonomies also cannot be modified. 
                      Use this flag to mark core taxonomies that should remain stable.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {editingTaxonomy && editingTaxonomy.is_system && !formData.is_system && (
              <div className="rounded-md bg-yellow-50 border border-yellow-200 p-3">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-yellow-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-yellow-800">
                    <p className="font-medium mb-1">Removing System Protection</p>
                    <p className="text-xs">
                      You are removing the system flag. After saving, this taxonomy and its items will become editable and deletable.
                    </p>
                  </div>
                </div>
              </div>
            )}
            {editingTaxonomy && editingTaxonomy.is_system && formData.is_system && (
              <div className="rounded-md bg-blue-50 border border-blue-200 p-3">
                <div className="flex items-start gap-2">
                  <Info className="size-4 text-blue-600 mt-0.5 flex-shrink-0" />
                  <div className="text-sm text-blue-800">
                    <p className="font-medium mb-1">Editing System Taxonomy</p>
                    <p className="text-xs">
                      This is a system taxonomy. You can edit its properties and toggle the System flag. 
                      To make it editable, turn off the "System Taxonomy" switch below.
                    </p>
                  </div>
                </div>
              </div>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              {editingTaxonomy ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
