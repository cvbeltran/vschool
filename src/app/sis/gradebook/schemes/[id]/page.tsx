"use client";

import { useEffect, useState, useRef } from "react";
import { useRouter, useParams } from "next/navigation";
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
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import {
  ArrowLeft,
  Plus,
  Edit,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Settings,
  Target,
  Scale,
  Calculator,
  FileText,
} from "lucide-react";
import {
  getScheme,
  listComponents,
  createComponent,
  updateComponent,
  archiveComponent,
  listWeightProfiles,
  createWeightProfile,
  updateWeightProfile,
  deleteWeightProfile,
  listComponentWeights,
  upsertComponentWeights,
  listTransmutationTables,
  createTransmutationTable,
  listTransmutationRows,
  upsertTransmutationRows,
  publishScheme,
  publishTransmutationTable,
  archiveTransmutationTable,
  type GradebookScheme,
  type GradebookComponent,
  type GradebookWeightProfile,
  type GradebookComponentWeight,
  type GradebookTransmutationTable,
  type GradebookTransmutationRow,
} from "@/lib/gradebook";

export default function SchemeDetailPage() {
  const router = useRouter();
  const params = useParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const schemeId = params.id as string;

  const [scheme, setScheme] = useState<GradebookScheme | null>(null);
  const [components, setComponents] = useState<GradebookComponent[]>([]);
  const [weightProfiles, setWeightProfiles] = useState<GradebookWeightProfile[]>([]);
  const [selectedProfileId, setSelectedProfileId] = useState<string | null>(null);
  const [componentWeights, setComponentWeights] = useState<GradebookComponentWeight[]>([]);
  const [transmutationTables, setTransmutationTables] = useState<GradebookTransmutationTable[]>([]);
  const [selectedTableId, setSelectedTableId] = useState<string | null>(null);
  const [transmutationRows, setTransmutationRows] = useState<GradebookTransmutationRow[]>([]);
  const [editingRows, setEditingRows] = useState<Record<string, { initial_grade: number; transmuted_grade: number }>>({});
  const [newRows, setNewRows] = useState<Array<{ tempId: string; initial_grade: number; transmuted_grade: number }>>([]);
  const [loading, setLoading] = useState(true);
  const [savingWeights, setSavingWeights] = useState(false);
  const [savingTransmutationRows, setSavingTransmutationRows] = useState(false);
  const [publishingTable, setPublishingTable] = useState(false);
  const [activeTab, setActiveTab] = useState("overview");
  const hasNavigatedAway = useRef(false);

  // Dialog states
  const [componentDialogOpen, setComponentDialogOpen] = useState(false);
  const [profileDialogOpen, setProfileDialogOpen] = useState(false);
  const [transmutationDialogOpen, setTransmutationDialogOpen] = useState(false);
  const [editingComponent, setEditingComponent] = useState<GradebookComponent | null>(null);
  const [editingProfile, setEditingProfile] = useState<GradebookWeightProfile | null>(null);
  const [deleteProfileDialogOpen, setDeleteProfileDialogOpen] = useState(false);
  const [profileToDelete, setProfileToDelete] = useState<{ id: string; label: string } | null>(null);
  const [deletingProfile, setDeletingProfile] = useState(false);

  // Form states
  const [componentForm, setComponentForm] = useState({
    code: "",
    label: "",
    description: "",
    display_order: 1,
  });
  const [profileForm, setProfileForm] = useState({
    profile_key: "",
    profile_label: "",
    description: "",
    is_default: false,
  });
  const [weightsForm, setWeightsForm] = useState<Record<string, number>>({});

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !schemeId || hasNavigatedAway.current) {
        console.log("Waiting for org or schemeId or already navigated", { orgLoading, schemeId, hasNavigatedAway: hasNavigatedAway.current });
        return;
      }
      try {
        setLoading(true);
        console.log("Fetching scheme", schemeId);
        const schemeData = await getScheme(schemeId);
        if (!schemeData) {
          console.log("Scheme not found", schemeId);
          hasNavigatedAway.current = true;
          toast({
            message: "Scheme not found",
            type: "error",
          });
          // Use setTimeout to avoid calling router.push during render
          setTimeout(() => {
            router.push("/sis/gradebook/schemes");
          }, 100);
          return;
        }
        console.log("Scheme found", schemeData);
        setScheme(schemeData);

        // Fetch all related data
        const [componentsData, profilesData, tablesData] = await Promise.all([
          listComponents(schemeId),
          listWeightProfiles(schemeId),
          listTransmutationTables(schemeId),
        ]);

        setComponents(componentsData);
        setWeightProfiles(profilesData);
        setTransmutationTables(tablesData);

        // Set default profile if exists
        const defaultProfile = profilesData.find((p) => p.is_default);
        if (defaultProfile) {
          setSelectedProfileId(defaultProfile.id);
        } else if (profilesData.length > 0) {
          setSelectedProfileId(profilesData[0].id);
        }
      } catch (error: any) {
        console.error("Error fetching scheme data", error);
        toast({
          message: error.message || "Failed to load scheme",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading, schemeId]);

  // Fetch component weights when profile changes
  useEffect(() => {
    const fetchWeights = async () => {
      if (!schemeId || !selectedProfileId) return;
      try {
        const weights = await listComponentWeights(schemeId, selectedProfileId);
        setComponentWeights(weights);

        // Initialize form with current weights
        const form: Record<string, number> = {};
        weights.forEach((w) => {
          form[w.component_id] = w.weight_percent;
        });
        setWeightsForm(form);
      } catch (error: any) {
        console.error("Error fetching weights", error);
      }
    };

    fetchWeights();
  }, [schemeId, selectedProfileId]);

  // Fetch transmutation rows when table changes
  useEffect(() => {
    const fetchRows = async () => {
      if (!selectedTableId) return;
      try {
        const rows = await listTransmutationRows(selectedTableId);
        setTransmutationRows(rows);
      } catch (error: any) {
        console.error("Error fetching transmutation rows", error);
      }
    };

    fetchRows();
  }, [selectedTableId]);

  // Initialize editingRows when transmutationRows change
  useEffect(() => {
    if (transmutationRows.length > 0) {
      const initialEditing: Record<string, { initial_grade: number; transmuted_grade: number }> = {};
      transmutationRows.forEach((row) => {
        initialEditing[row.id] = {
          initial_grade: row.initial_grade,
          transmuted_grade: row.transmuted_grade,
        };
      });
      setEditingRows(initialEditing);
    } else {
      setEditingRows({});
    }
    // Clear new rows when table changes
    setNewRows([]);
  }, [transmutationRows, selectedTableId]);

  const handleCreateComponent = async () => {
    if (!organizationId || !schemeId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const newComponent = await createComponent({
        organization_id: organizationId,
        scheme_id: schemeId,
        code: componentForm.code,
        label: componentForm.label,
        description: componentForm.description || null,
        display_order: componentForm.display_order,
        created_by: session.user.id,
      });

      setComponents([...components, newComponent]);
      setComponentDialogOpen(false);
      setComponentForm({ code: "", label: "", description: "", display_order: components.length + 1 });
      toast({
        message: "✅ Component created successfully",
        type: "success",
      });
    } catch (error: any) {
      toast({
        message: error.message || "Failed to create component",
        type: "error",
      });
    }
  };

  const handleUpdateComponent = async () => {
    if (!editingComponent) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const updated = await updateComponent(editingComponent.id, {
        code: componentForm.code,
        label: componentForm.label,
        description: componentForm.description || null,
        display_order: componentForm.display_order,
        updated_by: session.user.id,
      });

      setComponents(components.map((c) => (c.id === updated.id ? updated : c)));
      setComponentDialogOpen(false);
      setEditingComponent(null);
      setComponentForm({ code: "", label: "", description: "", display_order: 1 });
      toast({
        message: "✅ Component updated successfully",
        type: "success",
      });
    } catch (error: any) {
      toast({
        message: error.message || "Failed to update component",
        type: "error",
      });
    }
  };

  const handleArchiveComponent = async (componentId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      await archiveComponent(componentId, session.user.id);
      setComponents(components.filter((c) => c.id !== componentId));
      toast({
        message: "✅ Component archived successfully",
        type: "success",
      });
    } catch (error: any) {
      toast({
        message: error.message || "Failed to archive component",
        type: "error",
      });
    }
  };

  const handleCreateProfile = async () => {
    if (!organizationId || !schemeId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      if (editingProfile) {
        // Update existing profile
        const updatedProfile = await updateWeightProfile(editingProfile.id, {
          profile_key: profileForm.profile_key,
          profile_label: profileForm.profile_label,
          description: profileForm.description || null,
          is_default: profileForm.is_default,
          updated_by: session.user.id,
        });

        // If setting as default, unset other defaults
        if (profileForm.is_default) {
          const otherProfiles = weightProfiles.filter((p) => p.id !== editingProfile.id && p.is_default);
          for (const profile of otherProfiles) {
            await updateWeightProfile(profile.id, {
              is_default: false,
              updated_by: session.user.id,
            });
          }
        }

        // Refresh profiles list
        const updatedProfiles = await listWeightProfiles(schemeId);
        setWeightProfiles(updatedProfiles);
        
        if (profileForm.is_default || selectedProfileId === editingProfile.id) {
          setSelectedProfileId(updatedProfile.id);
        }

        toast({
          message: "Weight profile updated successfully",
          type: "success",
        });
      } else {
        // Create new profile
        // If setting as default, unset other defaults first
        if (profileForm.is_default) {
          const defaultProfiles = weightProfiles.filter((p) => p.is_default);
          for (const profile of defaultProfiles) {
            await updateWeightProfile(profile.id, {
              is_default: false,
              updated_by: session.user.id,
            });
          }
        }

        const newProfile = await createWeightProfile({
          organization_id: organizationId,
          scheme_id: schemeId,
          profile_key: profileForm.profile_key,
          profile_label: profileForm.profile_label,
          description: profileForm.description || null,
          is_default: profileForm.is_default,
          created_by: session.user.id,
        });

        // Refresh profiles list
        const updatedProfiles = await listWeightProfiles(schemeId);
        setWeightProfiles(updatedProfiles);
        
        if (profileForm.is_default) {
          setSelectedProfileId(newProfile.id);
        }
        
        toast({
          message: "Weight profile created successfully",
          type: "success",
        });
      }

      setProfileDialogOpen(false);
      setEditingProfile(null);
      setProfileForm({ profile_key: "", profile_label: "", description: "", is_default: false });
    } catch (error: any) {
      toast({
        message: error.message || `Failed to ${editingProfile ? "update" : "create"} weight profile`,
        type: "error",
      });
    }
  };

  const handleEditProfile = (profile: GradebookWeightProfile) => {
    setEditingProfile(profile);
    setProfileForm({
      profile_key: profile.profile_key,
      profile_label: profile.profile_label,
      description: profile.description || "",
      is_default: profile.is_default,
    });
    setProfileDialogOpen(true);
  };

  const handleDeleteProfileClick = (profileId: string, profileLabel: string) => {
    setProfileToDelete({ id: profileId, label: profileLabel });
    setDeleteProfileDialogOpen(true);
  };

  const handleDeleteProfile = async () => {
    if (!profileToDelete) return;

    try {
      setDeletingProfile(true);
      console.log("Deleting weight profile:", profileToDelete.id);
      
      // Get session token for API call
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // Call API route to delete (bypasses RLS)
      const response = await fetch(`/api/gradebook/weight-profiles/${profileToDelete.id}`, {
        method: "DELETE",
        headers: {
          "Authorization": `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to archive weight profile");
      }

      console.log("Weight profile archived successfully");
      
      // Refresh profiles list - use a small delay to ensure database consistency
      await new Promise(resolve => setTimeout(resolve, 100));
      const updatedProfiles = await listWeightProfiles(schemeId);
      console.log("Updated profiles:", updatedProfiles);
      setWeightProfiles(updatedProfiles);
      
      // If deleted profile was selected, clear selection or select first available
      if (selectedProfileId === profileToDelete.id) {
        if (updatedProfiles.length > 0) {
          setSelectedProfileId(updatedProfiles[0].id);
        } else {
          setSelectedProfileId(null);
        }
      }
      
      setDeleteProfileDialogOpen(false);
      setProfileToDelete(null);
      
      toast({
        message: "Weight profile archived successfully",
        type: "success",
      });
    } catch (error: any) {
      console.error("Error deleting weight profile:", error);
      toast({
        message: error.message || "Failed to archive weight profile",
        type: "error",
      });
    } finally {
      setDeletingProfile(false);
    }
  };

  const handleSaveWeights = async () => {
    if (!organizationId || !schemeId || !selectedProfileId) return;

    // Validate weights sum to 100 (strict mode)
    const totalWeight = Object.values(weightsForm).reduce((sum, w) => sum + w, 0);
    if (Math.abs(totalWeight - 100) > 0.01) {
      toast({
        message: `Weights must sum to 100% (current: ${totalWeight.toFixed(2)}%)`,
        type: "error",
      });
      return;
    }

    setSavingWeights(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const weights = Object.entries(weightsForm).map(([componentId, weightPercent]) => ({
        organization_id: organizationId,
        scheme_id: schemeId,
        profile_id: selectedProfileId,
        component_id: componentId,
        weight_percent: weightPercent,
        created_by: session.user.id,
      }));

      await upsertComponentWeights(weights);
      const updated = await listComponentWeights(schemeId, selectedProfileId);
      setComponentWeights(updated);
      
      // Get profile name for better notification
      const selectedProfile = weightProfiles.find(p => p.id === selectedProfileId);
      const profileName = selectedProfile?.profile_label || "selected profile";
      
      // Show success notification
      toast({
        message: `✅ Weights Updated Successfully! Component weights for "${profileName}" have been saved. Total: ${totalWeight.toFixed(2)}%`,
        type: "success",
        duration: 5000,
      });
      
      // Also log to console for debugging
      console.log("Weights saved successfully:", {
        profileName,
        totalWeight: totalWeight.toFixed(2),
        weightsCount: weights.length,
      });
    } catch (error: any) {
      toast({
        message: error.message || "Failed to save weights",
        type: "error",
      });
    } finally {
      setSavingWeights(false);
    }
  };

  const handleCreateTransmutationTable = async () => {
    if (!organizationId || !schemeId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const latestVersion = transmutationTables.length > 0
        ? Math.max(...transmutationTables.map((t) => t.version)) + 1
        : 1;

      const newTable = await createTransmutationTable({
        organization_id: organizationId,
        scheme_id: schemeId,
        version: latestVersion,
        description: `Version ${latestVersion}`,
        created_by: session.user.id,
      });

      setTransmutationTables([...transmutationTables, newTable]);
      setSelectedTableId(newTable.id);
      setTransmutationDialogOpen(false);
      toast({
        title: "Success",
        description: "Transmutation table created. Add rows below.",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create transmutation table",
        variant: "destructive",
      });
    }
  };

  const handleSaveTransmutationRows = async () => {
    if (!organizationId || !selectedTableId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Generate standard DepEd rows (75-100)
      const rows: Array<{
        organization_id: string;
        transmutation_table_id: string;
        initial_grade: number;
        transmuted_grade: number;
        created_by: string;
      }> = [];

      for (let initial = 75; initial <= 100; initial++) {
        let transmuted: number;
        if (initial >= 90) {
          transmuted = 95 + ((initial - 90) / 10) * 5; // 90-100 → 95-100
        } else if (initial >= 85) {
          transmuted = 90 + (initial - 85); // 85-89 → 90-94
        } else if (initial >= 80) {
          transmuted = 85 + (initial - 80); // 80-84 → 85-89
        } else {
          transmuted = 80 + (initial - 75); // 75-79 → 80-84
        }

        rows.push({
          organization_id: organizationId,
          transmutation_table_id: selectedTableId,
          initial_grade: initial,
          transmuted_grade: Math.round(transmuted),
          created_by: session.user.id,
        });
      }

      await upsertTransmutationRows(rows);
      const updated = await listTransmutationRows(selectedTableId);
      setTransmutationRows(updated);
      toast({
        title: "Success",
        description: "Transmutation rows generated successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to save transmutation rows",
        variant: "destructive",
      });
    }
  };

  const handleAddTransmutationRow = () => {
    if (!selectedTableId) return;
    const tempId = `new-${Date.now()}-${Math.random()}`;
    setNewRows([...newRows, { tempId, initial_grade: 0, transmuted_grade: 0 }]);
  };

  const handleDeleteTransmutationRow = (rowId: string) => {
    if (rowId.startsWith("new-")) {
      // Delete new row
      setNewRows(newRows.filter((r) => r.tempId !== rowId));
    } else {
      // Delete existing row - remove from editingRows
      const updatedEditing = { ...editingRows };
      delete updatedEditing[rowId];
      setEditingRows(updatedEditing);
      
      // Also remove from transmutationRows for immediate UI update
      setTransmutationRows(transmutationRows.filter((r) => r.id !== rowId));
    }
  };

  const handleSaveEditedTransmutationRows = async () => {
    if (!organizationId || !selectedTableId) return;
    try {
      setSavingTransmutationRows(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Combine existing edited rows and new rows
      const existingRows = Object.entries(editingRows).map(([rowId, values]) => ({
        organization_id: organizationId,
        transmutation_table_id: selectedTableId,
        initial_grade: values.initial_grade,
        transmuted_grade: values.transmuted_grade,
        created_by: session.user.id,
      }));

      const newRowsData = newRows.map((row) => ({
        organization_id: organizationId,
        transmutation_table_id: selectedTableId,
        initial_grade: row.initial_grade,
        transmuted_grade: row.transmuted_grade,
        created_by: session.user.id,
      }));

      const allRows = [...existingRows, ...newRowsData];

      if (allRows.length === 0) {
        toast({
          title: "Error",
          description: "Cannot save empty transmutation table",
          variant: "destructive",
        });
        return;
      }

      // Validate rows have valid values
      const invalidRows = allRows.filter(
        (row) => isNaN(row.initial_grade) || isNaN(row.transmuted_grade) || row.initial_grade < 0 || row.transmuted_grade < 0
      );
      if (invalidRows.length > 0) {
        toast({
          title: "Error",
          description: "Please ensure all rows have valid grade values (0-100)",
          variant: "destructive",
        });
        return;
      }

      console.log("Saving transmutation rows:", allRows.length, "rows");
      await upsertTransmutationRows(allRows);
      
      // Wait a bit to ensure database is updated
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const updated = await listTransmutationRows(selectedTableId);
      console.log("Fetched updated rows:", updated.length, "rows");
      
      setTransmutationRows(updated);
      setNewRows([]);
      
      // Reset editingRows to match the updated rows
      const updatedEditing: Record<string, { initial_grade: number; transmuted_grade: number }> = {};
      updated.forEach((row) => {
        updatedEditing[row.id] = {
          initial_grade: row.initial_grade,
          transmuted_grade: row.transmuted_grade,
        };
      });
      setEditingRows(updatedEditing);
      
      toast({
        title: "Success",
        description: `Saved ${allRows.length} transmutation row${allRows.length !== 1 ? 's' : ''} successfully`,
      });
    } catch (error: any) {
      console.error("Error saving transmutation rows:", error);
      toast({
        title: "Error",
        description: error.message || "Failed to save transmutation rows",
        variant: "destructive",
      });
    } finally {
      setSavingTransmutationRows(false);
    }
  };

  const handleDeleteTransmutationTable = async () => {
    if (!selectedTableId) return;
    
    const selectedTable = transmutationTables.find((t) => t.id === selectedTableId);
    if (!selectedTable) return;

    // Prevent deletion of published tables
    if (selectedTable.published_at) {
      toast({
        title: "Error",
        description: "Cannot delete a published transmutation table. Published tables can only be updated.",
        variant: "destructive",
      });
      return;
    }

    const confirmMessage = `Are you sure you want to delete table version ${selectedTable.version}? This action cannot be undone.`;

    if (!confirm(confirmMessage)) return;

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      await archiveTransmutationTable(selectedTableId, session.user.id);
      
      // Refresh tables list
      const updatedTables = await listTransmutationTables(schemeId);
      setTransmutationTables(updatedTables);
      
      // Clear selected table and rows if it was deleted
      if (updatedTables.length === 0) {
        setSelectedTableId(null);
        setTransmutationRows([]);
        setEditingRows({});
        setNewRows([]);
      } else {
        // Select the first available table
        setSelectedTableId(updatedTables[0].id);
      }
      
      toast({
        title: "Success",
        description: "Transmutation table deleted successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to delete transmutation table",
        variant: "destructive",
      });
    }
  };

  const handlePublishTransmutationTable = async () => {
    if (!selectedTableId) return;
    try {
      setPublishingTable(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Validate rows exist
      if (transmutationRows.length === 0 && newRows.length === 0) {
        toast({
          title: "Error",
          description: "Cannot publish table without transmutation rows",
          variant: "destructive",
        });
        return;
      }

      // Save any unsaved rows first
      if (newRows.length > 0 || Object.keys(editingRows).length > 0) {
        await handleSaveEditedTransmutationRows();
        // Refresh rows after saving
        const updated = await listTransmutationRows(selectedTableId);
        setTransmutationRows(updated);
      }

      await publishTransmutationTable(selectedTableId, session.user.id);
      
      // Refresh tables to get updated published_at
      const updatedTables = await listTransmutationTables(schemeId);
      setTransmutationTables(updatedTables);
      
      toast({
        title: "Success",
        description: "Transmutation table published successfully",
      });
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to publish transmutation table",
        variant: "destructive",
      });
    } finally {
      setPublishingTable(false);
    }
  };

  const handlePublish = async () => {
    if (!schemeId) return;
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Validate before publishing
      if (components.length === 0) {
        toast({
          message: "Cannot publish scheme without components",
          type: "error",
        });
        return;
      }

      // Check weights for default profile
      const defaultProfile = weightProfiles.find((p) => p.is_default);
      if (defaultProfile) {
        const weights = await listComponentWeights(schemeId, defaultProfile.id);
        const totalWeight = weights.reduce((sum, w) => sum + w.weight_percent, 0);
        if (Math.abs(totalWeight - 100) > 0.01) {
          toast({
            message: `Default weight profile must sum to 100% (current: ${totalWeight.toFixed(2)}%)`,
            type: "error",
          });
          return;
        }
      }

      // Check transmutation for DepEd and CHED
      if ((scheme?.scheme_type === "deped_k12" || scheme?.scheme_type === "ched_hei") && transmutationTables.length === 0) {
        toast({
          message: `${scheme?.scheme_type === "deped_k12" ? "DepEd K-12" : "CHED"} scheme requires a transmutation table`,
          type: "error",
        });
        return;
      }

      await publishScheme(schemeId, session.user.id);
      const updated = await getScheme(schemeId);
      setScheme(updated);
      toast({
        message: "✅ Scheme published successfully",
        type: "success",
      });
    } catch (error: any) {
      toast({
        message: error.message || "Failed to publish scheme",
        type: "error",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading scheme...</p>
        </div>
      </div>
    );
  }

  if (!scheme) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="flex flex-col items-center justify-center py-12">
            <AlertCircle className="h-12 w-12 text-muted-foreground mb-4" />
            <p className="text-muted-foreground">Scheme not found</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const totalWeight = Object.values(weightsForm).reduce((sum, w) => sum + w, 0);
  const weightWarning = Math.abs(totalWeight - 100) > 0.01;

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.push("/sis/gradebook/schemes")}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              {scheme.name}
              <Badge variant={scheme.published_at ? "default" : "secondary"}>
                {scheme.published_at ? "Published" : "Draft"}
              </Badge>
              <Badge variant="outline">{scheme.scheme_type}</Badge>
            </h1>
            {scheme.description && (
              <p className="text-muted-foreground mt-1">{scheme.description}</p>
            )}
          </div>
        </div>
        {!scheme.published_at && (
          <Button onClick={handlePublish}>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Publish Scheme
          </Button>
        )}
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList>
          <TabsTrigger value="overview">
            <FileText className="mr-2 h-4 w-4" />
            Overview
          </TabsTrigger>
          <TabsTrigger value="components">
            <Target className="mr-2 h-4 w-4" />
            Components
          </TabsTrigger>
          <TabsTrigger value="profiles">
            <Settings className="mr-2 h-4 w-4" />
            Weight Profiles
          </TabsTrigger>
          <TabsTrigger value="weights">
            <Scale className="mr-2 h-4 w-4" />
            Component Weights
          </TabsTrigger>
          {(scheme.scheme_type === "deped_k12" || scheme.scheme_type === "ched_hei") && (
            <TabsTrigger value="transmutation">
              <Calculator className="mr-2 h-4 w-4" />
              Transmutation
            </TabsTrigger>
          )}
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Scheme Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label>Scheme Type</Label>
                  <p className="text-sm font-medium">{scheme.scheme_type}</p>
                </div>
                <div>
                  <Label>Version</Label>
                  <p className="text-sm font-medium">{scheme.version}</p>
                </div>
                <div>
                  <Label>Status</Label>
                  <p className="text-sm font-medium">
                    {scheme.published_at ? "Published" : "Draft"}
                  </p>
                </div>
                {scheme.published_at && (
                  <div>
                    <Label>Published At</Label>
                    <p className="text-sm font-medium">
                      {new Date(scheme.published_at).toLocaleString()}
                    </p>
                  </div>
                )}
              </div>
              <div className="bg-blue-50 p-4 rounded-md">
                <h4 className="font-semibold mb-2">Default Settings (from Hardening Report)</h4>
                <ul className="text-sm space-y-1">
                  <li>
                    <strong>Rounding Mode:</strong>{" "}
                    {scheme.scheme_type === "deped_k12" ? "floor" : "round"}
                  </li>
                  <li>
                    <strong>Weight Policy:</strong> strict (fails if weights != 100%)
                  </li>
                  <li>
                    <strong>Score Status:</strong> present (normal), missing/absent (0 points),
                    excused (excluded)
                  </li>
                </ul>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Components Tab */}
        <TabsContent value="components" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Components</CardTitle>
                {!scheme.published_at && (
                  <Dialog open={componentDialogOpen} onOpenChange={setComponentDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setEditingComponent(null);
                          setComponentForm({
                            code: "",
                            label: "",
                            description: "",
                            display_order: components.length + 1,
                          });
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Component
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingComponent ? "Edit Component" : "Create Component"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="code">Code *</Label>
                          <Input
                            id="code"
                            value={componentForm.code}
                            onChange={(e) =>
                              setComponentForm({ ...componentForm, code: e.target.value })
                            }
                            placeholder="e.g., WW, PT, QA"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="label">Label *</Label>
                          <Input
                            id="label"
                            value={componentForm.label}
                            onChange={(e) =>
                              setComponentForm({ ...componentForm, label: e.target.value })
                            }
                            placeholder="e.g., Written Works"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="description">Description</Label>
                          <Textarea
                            id="description"
                            value={componentForm.description}
                            onChange={(e) =>
                              setComponentForm({ ...componentForm, description: e.target.value })
                            }
                            placeholder="Optional description"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="display_order">Display Order</Label>
                          <Input
                            id="display_order"
                            type="number"
                            value={componentForm.display_order}
                            onChange={(e) =>
                              setComponentForm({
                                ...componentForm,
                                display_order: parseInt(e.target.value) || 1,
                              })
                            }
                          />
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setComponentDialogOpen(false);
                            setEditingComponent(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={editingComponent ? handleUpdateComponent : handleCreateComponent}
                          disabled={!componentForm.code || !componentForm.label}
                        >
                          {editingComponent ? "Update" : "Create"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {components.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No components yet. Add components to get started.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Order</TableHead>
                      <TableHead>Code</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Description</TableHead>
                      {!scheme.published_at && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {components.map((component) => (
                      <TableRow key={component.id}>
                        <TableCell>{component.display_order}</TableCell>
                        <TableCell className="font-mono">{component.code}</TableCell>
                        <TableCell>{component.label}</TableCell>
                        <TableCell>{component.description || "-"}</TableCell>
                        {!scheme.published_at && (
                          <TableCell>
                            <div className="flex gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => {
                                  setEditingComponent(component);
                                  setComponentForm({
                                    code: component.code,
                                    label: component.label,
                                    description: component.description || "",
                                    display_order: component.display_order,
                                  });
                                  setComponentDialogOpen(true);
                                }}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleArchiveComponent(component.id)}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Weight Profiles Tab */}
        <TabsContent value="profiles" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>Weight Profiles</CardTitle>
                {!scheme.published_at && (
                  <Dialog open={profileDialogOpen} onOpenChange={setProfileDialogOpen}>
                    <DialogTrigger asChild>
                      <Button
                        onClick={() => {
                          setEditingProfile(null);
                          setProfileForm({
                            profile_key: "",
                            profile_label: "",
                            description: "",
                            is_default: false,
                          });
                        }}
                      >
                        <Plus className="mr-2 h-4 w-4" />
                        Add Profile
                      </Button>
                    </DialogTrigger>
                    <DialogContent>
                      <DialogHeader>
                        <DialogTitle>
                          {editingProfile ? "Edit Profile" : "Create Weight Profile"}
                        </DialogTitle>
                      </DialogHeader>
                      <div className="grid gap-4 py-4">
                        <div className="grid gap-2">
                          <Label htmlFor="profile_key">Profile Key *</Label>
                          <Input
                            id="profile_key"
                            value={profileForm.profile_key}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, profile_key: e.target.value })
                            }
                            placeholder="e.g., math, science"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="profile_label">Profile Label *</Label>
                          <Input
                            id="profile_label"
                            value={profileForm.profile_label}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, profile_label: e.target.value })
                            }
                            placeholder="e.g., Mathematics"
                          />
                        </div>
                        <div className="grid gap-2">
                          <Label htmlFor="profile_description">Description</Label>
                          <Textarea
                            id="profile_description"
                            value={profileForm.description}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, description: e.target.value })
                            }
                            placeholder="Optional description"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <input
                            type="checkbox"
                            id="is_default"
                            checked={profileForm.is_default}
                            onChange={(e) =>
                              setProfileForm({ ...profileForm, is_default: e.target.checked })
                            }
                            className="rounded"
                          />
                          <Label htmlFor="is_default">Set as default profile</Label>
                        </div>
                      </div>
                      <DialogFooter>
                        <Button
                          variant="outline"
                          onClick={() => {
                            setProfileDialogOpen(false);
                            setEditingProfile(null);
                          }}
                        >
                          Cancel
                        </Button>
                        <Button
                          onClick={handleCreateProfile}
                          disabled={!profileForm.profile_key || !profileForm.profile_label}
                        >
                          {editingProfile ? "Update" : "Create"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                )}
              </div>
            </CardHeader>
            <CardContent>
              {weightProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  No weight profiles yet. Create a profile to set component weights.
                </p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Key</TableHead>
                      <TableHead>Label</TableHead>
                      <TableHead>Default</TableHead>
                      <TableHead>Description</TableHead>
                      {!scheme.published_at && <TableHead>Actions</TableHead>}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {weightProfiles.map((profile) => (
                      <TableRow
                        key={profile.id}
                        className={selectedProfileId === profile.id ? "bg-muted" : ""}
                      >
                        <TableCell className="font-mono">{profile.profile_key}</TableCell>
                        <TableCell>{profile.profile_label}</TableCell>
                        <TableCell>
                          {profile.is_default && (
                            <Badge variant="default">Default</Badge>
                          )}
                        </TableCell>
                        <TableCell>{profile.description || "-"}</TableCell>
                        {!scheme.published_at && (
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleEditProfile(profile)}
                              >
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleDeleteProfileClick(profile.id, profile.profile_label)}
                              >
                                <Trash2 className="h-4 w-4 text-red-500" />
                              </Button>
                            </div>
                          </TableCell>
                        )}
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Component Weights Tab */}
        <TabsContent value="weights" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Component Weights</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {weightProfiles.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-8">
                  Create a weight profile first to set component weights.
                </p>
              ) : (
                <>
                  <div className="flex items-center gap-4">
                    <Label>Weight Profile:</Label>
                    <Select
                      value={selectedProfileId || ""}
                      onValueChange={setSelectedProfileId}
                    >
                      <SelectTrigger className="w-[300px]">
                        <SelectValue placeholder="Select profile" />
                      </SelectTrigger>
                      <SelectContent>
                        {weightProfiles.map((profile) => (
                          <SelectItem key={profile.id} value={profile.id}>
                            {profile.profile_label}
                            {profile.is_default && " (Default)"}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {selectedProfileId && components.length > 0 && (
                    <>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Component</TableHead>
                            <TableHead>Weight %</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {components.map((component) => (
                            <TableRow key={component.id}>
                              <TableCell>
                                {component.code} - {component.label}
                              </TableCell>
                              <TableCell>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  step="0.01"
                                  value={weightsForm[component.id] || 0}
                                  onChange={(e) =>
                                    setWeightsForm({
                                      ...weightsForm,
                                      [component.id]: parseFloat(e.target.value) || 0,
                                    })
                                  }
                                  className="w-24"
                                  disabled={!!scheme.published_at}
                                />
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>

                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-sm font-medium">
                            Total: {totalWeight.toFixed(2)}%
                          </p>
                          {weightWarning && !scheme.published_at && (
                            <p className="text-sm text-destructive mt-1">
                              ⚠️ Weights must sum to 100% (strict mode)
                            </p>
                          )}
                          {scheme.published_at && (
                            <p className="text-sm text-muted-foreground mt-1">
                              This scheme is published. Unpublish to edit weights.
                            </p>
                          )}
                        </div>
                        {!scheme.published_at && (
                          <Button
                            onClick={handleSaveWeights}
                            disabled={weightWarning || savingWeights}
                          >
                            {savingWeights ? "Saving..." : "Save Weights"}
                          </Button>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Transmutation Tab (DepEd and CHED) */}
        {(scheme.scheme_type === "deped_k12" || scheme.scheme_type === "ched_hei") && (
          <TabsContent value="transmutation" className="space-y-4">
            <Card>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle>Transmutation Tables</CardTitle>
                  {!scheme.published_at && (
                    <Button onClick={handleCreateTransmutationTable}>
                      <Plus className="mr-2 h-4 w-4" />
                      Create Table
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {transmutationTables.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-8">
                    No transmutation tables yet. Create a table to define grade transmutation.
                  </p>
                ) : (
                  <>
                    <div className="flex items-center gap-4">
                      <Label>Table:</Label>
                      <Select
                        value={selectedTableId || ""}
                        onValueChange={setSelectedTableId}
                      >
                        <SelectTrigger className="w-[300px]">
                          <SelectValue placeholder="Select table" />
                        </SelectTrigger>
                        <SelectContent>
                          {transmutationTables.map((table) => (
                            <SelectItem key={table.id} value={table.id}>
                              Version {table.version}
                              {table.published_at && " (Published)"}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      {selectedTableId && (() => {
                        const selectedTable = transmutationTables.find((t) => t.id === selectedTableId);
                        const isTablePublished = selectedTable?.published_at !== null;
                        
                        if (isTablePublished) {
                          return (
                            <Badge variant="default" className="ml-2">
                              Published - Can Update, Cannot Delete Table
                            </Badge>
                          );
                        }
                        
                        return (
                          <Button
                            variant="destructive"
                            size="sm"
                            onClick={handleDeleteTransmutationTable}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete Table
                          </Button>
                        );
                      })()}
                    </div>

                    {selectedTableId && (() => {
                      const selectedTable = transmutationTables.find((t) => t.id === selectedTableId);
                      const isTablePublished = selectedTable?.published_at !== null;
                      
                      return (
                        <>
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-4">
                              <p className="text-sm text-muted-foreground">
                                {transmutationRows.length + newRows.length} rows defined
                                {newRows.length > 0 && ` (${newRows.length} new)`}
                              </p>
                              {selectedTable && (
                                <Badge variant={isTablePublished ? "default" : "secondary"}>
                                  {isTablePublished ? "Published" : "Draft"}
                                </Badge>
                              )}
                            </div>
                            <div className="flex items-center gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={handleAddTransmutationRow}
                              >
                                <Plus className="mr-2 h-4 w-4" />
                                Add Row
                              </Button>
                              {!isTablePublished && transmutationRows.length === 0 && newRows.length === 0 && (
                                <Button onClick={handleSaveTransmutationRows}>
                                  Generate Standard Rows (75-100)
                                </Button>
                              )}
                              {(transmutationRows.length > 0 || newRows.length > 0) && (
                                <Button
                                  onClick={handleSaveEditedTransmutationRows}
                                  disabled={savingTransmutationRows}
                                >
                                  {savingTransmutationRows ? "Saving..." : "Save Changes"}
                                </Button>
                              )}
                              {!isTablePublished && (transmutationRows.length > 0 || newRows.length > 0) && (
                                <Button
                                  onClick={handlePublishTransmutationTable}
                                  disabled={publishingTable || (transmutationRows.length === 0 && newRows.length === 0)}
                                >
                                  {publishingTable ? "Publishing..." : "Publish Table"}
                                </Button>
                              )}
                            </div>
                          </div>

                          {transmutationRows.length === 0 && newRows.length === 0 ? (
                            <div className="text-center py-8 text-muted-foreground">
                              <p>No transmutation rows yet.</p>
                              <p className="text-sm mt-2">Click "Add Row" to create a new row, or "Generate Standard Rows" to create default DepEd rows.</p>
                            </div>
                          ) : (
                            <div className="max-h-[400px] overflow-y-auto">
                              <Table>
                                <TableHeader>
                                  <TableRow>
                                    <TableHead>Initial Grade</TableHead>
                                    <TableHead>Transmuted Grade</TableHead>
                                    <TableHead className="w-20">Actions</TableHead>
                                  </TableRow>
                                </TableHeader>
                                <TableBody>
                                  {(() => {
                                    // Combine existing rows and new rows, then sort by initial_grade
                                    const allRows = [
                                      ...transmutationRows.map(row => ({ ...row, isNew: false })),
                                      ...newRows.map(row => ({ 
                                        id: row.tempId, 
                                        initial_grade: row.initial_grade, 
                                        transmuted_grade: row.transmuted_grade,
                                        tempId: row.tempId,
                                        isNew: true 
                                      }))
                                    ].sort((a, b) => a.initial_grade - b.initial_grade);

                                    return allRows.map((row) => {
                                      const isNewRow = (row as any).isNew;
                                      
                                      if (isNewRow) {
                                        // Render new row
                                        return (
                                          <TableRow key={row.tempId}>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={row.initial_grade}
                                                onChange={(e) => {
                                                  const newValue = parseFloat(e.target.value) || 0;
                                                  setNewRows(
                                                    newRows.map((r) =>
                                                      r.tempId === row.tempId
                                                        ? { ...r, initial_grade: newValue }
                                                        : r
                                                    )
                                                  );
                                                }}
                                                className="w-24"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={row.transmuted_grade}
                                                onChange={(e) => {
                                                  const newValue = parseFloat(e.target.value) || 0;
                                                  setNewRows(
                                                    newRows.map((r) =>
                                                      r.tempId === row.tempId
                                                        ? { ...r, transmuted_grade: newValue }
                                                        : r
                                                    )
                                                  );
                                                }}
                                                className="w-24"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteTransmutationRow(row.tempId)}
                                              >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      } else {
                                        // Render existing row
                                        const editing = editingRows[row.id];
                                        return (
                                          <TableRow key={row.id}>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={editing?.initial_grade ?? row.initial_grade}
                                                onChange={(e) => {
                                                  const newValue = parseFloat(e.target.value) || 0;
                                                  setEditingRows({
                                                    ...editingRows,
                                                    [row.id]: {
                                                      ...editing!,
                                                      initial_grade: newValue,
                                                    },
                                                  });
                                                }}
                                                className="w-24"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Input
                                                type="number"
                                                min="0"
                                                max="100"
                                                step="0.01"
                                                value={editing?.transmuted_grade ?? row.transmuted_grade}
                                                onChange={(e) => {
                                                  const newValue = parseFloat(e.target.value) || 0;
                                                  setEditingRows({
                                                    ...editingRows,
                                                    [row.id]: {
                                                      ...editing!,
                                                      transmuted_grade: newValue,
                                                    },
                                                  });
                                                }}
                                                className="w-24"
                                              />
                                            </TableCell>
                                            <TableCell>
                                              <Button
                                                variant="ghost"
                                                size="sm"
                                                onClick={() => handleDeleteTransmutationRow(row.id)}
                                              >
                                                <Trash2 className="h-4 w-4 text-red-500" />
                                              </Button>
                                            </TableCell>
                                          </TableRow>
                                        );
                                      }
                                    });
                                  })()}
                                </TableBody>
                              </Table>
                            </div>
                          )}
                        </>
                      );
                    })()}
                  </>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        )}
      </Tabs>

      {/* Delete Profile Confirmation Dialog */}
      <ConfirmDialog
        open={deleteProfileDialogOpen}
        onOpenChange={(open) => {
          if (!open && !deletingProfile) {
            setDeleteProfileDialogOpen(false);
            setProfileToDelete(null);
          }
        }}
        title="Archive Weight Profile"
        description={
          profileToDelete
            ? `Are you sure you want to archive the weight profile "${profileToDelete.label}"? This will also archive all associated component weights.`
            : ""
        }
        confirmText="Archive"
        cancelText="Cancel"
        variant="destructive"
        onConfirm={handleDeleteProfile}
        isLoading={deletingProfile}
      />
    </div>
  );
}
