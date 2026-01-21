"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Plus, Edit } from "lucide-react";
import { getLabelSet, type AssessmentLabelSet } from "@/lib/assessment-labels";
import { listLabels, type AssessmentLabel } from "@/lib/assessment-labels";

export default function LabelSetDetailPage() {
  const params = useParams();
  const router = useRouter();
  const labelSetId = params.id as string;

  const [labelSet, setLabelSet] = useState<AssessmentLabelSet | null>(null);
  const [labels, setLabels] = useState<AssessmentLabel[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const labelSetData = await getLabelSet(labelSetId);
        if (!labelSetData) {
          router.push("/sis/assessments/label-sets");
          return;
        }
        setLabelSet(labelSetData);

        const labelsData = await listLabels(labelSetId);
        setLabels(labelsData);
      } catch (error: any) {
        console.error("Error fetching label set:", error);
      } finally {
        setLoading(false);
      }
    };

    if (labelSetId) {
      fetchData();
    }
  }, [labelSetId, router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Label Set</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!labelSet) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Label Set Not Found</h1>
        <Button onClick={() => router.push("/sis/assessments/label-sets")}>Back to Label Sets</Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.back()}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-semibold">{labelSet.name}</h1>
          {labelSet.description && (
            <p className="text-sm text-muted-foreground mt-1">{labelSet.description}</p>
          )}
        </div>
        <Button
          variant="outline"
          onClick={() => router.push(`/sis/assessments/label-sets/${labelSetId}/edit`)}
          className="gap-2"
        >
          <Edit className="size-4" />
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle>Labels</CardTitle>
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push(`/sis/assessments/label-sets/${labelSetId}/labels/new`)}
              className="gap-2"
            >
              <Plus className="size-4" />
              Add Label
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {labels.length === 0 ? (
            <div className="text-sm text-muted-foreground py-4">
              No labels yet. Click "Add Label" to create labels for this set.
            </div>
          ) : (
            <div className="space-y-2">
              {labels.map((label) => (
                <div
                  key={label.id}
                  className="border rounded-lg p-4 flex items-start justify-between"
                >
                  <div className="flex-1">
                    <div className="font-medium">{label.label_text}</div>
                    {label.description && (
                      <div className="text-sm text-muted-foreground mt-1">{label.description}</div>
                    )}
                    {label.display_order !== null && (
                      <div className="text-xs text-muted-foreground mt-1">
                        Display order: {label.display_order}
                      </div>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push(`/sis/assessments/labels/${label.id}/edit`)}
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

