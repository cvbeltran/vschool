"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewAttendanceSessionPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Create Attendance Session</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Attendance Session Form</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Attendance session creation form will be implemented here.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
