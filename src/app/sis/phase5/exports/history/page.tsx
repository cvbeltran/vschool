"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listExportJobs,
  regenerateExport,
  getExportFileUrl,
  type ExportJob,
} from "@/lib/phase5/exports";
import { useRouter } from "next/navigation";
import { Eye, Download, RefreshCw, FileText } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";

export default function ExportHistoryPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [exportTypeFilter, setExportTypeFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Data
  const [jobs, setJobs] = useState<ExportJob[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // Regenerating
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);

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
          setRole(normalizeRole(profile.role));
        }
      }

      // Permissions checked via role state

      try {
        const orgId = isSuperAdmin ? null : organizationId || null;
        const filters: any = {};
        if (exportTypeFilter !== "all") filters.export_type = exportTypeFilter;
        if (statusFilter !== "all") filters.status = statusFilter;

        const result = await listExportJobs(orgId, filters, {
          page,
          pageSize,
        });
        setJobs(result.data);
        setTotalCount(result.count);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching export jobs:", err);
        setError(err.message || "Failed to load export history");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, exportTypeFilter, statusFilter, page]);

  const canRegenerate = role === "principal" || role === "admin";
  const canViewHistory = role === "principal" || role === "admin"; // registrar can view but normalized to admin

  const handleRegenerate = async (jobId: string) => {
    if (!confirm("Create a new export with the same parameters?")) {
      return;
    }

    setRegeneratingId(jobId);
    try {
      const newJob = await regenerateExport(jobId);
      router.push(`/sis/phase5/exports/${newJob.id}`);
    } catch (err: any) {
      console.error("Error regenerating export:", err);
      alert(err.message || "Failed to regenerate export");
    } finally {
      setRegeneratingId(null);
    }
  };

  const handleDownload = async (job: ExportJob) => {
    if (!job.file_path) {
      alert("Export file not available");
      return;
    }

    try {
      const url = await getExportFileUrl(job.file_path);
      window.open(url, "_blank");
    } catch (err: any) {
      console.error("Error downloading export:", err);
      alert(err.message || "Failed to download export");
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
      pending: "secondary",
      processing: "default",
      completed: "default",
      failed: "destructive",
    };
    return (
      <Badge variant={variants[status] || "outline"}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  };

  const getExportTypeLabel = (type: string) => {
    const labels: Record<string, string> = {
      transcript: "Transcript",
      report_card: "Report Card",
      compliance_export: "Compliance Export",
    };
    return labels[type] || type;
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

  if (error && !canRegenerate) {
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
          <h1 className="text-3xl font-bold">Export History</h1>
          <p className="text-muted-foreground mt-1">
            View and manage export jobs
          </p>
        </div>
        <Button onClick={() => router.push("/sis/phase5/exports")}>
          Generate New Export
        </Button>
      </div>

      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex gap-4">
            <div className="space-y-2 flex-1">
              <Label>Export Type</Label>
              <Select value={exportTypeFilter} onValueChange={setExportTypeFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Types</SelectItem>
                  <SelectItem value="transcript">Transcript</SelectItem>
                  <SelectItem value="report_card">Report Card</SelectItem>
                  <SelectItem value="compliance_export">Compliance Export</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2 flex-1">
              <Label>Status</Label>
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="processing">Processing</SelectItem>
                  <SelectItem value="completed">Completed</SelectItem>
                  <SelectItem value="failed">Failed</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Export Jobs Table */}
      <Card>
        <CardHeader>
          <CardTitle>Export Jobs</CardTitle>
        </CardHeader>
        <CardContent>
          {jobs.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No export jobs found</p>
              <p className="text-sm text-muted-foreground">
                Generate your first export to see it here
              </p>
              <Button
                className="mt-4"
                onClick={() => router.push("/sis/phase5/exports")}
              >
                Generate Export
              </Button>
            </div>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b">
                      <th className="text-left p-2">Type</th>
                      <th className="text-left p-2">Status</th>
                      <th className="text-left p-2">Requested By</th>
                      <th className="text-left p-2">Created</th>
                      <th className="text-left p-2">Completed</th>
                      <th className="text-left p-2">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {jobs.map((job) => (
                      <tr key={job.id} className="border-b hover:bg-muted/50">
                        <td className="p-2">{getExportTypeLabel(job.export_type)}</td>
                        <td className="p-2">{getStatusBadge(job.status)}</td>
                        <td className="p-2">
                          {job.requested_by_profile
                            ? `${job.requested_by_profile.first_name || ""} ${job.requested_by_profile.last_name || ""}`.trim() || job.requested_by_profile.email
                            : "—"}
                        </td>
                        <td className="p-2">{formatDate(job.created_at)}</td>
                        <td className="p-2">{formatDate(job.completed_at)}</td>
                        <td className="p-2">
                          <div className="flex gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => router.push(`/sis/phase5/exports/${job.id}`)}
                            >
                              <Eye className="h-4 w-4" />
                            </Button>
                            {job.status === "completed" && job.file_path && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleDownload(job)}
                              >
                                <Download className="h-4 w-4" />
                              </Button>
                            )}
                            {canRegenerate && (
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => handleRegenerate(job.id)}
                                disabled={regeneratingId === job.id}
                              >
                                <RefreshCw className={`h-4 w-4 ${regeneratingId === job.id ? "animate-spin" : ""}`} />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Pagination */}
              {totalCount > pageSize && (
                <div className="flex items-center justify-between mt-4">
                  <p className="text-sm text-muted-foreground">
                    Showing {(page - 1) * pageSize + 1} to {Math.min(page * pageSize, totalCount)} of {totalCount}
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => Math.max(1, p - 1))}
                      disabled={page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setPage((p) => p + 1)}
                      disabled={page * pageSize >= totalCount}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
