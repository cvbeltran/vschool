"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewLessonLogPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Create Lesson Log</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Lesson Log Form</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Lesson log creation form will be implemented here. This will include:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Syllabus and week selection (with copy from syllabus week)</li>
            <li>Week range (start/end dates)</li>
            <li>Objectives and activities</li>
            <li>Per-learner verification entries</li>
            <li>Links to Phase 2 experiences</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
