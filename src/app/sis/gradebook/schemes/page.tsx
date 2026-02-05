"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { Award, Plus, Settings, CheckCircle2, XCircle } from "lucide-react";
import {
  listSchemes,
  createScheme,
  listComponents,
  createComponent,
  createWeightProfile,
  upsertComponentWeights,
  createTransmutationTable,
  upsertTransmutationRows,
  publishScheme,
  type GradebookScheme,
  type GradebookComponent,
} from "@/lib/gradebook";

export default function SchemesPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [schemes, setSchemes] = useState<GradebookScheme[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const [formData, setFormData] = useState({
    scheme_type: "deped_k12" as "deped_k12" | "ched_hei",
    name: "",
    description: "",
  });

  useEffect(() => {
    const fetchSchemes = async () => {
      if (orgLoading || !organizationId) return;
      try {
        setLoading(true);
        const data = await listSchemes(organizationId);
        setSchemes(data || []);
      } catch (error: any) {
        console.error("Error fetching schemes", error);
        toast({
          message: error.message || "Failed to load schemes",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSchemes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading, organizationId]);

  const handleCreateScheme = async () => {
    if (!organizationId) {
      toast({
        title: "Error",
        description: "Organization ID not found",
        variant: "destructive",
      });
      return;
    }

    try {
      setCreating(true);
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      // 1. Create scheme
      const scheme = await createScheme({
        organization_id: organizationId,
        scheme_type: formData.scheme_type,
        name: formData.name,
        description: formData.description || null,
        created_by: session.user.id,
      });

      // 2. Add components (WW, PT, QA for DepEd)
      if (formData.scheme_type === "deped_k12") {
        const ww = await createComponent({
          organization_id: organizationId,
          scheme_id: scheme.id,
          code: "WW",
          label: "Written Works",
          description: "Written assignments, quizzes, and tests",
          display_order: 1,
          created_by: session.user.id,
        });

        const pt = await createComponent({
          organization_id: organizationId,
          scheme_id: scheme.id,
          code: "PT",
          label: "Performance Tasks",
          description: "Performance-based assessments and projects",
          display_order: 2,
          created_by: session.user.id,
        });

        const qa = await createComponent({
          organization_id: organizationId,
          scheme_id: scheme.id,
          code: "QA",
          label: "Quarterly Assessment",
          description: "Quarterly or period-end assessments",
          display_order: 3,
          created_by: session.user.id,
        });

        // 3. Create default weight profile
        const profile = await createWeightProfile({
          organization_id: organizationId,
          scheme_id: scheme.id,
          profile_key: "default",
          profile_label: "Default",
          is_default: true,
          description: "Default weight profile (WW: 30%, PT: 50%, QA: 20%)",
          created_by: session.user.id,
        });

        // 4. Set default weights (WW: 30%, PT: 50%, QA: 20%)
        await upsertComponentWeights([
          {
            organization_id: organizationId,
            scheme_id: scheme.id,
            profile_id: profile.id,
            component_id: ww.id,
            weight_percent: 30,
            created_by: session.user.id,
          },
          {
            organization_id: organizationId,
            scheme_id: scheme.id,
            profile_id: profile.id,
            component_id: pt.id,
            weight_percent: 50,
            created_by: session.user.id,
          },
          {
            organization_id: organizationId,
            scheme_id: scheme.id,
            profile_id: profile.id,
            component_id: qa.id,
            weight_percent: 20,
            created_by: session.user.id,
          },
        ]);

        // 5. Create transmutation table (DepEd only)
        const table = await createTransmutationTable({
          organization_id: organizationId,
          scheme_id: scheme.id,
          version: 1,
          description: "Standard DepEd K-12 transmutation table",
          created_by: session.user.id,
        });

        // 6. Add standard DepEd transmutation rows (75-100 range)
        // Standard DepEd K-12 transmutation: 75-79 → 80, 80-84 → 85, 85-89 → 90, 90-100 → 95-100
        const transmutationRows = [];
        for (let initial = 75; initial <= 100; initial++) {
          let transmuted: number;
          if (initial >= 90) {
            // 90-100 → 95-100 (linear mapping)
            transmuted = 95 + ((initial - 90) / 10) * 5;
          } else if (initial >= 85) {
            // 85-89 → 90-94
            transmuted = 90 + (initial - 85);
          } else if (initial >= 80) {
            // 80-84 → 85-89
            transmuted = 85 + (initial - 80);
          } else {
            // 75-79 → 80-84
            transmuted = 80 + (initial - 75);
          }
          
          transmutationRows.push({
            organization_id: organizationId,
            transmutation_table_id: table.id,
            initial_grade: initial,
            transmuted_grade: Math.round(transmuted),
            created_by: session.user.id,
          });
        }

        await upsertTransmutationRows(transmutationRows);
      }

      toast({
        message: "Scheme created successfully. You can now publish it.",
        type: "success",
      });

      setCreateDialogOpen(false);
      setFormData({
        scheme_type: "deped_k12",
        name: "",
        description: "",
      });

      // Refresh schemes list
      const data = await listSchemes(organizationId);
      setSchemes(data || []);
    } catch (error: any) {
      console.error("Error creating scheme", error);
      toast({
        message: error.message || "Failed to create scheme",
        type: "error",
      });
    } finally {
      setCreating(false);
    }
  };

  const handlePublish = async (schemeId: string) => {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("Not authenticated");
      }

      await publishScheme(schemeId, session.user.id);

      toast({
        message: "Scheme published successfully",
        type: "success",
      });

      // Refresh schemes list
      if (organizationId) {
        const data = await listSchemes(organizationId);
        setSchemes(data || []);
      }
    } catch (error: any) {
      console.error("Error publishing scheme", error);
      toast({
        message: error.message || "Failed to publish scheme",
        type: "error",
      });
    }
  };

  const handleViewDetails = (schemeId: string) => {
    router.push(`/sis/gradebook/schemes/${schemeId}`);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading schemes...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold">Gradebook Schemes</h1>
          <p className="text-muted-foreground mt-1">
            Configure DepEd K-12 or CHED/HEI grade computation schemes
          </p>
        </div>
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Create Scheme
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Create Gradebook Scheme</DialogTitle>
              <DialogDescription>
                Create a new computation scheme. For DepEd K-12, WW/PT/QA components will be automatically added.
              </DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label htmlFor="scheme_type">Scheme Type *</Label>
                <Select
                  value={formData.scheme_type}
                  onValueChange={(value: "deped_k12" | "ched_hei") =>
                    setFormData({ ...formData, scheme_type: value })
                  }
                >
                  <SelectTrigger id="scheme_type">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="deped_k12">DepEd K-12</SelectItem>
                    <SelectItem value="ched_hei">CHED/HEI</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="name">Scheme Name *</Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="e.g., DepEd K-12 Standard"
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="Optional description"
                  rows={3}
                />
              </div>
              {formData.scheme_type === "deped_k12" && (
                <div className="bg-blue-50 p-4 rounded-md">
                  <div className="text-sm text-blue-900">
                    <p className="mb-2">
                      <strong>Note:</strong> This will automatically create:
                    </p>
                    <ul className="list-disc list-inside mt-2">
                      <li>WW (Written Works) component</li>
                      <li>PT (Performance Tasks) component</li>
                      <li>QA (Quarterly Assessment) component</li>
                      <li>Default weight profile (WW: 30%, PT: 50%, QA: 20%)</li>
                      <li>Standard transmutation table</li>
                    </ul>
                  </div>
                </div>
              )}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                Cancel
              </Button>
              <Button onClick={handleCreateScheme} disabled={creating || !formData.name}>
                {creating ? "Creating..." : "Create Scheme"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {schemes.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Award className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No schemes found</h3>
            <p className="text-muted-foreground mb-4">
              Create your first gradebook scheme to get started
            </p>
            <Button onClick={() => setCreateDialogOpen(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Create Scheme
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {schemes.map((scheme) => (
            <Card key={scheme.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div>
                    <CardTitle className="flex items-center gap-2">
                      {scheme.name}
                      <Badge variant={scheme.published_at ? "default" : "secondary"}>
                        {scheme.published_at ? "Published" : "Draft"}
                      </Badge>
                      <Badge variant="outline">{scheme.scheme_type}</Badge>
                    </CardTitle>
                    {scheme.description && (
                      <p className="text-sm text-muted-foreground mt-1">{scheme.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    {!scheme.published_at && (
                      <Button
                        size="sm"
                        onClick={() => handlePublish(scheme.id)}
                        variant="outline"
                      >
                        <CheckCircle2 className="mr-2 h-4 w-4" />
                        Publish
                      </Button>
                    )}
                    <Button
                      size="sm"
                      onClick={() => handleViewDetails(scheme.id)}
                      variant="outline"
                    >
                      <Settings className="mr-2 h-4 w-4" />
                      Manage
                    </Button>
                  </div>
                </div>
              </CardHeader>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
