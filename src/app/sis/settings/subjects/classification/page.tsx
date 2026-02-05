"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Pencil, AlertTriangle, ArrowLeft } from "lucide-react";
import { normalizeRole } from "@/lib/rbac";
import { useOrganization } from "@/lib/hooks/use-organization";
import Link from "next/link";

interface Section {
  id: string;
  school_id: string;
  program_id: string;
  code: string;
  name: string;
  primary_classification: string | null;
  classification_source: string | null;
  is_active: boolean;
}

interface School {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
  code: string;
}

export default function SubjectsClassificationPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [sections, setSections] = useState<Section[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingSection, setEditingSection] = useState<Section | null>(null);
  const [availableClassifications, setAvailableClassifications] = useState<string[]>([]);
  const [selectedClassification, setSelectedClassification] = useState<string | null>(null);
  const [unclassifiedCount, setUnclassifiedCount] = useState(0);

  useEffect(() => {
    const checkAccess = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/sis/auth/login");
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (profile?.role) {
        const normalizedRole = normalizeRole(profile.role);
        setRole(normalizedRole);

        // Check if user has access (admin, principal, registrar, or super_admin)
        const allowedRoles = ["admin", "principal", "registrar", "super_admin"];
        if (!allowedRoles.includes(profile.role) && !isSuperAdmin) {
          router.push("/sis");
          return;
        }
      }
    };

    checkAccess();
  }, [router, isSuperAdmin]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

      setLoading(true);

      // Fetch schools
      let schoolsQuery = supabase.from("schools").select("id, name");
      if (!isSuperAdmin && organizationId) {
        schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
      }
      const { data: schoolsData } = await schoolsQuery.order("name", { ascending: true });
      setSchools(schoolsData || []);

      // Fetch programs
      let programsQuery = supabase.from("programs").select("id, name, code, school_id");
      if (!isSuperAdmin && organizationId) {
        programsQuery = programsQuery.eq("organization_id", organizationId);
      }
      const { data: programsData } = await programsQuery.order("name", { ascending: true });
      setPrograms(programsData || []);

      // Fetch sections with classification
      let sectionsQuery = supabase
        .from("sections")
        .select("id, school_id, program_id, code, name, primary_classification, classification_source, is_active")
        .is("archived_at", null)
        .order("code", { ascending: true });

      if (!isSuperAdmin && organizationId) {
        sectionsQuery = sectionsQuery.eq("organization_id", organizationId);
      }

      const { data: sectionsData, error: sectionsError } = await sectionsQuery;

      if (sectionsError) {
        // Check if error is due to missing columns (migration not run)
        if (sectionsError.message.includes("primary_classification") || 
            sectionsError.message.includes("does not exist") ||
            sectionsError.message.includes("column") && sectionsError.message.includes("not found")) {
          setError(
            "⚠️ Database migration required: The primary_classification columns don't exist yet. " +
            "Please run the migration: migrations/20260203131145_primary_classification_on_sections.sql " +
            "You can run it via Supabase Dashboard SQL Editor or using psql."
          );
          setLoading(false);
          return;
        }
        setError(`Failed to fetch sections: ${sectionsError.message}`);
        setLoading(false);
        return;
      }

      setSections(sectionsData || []);
      
      // Count unclassified sections
      const unclassified = (sectionsData || []).filter(
        (s: Section) => !s.primary_classification && s.is_active
      ).length;
      setUnclassifiedCount(unclassified);

      // Fetch available classifications
      let schemesQuery = supabase
        .from("gradebook_schemes")
        .select("id")
        .is("archived_at", null);

      if (!isSuperAdmin && organizationId) {
        schemesQuery = schemesQuery.eq("organization_id", organizationId);
      }

      const { data: schemes } = await schemesQuery;

      if (schemes && schemes.length > 0) {
        const schemeIds = schemes.map((s: any) => s.id);
        const { data: profiles } = await supabase
          .from("gradebook_weight_profiles")
          .select("profile_key")
          .in("scheme_id", schemeIds)
          .is("archived_at", null);

        if (profiles) {
          const uniqueKeys = [...new Set(profiles.map((p: any) => p.profile_key))].sort();
          setAvailableClassifications(uniqueKeys);
        }
      }

      setError(null);
      setLoading(false);
    };

    if (!orgLoading) {
      fetchData();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  const handleEdit = (section: Section) => {
    setEditingSection(section);
    setSelectedClassification(section.primary_classification);
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!editingSection) return;

    setError(null);

    const updateData: any = {
      primary_classification: selectedClassification || null,
      classification_source: selectedClassification ? "manual" : null,
    };

    const { error: updateError } = await supabase
      .from("sections")
      .update(updateData)
      .eq("id", editingSection.id);

    if (updateError) {
      setError(`Failed to update classification: ${updateError.message}`);
      return;
    }

    // Refresh data
    const { data: sectionsData } = await supabase
      .from("sections")
      .select("id, school_id, program_id, code, name, primary_classification, classification_source, is_active")
      .is("archived_at", null)
      .order("code", { ascending: true });

    if (!isSuperAdmin && organizationId) {
      const { data } = await supabase
        .from("sections")
        .select("id, school_id, program_id, code, name, primary_classification, classification_source, is_active")
        .eq("organization_id", organizationId)
        .is("archived_at", null)
        .order("code", { ascending: true });
      setSections(data || []);
      const unclassified = (data || []).filter(
        (s: Section) => !s.primary_classification && s.is_active
      ).length;
      setUnclassifiedCount(unclassified);
    } else {
      setSections(sectionsData || []);
      const unclassified = (sectionsData || []).filter(
        (s: Section) => !s.primary_classification && s.is_active
      ).length;
      setUnclassifiedCount(unclassified);
    }

    setIsDialogOpen(false);
    setEditingSection(null);
    setSelectedClassification(null);
  };

  const getSchoolName = (schoolId: string) => {
    return schools.find((s) => s.id === schoolId)?.name || "Unknown";
  };

  const getProgramName = (programId: string) => {
    return programs.find((p) => p.id === programId)?.name || "Unknown";
  };

  // Group sections by classification
  const groupedByClassification = sections.reduce((acc, section) => {
    const key = section.primary_classification || "unclassified";
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(section);
    return acc;
  }, {} as Record<string, Section[]>);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Subjects (Classification)</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/sis/settings/subjects">
          <Button variant="ghost" size="sm" className="gap-2">
            <ArrowLeft className="size-4" />
            Back to Subjects
          </Button>
        </Link>
        <div>
          <h1 className="text-2xl font-semibold">Subjects (Classification)</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Manage primary classification for sections used by Gradebook weight profile selection
          </p>
        </div>
      </div>

      {unclassifiedCount > 0 && (
        <Card className="border-destructive">
          <CardContent className="py-4">
            <div className="flex items-start gap-3">
              <AlertTriangle className="h-5 w-5 text-destructive mt-0.5" />
              <div>
                <div className="font-semibold text-destructive">Action Required</div>
                <div className="text-sm text-muted-foreground mt-1">
                  {unclassifiedCount} active section{unclassifiedCount !== 1 ? "s" : ""} {unclassifiedCount !== 1 ? "are" : "is"} missing primary classification. 
                  Gradebook will use fallback profiles until classifications are set.
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {error && (
        <Card className={error.includes("migration") ? "border-yellow-500" : ""}>
          <CardContent className="py-4">
            <div className="text-sm text-destructive mb-3">{error}</div>
            {error.includes("migration") && (
              <div className="mt-4 p-4 bg-muted rounded-lg">
                <div className="font-semibold mb-2">How to run the migration:</div>
                <ol className="list-decimal list-inside space-y-1 text-sm text-muted-foreground">
                  <li>Open your Supabase Dashboard</li>
                  <li>Go to SQL Editor</li>
                  <li>Copy and paste the contents of <code className="bg-background px-1 rounded">migrations/20260203131145_primary_classification_on_sections.sql</code></li>
                  <li>Click "Run" to execute the migration</li>
                  <li>Optionally run the backfill: <code className="bg-background px-1 rounded">migrations/20260203131146_backfill_sections_classification.sql</code></li>
                  <li>Refresh this page</li>
                </ol>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Grouped by Classification */}
      <div className="space-y-6">
        {/* Unclassified sections first */}
        {groupedByClassification["unclassified"] && groupedByClassification["unclassified"].length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="text-destructive">Unclassified Sections</CardTitle>
              <CardDescription>
                {groupedByClassification["unclassified"].length} section(s) without classification
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {groupedByClassification["unclassified"].map((section) => (
                  <div
                    key={section.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <div className="font-medium">
                        {section.code} - {section.name}
                      </div>
                      <div className="text-sm text-muted-foreground">
                        {getSchoolName(section.school_id)} / {getProgramName(section.program_id)}
                      </div>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleEdit(section)}
                      className="gap-2"
                    >
                      <Pencil className="size-4" />
                      Set Classification
                    </Button>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Classified sections grouped by classification */}
        {Object.entries(groupedByClassification)
          .filter(([key]) => key !== "unclassified")
          .sort(([a], [b]) => a.localeCompare(b))
          .map(([classification, sectionList]) => (
            <Card key={classification}>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <span className="font-mono">{classification}</span>
                  <span className="text-sm font-normal text-muted-foreground">
                    ({sectionList.length} section{sectionList.length !== 1 ? "s" : ""})
                  </span>
                </CardTitle>
                <CardDescription>
                  Classification source: {sectionList[0]?.classification_source || "unknown"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {sectionList.map((section) => (
                    <div
                      key={section.id}
                      className="flex items-center justify-between p-3 border rounded-lg"
                    >
                      <div>
                        <div className="font-medium">
                          {section.code} - {section.name}
                        </div>
                        <div className="text-sm text-muted-foreground">
                          {getSchoolName(section.school_id)} / {getProgramName(section.program_id)}
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEdit(section)}
                        className="gap-2"
                      >
                        <Pencil className="size-4" />
                        Edit
                      </Button>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          ))}
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Classification</DialogTitle>
            <DialogDescription>
              Set the primary classification for {editingSection?.code} - {editingSection?.name}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="classification">Primary Classification</Label>
              <Select
                value={selectedClassification || "__none__"}
                onValueChange={(value) => setSelectedClassification(value === "__none__" ? null : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select classification (optional)" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">None (will use default profile)</SelectItem>
                  {availableClassifications.map((key) => (
                    <SelectItem key={key} value={key}>
                      {key}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-muted-foreground text-xs">
                Determines which weight profile is used for grade computation.
                {availableClassifications.length > 0 && (
                  <> Available: {availableClassifications.join(", ")}</>
                )}
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>Save</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
