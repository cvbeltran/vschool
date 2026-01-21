"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { listMyPortfolioArtifacts, type PortfolioArtifact } from "@/lib/phase6/portfolio";

export default function MyPortfolioPage() {
  const router = useRouter();
  const [artifacts, setArtifacts] = useState<PortfolioArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState<boolean | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        // First check if user is a student by trying to match their email
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (!session) {
          setError("Please log in to access your portfolio");
          setIsStudent(false);
          setLoading(false);
          return;
        }

        // Get organization_id from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          setError("Profile not found");
          setIsStudent(false);
          setLoading(false);
          return;
        }

        // Try to match student by email
        const { data: user } = await supabase.auth.getUser();
        let studentFound = false;
        
        if (user?.user?.email && profile.organization_id) {
          const { data: student } = await supabase
            .from("students")
            .select("id")
            .eq("primary_email", user.user.email)
            .eq("organization_id", profile.organization_id)
            .maybeSingle();
          
          if (student) {
            studentFound = true;
          }
        }

        if (!studentFound) {
          setIsStudent(false);
          setError(null); // Don't show error, show friendly message instead
          setLoading(false);
          return;
        }

        setIsStudent(true);
        const data = await listMyPortfolioArtifacts();
        setArtifacts(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching portfolio artifacts:", err);
        // Check if it's the "Student ID not found" error
        if (err.message?.includes("Student ID not found")) {
          setIsStudent(false);
          setError(null); // Don't show error, show friendly message instead
        } else {
          setError(err.message || "Failed to load portfolio artifacts");
        }
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

  // Show friendly message if user is not a student
  if (isStudent === false) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Portfolio</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              This page is only available for students. Please ensure your account is linked to a student record.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">My Portfolio</h1>
        {isStudent && (
          <Button onClick={() => router.push("/sis/phase6/portfolio/my/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Artifact
          </Button>
        )}
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
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{artifact.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {artifact.artifact_type}
                      </Badge>
                    </div>
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
