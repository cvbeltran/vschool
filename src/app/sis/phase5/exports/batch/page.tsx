"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  createExportJob,
  processExportJob,
  type ExportParameters,
} from "@/lib/phase5/exports";
import { useRouter } from "next/navigation";
import { AlertCircle, FileText } from "lucide-react";
import { Badge } from "@/components/ui/badge";

export default function BatchExportPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [estimatedCount, setEstimatedCount] = useState<number | null>(null);
  const [estimating, setEstimating] = useState(false);

  // Form state
  const [exportType, setExportType] = useState<
    "transcript" | "report_card" | "compliance_export"
  >("compliance_export");
  const [schoolYearId, setSchoolYearId] = useState<string>("");
  const [termPeriod, setTermPeriod] = useState<string>("");
  const [programId, setProgramId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [batchSize, setBatchSize] = useState<number>(500);
  const [format, setFormat] = useState<"pdf" | "csv" | "excel">("csv");

  // Data
  const [schoolYears, setSchoolYears] = useState<
    Array<{ id: string; year_label: string }>
  >([]);
  const [programs, setPrograms] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [sections, setSections] = useState<
    Array<{ id: string; name: string }>
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

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

      const canGenerate =
        role === "principal" ||
        role === "admin" ||
        role === "admin"; // registrar normalized to admin

      if (!canGenerate) {
        setError("You do not have permission to generate batch exports");
        setLoading(false);
        return;
      }

      try {
        const orgId = isSuperAdmin ? null : organizationId || null;

        // Fetch school years
        let schoolYearsQuery = supabase
          .from("school_years")
          .select("id, year_label")
          .order("start_date", { ascending: false });
        if (!isSuperAdmin && organizationId) {
          schoolYearsQuery = schoolYearsQuery.eq("organization_id", organizationId);
        }
        const { data: years, error: yearsError } = await schoolYearsQuery;
        if (yearsError) {
          console.error("Error fetching school years:", yearsError);
        } else {
          setSchoolYears(years || []);
        }

        // Fetch programs
        let programsQuery = supabase
          .from("programs")
          .select("id, name")
          .order("name", { ascending: true });
        if (!isSuperAdmin && organizationId) {
          programsQuery = programsQuery.eq("organization_id", organizationId);
        }
        const { data: programsData, error: programsError } = await programsQuery;
        if (programsError) {
          console.error("Error fetching programs:", programsError);
        } else {
          setPrograms(programsData || []);
        }

        // Fetch sections
        let sectionsQuery = supabase
          .from("sections")
          .select("id, name")
          .order("name", { ascending: true });
        if (!isSuperAdmin && organizationId) {
          sectionsQuery = sectionsQuery.eq("organization_id", organizationId);
        }
        const { data: sectionsData, error: sectionsError } = await sectionsQuery;
        if (sectionsError) {
          console.error("Error fetching sections:", sectionsError);
        } else {
          setSections(sectionsData || []);
        }

        setError(null);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, role]);

  const estimateRecordCount = async () => {
    if (!schoolYearId || !termPeriod) {
      setEstimatedCount(null);
      return;
    }

    setEstimating(true);
    try {
      const orgId = isSuperAdmin ? null : organizationId || null;
      let query;

      if (exportType === "compliance_export") {
        query = supabase
          .from("transcript_records")
          .select("id", { count: "exact", head: true })
          .eq("transcript_status", "finalized")
          .eq("school_year_id", schoolYearId)
          .eq("term_period", termPeriod);
      } else {
        query = supabase
          .from("student_grades")
          .select("id", { count: "exact", head: true })
          .in("status", ["confirmed", "overridden"])
          .eq("school_year_id", schoolYearId)
          .eq("term_period", termPeriod);
      }

      if (orgId) {
        query = query.eq("organization_id", orgId);
      }

      if (programId && programId !== "__all__") {
        query = query.eq("program_id", programId);
      }

      if (sectionId && sectionId !== "__all__") {
        query = query.eq("section_id", sectionId);
      }

      const { count } = await query;
      setEstimatedCount(count || 0);
    } catch (err) {
      console.error("Error estimating count:", err);
      setEstimatedCount(null);
    } finally {
      setEstimating(false);
    }
  };

  useEffect(() => {
    estimateRecordCount();
  }, [schoolYearId, termPeriod, programId, sectionId, exportType, organizationId, isSuperAdmin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        throw new Error("No active session");
      }

      const orgId =
        isSuperAdmin && organizationId
          ? organizationId
          : (await supabase
              .from("profiles")
              .select("organization_id")
              .eq("id", session.user.id)
              .single()).data?.organization_id;

      if (!orgId) {
        throw new Error("Organization ID not found");
      }

      if (estimatedCount && estimatedCount > batchSize * 10) {
        if (
          !confirm(
            `This export will process approximately ${estimatedCount} records. This may take a while. Continue?`
          )
        ) {
          return;
        }
      }

      // Build export parameters
      const exportParams: ExportParameters = {
        school_year_id: schoolYearId,
        term_period: termPeriod,
        batch_size: batchSize,
      };

      if (programId && programId !== "__all__") exportParams.program_id = programId;
      if (sectionId && sectionId !== "__all__") exportParams.section_id = sectionId;
      if (exportType === "compliance_export") {
        exportParams.format = format;
      }

      // Create export job
      const job = await createExportJob({
        organization_id: orgId,
        requested_by: session.user.id,
        export_type: exportType,
        export_parameters: exportParams,
      });

      // Trigger processing
      await processExportJob(job.id);

      // Redirect to history
      router.push(`/sis/phase5/exports/history`);
    } catch (err: any) {
      console.error("Error creating batch export:", err);
      setError(err.message || "Failed to create batch export");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p>Loading...</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Batch Export</h1>
          <p className="text-muted-foreground mt-1">
            Generate exports for large datasets
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => router.push("/sis/phase5/exports/history")}
        >
          View History
        </Button>
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Estimated Count Warning */}
      {estimatedCount !== null && estimatedCount > 0 && (
        <Card className={estimatedCount > batchSize * 5 ? "border-yellow-500" : ""}>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-5 w-5 text-yellow-500 mt-0.5" />
              <div>
                <p className="font-medium">
                  Estimated Records: {estimatedCount.toLocaleString()}
                </p>
                <p className="text-sm text-muted-foreground mt-1">
                  {estimatedCount > batchSize * 5
                    ? "This is a large export. It may take several minutes to process."
                    : "This export should complete quickly."}
                </p>
                {estimatedCount > batchSize && (
                  <p className="text-sm text-muted-foreground mt-1">
                    The export will be processed in batches of {batchSize} records.
                  </p>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Batch Export Configuration</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Export Type */}
            <div className="space-y-2">
              <Label htmlFor="export-type">Export Type</Label>
              <Select
                value={exportType}
                onValueChange={(value: any) => setExportType(value)}
              >
                <SelectTrigger id="export-type">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="transcript">Transcript</SelectItem>
                  <SelectItem value="report_card">Report Card</SelectItem>
                  <SelectItem value="compliance_export">Compliance Export</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* School Year */}
            <div className="space-y-2">
              <Label htmlFor="school-year">School Year *</Label>
              <Select
                value={schoolYearId}
                onValueChange={setSchoolYearId}
                required
              >
                <SelectTrigger id="school-year">
                  <SelectValue placeholder="Select school year" />
                </SelectTrigger>
                <SelectContent>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Term Period */}
            <div className="space-y-2">
              <Label htmlFor="term-period">Term Period *</Label>
              <Select
                value={termPeriod}
                onValueChange={setTermPeriod}
                required
              >
                <SelectTrigger id="term-period">
                  <SelectValue placeholder="Select term period" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Q1">Q1</SelectItem>
                  <SelectItem value="Q2">Q2</SelectItem>
                  <SelectItem value="Q3">Q3</SelectItem>
                  <SelectItem value="Q4">Q4</SelectItem>
                  <SelectItem value="Semester 1">Semester 1</SelectItem>
                  <SelectItem value="Semester 2">Semester 2</SelectItem>
                  <SelectItem value="Full Year">Full Year</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Batch Size */}
            <div className="space-y-2">
              <Label htmlFor="batch-size">Batch Size</Label>
              <Select
                value={batchSize.toString()}
                onValueChange={(value) => setBatchSize(parseInt(value))}
              >
                <SelectTrigger id="batch-size">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="100">100 records per batch</SelectItem>
                  <SelectItem value="500">500 records per batch</SelectItem>
                  <SelectItem value="1000">1,000 records per batch</SelectItem>
                  <SelectItem value="2000">2,000 records per batch</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">
                Larger batch sizes process faster but use more memory
              </p>
            </div>

            {/* Format (for compliance export) */}
            {exportType === "compliance_export" && (
              <div className="space-y-2">
                <Label htmlFor="format">Format</Label>
                <Select value={format} onValueChange={(value: any) => setFormat(value)}>
                  <SelectTrigger id="format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Optional Filters */}
            <div className="space-y-4">
              <Label>Optional Filters</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="program">Program (Optional)</Label>
                  <Select value={programId || "__all__"} onValueChange={(val) => setProgramId(val === "__all__" ? "" : val)}>
                    <SelectTrigger id="program">
                      <SelectValue placeholder="All programs" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All programs</SelectItem>
                      {programs.map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="section">Section (Optional)</Label>
                  <Select value={sectionId || "__all__"} onValueChange={(val) => setSectionId(val === "__all__" ? "" : val)}>
                    <SelectTrigger id="section">
                      <SelectValue placeholder="All sections" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__all__">All sections</SelectItem>
                      {sections.map((section) => (
                        <SelectItem key={section.id} value={section.id}>
                          {section.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting || estimating}>
                {isSubmitting ? "Generating..." : "Generate Batch Export"}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => router.back()}
              >
                Cancel
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
