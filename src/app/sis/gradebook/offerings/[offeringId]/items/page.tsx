"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, Edit, Trash2, Calendar } from "lucide-react";
import {
  listGradedItems,
  createGradedItem,
  updateGradedItem,
  archiveGradedItem,
  listSchemes,
  listComponents,
  type GradebookGradedItem,
  type GradebookComponent,
} from "@/lib/gradebook";
import { getOfferingContext } from "@/lib/gradebook-offerings";
import type { OfferingContext } from "@/lib/gradebook-offerings";
import { OfferingContextHeader } from "@/components/gradebook/OfferingContextHeader";

export default function OfferingItemsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const offeringId = params.offeringId as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();

  const [offeringContext, setOfferingContext] = useState<OfferingContext | null>(null);
  const [items, setItems] = useState<GradebookGradedItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GradebookGradedItem | null>(null);
  const [schemes, setSchemes] = useState<Array<{ id: string; name: string; scheme_type: string }>>([]);
  const [components, setComponents] = useState<GradebookComponent[]>([]);
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; year_label: string }>>([]);

  const termPeriod = searchParams.get("term_period") || offeringContext?.term_period || "";

  const [formData, setFormData] = useState({
    scheme_id: "",
    component_id: "",
    school_year_id: "",
    term_period: termPeriod,
    title: "",
    description: "",
    max_points: 100,
    due_at: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !organizationId || !offeringId) return;

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // Fetch offering context
        const context = await getOfferingContext(offeringId);
        if (!context) throw new Error("Offering not found");
        setOfferingContext(context);

        // Set form defaults from context
        setFormData((prev) => ({
          ...prev,
          school_year_id: context.school_year_id,
          term_period: context.term_period,
        }));

        // Fetch schemes
        const schemesData = await listSchemes(organizationId);
        setSchemes(schemesData.filter((s) => s.published_at));

        // Fetch school years
        const { data: yearsData } = await supabase
          .from("school_years")
          .select("id, year_label")
          .order("year_label", { ascending: false });
        setSchoolYears(yearsData || []);

        // Fetch items for this offering
        const itemsData = await listGradedItems({
          section_subject_offering_id: offeringId,
          term_period: context.term_period,
        });
        setItems(itemsData);
      } catch (error: any) {
        console.error("Error fetching data", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading, organizationId, offeringId, toast]);

  useEffect(() => {
    const fetchComponents = async () => {
      if (!formData.scheme_id) {
        setComponents([]);
        return;
      }

      try {
        const componentsData = await listComponents(formData.scheme_id);
        setComponents(componentsData);
      } catch (error: any) {
        console.error("Error fetching components", error);
      }
    };

    fetchComponents();
  }, [formData.scheme_id]);

  const handleCreateItem = async () => {
    if (!formData.scheme_id || !formData.component_id || !formData.title || !offeringContext) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Use API route instead of direct client call to ensure proper authorization
      const response = await fetch("/api/gradebook/graded-items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section_subject_offering_id: offeringId, // Preferred for new workflows
          section_id: offeringContext.section_id, // Also set for backwards compatibility
          school_id: offeringContext.school_id,
          school_year_id: offeringContext.school_year_id,
          term_period: offeringContext.term_period,
          component_id: formData.component_id,
          title: formData.title,
          description: formData.description || null,
          max_points: formData.max_points,
          due_at: formData.due_at || null,
        }),
      });

      const responseData = await response.json();

      if (!response.ok) {
        // Log debug info if available
        if (responseData.debug) {
          console.error("Authorization debug info:", responseData.debug);
        }
        throw new Error(responseData.error || "Failed to create graded item");
      }

      const { item } = responseData;

      toast({
        title: "Success",
        description: "Graded item created",
      });

      setItemDialogOpen(false);
      setFormData({
        scheme_id: "",
        component_id: "",
        school_year_id: offeringContext.school_year_id,
        term_period: offeringContext.term_period,
        title: "",
        description: "",
        max_points: 100,
        due_at: "",
      });

      // Refresh items
      const itemsData = await listGradedItems({
        section_subject_offering_id: offeringId,
        term_period: offeringContext.term_period,
      });
      setItems(itemsData);
    } catch (error: any) {
      console.error("Error creating item", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !formData.component_id || !formData.title) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      await updateGradedItem(editingItem.id, {
        component_id: formData.component_id,
        term_period: formData.term_period,
        title: formData.title,
        description: formData.description || null,
        max_points: formData.max_points,
        due_at: formData.due_at || null,
        updated_by: session.user.id,
      });

      toast({
        title: "Success",
        description: "Graded item updated",
      });

      setItemDialogOpen(false);
      setEditingItem(null);

      // Refresh items
      if (offeringContext) {
        const itemsData = await listGradedItems({
          section_subject_offering_id: offeringId,
          term_period: offeringContext.term_period,
        });
        setItems(itemsData);
      }
    } catch (error: any) {
      console.error("Error updating item", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    }
  };

  const handleEditItem = (item: GradebookGradedItem) => {
    setEditingItem(item);
    setFormData({
      scheme_id: "",
      component_id: item.component_id,
      school_year_id: item.school_year_id,
      term_period: item.term_period,
      title: item.title,
      description: item.description || "",
      max_points: item.max_points,
      due_at: item.due_at ? new Date(item.due_at).toISOString().slice(0, 16) : "",
    });
    setItemDialogOpen(true);
  };

  const handleArchiveItem = async (id: string) => {
    if (!confirm("Are you sure you want to archive this item?")) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      await archiveGradedItem(id, session.user.id);

      toast({
        title: "Success",
        description: "Item archived",
      });

      // Refresh items
      if (offeringContext) {
        const itemsData = await listGradedItems({
          section_subject_offering_id: offeringId,
          term_period: offeringContext.term_period,
        });
        setItems(itemsData);
      }
    } catch (error: any) {
      console.error("Error archiving item", error);
      toast({
        title: "Error",
        description: error.message || "Failed to archive item",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading items...</p>
        </div>
      </div>
    );
  }

  if (!offeringContext) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Offering not found</h3>
            <p className="text-muted-foreground">The subject offering could not be loaded.</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Graded Items</h1>
            <p className="text-muted-foreground mt-1">
              Manage graded items for {offeringContext.subject_name}
            </p>
          </div>
        </div>
        <Dialog open={itemDialogOpen} onOpenChange={setItemDialogOpen}>
          <DialogTrigger asChild>
            <Button
              onClick={() => {
                setEditingItem(null);
                setFormData({
                  scheme_id: "",
                  component_id: "",
                  school_year_id: offeringContext.school_year_id,
                  term_period: offeringContext.term_period,
                  title: "",
                  description: "",
                  max_points: 100,
                  due_at: "",
                });
              }}
            >
              <Plus className="mr-2 h-4 w-4" />
              Create Item
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>{editingItem ? "Edit Graded Item" : "Create Graded Item"}</DialogTitle>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              {!editingItem && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="scheme_id">Scheme *</Label>
                    <Select
                      value={formData.scheme_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, scheme_id: value, component_id: "" })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select scheme" />
                      </SelectTrigger>
                      <SelectContent>
                        {schemes.map((scheme) => (
                          <SelectItem key={scheme.id} value={scheme.id}>
                            {scheme.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="component_id">Component *</Label>
                    <Select
                      value={formData.component_id}
                      onValueChange={(value) => setFormData({ ...formData, component_id: value })}
                      disabled={!formData.scheme_id}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select component" />
                      </SelectTrigger>
                      <SelectContent>
                        {components.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id}>
                            {comp.code} - {comp.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              {editingItem && (
                <>
                  <div className="grid gap-2">
                    <Label htmlFor="edit_component_id">Component *</Label>
                    <Select
                      value={formData.component_id}
                      onValueChange={(value) => setFormData({ ...formData, component_id: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select component" />
                      </SelectTrigger>
                      <SelectContent>
                        {components.map((comp) => (
                          <SelectItem key={comp.id} value={comp.id}>
                            {comp.code} - {comp.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </>
              )}
              <div className="grid gap-2">
                <Label htmlFor="title">Title *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="e.g., Quiz 1, Midterm Exam"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                  <Label htmlFor="max_points">Max Points *</Label>
                  <Input
                    id="max_points"
                    type="number"
                    min="1"
                    value={formData.max_points}
                    onChange={(e) =>
                      setFormData({ ...formData, max_points: parseInt(e.target.value) || 100 })
                    }
                  />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="due_at">Due Date</Label>
                  <Input
                    id="due_at"
                    type="datetime-local"
                    value={formData.due_at}
                    onChange={(e) => setFormData({ ...formData, due_at: e.target.value })}
                  />
                </div>
              </div>
            </div>
            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setItemDialogOpen(false);
                  setEditingItem(null);
                  setFormData({
                    scheme_id: "",
                    component_id: "",
                    school_year_id: offeringContext.school_year_id,
                    term_period: offeringContext.term_period,
                    title: "",
                    description: "",
                    max_points: 100,
                    due_at: "",
                  });
                }}
              >
                Cancel
              </Button>
              <Button
                onClick={editingItem ? handleUpdateItem : handleCreateItem}
                disabled={
                  editingItem
                    ? !formData.component_id || !formData.title
                    : !formData.scheme_id || !formData.component_id || !formData.title
                }
              >
                {editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Offering Context Header */}
      <OfferingContextHeader offeringId={offeringId} />

      <Card>
        <CardHeader>
          <CardTitle>Graded Items</CardTitle>
        </CardHeader>
        <CardContent>
          {items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No graded items yet. Create your first item to get started.
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Title</TableHead>
                  <TableHead>Component</TableHead>
                  <TableHead>Term</TableHead>
                  <TableHead>Max Points</TableHead>
                  <TableHead>Due Date</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {items.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>{item.title}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {(item.component as any)?.code || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>{item.term_period}</TableCell>
                    <TableCell>{item.max_points}</TableCell>
                    <TableCell>
                      {item.due_at ? (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-4 w-4" />
                          {new Date(item.due_at).toLocaleDateString()}
                        </span>
                      ) : (
                        "-"
                      )}
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleEditItem(item)}
                        >
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={() => handleArchiveItem(item.id)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
