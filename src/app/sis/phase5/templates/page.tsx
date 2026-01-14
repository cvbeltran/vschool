"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
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
  listExportTemplates,
  createExportTemplate,
  updateExportTemplate,
  archiveExportTemplate,
  type ExportTemplate,
} from "@/lib/phase5/templates";
import { Plus, Edit2, Archive, FileText } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";

export default function TemplatesPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [templates, setTemplates] = useState<ExportTemplate[]>([]);
  const [isFormOpen, setIsFormOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<ExportTemplate | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [archivingId, setArchivingId] = useState<string | null>(null);

  // Form state
  const [templateName, setTemplateName] = useState("");
  const [templateType, setTemplateType] = useState<
    "transcript" | "report_card" | "compliance_export"
  >("transcript");
  const [exportFormat, setExportFormat] = useState<"pdf" | "csv" | "excel">("pdf");
  const [templateConfig, setTemplateConfig] = useState("{}");
  const [isActive, setIsActive] = useState(true);

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

      const canManage = role === "principal" || role === "admin";
      if (!canManage) {
        setError("You do not have permission to manage templates");
        setLoading(false);
        return;
      }

      try {
        const orgId = isSuperAdmin ? null : organizationId || null;
        const data = await listExportTemplates(orgId);
        setTemplates(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching templates:", err);
        setError(err.message || "Failed to load templates");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading, role]);

  const canManage = role === "principal" || role === "admin";

  const handleCreate = () => {
    setEditingTemplate(null);
    setTemplateName("");
    setTemplateType("transcript");
    setExportFormat("pdf");
    setTemplateConfig("{}");
    setIsActive(true);
    setIsFormOpen(true);
  };

  const handleEdit = (template: ExportTemplate) => {
    setEditingTemplate(template);
    setTemplateName(template.template_name);
    setTemplateType(template.template_type);
    setExportFormat(template.export_format);
    setTemplateConfig(JSON.stringify(template.template_config, null, 2));
    setIsActive(template.is_active);
    setIsFormOpen(true);
  };

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

      // Validate JSON
      let configObj: Record<string, any>;
      try {
        configObj = JSON.parse(templateConfig);
      } catch (err) {
        throw new Error("Invalid JSON in template configuration");
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

      if (editingTemplate) {
        await updateExportTemplate(editingTemplate.id, {
          template_name: templateName,
          template_config: configObj,
          export_format: exportFormat,
          is_active: isActive,
          updated_by: session.user.id,
        });
      } else {
        await createExportTemplate({
          organization_id: orgId,
          template_name: templateName,
          template_type: templateType,
          template_config: configObj,
          export_format: exportFormat,
          is_active: isActive,
          created_by: session.user.id,
        });
      }

      setIsFormOpen(false);
      setEditingTemplate(null);

      // Refresh list
      const orgIdForRefresh = isSuperAdmin ? null : organizationId || null;
      const updated = await listExportTemplates(orgIdForRefresh);
      setTemplates(updated);
    } catch (err: any) {
      console.error("Error saving template:", err);
      setError(err.message || "Failed to save template");
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleArchive = async (id: string) => {
    if (!confirm("Are you sure you want to archive this template?")) {
      return;
    }

    setArchivingId(id);
    try {
      await archiveExportTemplate(id);
      const orgId = isSuperAdmin ? null : organizationId || null;
      const updated = await listExportTemplates(orgId);
      setTemplates(updated);
    } catch (err: any) {
      console.error("Error archiving template:", err);
      alert(err.message || "Failed to archive template");
    } finally {
      setArchivingId(null);
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

  if (error && !canManage) {
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
          <h1 className="text-3xl font-bold">Export Templates</h1>
          <p className="text-muted-foreground mt-1">
            Manage export format templates
          </p>
        </div>
        {canManage && (
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" />
            Create Template
          </Button>
        )}
      </div>

      {error && (
        <Card className="border-destructive">
          <CardContent className="p-4">
            <p className="text-destructive">{error}</p>
          </CardContent>
        </Card>
      )}

      {/* Form Modal */}
      {isFormOpen && (
        <Card>
          <CardHeader>
            <CardTitle>
              {editingTemplate ? "Edit Template" : "Create Template"}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="template-name">Template Name *</Label>
                <Input
                  id="template-name"
                  value={templateName}
                  onChange={(e) => setTemplateName(e.target.value)}
                  required
                />
              </div>

              {!editingTemplate && (
                <div className="space-y-2">
                  <Label htmlFor="template-type">Template Type *</Label>
                  <Select
                    value={templateType}
                    onValueChange={(value: any) => setTemplateType(value)}
                  >
                    <SelectTrigger id="template-type">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="transcript">Transcript</SelectItem>
                      <SelectItem value="report_card">Report Card</SelectItem>
                      <SelectItem value="compliance_export">Compliance Export</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="export-format">Export Format *</Label>
                <Select
                  value={exportFormat}
                  onValueChange={(value: any) => setExportFormat(value)}
                >
                  <SelectTrigger id="export-format">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="pdf">PDF</SelectItem>
                    <SelectItem value="csv">CSV</SelectItem>
                    <SelectItem value="excel">Excel</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="template-config">Template Configuration (JSON) *</Label>
                <Textarea
                  id="template-config"
                  value={templateConfig}
                  onChange={(e) => setTemplateConfig(e.target.value)}
                  rows={10}
                  className="font-mono text-sm"
                  required
                />
                <p className="text-xs text-muted-foreground">
                  Enter valid JSON configuration for the template
                </p>
              </div>

              <div className="flex items-center gap-2">
                <Switch
                  id="is-active"
                  checked={isActive}
                  onCheckedChange={setIsActive}
                />
                <Label htmlFor="is-active">Active</Label>
              </div>

              <div className="flex gap-4">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? "Saving..." : "Save Template"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setIsFormOpen(false);
                    setEditingTemplate(null);
                  }}
                >
                  Cancel
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      )}

      {/* Templates List */}
      <Card>
        <CardHeader>
          <CardTitle>Templates</CardTitle>
        </CardHeader>
        <CardContent>
          {templates.length === 0 ? (
            <div className="text-center py-12">
              <FileText className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
              <p className="text-muted-foreground mb-2">No templates found</p>
              <p className="text-sm text-muted-foreground">
                Create your first template to get started
              </p>
              {canManage && (
                <Button className="mt-4" onClick={handleCreate}>
                  Create Template
                </Button>
              )}
            </div>
          ) : (
            <div className="space-y-4">
              {templates.map((template) => (
                <Card key={template.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <h3 className="font-semibold">{template.template_name}</h3>
                          {template.is_active && (
                            <Badge variant="default">Active</Badge>
                          )}
                          <Badge variant="outline">{template.template_type}</Badge>
                          <Badge variant="outline">{template.export_format.toUpperCase()}</Badge>
                          <Badge variant="secondary">v{template.version}</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground">
                          Updated {new Date(template.updated_at).toLocaleDateString()}
                        </p>
                      </div>
                      {canManage && (
                        <div className="flex gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEdit(template)}
                          >
                            <Edit2 className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleArchive(template.id)}
                            disabled={archivingId === template.id}
                          >
                            <Archive className="h-4 w-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
