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
import { getSectionContext } from "@/lib/gradebook-section-context";
import type { SectionContext } from "@/lib/gradebook-section-context";
import { listSectionOfferings, type SectionSubjectOffering } from "@/lib/gradebook-offerings";
import { SectionContextHeader } from "@/components/gradebook/SectionContextHeader";

export default function SectionItemsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const sectionId = params.id as string;
  const termPeriod = searchParams.get("term") || "";
  const period = searchParams.get("period") || "";

  const [sectionContext, setSectionContext] = useState<SectionContext | null>(null);
  const [items, setItems] = useState<GradebookGradedItem[]>([]);
  const [schemes, setSchemes] = useState<Array<{ id: string; name: string; scheme_type: string }>>([]);
  const [components, setComponents] = useState<GradebookComponent[]>([]);
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; year_label: string }>>([]);
  const [offerings, setOfferings] = useState<SectionSubjectOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [itemDialogOpen, setItemDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<GradebookGradedItem | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  // Separate filter state from form state
  const [filterTermPeriod, setFilterTermPeriod] = useState(termPeriod || period || "");

  const [formData, setFormData] = useState({
    scheme_id: "",
    component_id: "",
    school_year_id: "",
    term_period: termPeriod || period || "",
    section_subject_offering_id: "",
    title: "",
    description: "",
    max_points: 100,
    due_at: "",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !organizationId || !sectionId) return;

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // Fetch section context
        const context = await getSectionContext(sectionId);
        if (!context) throw new Error("Section not found");
        setSectionContext(context);

        // Fetch school years
        const { data: yearsData } = await supabase
          .from("school_years")
          .select("id, year_label")
          .order("year_label", { ascending: false });
        setSchoolYears(yearsData || []);

        // Fetch schemes using listSchemes function (same as offerings page)
        const schemesData = await listSchemes(organizationId);
        setSchemes(schemesData.filter((s) => s.published_at));

        // Fetch items
        const itemsData = await listGradedItems({
          section_id: sectionId,
          term_period: filterTermPeriod || undefined,
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
  }, [orgLoading, organizationId, sectionId, filterTermPeriod, toast]);

  // Fetch components when scheme changes (for both create and edit modes)
  useEffect(() => {
    const fetchComponents = async () => {
      if (!formData.scheme_id) {
        // Don't clear components if we're editing (they might already be loaded)
        if (!editingItem) {
          setComponents([]);
        }
        return;
      }
      try {
        const comps = await listComponents(formData.scheme_id);
        setComponents(comps);
      } catch (error: any) {
        console.error("Error fetching components", error);
      }
    };

    fetchComponents();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.scheme_id]);

  // Fetch offerings when school_year_id and term_period change
  useEffect(() => {
    const fetchOfferings = async () => {
      if (!sectionId || !formData.school_year_id || !formData.term_period) {
        setOfferings([]);
        // Clear offering selection if filters change
        if (!editingItem) {
          setFormData((prev) => ({ ...prev, section_subject_offering_id: "" }));
        }
        return;
      }

      try {
        const offeringsData = await listSectionOfferings(
          sectionId,
          formData.school_year_id,
          formData.term_period
        );
        setOfferings(offeringsData);
      } catch (error: any) {
        console.error("Error fetching offerings", error);
        setOfferings([]);
      }
    };

    fetchOfferings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sectionId, formData.school_year_id, formData.term_period]);

  const handleCreateItem = async () => {
    if (!formData.scheme_id || !formData.component_id || !formData.school_year_id || !formData.term_period || !formData.title || !sectionContext) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    if (isSubmitting) return; // Prevent double submission

    setIsSubmitting(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      console.log("Creating graded item with data:", {
        section_id: sectionId,
        school_id: sectionContext.school_id,
        school_year_id: formData.school_year_id,
        term_period: formData.term_period,
        component_id: formData.component_id,
        title: formData.title,
        max_points: formData.max_points,
      });

      // Use API route instead of direct client call to ensure proper authorization
      const response = await fetch("/api/gradebook/graded-items", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          section_id: sectionId, // Legacy support
          section_subject_offering_id: formData.section_subject_offering_id || null, // Preferred for new workflows
          school_id: sectionContext.school_id,
          school_year_id: formData.school_year_id,
          term_period: formData.term_period,
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
        console.error("API error response:", responseData);
        throw new Error(responseData.error || "Failed to create graded item");
      }

      const { item } = responseData;

      if (!item || !item.id) {
        console.error("Invalid item response:", responseData);
        throw new Error("Server returned invalid item data");
      }

      console.log("Item created successfully:", item.id);

      // Close dialog first
      setItemDialogOpen(false);
      
      // Reset form
      setFormData({
        scheme_id: "",
        component_id: "",
        school_year_id: "",
        term_period: formData.term_period,
        section_subject_offering_id: "",
        title: "",
        description: "",
        max_points: 100,
        due_at: "",
      });

      // Show success toast
      toast({
        title: "Success",
        description: "Graded item created successfully",
      });

      // Refresh items
      const itemsData = await listGradedItems({
        section_id: sectionId,
        term_period: filterTermPeriod || undefined,
      });
      setItems(itemsData);
    } catch (error: any) {
      console.error("Error creating item", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create item",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateItem = async () => {
    if (!editingItem || !organizationId) return;
    
    if (isSubmitting) return; // Prevent double submission
    
    setIsSubmitting(true);
    
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updatedItem = await updateGradedItem(editingItem.id, {
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
      const itemsData = await listGradedItems({
        section_id: sectionId,
        term_period: filterTermPeriod || undefined,
      });
      setItems(itemsData);
    } catch (error: any) {
      console.error("Error updating item", error);
      toast({
        title: "Error",
        description: error.message || "Failed to update item",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEditItem = async (item: GradebookGradedItem) => {
    setEditingItem(item);
    // Get the scheme_id from the component
    const component = item.component as any;
    const schemeId = component?.scheme_id || "";
    
    // Fetch components for the scheme so they're available in the dropdown
    if (schemeId) {
      try {
        const comps = await listComponents(schemeId);
        setComponents(comps);
      } catch (error: any) {
        console.error("Error fetching components for edit", error);
      }
    }

    // Fetch offerings for the item's school_year_id and term_period
    if (item.school_year_id && item.term_period) {
      try {
        const offeringsData = await listSectionOfferings(
          sectionId,
          item.school_year_id,
          item.term_period
        );
        setOfferings(offeringsData);
      } catch (error: any) {
        console.error("Error fetching offerings for edit", error);
      }
    }
    
    setFormData({
      scheme_id: schemeId,
      component_id: item.component_id,
      school_year_id: item.school_year_id,
      term_period: item.term_period,
      section_subject_offering_id: (item as any).section_subject_offering_id || "",
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
      const itemsData = await listGradedItems({
        section_id: sectionId,
        term_period: filterTermPeriod || undefined,
      });
      setItems(itemsData);
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

  if (!sectionContext) {
    return (
      <div className="container mx-auto p-6">
        <Card className="border-destructive">
          <CardContent className="py-12 text-center">
            <h3 className="text-lg font-semibold mb-2">Section not found</h3>
            <p className="text-muted-foreground">The section could not be loaded.</p>
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
            <p className="text-muted-foreground mt-1">Manage graded items for this section</p>
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
                  school_year_id: schoolYears[0]?.id || "",
                  term_period: termPeriod || period || "",
                  section_subject_offering_id: "",
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
                      onValueChange={(value) => setFormData({ ...formData, scheme_id: value, component_id: "" })}
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
                    <div className="grid grid-cols-2 gap-4">
                    <div className="grid gap-2">
                      <Label htmlFor="school_year_id">School Year *</Label>
                      <Select
                        value={formData.school_year_id}
                        onValueChange={(value) => setFormData({ ...formData, school_year_id: value, section_subject_offering_id: "" })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select year" />
                        </SelectTrigger>
                        <SelectContent>
                          {schoolYears.map((year) => (
                            <SelectItem key={year.id} value={year.id}>
                              {year.year_label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="grid gap-2">
                      <Label htmlFor="term_period">Term Period *</Label>
                      <Select
                        value={formData.term_period}
                        onValueChange={(value) => setFormData({ ...formData, term_period: value, section_subject_offering_id: "" })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select term" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="Q1">Q1</SelectItem>
                          <SelectItem value="Q2">Q2</SelectItem>
                          <SelectItem value="Q3">Q3</SelectItem>
                          <SelectItem value="Q4">Q4</SelectItem>
                          <SelectItem value="Semester 1">Semester 1</SelectItem>
                          <SelectItem value="Semester 2">Semester 2</SelectItem>
                          <SelectItem value="Full Year">Full Year</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  {offerings.length > 0 && (
                    <div className="grid gap-2">
                      <Label htmlFor="section_subject_offering_id">Subject Offering (Optional)</Label>
                      <Select
                        value={formData.section_subject_offering_id || undefined}
                        onValueChange={(value) => setFormData({ ...formData, section_subject_offering_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject offering (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {offerings.map((offering) => (
                            <SelectItem key={offering.id} value={offering.id}>
                              {offering.subject?.name || offering.subject?.code || "Unknown Subject"} - {offering.term_period}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Select a subject offering to associate this item with a specific subject. Leave empty if this item applies to all subjects.
                        </p>
                        {formData.section_subject_offering_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setFormData({ ...formData, section_subject_offering_id: "" })}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
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
                  <div className="grid gap-2">
                    <Label htmlFor="edit_term_period">Term Period *</Label>
                    <Select
                      value={formData.term_period}
                      onValueChange={(value) => setFormData({ ...formData, term_period: value })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select term" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Q1">Q1</SelectItem>
                        <SelectItem value="Q2">Q2</SelectItem>
                        <SelectItem value="Q3">Q3</SelectItem>
                        <SelectItem value="Q4">Q4</SelectItem>
                        <SelectItem value="Semester 1">Semester 1</SelectItem>
                        <SelectItem value="Semester 2">Semester 2</SelectItem>
                        <SelectItem value="Full Year">Full Year</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  {offerings.length > 0 && (
                    <div className="grid gap-2">
                      <Label htmlFor="edit_section_subject_offering_id">Subject Offering (Optional)</Label>
                      <Select
                        value={formData.section_subject_offering_id || undefined}
                        onValueChange={(value) => setFormData({ ...formData, section_subject_offering_id: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select subject offering (optional)" />
                        </SelectTrigger>
                        <SelectContent>
                          {offerings.map((offering) => (
                            <SelectItem key={offering.id} value={offering.id}>
                              {offering.subject?.name || offering.subject?.code || "Unknown Subject"} - {offering.term_period}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-muted-foreground">
                          Select a subject offering to associate this item with a specific subject. Leave empty if this item applies to all subjects.
                        </p>
                        {formData.section_subject_offering_id && (
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            className="h-6 text-xs"
                            onClick={() => setFormData({ ...formData, section_subject_offering_id: "" })}
                          >
                            Clear
                          </Button>
                        )}
                      </div>
                    </div>
                  )}
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
                    onChange={(e) => setFormData({ ...formData, max_points: parseInt(e.target.value) || 100 })}
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
                    school_year_id: "",
                    term_period: termPeriod || period || "",
                    section_subject_offering_id: "",
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
                type="button"
                onClick={editingItem ? handleUpdateItem : handleCreateItem}
                disabled={
                  isSubmitting ||
                  (editingItem
                    ? !formData.component_id || !formData.title
                    : !formData.scheme_id || !formData.component_id || !formData.school_year_id || !formData.term_period || !formData.title)
                }
              >
                {isSubmitting ? "Creating..." : editingItem ? "Update" : "Create"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* Section Context Header */}
      <SectionContextHeader sectionId={sectionId} period={termPeriod || period} />

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
