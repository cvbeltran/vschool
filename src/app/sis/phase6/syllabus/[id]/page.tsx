"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
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
import { ArrowLeft, Edit2, Archive, CheckCircle, Copy, History } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import {
  getSyllabus,
  listSyllabusContributors,
  listSyllabusWeeks,
  publishSyllabus,
  archiveSyllabus,
  createSyllabusRevision,
  listSyllabusRevisions,
  type Syllabus,
  type SyllabusContributor,
  type SyllabusWeek,
} from "@/lib/phase6/syllabus";

export default function SyllabusDetailPage() {
  const params = useParams();
  const router = useRouter();
  const id = params.id as string;
  const [syllabus, setSyllabus] = useState<Syllabus | null>(null);
  const [contributors, setContributors] = useState<SyllabusContributor[]>([]);
  const [weeks, setWeeks] = useState<SyllabusWeek[]>([]);
  const [revisions, setRevisions] = useState<Syllabus[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showRevisionDialog, setShowRevisionDialog] = useState(false);
  const [showPublishDialog, setShowPublishDialog] = useState(false);
  const [showArchiveDialog, setShowArchiveDialog] = useState(false);
  const [isCreatingRevision, setIsCreatingRevision] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [isArchiving, setIsArchiving] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const data = await getSyllabus(id);
        if (!data) {
          setError("Syllabus not found");
        } else {
          setSyllabus(data);

          // Fetch related data
          const [contributorsData, weeksData, revisionsData] = await Promise.all([
            listSyllabusContributors(id),
            listSyllabusWeeks(id),
            listSyllabusRevisions(id),
          ]);

          setContributors(contributorsData);
          setWeeks(weeksData);
          setRevisions(revisionsData);
        }
      } catch (err: any) {
        console.error("Error fetching syllabus:", err);
        setError(err.message || "Failed to load syllabus");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  const handleCreateRevision = async () => {
    setIsCreatingRevision(true);
    try {
      const revision = await createSyllabusRevision(id);
      router.push(`/sis/phase6/syllabus/${revision.id}/edit`);
    } catch (err: any) {
      console.error("Error creating revision:", err);
      alert(err.message || "Failed to create revision");
    } finally {
      setIsCreatingRevision(false);
      setShowRevisionDialog(false);
    }
  };

  const handlePublish = async () => {
    setIsPublishing(true);
    try {
      await publishSyllabus(id);
      // Reload syllabus
      const updated = await getSyllabus(id);
      if (updated) {
        setSyllabus(updated);
      }
      setShowPublishDialog(false);
    } catch (err: any) {
      console.error("Error publishing syllabus:", err);
      alert(err.message || "Failed to publish syllabus");
    } finally {
      setIsPublishing(false);
    }
  };

  const handleArchive = async () => {
    setIsArchiving(true);
    try {
      await archiveSyllabus(id);
      setShowArchiveDialog(false);
      router.push("/sis/phase6/syllabus");
    } catch (err: any) {
      console.error("Error archiving syllabus:", err);
      alert(err.message || "Failed to archive syllabus");
    } finally {
      setIsArchiving(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Syllabus Details</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !syllabus) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Syllabus Details</h1>
        </div>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-destructive">{error || "Syllabus not found"}</p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const isDraft = syllabus.status === "draft";
  const isPublished = syllabus.status === "published";
  const isArchived = syllabus.status === "archived";

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4 flex-wrap">
        <Button variant="ghost" size="sm" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">{syllabus.name}</h1>
        <Badge
          variant={
            isPublished
              ? "default"
              : isArchived
              ? "secondary"
              : "outline"
          }
        >
          {syllabus.status}
        </Badge>
        {syllabus.version_number > 1 && (
          <Badge variant="outline">Version {syllabus.version_number}</Badge>
        )}
        {syllabus.parent_syllabus_id && (
          <Badge variant="outline">Revision</Badge>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 flex-wrap">
        {isDraft && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => router.push(`/sis/phase6/syllabus/${id}/edit`)}
          >
            <Edit2 className="mr-2 h-4 w-4" />
            Edit
          </Button>
        )}
        {isPublished && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowRevisionDialog(true)}
          >
            <Copy className="mr-2 h-4 w-4" />
            Create Revision
          </Button>
        )}
        {isDraft && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowPublishDialog(true)}
            disabled={isPublishing}
          >
            <CheckCircle className="mr-2 h-4 w-4" />
            Publish
          </Button>
        )}
        {!isArchived && (
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowArchiveDialog(true)}
            disabled={isArchiving}
          >
            <Archive className="mr-2 h-4 w-4" />
            Archive
          </Button>
        )}
      </div>

      {/* Details */}
      <Card>
        <CardHeader>
          <CardTitle>Details</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {syllabus.description && (
            <div>
              <p className="text-sm font-medium mb-1">Description</p>
              <p className="text-sm text-muted-foreground">{syllabus.description}</p>
            </div>
          )}
          {syllabus.program && (
            <div>
              <p className="text-sm font-medium mb-1">Program</p>
              <p className="text-sm text-muted-foreground">{syllabus.program.name}</p>
            </div>
          )}
          {syllabus.subject && (
            <div>
              <p className="text-sm font-medium mb-1">Subject</p>
              <p className="text-sm text-muted-foreground">{syllabus.subject}</p>
            </div>
          )}
          {syllabus.published_at && (
            <div>
              <p className="text-sm font-medium mb-1">Published</p>
              <p className="text-sm text-muted-foreground">
                {new Date(syllabus.published_at).toLocaleDateString()}
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Contributors */}
      <Card>
        <CardHeader>
          <CardTitle>Contributors</CardTitle>
        </CardHeader>
        <CardContent>
          {contributors.length === 0 ? (
            <p className="text-sm text-muted-foreground">No contributors added yet.</p>
          ) : (
            <div className="space-y-2">
              {contributors.map((contributor) => (
                <div key={contributor.id} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium">
                      {contributor.teacher?.first_name} {contributor.teacher?.last_name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {contributor.role} • {contributor.permissions}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Weekly Plans */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Plans</CardTitle>
        </CardHeader>
        <CardContent>
          {weeks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No weekly plans added yet.</p>
          ) : (
            <div className="space-y-4">
              {weeks.map((week) => (
                <div key={week.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <h4 className="font-medium">Week {week.week_number}</h4>
                    {week.week_start_date && week.week_end_date && (
                      <p className="text-xs text-muted-foreground">
                        {new Date(week.week_start_date).toLocaleDateString()} -{" "}
                        {new Date(week.week_end_date).toLocaleDateString()}
                      </p>
                    )}
                  </div>
                  {week.objectives.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium mb-1">Objectives:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {week.objectives.map((obj, idx) => (
                          <li key={idx}>{obj}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {week.activities.length > 0 && (
                    <div className="mb-2">
                      <p className="text-xs font-medium mb-1">Activities:</p>
                      <ul className="text-sm text-muted-foreground list-disc list-inside">
                        {week.activities.map((act, idx) => (
                          <li key={idx}>{act}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {week.verification_method && (
                    <div>
                      <p className="text-xs font-medium mb-1">Verification:</p>
                      <p className="text-sm text-muted-foreground">
                        {week.verification_method}
                      </p>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Version History */}
      {revisions.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <History className="h-4 w-4" />
              Version History
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {revisions
                .sort((a, b) => b.version_number - a.version_number)
                .map((rev) => (
                  <div
                    key={rev.id}
                    className={`flex items-center justify-between p-2 rounded ${
                      rev.id === id ? "bg-muted" : ""
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium">
                        Version {rev.version_number} - {rev.status}
                        {rev.id === id && " (Current)"}
                      </p>
                      {rev.published_at && (
                        <p className="text-xs text-muted-foreground">
                          Published {new Date(rev.published_at).toLocaleDateString()}
                        </p>
                      )}
                    </div>
                    {rev.id !== id && (
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => router.push(`/sis/phase6/syllabus/${rev.id}`)}
                      >
                        View
                      </Button>
                    )}
                  </div>
                ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Revision Dialog */}
      <Dialog open={showRevisionDialog} onOpenChange={setShowRevisionDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create Revision</DialogTitle>
            <DialogDescription>
              This syllabus is published and cannot be edited directly. Creating a revision
              will copy this syllabus into a new draft version that you can edit.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowRevisionDialog(false)}
              disabled={isCreatingRevision}
            >
              Cancel
            </Button>
            <Button onClick={handleCreateRevision} disabled={isCreatingRevision}>
              {isCreatingRevision ? "Creating..." : "Create Revision"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Publish Confirmation Dialog */}
      <Dialog open={showPublishDialog} onOpenChange={setShowPublishDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Publish Syllabus</DialogTitle>
            <DialogDescription>
              Are you sure you want to publish this syllabus? Published syllabi cannot be edited directly.
              You will need to create a revision to make changes after publishing.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowPublishDialog(false)}
              disabled={isPublishing}
            >
              Cancel
            </Button>
            <Button onClick={handlePublish} disabled={isPublishing}>
              {isPublishing ? "Publishing..." : "Publish"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
              onClick={() => setShowArchiveDialog(false)}
              disabled={isArchiving}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleArchive}
              disabled={isArchiving}
            >
              {isArchiving ? "Archiving..." : "Archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
