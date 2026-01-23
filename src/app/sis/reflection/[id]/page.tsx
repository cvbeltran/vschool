"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getTeacherReflection,
  type TeacherReflection,
} from "@/lib/reflection";

export default function TeacherReflectionDetailPage() {
  const params = useParams();
  const router = useRouter();
  const reflectionId = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [reflection, setReflection] = useState<TeacherReflection | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !reflectionId) return;

      // Fetch user role
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          setRole(normalizeRole(profile.role));
        }
      }

      try {
        const reflectionData = await getTeacherReflection(reflectionId);
        if (!reflectionData) {
          setError("Reflection not found");
          setLoading(false);
          return;
        }
        setReflection(reflectionData);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching reflection:", err);
        setError(err.message || "Failed to load reflection");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [reflectionId, orgLoading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Teacher Reflection</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (!reflection) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Reflection Not Found</h1>
        <Button onClick={() => router.push("/sis/reflection/my")}>
          Back to Reflections
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/sis/reflection/my")}
          className="gap-2"
        >
          <ArrowLeft className="size-4" />
          Back
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Teacher Reflection</h1>
          <p className="text-sm text-muted-foreground mt-1">
            View reflection details
          </p>
        </div>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Reflection Information */}
        <Card>
          <CardHeader>
            <CardTitle>Reflection Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {reflection.reflection_prompt && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Prompt
                </div>
                <div className="text-base">
                  {reflection.reflection_prompt.prompt_text}
                </div>
              </div>
            )}
            {reflection.experience && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Experience
                </div>
                <div className="text-base">{reflection.experience.name}</div>
              </div>
            )}
            {reflection.competency && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Competency
                </div>
                <div className="text-base">{reflection.competency.name}</div>
              </div>
            )}
            {reflection.school_year && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  School Year
                </div>
                <div className="text-base">
                  {reflection.school_year.year_label}
                </div>
              </div>
            )}
            {reflection.quarter && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Quarter
                </div>
                <div className="text-base">{reflection.quarter}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Status
              </div>
              <Badge
                variant={
                  reflection.status === "completed" ? "default" : "secondary"
                }
              >
                {reflection.status}
              </Badge>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Reflected At
              </div>
              <div className="text-base">
                {new Date(reflection.reflected_at).toLocaleString()}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Metadata */}
        <Card>
          <CardHeader>
            <CardTitle>Metadata</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Created
              </div>
              <div className="text-base">
                {new Date(reflection.created_at).toLocaleString()}
              </div>
            </div>
            {reflection.updated_at !== reflection.created_at && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">
                  Last Updated
                </div>
                <div className="text-base">
                  {new Date(reflection.updated_at).toLocaleString()}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Reflection Text */}
      <Card>
        <CardHeader>
          <CardTitle>Reflection Text</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="prose max-w-none whitespace-pre-wrap">
            {reflection.reflection_text || "—"}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
