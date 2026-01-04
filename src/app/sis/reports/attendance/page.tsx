"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function AttendanceReportsPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Attendance Reports</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No attendance reports available yet
        </CardContent>
      </Card>
    </div>
  );
}

