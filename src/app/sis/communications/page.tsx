"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function CommunicationsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Communications</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No communications available yet
        </CardContent>
      </Card>
    </div>
  );
}

