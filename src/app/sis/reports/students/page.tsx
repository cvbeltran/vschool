"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function StudentReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Student Reports</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No student reports available yet
        </CardContent>
      </Card>
    </div>
  );
}

