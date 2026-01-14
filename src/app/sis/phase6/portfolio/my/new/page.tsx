"use client";

import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function NewPortfolioArtifactPage() {
  const router = useRouter();

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Create Portfolio Artifact</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Portfolio Artifact Form</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Portfolio artifact creation form will be implemented here. This will include:
          </p>
          <ul className="list-disc list-inside mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Artifact type selection (upload/link/text)</li>
            <li>Title and description</li>
            <li>File upload or URL or text content</li>
            <li>Tags (competencies, domains, experiences)</li>
            <li>Visibility settings</li>
            <li>Links to Phase 2 observations/experiences</li>
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
