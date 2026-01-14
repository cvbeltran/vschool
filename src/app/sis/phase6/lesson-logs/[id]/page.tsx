"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Edit2 } from "lucide-react";

export default function LessonLogDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Lesson Log Details</h1>
        <Button
          variant="outline"
          size="sm"
          onClick={() => router.push(`/sis/phase6/lesson-logs/${id}/edit`)}
        >
          <Edit2 className="mr-2 h-4 w-4" />
          Edit
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Log</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Lesson log detail view will be implemented here for log ID: {id}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
