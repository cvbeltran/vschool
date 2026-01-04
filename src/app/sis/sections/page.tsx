"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function SectionsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Sections</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No sections available yet
        </CardContent>
      </Card>
    </div>
  );
}

