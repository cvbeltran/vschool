"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { createMasteryLevel, listMasteryLevels, getMasteryModel, type MasteryModel } from "@/lib/mastery";
import { useToast } from "@/hooks/use-toast";

export default function NewMasteryLevelPage() {
  const router = useRouter();
  const params = useParams();
  const modelId = params.id as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [model, setModel] = useState<MasteryModel | null>(null);
  const [formData, setFormData] = useState({
    label: "",
    description: "",
    display_order: 1,
    is_terminal: false,
  });

  useEffect(() => {
    let isMounted = true;
    let timeoutId: NodeJS.Timeout | null = null;
    
    const fetchData = async () => {
      // Wait for organization to load and modelId to be available
      if (orgLoading) {
        // Still loading organization, keep loading state
        // Add a timeout to prevent infinite loading (30 seconds)
        timeoutId = setTimeout(() => {
          if (isMounted && orgLoading) {
            console.warn("Organization loading timeout - proceeding anyway");
            setLoading(false);
            toast({
              title: "Warning",
              description: "Organization loading is taking longer than expected. Please refresh the page.",
              variant: "destructive",
            });
          }
        }, 30000);
        return;
      }
      
      // Clear timeout if organization finished loading
      if (timeoutId) {
        clearTimeout(timeoutId);
        timeoutId = null;
      }
      
      if (!modelId) {
        // No modelId available, stop loading and show error
        if (isMounted) {
          setLoading(false);
          toast({
            title: "Error",
            description: "Mastery model ID is missing",
            variant: "destructive",
          });
          setTimeout(() => {
            if (isMounted) {
              router.push("/sis/mastery/setup/models");
            }
          }, 1000);
        }
        return;
      }
      
      console.log("Fetching mastery model data", { modelId, organizationId });
      
      try {
        setLoading(true);
        
        // Fetch model first
        let modelData: MasteryModel | null;
        try {
          modelData = await getMasteryModel(modelId);
        } catch (error: any) {
          // getMasteryModel throws for non-404 errors
          if (!isMounted) return;
          
          console.error("Error fetching mastery model", error);
          const errorMessage = error?.message || error?.error || "Failed to load mastery model";
          
          toast({
            title: "Error",
            description: errorMessage,
            variant: "destructive",
          });
          
          // Small delay before redirect to allow toast to show
          setTimeout(() => {
            if (isMounted) {
              router.push("/sis/mastery/setup/models");
            }
          }, 1000);
          return;
        }

        if (!isMounted) return;

        if (!modelData) {
          if (isMounted) {
            setLoading(false);
            toast({
              title: "Error",
              description: "Mastery model not found",
              variant: "destructive",
            });
            setTimeout(() => {
              if (isMounted) {
                router.push("/sis/mastery/setup/models");
              }
            }, 1000);
          }
          return;
        }
        
        setModel(modelData);

        // Fetch levels (will return empty array if none exist or if there's an error)
        // listMasteryLevels never throws - it returns an empty array on error
        const levelsData = await listMasteryLevels(modelId);
        
        if (!isMounted) return;
        
        // Set display_order to be one more than the highest existing order
        const maxOrder = levelsData.length > 0
          ? Math.max(...levelsData.map((l) => l.display_order))
          : 0;
        setFormData((prev) => ({ ...prev, display_order: maxOrder + 1 }));
      } catch (error: any) {
        // Fallback catch for any unexpected errors
        if (!isMounted) return;
        
        console.error("Unexpected error in fetchData", error);
        const errorMessage = error?.message || error?.error || "An unexpected error occurred";
        
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    fetchData();
    
    return () => {
      isMounted = false;
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
    };
  }, [modelId, orgLoading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId || !modelId) return;

    try {
      setSubmitting(true);
      await createMasteryLevel({
        organization_id: organizationId,
        mastery_model_id: modelId,
        label: formData.label,
        description: formData.description || null,
        display_order: formData.display_order,
        is_terminal: formData.is_terminal,
      });
      toast({
        title: "Success",
        description: "Mastery level created successfully",
      });
      router.push(`/sis/mastery/setup/models/${modelId}`);
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create mastery level",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  if (loading || orgLoading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Mastery Level</h1>
        <div className="text-muted-foreground text-sm">
          {orgLoading ? "Loading organization..." : "Loading mastery model..."}
        </div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Create Mastery Level</h1>
        <div className="text-muted-foreground text-sm">Model not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push(`/sis/mastery/setup/models/${modelId}`)}
        >
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Create Mastery Level</h1>
          <p className="text-sm text-muted-foreground mt-1">For model: {model.name}</p>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="label">Label *</Label>
              <Input
                id="label"
                value={formData.label}
                onChange={(e) => setFormData({ ...formData, label: e.target.value })}
                placeholder="e.g., Not Started, Emerging, Developing, Proficient, Mastered"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Optional description of this mastery level"
                rows={3}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="display_order">Display Order *</Label>
              <Input
                id="display_order"
                type="number"
                value={formData.display_order}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    display_order: parseInt(e.target.value) || 1,
                  })
                }
                min={1}
                required
              />
              <p className="text-xs text-muted-foreground">
                Lower numbers appear first. Levels are ordered by this value.
              </p>
            </div>
            <div className="flex items-center space-x-2">
              <Switch
                id="is_terminal"
                checked={formData.is_terminal}
                onCheckedChange={(checked) =>
                  setFormData({ ...formData, is_terminal: checked })
                }
              />
              <Label htmlFor="is_terminal" className="cursor-pointer">
                Terminal Level
              </Label>
            </div>
            <p className="text-xs text-muted-foreground">
              Terminal levels indicate the highest achievement level (e.g., "Mastered").
            </p>
            <div className="flex gap-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Level"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`/sis/mastery/setup/models/${modelId}`)}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
