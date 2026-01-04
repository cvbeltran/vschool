"use client";

import { Card, CardContent } from "@/components/ui/card";

export default function GuardiansPage() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Guardians</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          No guardians available yet
        </CardContent>
      </Card>
    </div>
  );
}

