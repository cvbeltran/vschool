"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  getExportJob,
  regenerateExport,
  getExportFileUrl,
  type ExportJob,
} from "@/lib/phase5/exports";
import { Download, RefreshCw, ArrowLeft, Clock, CheckCircle, XCircle, AlertCircle } from "lucide-react";

export default function ExportDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const exportJobId = params.id as string;
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [job, setJob] = useState<ExportJob | null>(null);
  const [regenerating, setRegenerating] = useState(false);

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
        const jobData = await getExportJob(exportJobId);
        if (!jobData) {
          setError("Export job not found");
          return;
        }
        setJob(jobData);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching export job:", err);
        setError(err.message || "Failed to load export job");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [exportJobId, organizationId, isSuperAdmin, orgLoading]);

  const canRegenerate = role === "principal" || role === "admin";

  const handleRegenerate = async () => {
    if (!confirm("Create a new export with the same parameters?")) {
      return;
    }

    setRegenerating(true);
    try {
      const newJob = await regenerateExport(exportJobId);
      router.push(`/sis/phase5/exports/${newJob.id}`);
    } catch (err: any) {
      console.error("Error regenerating export:", err);
      alert(err.message || "Failed to regenerate export");
    } finally {
      setRegenerating(false);
    }
  };

  const handleDownload = async () => {
    if (!job?.file_path) {
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
    const icons: Record<string, any> = {
      pending: Clock,
      processing: Clock,
      completed: CheckCircle,
      failed: XCircle,
    };
    const Icon = icons[status] || AlertCircle;
    return (
      <Badge variant={variants[status] || "outline"} className="flex items-center gap-1">
        <Icon className="h-3 w-3" />
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    );
  };

  const formatDate = (dateString: string | null) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleString();
  };

  const formatFileSize = (bytes: number | null) => {
    if (!bytes) return "—";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
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

  if (error || !job) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="p-6">
            <p className="text-destructive">{error || "Export job not found"}</p>
            <Button className="mt-4" onClick={() => router.back()}>
              Go Back
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Export Details</h1>
            <p className="text-muted-foreground mt-1">
              {getExportTypeLabel(job.export_type)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          {job.status === "completed" && job.file_path && (
            <Button onClick={handleDownload}>
              <Download className="h-4 w-4 mr-2" />
              Download
            </Button>
          )}
          {canRegenerate && (
            <Button
              variant="outline"
              onClick={handleRegenerate}
              disabled={regenerating}
            >
              <RefreshCw className={`h-4 w-4 mr-2 ${regenerating ? "animate-spin" : ""}`} />
              Regenerate
            </Button>
          )}
        </div>
      </div>

      {/* Status Card */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            Status: {getStatusBadge(job.status)}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Requested By</p>
              <p className="font-medium">
                {job.requested_by_profile
                  ? `${job.requested_by_profile.first_name || ""} ${job.requested_by_profile.last_name || ""}`.trim() || job.requested_by_profile.email
                  : "—"}
              </p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Created At</p>
              <p className="font-medium">{formatDate(job.created_at)}</p>
            </div>
            {job.started_at && (
              <div>
                <p className="text-sm text-muted-foreground">Started At</p>
                <p className="font-medium">{formatDate(job.started_at)}</p>
              </div>
            )}
            {job.completed_at && (
              <div>
                <p className="text-sm text-muted-foreground">Completed At</p>
                <p className="font-medium">{formatDate(job.completed_at)}</p>
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File Information */}
      {job.status === "completed" && job.file_path && (
        <Card>
          <CardHeader>
            <CardTitle>File Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div>
              <p className="text-sm text-muted-foreground">File Path</p>
              <p className="font-mono text-sm">{job.file_path}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">File Size</p>
              <p className="font-medium">{formatFileSize(job.file_size_bytes)}</p>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Error Message */}
      {job.status === "failed" && job.error_message && (
        <Card className="border-destructive">
          <CardHeader>
            <CardTitle className="text-destructive">Error</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-destructive">{job.error_message}</p>
          </CardContent>
        </Card>
      )}

      {/* Export Parameters */}
      <Card>
        <CardHeader>
          <CardTitle>Export Parameters</CardTitle>
        </CardHeader>
        <CardContent>
          <pre className="bg-muted p-4 rounded-md overflow-auto text-sm">
            {JSON.stringify(job.export_parameters, null, 2)}
          </pre>
        </CardContent>
      </Card>
    </div>
  );
}
