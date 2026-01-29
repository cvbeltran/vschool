"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { createMasteryModel } from "@/lib/mastery";
import { useToast } from "@/hooks/use-toast";

export default function NewMasteryModelPage() {
  const router = useRouter();
  const { organizationId } = useOrganization();
  const { toast } = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    description: "",
    is_active: true,
    threshold_not_started: 0,
    threshold_emerging: 1,
    threshold_developing: 2,
    threshold_proficient: 3,
    threshold_mastered: 5,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!organizationId) return;

    try {
      setSubmitting(true);
      await createMasteryModel({
        ...formData,
        organization_id: organizationId,
      });
      toast({
        title: "Success",
        description: "Mastery model created successfully",
      });
      router.push("/sis/mastery/setup/models");
    } catch (error: any) {
      toast({
        title: "Error",
        description: error.message || "Failed to create mastery model",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.push("/sis/mastery/setup/models")}>
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Create Mastery Model</h1>
      </div>

      <Card>
        <CardContent className="pt-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Name *</Label>
              <Input
                id="name"
                value={formData.name}
                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Description</Label>
              <Textarea
                id="description"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              />
            </div>
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="space-y-2">
                <Label htmlFor="threshold_not_started">Not Started</Label>
                <Input
                  id="threshold_not_started"
                  type="number"
                  value={formData.threshold_not_started}
                  onChange={(e) => setFormData({ ...formData, threshold_not_started: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_emerging">Emerging</Label>
                <Input
                  id="threshold_emerging"
                  type="number"
                  value={formData.threshold_emerging}
                  onChange={(e) => setFormData({ ...formData, threshold_emerging: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_developing">Developing</Label>
                <Input
                  id="threshold_developing"
                  type="number"
                  value={formData.threshold_developing}
                  onChange={(e) => setFormData({ ...formData, threshold_developing: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_proficient">Proficient</Label>
                <Input
                  id="threshold_proficient"
                  type="number"
                  value={formData.threshold_proficient}
                  onChange={(e) => setFormData({ ...formData, threshold_proficient: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="threshold_mastered">Mastered</Label>
                <Input
                  id="threshold_mastered"
                  type="number"
                  value={formData.threshold_mastered}
                  onChange={(e) => setFormData({ ...formData, threshold_mastered: parseInt(e.target.value) || 0 })}
                  min={0}
                />
              </div>
            </div>
            <div className="flex gap-4">
              <Button type="submit" disabled={submitting}>
                {submitting ? "Creating..." : "Create Model"}
              </Button>
              <Button type="button" variant="outline" onClick={() => router.back()}>
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
