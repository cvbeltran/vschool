"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Plus, Edit } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { getMasteryModel, listMasteryLevels, type MasteryModel, type MasteryLevel } from "@/lib/mastery";

export default function MasteryModelDetailPage() {
  const router = useRouter();
  const params = useParams();
  const modelId = params.id as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [model, setModel] = useState<MasteryModel | null>(null);
  const [levels, setLevels] = useState<MasteryLevel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !modelId) return;
      try {
        setLoading(true);
        const [modelData, levelsData] = await Promise.all([
          getMasteryModel(modelId),
          listMasteryLevels(modelId),
        ]);
        setModel(modelData);
        setLevels(levelsData || []);
      } catch (error) {
        console.error("Error fetching mastery model", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [modelId, orgLoading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mastery Model</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!model) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mastery Model</h1>
        <div className="text-muted-foreground text-sm">Model not found</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.push("/sis/mastery/setup/models")}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{model.name}</h1>
            <p className="text-sm text-muted-foreground mt-1">{model.description || "No description"}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => router.push(`/sis/mastery/setup/models/${modelId}/edit`)}>
            <Edit className="h-4 w-4 mr-2" />
            Edit
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="pt-6">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <div className="text-sm text-muted-foreground">Status</div>
              <Badge variant={model.is_active ? "default" : "secondary"}>
                {model.is_active ? "Active" : "Inactive"}
              </Badge>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Emerging Threshold</div>
              <div className="font-medium">{model.threshold_emerging}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Developing Threshold</div>
              <div className="font-medium">{model.threshold_developing}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Proficient Threshold</div>
              <div className="font-medium">{model.threshold_proficient}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">Mastered Threshold</div>
              <div className="font-medium">{model.threshold_mastered}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold">Mastery Levels ({levels.length})</h2>
            <Button size="sm" onClick={() => router.push(`/sis/mastery/setup/models/${modelId}/levels/new`)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Level
            </Button>
          </div>
          {levels.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              No mastery levels yet. Add levels to define mastery states.
            </div>
          ) : (
            <div className="space-y-2">
              {levels.map((level) => (
                <div key={level.id} className="border rounded-lg p-4 flex items-center justify-between">
                  <div>
                    <div className="font-medium">{level.label}</div>
                    {level.description && (
                      <div className="text-sm text-muted-foreground">{level.description}</div>
                    )}
                    <div className="text-xs text-muted-foreground mt-1">
                      Order: {level.display_order} {level.is_terminal && "• Terminal"}
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/sis/mastery/setup/models/${modelId}/levels/${level.id}/edit`)}
                  >
                    Edit
                  </Button>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
