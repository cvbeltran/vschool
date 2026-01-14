"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { listMyPortfolioArtifacts, type PortfolioArtifact } from "@/lib/phase6/portfolio";

export default function MyPortfolioPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<PortfolioArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await listMyPortfolioArtifacts();
        setArtifacts(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching portfolio artifacts:", err);
        setError(err.message || "Failed to load portfolio artifacts");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Portfolio</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Portfolio</h1>
        <Button onClick={() => router.push("/sis/phase6/portfolio/my/new")}>
          <Plus className="mr-2 h-4 w-4" />
          Create Artifact
        </Button>
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {artifacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No portfolio artifacts found. Create your first artifact to get started.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((artifact) => (
            <Card key={artifact.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="font-medium">{artifact.title}</p>
                    <p className="text-xs text-muted-foreground mt-1">
                      Type: {artifact.artifact_type}
                    </p>
                    {artifact.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {artifact.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/sis/phase6/portfolio/my/${artifact.id}`)}
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
