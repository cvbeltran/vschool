"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Plus, Edit2, Archive, Eye } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";
import {
  listSyllabi,
  archiveSyllabus,
  type Syllabus,
} from "@/lib/phase6/syllabus";

export default function SyllabusPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } =
    useOrganization();
  const [syllabi, setSyllabi] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">(
    "principal"
  );
  const [archivingId, setArchivingId] = useState<string | null>(null);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [archiveTargetId, setArchiveTargetId] = useState<string | null>(null);

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

      // Fetch syllabi
      try {
        const data = await listSyllabi({
          school_id: isSuperAdmin ? undefined : undefined,
        });
        setSyllabi(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching syllabi:", err);
        setError(err.message || "Failed to load syllabi");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

  const canCreate = role === "principal" || role === "admin" || role === "teacher";
  const canEditAll = role === "principal" || role === "admin";

  const handleArchiveClick = (id: string) => {
    setArchiveTargetId(id);
    setShowArchiveDialog(true);
  };

  const handleArchive = async () => {
    if (!archiveTargetId) return;

    setArchivingId(archiveTargetId);
    try {
      await archiveSyllabus(archiveTargetId);
      setSyllabi(syllabi.filter((s) => s.id !== archiveTargetId));
      setShowArchiveDialog(false);
      setArchiveTargetId(null);
    } catch (err: any) {
      console.error("Error archiving syllabus:", err);
      alert(err.message || "Failed to archive syllabus");
    } finally {
      setArchivingId(null);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Syllabus</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Syllabus</h1>
        {canCreate && (
          <Button onClick={() => router.push("/sis/phase6/syllabus/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Syllabus
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {syllabi.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              No syllabi found. {canCreate && "Create your first syllabus to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {syllabi.map((syllabus) => (
            <Card key={syllabus.id}>
              <CardHeader>
                <div className="flex items-start justify-between">
                  <CardTitle className="text-lg">{syllabus.name}</CardTitle>
                  <Badge variant={syllabus.status === "published" ? "default" : "secondary"}>
                    {syllabus.status}
                  </Badge>
                </div>
              </CardHeader>
              <CardContent>
                {syllabus.description && (
                  <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                    {syllabus.description}
                  </p>
                )}
                {syllabus.program && (
                  <p className="text-xs text-muted-foreground mb-2">
                    Program: {syllabus.program.name}
                  </p>
                )}
                {syllabus.subject && (
                  <p className="text-xs text-muted-foreground mb-4">
                    Subject: {syllabus.subject}
                  </p>
                )}
                <div className="flex items-center gap-2 mt-4">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => router.push(`/sis/phase6/syllabus/${syllabus.id}`)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    View
                  </Button>
                  {canEditAll && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => router.push(`/sis/phase6/syllabus/${syllabus.id}/edit`)}
                    >
                      <Edit2 className="mr-2 h-4 w-4" />
                      Edit
                    </Button>
                  )}
                  {canEditAll && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleArchiveClick(syllabus.id)}
                      disabled={archivingId === syllabus.id}
                    >
                      <Archive className="mr-2 h-4 w-4" />
                      Archive
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Archive Confirmation Dialog */}
      <Dialog open={showArchiveDialog} onOpenChange={setShowArchiveDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Archive Syllabus</DialogTitle>
            <DialogDescription>
              Are you sure you want to archive this syllabus? Archived syllabi are soft-deleted and can be restored if needed.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowArchiveDialog(false);
                setArchiveTargetId(null);
              }}
              disabled={archivingId !== null}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={archivingId !== null}
            >
              {archivingId ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
