"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ArrowLeft, Plus, Pencil, XCircle, Info, Trash2 } from "lucide-react";
import { normalizeRole, canPerform } from "@/lib/rbac";

interface Taxonomy {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
}

interface TaxonomyItem {
  id: string;
  taxonomy_id: string;
  code: string;
  label: string;
  description: string | null;
  sort_order: number | null;
  is_active: boolean;
  created_at: string;
}

interface TaxonomyGuidance {
  id: string;
  taxonomy_item_id: string;
  guidance_text: string;
}

export default function TaxonomyDetailPage() {
  const params = useParams();
  const router = useRouter();
  const taxonomyKey = params.key as string;

  const [taxonomy, setTaxonomy] = useState<Taxonomy | null>(null);
  const [items, setItems] = useState<TaxonomyItem[]>([]);
  const [guidanceMap, setGuidanceMap] = useState<Map<string, string>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isGuidanceDialogOpen, setIsGuidanceDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<TaxonomyItem | null>(null);
  const [editingGuidanceItemId, setEditingGuidanceItemId] = useState<string | null>(null);
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    label: "",
    code: "",
    description: "",
    sort_order: null as number | null,
    is_active: true,
  });
  const [guidanceText, setGuidanceText] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (!taxonomyKey) {
        setError("Taxonomy key is required");
        setLoading(false);
        return;
      }

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

      // Fetch taxonomy by key
      const { data: taxonomyData, error: taxonomyError } = await supabase
        .from("taxonomies")
        .select("id, key, name, description, is_active, is_system")
        .eq("key", taxonomyKey)
        .single();

      if (taxonomyError) {
        console.error("Error fetching taxonomy:", taxonomyError);
        console.error("Error message:", taxonomyError.message);
        console.error("Error code:", taxonomyError.code);
        
        // Distinguish between schema mismatch and table not found
        if (taxonomyError.code === "42703") {
          setError("Schema mismatch: Column does not exist. Please check that the taxonomies table has the expected columns.");
        } else if (taxonomyError.code === "42P01") {
          setError("Taxonomies table not found. Please run the SQL schema file (supabase_taxonomies_schema.sql) in your Supabase database.");
        } else {
          setError(taxonomyError.message || "Failed to fetch taxonomy.");
        }
        setLoading(false);
        return;
      }

      if (!taxonomyData) {
        setError("Taxonomy not found");
        setLoading(false);
        return;
      }

      setTaxonomy(taxonomyData);

      // Fetch taxonomy items
      const { data: itemsData, error: itemsError } = await supabase
        .from("taxonomy_items")
        .select("id, taxonomy_id, code, label, description, sort_order, is_active, created_at")
        .eq("taxonomy_id", taxonomyData.id)
        .order("sort_order", { ascending: true, nullsFirst: false })
        .order("label", { ascending: true });

      if (itemsError) {
        console.error("Error fetching taxonomy items:", itemsError);
        console.error("Error code:", itemsError.code);
        
        // Distinguish between schema mismatch and table not found
        if (itemsError.code === "42703") {
          setError("Schema mismatch: Column does not exist. Please check that the taxonomy_items table has the expected columns.");
        } else if (itemsError.code === "42P01") {
          setError("Taxonomy items table not found. Please run the SQL schema file (supabase_taxonomies_schema.sql) in your Supabase database.");
        } else {
          setError(itemsError.message || "Failed to fetch taxonomy items.");
        }
        setLoading(false);
        return;
      }

      setItems(itemsData || []);

      // Fetch guidance for all items
      if (itemsData && itemsData.length > 0) {
        const itemIds = itemsData.map((item) => item.id);
        const { data: guidanceData, error: guidanceError } = await supabase
          .from("taxonomy_guidance")
          .select("id, taxonomy_item_id, guidance_text")
          .in("taxonomy_item_id", itemIds);

        if (!guidanceError && guidanceData) {
          const guidance = new Map<string, string>();
          guidanceData.forEach((g) => {
            guidance.set(g.taxonomy_item_id, g.guidance_text);
          });
          setGuidanceMap(guidance);
        }
      }

      setError(null);
      setLoading(false);
    };

    fetchData();
  }, [taxonomyKey]);

  const handleCreate = () => {
    setFormData({
      label: "",
      code: "",
      description: "",
      sort_order: null,
      is_active: true,
    });
    setEditingItem(null);
    setIsDialogOpen(true);
  };

  const handleEdit = (item: TaxonomyItem) => {
    setFormData({
      label: item.label,
      code: item.code,
      description: item.description || "",
      sort_order: item.sort_order,
      is_active: item.is_active,
    });
    setEditingItem(item);
    setIsDialogOpen(true);
  };

  const handleEditGuidance = (item: TaxonomyItem) => {
    setEditingGuidanceItemId(item.id);
    setGuidanceText(guidanceMap.get(item.id) || "");
    setIsGuidanceDialogOpen(true);
  };

  const handleDisable = async (item: TaxonomyItem) => {
    if (!taxonomy) return;

    // Check if item is referenced (basic check - can be expanded)
    // For Phase-1, we'll allow disable but show a warning
    const confirmed = window.confirm(
      `Are you sure you want to disable "${item.label}"? This will make it unavailable for new records.`
    );

    if (!confirmed) return;

    const { error: updateError } = await supabase
      .from("taxonomy_items")
      .update({ is_active: false })
      .eq("id", item.id);

    if (updateError) {
      console.error("Error disabling item:", updateError);
      setError(updateError.message || "Failed to disable item.");
      return;
    }

    // Refresh items list
    const { data: itemsData, error: itemsError } = await supabase
      .from("taxonomy_items")
      .select("id, taxonomy_id, code, label, description, sort_order, is_active, created_at")
      .eq("taxonomy_id", taxonomy.id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true });

    if (!itemsError && itemsData) {
      setItems(itemsData);
      setError(null);
    }
  };

  const handleDelete = async (item: TaxonomyItem) => {
    if (!taxonomy) return;

    const confirmed = window.confirm(
      `Are you sure you want to delete "${item.label}"? This action cannot be undone. Any records using this item may be affected.`
    );

    if (!confirmed) return;

    // Delete guidance first if it exists
    const { error: guidanceDeleteError } = await supabase
      .from("taxonomy_guidance")
      .delete()
      .eq("taxonomy_item_id", item.id);

    if (guidanceDeleteError) {
      console.warn("Error deleting guidance (continuing anyway):", guidanceDeleteError);
    }

    // Delete the taxonomy item
    const { error: deleteError } = await supabase
      .from("taxonomy_items")
      .delete()
      .eq("id", item.id);

    if (deleteError) {
      console.error("Error deleting item:", deleteError);
      setError(deleteError.message || "Failed to delete item.");
      return;
    }

    // Remove from local guidance map
    const newGuidanceMap = new Map(guidanceMap);
    newGuidanceMap.delete(item.id);
    setGuidanceMap(newGuidanceMap);

    // Refresh items list
    const { data: itemsData, error: itemsError } = await supabase
      .from("taxonomy_items")
      .select("id, taxonomy_id, code, label, description, sort_order, is_active, created_at")
      .eq("taxonomy_id", taxonomy.id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true });

    if (!itemsError && itemsData) {
      setItems(itemsData);
      setError(null);
    }
  };

  const handleSubmit = async () => {
    if (!taxonomy) return;

    if (!formData.label || !formData.code) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);

    if (editingItem) {
      // Update existing item
      const updateData: any = {
        label: formData.label,
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };
      
      const { error: updateError } = await supabase
        .from("taxonomy_items")
        .update(updateData)
        .eq("id", editingItem.id);

      if (updateError) {
        console.error("Update taxonomy item error:", updateError);
        setError(updateError.message || "Failed to update item. Please check your permissions.");
        return;
      }
    } else {
      // Create new item
      const insertData: any = {
        taxonomy_id: taxonomy.id,
        label: formData.label,
        code: formData.code.toUpperCase(),
        description: formData.description || null,
        sort_order: formData.sort_order,
        is_active: formData.is_active,
      };
      
      const { error: createError } = await supabase.from("taxonomy_items").insert([insertData]);

      if (createError) {
        console.error("Create taxonomy item error:", createError);
        setError(createError.message || "Failed to create item. Please check your permissions.");
        return;
      }
    }

    // Refresh items list
    const { data: itemsData, error: itemsError } = await supabase
      .from("taxonomy_items")
      .select("id, taxonomy_id, code, label, description, sort_order, is_active, created_at")
      .eq("taxonomy_id", taxonomy.id)
      .order("sort_order", { ascending: true, nullsFirst: false })
      .order("label", { ascending: true });

    if (itemsError) {
      console.error("Error refreshing items:", itemsError);
      setError(itemsError.message || "Failed to refresh items list.");
    } else if (itemsData) {
      setItems(itemsData);
      setError(null);
    }

    setIsDialogOpen(false);
  };

  const handleSaveGuidance = async () => {
    if (!editingGuidanceItemId) return;

    setError(null);

    // Upsert guidance
    const { error: guidanceError } = await supabase
      .from("taxonomy_guidance")
      .upsert(
        {
          taxonomy_item_id: editingGuidanceItemId,
          guidance_text: guidanceText,
        },
        {
          onConflict: "taxonomy_item_id",
        }
      );

    if (guidanceError) {
      console.error("Error saving guidance:", guidanceError);
      setError(guidanceError.message || "Failed to save guidance.");
      return;
    }

    // Update local guidance map
    const newGuidanceMap = new Map(guidanceMap);
    newGuidanceMap.set(editingGuidanceItemId, guidanceText);
    setGuidanceMap(newGuidanceMap);

    setIsGuidanceDialogOpen(false);
    setEditingGuidanceItemId(null);
    setGuidanceText("");
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Taxonomy Details</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error && !taxonomy) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Taxonomy Details</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error || "Taxonomy not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Use explicit RBAC check for create/update permissions
  const canCreate = canPerform(role, "create", "taxonomies", originalRole);
  const canUpdate = canPerform(role, "update", "taxonomies", originalRole);
  const canEdit = canCreate || canUpdate;
  const isSystem = taxonomy?.is_system || false;
  // Allow CRUD on items even for system taxonomies - users can manage their own system taxonomies
  const canEditItems = canEdit;

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
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{taxonomy?.name}</h1>
          {taxonomy?.description && (
            <p className="text-sm text-muted-foreground mt-1">{taxonomy.description}</p>
          )}
          {isSystem && (
            <div className="mt-2 flex items-center gap-2 text-sm text-muted-foreground">
              <Info className="size-4" />
              <span>System-defined taxonomy</span>
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="text-lg font-medium">Items</h2>
        {canEditItems && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add Item
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

      {!error && items.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No items yet
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Label</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Code</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item.id} className="border-b">
                  <td className="px-4 py-3 text-sm font-medium">{item.label}</td>
                  <td className="px-4 py-3 text-sm font-mono text-xs">{item.code}</td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {item.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(item.is_active)}</td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {canEditItems && (
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleEdit(item)}
                              className="gap-1"
                            >
                              <Pencil className="size-4" />
                              Edit
                            </Button>
                            {item.is_active && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDisable(item)}
                                className="gap-1 text-muted-foreground hover:text-orange-600"
                              >
                                <XCircle className="size-4" />
                                Disable
                              </Button>
                            )}
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleDelete(item)}
                              className="gap-1 text-destructive hover:text-destructive"
                            >
                              <Trash2 className="size-4" />
                              Delete
                            </Button>
                          </>
                        )}
                        {canEdit && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEditGuidance(item)}
                            className="gap-1"
                          >
                            <Info className="size-4" />
                            Guidance
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

      {/* Create/Edit Item Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {editingItem ? "Edit Taxonomy Item" : "Add Taxonomy Item"}
            </DialogTitle>
            <DialogDescription>
              {editingItem
                ? "Update the taxonomy item information."
                : "Create a new taxonomy item."}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) =>
                  setFormData({ ...formData, label: e.target.value })
                }
                placeholder="Human-readable label"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="code">Code</Label>
              <Input
                id="code"
                value={formData.code}
                onChange={(e) => {
                  const processedValue = e.target.value.toUpperCase().replace(/\s+/g, "_");
                  setFormData({ ...formData, code: processedValue });
                }}
                placeholder="STABLE_IDENTIFIER"
                required
                disabled={!!editingItem} // Code is immutable after creation
              />
              <p className="text-muted-foreground text-xs">
                Stable identifier (e.g. LOW_INCOME, GRADE_6). Cannot be changed after creation.
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
            <div className="space-y-2">
              <Label htmlFor="sort_order">Sort Order (Optional)</Label>
              <Input
                id="sort_order"
                type="number"
                value={formData.sort_order ?? ""}
                onChange={(e) => {
                  const value = e.target.value;
                  setFormData({
                    ...formData,
                    sort_order: value === "" ? null : parseInt(value, 10),
                  });
                }}
                placeholder="1, 2, 3..."
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
              {editingItem ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Guidance Dialog */}
      <Dialog open={isGuidanceDialogOpen} onOpenChange={setIsGuidanceDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>Edit Guidance</DialogTitle>
            <DialogDescription>
              Add or edit guidance text for this taxonomy item. This helps staff make decisions and is not shown to students.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="guidance_text">Guidance Text</Label>
              <Textarea
                id="guidance_text"
                value={guidanceText}
                onChange={(e) => setGuidanceText(e.target.value)}
                placeholder="Enter guidance text to help staff understand when to use this taxonomy item..."
                rows={6}
              />
            </div>
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setIsGuidanceDialogOpen(false);
                setEditingGuidanceItemId(null);
                setGuidanceText("");
              }}
            >
              Cancel
            </Button>
            <Button onClick={handleSaveGuidance}>
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
