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
import { listExportTemplates } from "@/lib/phase5/templates";
import { useRouter } from "next/navigation";
import { FileText, Download } from "lucide-react";

export default function ExportsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Form state
  const [exportType, setExportType] = useState<
    "transcript" | "report_card" | "compliance_export"
  >("transcript");
  const [schoolYearId, setSchoolYearId] = useState<string>("");
  const [termPeriod, setTermPeriod] = useState<string>("");
  const [selectedStudentIds, setSelectedStudentIds] = useState<string[]>([]);
  const [programId, setProgramId] = useState<string>("");
  const [sectionId, setSectionId] = useState<string>("");
  const [templateId, setTemplateId] = useState<string>("");
  const [includeExternalIds, setIncludeExternalIds] = useState(false);
  const [includeGradeEntries, setIncludeGradeEntries] = useState(false);
  const [format, setFormat] = useState<"pdf" | "csv" | "excel">("pdf");

  // Data
  const [schoolYears, setSchoolYears] = useState<
    Array<{ id: string; year_label: string }>
  >([]);
  const [students, setStudents] = useState<
    Array<{
      id: string;
      first_name: string | null;
      last_name: string | null;
      student_number: string | null;
    }>
  >([]);
  const [programs, setPrograms] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [sections, setSections] = useState<
    Array<{ id: string; name: string }>
  >([]);
  const [templates, setTemplates] = useState<
    Array<{ id: string; template_name: string }>
  >([]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return;

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
          setOriginalRole(profile.role);
          setRole(normalizeRole(profile.role));
        }
      }

      // Permissions checked via role state

      // Fetch data
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
          console.error("Error fetching school years:", {
            message: yearsError.message,
            code: yearsError.code,
            details: yearsError.details,
            hint: yearsError.hint,
            error: yearsError,
          });
        } else {
          setSchoolYears(years || []);
        }

        // Fetch students
        let studentsQuery = supabase
          .from("students")
          .select("id, first_name, last_name, student_number")
          .order("last_name", { ascending: true });
        if (!isSuperAdmin && organizationId) {
          studentsQuery = studentsQuery.eq("organization_id", organizationId);
        }
        const { data: studentsData, error: studentsError } = await studentsQuery;
        if (studentsError) {
          console.error("Error fetching students:", {
            message: studentsError.message,
            code: studentsError.code,
            details: studentsError.details,
            hint: studentsError.hint,
            error: studentsError,
          });
        } else {
          setStudents(studentsData || []);
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
          console.error("Error fetching programs:", {
            message: programsError.message,
            code: programsError.code,
            details: programsError.details,
            hint: programsError.hint,
            error: programsError,
          });
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
          console.error("Error fetching sections:", {
            message: sectionsError.message,
            code: sectionsError.code,
            details: sectionsError.details,
            hint: sectionsError.hint,
            error: sectionsError,
          });
        } else {
          setSections(sectionsData || []);
        }

        // Fetch templates
        const templatesData = await listExportTemplates(orgId, {
          template_type: exportType,
          is_active: true,
        });
        setTemplates(templatesData);

        setError(null);
      } catch (err: any) {
        console.error("Error fetching data:", err);
        setError(err.message || "Failed to load data");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, exportType]);

  // Check original role to differentiate registrar from admin
  const isRegistrar = originalRole === "registrar";
  const canGenerateTranscript = role === "principal" || (role === "admin" && !isRegistrar);
  const canGenerateCompliance = role === "principal" || role === "admin"; // registrar can generate compliance exports

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

      // Validate permissions
      if (exportType === "transcript" || exportType === "report_card") {
        if (!canGenerateTranscript) {
          throw new Error("You do not have permission to generate this export type");
        }
      } else if (exportType === "compliance_export") {
        if (!canGenerateCompliance) {
          throw new Error("You do not have permission to generate compliance exports");
        }
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

      // Build export parameters
      const exportParams: ExportParameters = {
        school_year_id: schoolYearId || undefined,
        term_period: termPeriod || undefined,
      };

      if (exportType === "transcript" || exportType === "report_card") {
        if (selectedStudentIds.length === 0) {
          throw new Error("Please select at least one student");
        }
        exportParams.student_ids = selectedStudentIds;
      }

      if (programId && programId !== "__all__") exportParams.program_id = programId;
      if (sectionId && sectionId !== "__all__") exportParams.section_id = sectionId;
      if (templateId && templateId !== "__none__") exportParams.template_id = templateId;
      exportParams.include_external_ids = includeExternalIds;
      exportParams.include_grade_entries = includeGradeEntries;
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

      // Trigger processing (non-blocking - job will remain pending if Edge Function fails)
      try {
        await processExportJob(job.id);
      } catch (err: any) {
        // Log but don't fail - export job is created successfully
        console.warn("Export job created but processing trigger failed:", err);
        // Show a warning message to user
        setError(
          "Export job created successfully, but automatic processing failed. " +
          "The job is in 'pending' status. Please check the export history to process it manually."
        );
        // Still redirect to history so user can see the job
        setTimeout(() => {
          router.push(`/sis/phase5/exports/history`);
        }, 2000);
        return;
      }

      // Redirect to history
      router.push(`/sis/phase5/exports/history`);
    } catch (err: any) {
      console.error("Error creating export:", err);
      setError(err.message || "Failed to create export");
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

  if (error && !canGenerateTranscript && !canGenerateCompliance) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Generate Export</h1>
          <p className="text-muted-foreground mt-1">
            Create transcripts, report cards, or compliance exports
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

      <Card>
        <CardHeader>
          <CardTitle>Export Configuration</CardTitle>
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
                  <SelectItem value="transcript" disabled={!canGenerateTranscript}>
                    Transcript {!canGenerateTranscript && isRegistrar && "(Admin/Principal only)"}
                  </SelectItem>
                  <SelectItem value="report_card" disabled={!canGenerateTranscript}>
                    Report Card {!canGenerateTranscript && isRegistrar && "(Admin/Principal only)"}
                  </SelectItem>
                  <SelectItem value="compliance_export" disabled={!canGenerateCompliance}>
                    Compliance Export
                  </SelectItem>
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

            {/* Students (for transcript/report card) */}
            {(exportType === "transcript" || exportType === "report_card") && (
              <div className="space-y-2">
                <Label htmlFor="students">Students *</Label>
                <Select
                  value=""
                  onValueChange={(value) => {
                    if (value && !selectedStudentIds.includes(value)) {
                      setSelectedStudentIds([...selectedStudentIds, value]);
                    }
                  }}
                >
                  <SelectTrigger id="students">
                    <SelectValue placeholder="Select students" />
                  </SelectTrigger>
                  <SelectContent>
                    {students
                      .filter((s) => !selectedStudentIds.includes(s.id))
                      .map((student) => (
                        <SelectItem key={student.id} value={student.id}>
                          {student.first_name} {student.last_name}
                          {student.student_number && ` (${student.student_number})`}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
                {selectedStudentIds.length > 0 && (
                  <div className="flex flex-wrap gap-2 mt-2">
                    {selectedStudentIds.map((id) => {
                      const student = students.find((s) => s.id === id);
                      return (
                        <div
                          key={id}
                          className="flex items-center gap-2 bg-secondary px-3 py-1 rounded-md"
                        >
                          <span>
                            {student?.first_name} {student?.last_name}
                          </span>
                          <button
                            type="button"
                            onClick={() =>
                              setSelectedStudentIds(
                                selectedStudentIds.filter((sid) => sid !== id)
                              )
                            }
                            className="text-destructive hover:underline"
                          >
                            ×
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

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

            {/* Template */}
            {templates.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="template">Template (Optional)</Label>
                <Select value={templateId || "__none__"} onValueChange={(val) => setTemplateId(val === "__none__" ? "" : val)}>
                  <SelectTrigger id="template">
                    <SelectValue placeholder="Use default template" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">Use default template</SelectItem>
                      {templates.map((template) => (
                        <SelectItem key={template.id} value={template.id}>
                          {template.template_name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                </Select>
              </div>
            )}

            {/* Options */}
            <div className="space-y-4">
              <Label>Export Options</Label>
              <div className="space-y-2">
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={includeExternalIds}
                    onChange={(e) => setIncludeExternalIds(e.target.checked)}
                  />
                  <span>Include external IDs instead of internal UUIDs</span>
                </label>
                {(exportType === "transcript" || exportType === "report_card") && (
                  <label className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={includeGradeEntries}
                      onChange={(e) => setIncludeGradeEntries(e.target.checked)}
                    />
                    <span>Include grade entries and justifications</span>
                  </label>
                )}
              </div>
            </div>

            <div className="flex gap-4">
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? "Generating..." : "Generate Export"}
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
