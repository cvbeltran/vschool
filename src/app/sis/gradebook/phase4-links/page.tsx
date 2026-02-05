"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { Link2, Eye, Search, Filter } from "lucide-react";

interface Phase4Link {
  id: string;
  organization_id: string;
  computed_grade_id: string;
  grade_entry_id: string;
  created_at: string;
  created_by: string | null;
  archived_at: string | null;
  computed_grade?: {
    id: string;
    student_id: string;
    compute_run_id: string;
    initial_grade: number | null;
    final_numeric_grade: number;
    transmuted_grade: number | null;
    breakdown: any;
    student?: {
      id: string;
      first_name: string;
      last_name: string;
      student_number: string | null;
    };
    compute_run?: {
      id: string;
      section_id: string;
      term_period: string;
      scheme_id: string;
      as_of: string;
      section?: {
        id: string;
        name: string;
        code: string | null;
      };
      scheme?: {
        id: string;
        name: string;
        scheme_type: string;
      };
    };
  };
  grade_entry?: {
    id: string;
    student_grade_id: string;
    entry_type: string;
    entry_text: string | null;
    created_at: string;
  };
}

export default function Phase4LinksPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();

  const [links, setLinks] = useState<Phase4Link[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedLink, setSelectedLink] = useState<Phase4Link | null>(null);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);

  // Filters
  const [studentFilter, setStudentFilter] = useState("");
  const [sectionFilter, setSectionFilter] = useState("");
  const [runFilter, setRunFilter] = useState("");
  const [schemeFilter, setSchemeFilter] = useState("");

  // Options for filters
  const [students, setStudents] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);
  const [sections, setSections] = useState<Array<{ id: string; name: string; code: string | null }>>([]);
  const [runs, setRuns] = useState<Array<{ id: string; section_id: string; term_period: string }>>([]);
  const [schemes, setSchemes] = useState<Array<{ id: string; name: string }>>([]);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !organizationId) return;

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        // Fetch links via API route
        const response = await fetch("/api/gradebook/phase4-links", {
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        });

        if (!response.ok) {
          const error = await response.json();
          throw new Error(error.error || "Failed to fetch Phase 4 links");
        }

        const { links: linksData } = await response.json();
        setLinks(linksData || []);

        // Extract filter options from links
        const uniqueStudentIds = [...new Set(linksData.map((l: Phase4Link) => l.computed_grade?.student_id).filter(Boolean))];
        const uniqueSectionIds = [...new Set(linksData.map((l: Phase4Link) => l.computed_grade?.compute_run?.section_id).filter(Boolean))];
        const uniqueRunIds = [...new Set(linksData.map((l: Phase4Link) => l.computed_grade?.compute_run_id).filter(Boolean))];
        const uniqueSchemeIds = [...new Set(linksData.map((l: Phase4Link) => l.computed_grade?.compute_run?.scheme_id).filter(Boolean))];

        // Build filter options from links data
        const studentsMap = new Map();
        const sectionsMap = new Map();
        const runsMap = new Map();
        const schemesMap = new Map();

        linksData.forEach((link: Phase4Link) => {
          if (link.computed_grade?.student) {
            studentsMap.set(link.computed_grade.student.id, link.computed_grade.student);
          }
          if (link.computed_grade?.compute_run?.section) {
            sectionsMap.set(link.computed_grade.compute_run.section.id, link.computed_grade.compute_run.section);
          }
          if (link.computed_grade?.compute_run) {
            runsMap.set(link.computed_grade.compute_run.id, {
              id: link.computed_grade.compute_run.id,
              section_id: link.computed_grade.compute_run.section_id,
              term_period: link.computed_grade.compute_run.term_period,
            });
          }
          if (link.computed_grade?.compute_run?.scheme) {
            schemesMap.set(link.computed_grade.compute_run.scheme.id, {
              id: link.computed_grade.compute_run.scheme.id,
              name: link.computed_grade.compute_run.scheme.name,
            });
          }
        });

        setStudents(Array.from(studentsMap.values()));
        setSections(Array.from(sectionsMap.values()));
        setRuns(Array.from(runsMap.values()));
        setSchemes(Array.from(schemesMap.values()));
      } catch (error: any) {
        console.error("Error fetching Phase 4 links", error);
        toast({
          message: error.message || "Failed to load Phase 4 links",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading, organizationId, toast]);

  const filteredLinks = links.filter((link) => {
    if (studentFilter && link.computed_grade?.student_id !== studentFilter) return false;
    if (sectionFilter && link.computed_grade?.compute_run?.section_id !== sectionFilter) return false;
    if (runFilter && link.computed_grade?.compute_run_id !== runFilter) return false;
    if (schemeFilter && link.computed_grade?.compute_run?.scheme_id !== schemeFilter) return false;
    return true;
  });

  const handleViewDetails = (link: Phase4Link) => {
    setSelectedLink(link);
    setDetailDialogOpen(true);
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading Phase 4 links...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold flex items-center gap-2">
            <Link2 className="h-8 w-8" />
            Phase 4 Links
          </h1>
          <p className="text-muted-foreground mt-1">
            View links between computed grades and Phase 4 grade entries
          </p>
        </div>
      </div>

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Filter className="h-5 w-5" />
            Filters
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="student">Student</Label>
              <Select value={studentFilter} onValueChange={setStudentFilter}>
                <SelectTrigger id="student">
                  <SelectValue placeholder="All students" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All students</SelectItem>
                  {students.map((student) => (
                    <SelectItem key={student.id} value={student.id}>
                      {student.first_name} {student.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="section">Section</Label>
              <Select value={sectionFilter} onValueChange={setSectionFilter}>
                <SelectTrigger id="section">
                  <SelectValue placeholder="All sections" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All sections</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name} {section.code && `(${section.code})`}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="run">Compute Run</Label>
              <Select value={runFilter} onValueChange={setRunFilter}>
                <SelectTrigger id="run">
                  <SelectValue placeholder="All runs" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All runs</SelectItem>
                  {runs.map((run) => (
                    <SelectItem key={run.id} value={run.id}>
                      {run.term_period}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="scheme">Scheme</Label>
              <Select value={schemeFilter} onValueChange={setSchemeFilter}>
                <SelectTrigger id="scheme">
                  <SelectValue placeholder="All schemes" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">All schemes</SelectItem>
                  {schemes.map((scheme) => (
                    <SelectItem key={scheme.id} value={scheme.id}>
                      {scheme.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Links Table */}
      <Card>
        <CardHeader>
          <CardTitle>
            Links ({filteredLinks.length})
          </CardTitle>
        </CardHeader>
        <CardContent>
          {filteredLinks.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">
              No Phase 4 links found
            </p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Student</TableHead>
                  <TableHead>Section</TableHead>
                  <TableHead>Term Period</TableHead>
                  <TableHead>Scheme</TableHead>
                  <TableHead>Initial Grade</TableHead>
                  <TableHead>Final Grade</TableHead>
                  <TableHead>Linked At</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredLinks.map((link) => (
                  <TableRow key={link.id}>
                    <TableCell>
                      {link.computed_grade?.student?.first_name}{" "}
                      {link.computed_grade?.student?.last_name}
                      {link.computed_grade?.student?.student_number && (
                        <span className="text-muted-foreground ml-2">
                          ({link.computed_grade.student.student_number})
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.computed_grade?.compute_run?.section?.name || "N/A"}
                    </TableCell>
                    <TableCell>
                      {link.computed_grade?.compute_run?.term_period || "N/A"}
                    </TableCell>
                    <TableCell>
                      {link.computed_grade?.compute_run?.scheme?.name || "N/A"}
                      {link.computed_grade?.compute_run?.scheme?.scheme_type && (
                        <Badge variant="outline" className="ml-2">
                          {link.computed_grade.compute_run.scheme.scheme_type}
                        </Badge>
                      )}
                    </TableCell>
                    <TableCell>
                      {link.computed_grade?.initial_grade !== null
                        ? link.computed_grade.initial_grade.toFixed(2)
                        : "N/A"}
                    </TableCell>
                    <TableCell>
                      <Badge className="bg-blue-500">
                        {link.computed_grade?.final_numeric_grade.toFixed(2) || "N/A"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      {new Date(link.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleViewDetails(link)}
                      >
                        <Eye className="h-4 w-4 mr-2" />
                        View Details
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="max-w-4xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Link Details</DialogTitle>
            <DialogDescription>
              Detailed information about the computed grade and Phase 4 entry
            </DialogDescription>
          </DialogHeader>
          {selectedLink && (
            <div className="space-y-4">
              {/* Computed Grade Summary */}
              <Card>
                <CardHeader>
                  <CardTitle>Computed Grade Summary</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Student</p>
                      <p className="font-medium">
                        {selectedLink.computed_grade?.student?.first_name}{" "}
                        {selectedLink.computed_grade?.student?.last_name}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Section</p>
                      <p className="font-medium">
                        {selectedLink.computed_grade?.compute_run?.section?.name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Term Period</p>
                      <p className="font-medium">
                        {selectedLink.computed_grade?.compute_run?.term_period || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Scheme</p>
                      <p className="font-medium">
                        {selectedLink.computed_grade?.compute_run?.scheme?.name || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Initial Grade</p>
                      <p className="font-medium">
                        {selectedLink.computed_grade?.initial_grade !== null
                          ? selectedLink.computed_grade.initial_grade.toFixed(2)
                          : "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Final Grade</p>
                      <p className="font-medium">
                        {selectedLink.computed_grade?.final_numeric_grade.toFixed(2) || "N/A"}
                      </p>
                    </div>
                    {selectedLink.computed_grade?.transmuted_grade !== null && (
                      <div>
                        <p className="text-sm text-muted-foreground">Transmuted Grade</p>
                        <p className="font-medium">
                          {selectedLink.computed_grade.transmuted_grade.toFixed(2)}
                        </p>
                      </div>
                    )}
                    <div>
                      <p className="text-sm text-muted-foreground">Computed At</p>
                      <p className="font-medium">
                        {selectedLink.computed_grade?.compute_run?.as_of
                          ? new Date(selectedLink.computed_grade.compute_run.as_of).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Phase 4 Entry Preview */}
              <Card>
                <CardHeader>
                  <CardTitle>Phase 4 Grade Entry</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Entry Type</p>
                      <p className="font-medium">
                        {selectedLink.grade_entry?.entry_type || "N/A"}
                      </p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Created At</p>
                      <p className="font-medium">
                        {selectedLink.grade_entry?.created_at
                          ? new Date(selectedLink.grade_entry.created_at).toLocaleString()
                          : "N/A"}
                      </p>
                    </div>
                  </div>
                  {selectedLink.grade_entry?.entry_text && (
                    <div>
                      <p className="text-sm text-muted-foreground mb-2">Entry Text</p>
                      <pre className="p-4 bg-gray-100 rounded-md text-xs overflow-x-auto whitespace-pre-wrap">
                        {selectedLink.grade_entry.entry_text}
                      </pre>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Link Metadata */}
              <Card>
                <CardHeader>
                  <CardTitle>Link Metadata</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-sm text-muted-foreground">Link ID</p>
                      <p className="font-mono text-sm">{selectedLink.id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Computed Grade ID</p>
                      <p className="font-mono text-sm">{selectedLink.computed_grade_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Grade Entry ID</p>
                      <p className="font-mono text-sm">{selectedLink.grade_entry_id}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Linked At</p>
                      <p className="font-medium">
                        {new Date(selectedLink.created_at).toLocaleString()}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
