"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function StaffPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Staff</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No staff members available yet
        </CardContent>
      </Card>
    </div>
  );
}

