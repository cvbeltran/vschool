"use client";

import { useParams, useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

export default function EditPortfolioArtifactPage() {
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
        <h1 className="text-2xl font-semibold">Edit Portfolio Artifact</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Edit Portfolio Artifact Form</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-muted-foreground">
            Portfolio artifact edit form with tag editor will be implemented here for artifact ID: {id}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
