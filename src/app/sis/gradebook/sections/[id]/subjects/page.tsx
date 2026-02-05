"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams, useSearchParams } from "next/navigation";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { ArrowLeft, Plus, BookOpen, PenTool, Calculator, Users } from "lucide-react";
import {
  listSectionOfferings,
  createOffering,
  assignTeacherToOffering,
  type SectionSubjectOffering,
} from "@/lib/gradebook-offerings";
import { SectionContextHeader } from "@/components/gradebook/SectionContextHeader";

export default function SectionSubjectsPage() {
  const router = useRouter();
  const params = useParams();
  const searchParams = useSearchParams();
  const sectionId = params.id as string;
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();

  const [offerings, setOfferings] = useState<SectionSubjectOffering[]>([]);
  const [loading, setLoading] = useState(true);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [assignDialogOpen, setAssignDialogOpen] = useState(false);
  const [selectedOffering, setSelectedOffering] = useState<string | null>(null);

  // Filter state
  const [schoolYearId, setSchoolYearId] = useState(searchParams.get("school_year_id") || "");
  const [termPeriod, setTermPeriod] = useState(searchParams.get("term_period") || "");
  const [schoolYears, setSchoolYears] = useState<Array<{ id: string; year_label: string }>>([]);
  const [subjects, setSubjects] = useState<Array<{ id: string; code: string; name: string }>>([]);
  const [staff, setStaff] = useState<Array<{ id: string; first_name: string; last_name: string }>>([]);

  // Create offering form
  const [formData, setFormData] = useState({
    subject_id: "",
    school_year_id: schoolYearId || "",
    term_period: termPeriod || "",
  });

  // Assign teacher form
  const [assignFormData, setAssignFormData] = useState({
    staff_id: "",
    role: "primary" as "primary" | "co",
  });

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !organizationId || !sectionId) return;

      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error("Not authenticated");

        // Fetch school years
        const { data: yearsData } = await supabase
          .from("school_years")
          .select("id, year_label")
          .order("year_label", { ascending: false });

        setSchoolYears(yearsData || []);

        // Fetch subjects
        const { data: subjectsData } = await supabase
          .from("subjects")
          .select("id, code, name")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("code");

        setSubjects(subjectsData || []);

        // Fetch staff (for teacher assignment)
        const { data: staffData } = await supabase
          .from("staff")
          .select("id, first_name, last_name")
          .eq("organization_id", organizationId)
          .order("last_name");

        setStaff(staffData || []);

        // Fetch offerings
        const offeringsData = await listSectionOfferings(
          sectionId,
          schoolYearId || undefined,
          termPeriod || undefined
        );
        setOfferings(offeringsData);
      } catch (error: any) {
        console.error("Error fetching data", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load data",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [orgLoading, organizationId, sectionId, schoolYearId, termPeriod, toast]);

  const handleCreateOffering = async () => {
    if (!formData.subject_id || !formData.school_year_id || !formData.term_period) {
      toast({
        title: "Error",
        description: "Please fill in all required fields",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      // Get section to get school_id
      const { data: section } = await supabase
        .from("sections")
        .select("school_id")
        .eq("id", sectionId)
        .single();

      await createOffering({
        organization_id: organizationId!,
        school_id: section?.school_id || null,
        school_year_id: formData.school_year_id,
        section_id: sectionId,
        subject_id: formData.subject_id,
        term_period: formData.term_period,
      });

      toast({
        title: "Success",
        description: "Subject offering created",
      });

      setCreateDialogOpen(false);
      setFormData({ subject_id: "", school_year_id: schoolYearId || "", term_period: termPeriod || "" });

      // Refresh offerings
      const offeringsData = await listSectionOfferings(
        sectionId,
        schoolYearId || undefined,
        termPeriod || undefined
      );
      setOfferings(offeringsData);
    } catch (error: any) {
      console.error("Error creating offering", error);
      toast({
        title: "Error",
        description: error.message || "Failed to create offering",
        variant: "destructive",
      });
    }
  };

  const handleAssignTeacher = async () => {
    if (!selectedOffering || !assignFormData.staff_id) {
      toast({
        title: "Error",
        description: "Please select a teacher",
        variant: "destructive",
      });
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error("Not authenticated");

      const offering = offerings.find((o) => o.id === selectedOffering);
      if (!offering) throw new Error("Offering not found");

      await assignTeacherToOffering({
        organization_id: organizationId!,
        school_id: offering.school_id || null,
        section_subject_offering_id: selectedOffering,
        staff_id: assignFormData.staff_id,
        role: assignFormData.role,
      });

      toast({
        title: "Success",
        description: "Teacher assigned",
      });

      setAssignDialogOpen(false);
      setSelectedOffering(null);
      setAssignFormData({ staff_id: "", role: "primary" });

      // Refresh offerings
      const offeringsData = await listSectionOfferings(
        sectionId,
        schoolYearId || undefined,
        termPeriod || undefined
      );
      setOfferings(offeringsData);
    } catch (error: any) {
      console.error("Error assigning teacher", error);
      toast({
        title: "Error",
        description: error.message || "Failed to assign teacher",
        variant: "destructive",
      });
    }
  };

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading subjects...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back
          </Button>
          <div>
            <h1 className="text-3xl font-bold">Subject Offerings</h1>
            <p className="text-muted-foreground mt-1">
              Manage subject offerings for this section
            </p>
          </div>
        </div>
      </div>

      {/* Section Context Header */}
      <SectionContextHeader sectionId={sectionId} />

      {/* Filters */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>Filters</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 gap-4">
            <div className="grid gap-2">
              <Label htmlFor="school_year">School Year</Label>
              <Select 
                value={schoolYearId || "__all__"} 
                onValueChange={(value) => setSchoolYearId(value === "__all__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All years" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All years</SelectItem>
                  {schoolYears.map((year) => (
                    <SelectItem key={year.id} value={year.id}>
                      {year.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="term_period">Term Period</Label>
              <Select 
                value={termPeriod || "__all__"} 
                onValueChange={(value) => setTermPeriod(value === "__all__" ? "" : value)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="All terms" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__all__">All terms</SelectItem>
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
          </div>
        </CardContent>
      </Card>

      {/* Admin: Add Offering Button */}
      {organizationId && (
        <div className="mb-4 flex justify-end">
          <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="mr-2 h-4 w-4" />
                Add Subject Offering
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Add Subject Offering</DialogTitle>
                <DialogDescription>
                  Create a new subject offering for this section
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <div className="grid gap-2">
                  <Label htmlFor="subject">Subject *</Label>
                  <Select
                    value={formData.subject_id}
                    onValueChange={(value) => setFormData({ ...formData, subject_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select subject" />
                    </SelectTrigger>
                    <SelectContent>
                      {subjects.map((subject) => (
                        <SelectItem key={subject.id} value={subject.id}>
                          {subject.code} - {subject.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="school_year">School Year *</Label>
                  <Select
                    value={formData.school_year_id}
                    onValueChange={(value) => setFormData({ ...formData, school_year_id: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select year" />
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
                <div className="grid gap-2">
                  <Label htmlFor="term_period">Term Period *</Label>
                  <Select
                    value={formData.term_period}
                    onValueChange={(value) => setFormData({ ...formData, term_period: value })}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="Select term" />
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
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateOffering}
                  disabled={!formData.subject_id || !formData.school_year_id || !formData.term_period}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Offerings List */}
      {offerings.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No subject offerings found</h3>
            <p className="text-muted-foreground">
              {schoolYearId || termPeriod
                ? "No offerings match the selected filters."
                : "Create a subject offering to get started."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {offerings.map((offering) => {
            const subject = offering.subject;
            const teachers = offering.teachers || [];
            return (
              <Card key={offering.id} className="hover:shadow-lg transition-shadow">
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-lg">
                        {subject?.code} - {subject?.name}
                      </CardTitle>
                      <div className="mt-2 flex gap-2">
                        <Badge variant="outline">{offering.term_period}</Badge>
                        {offering.school_years && (
                          <Badge variant="secondary">
                            {(offering.school_years as any).year_label}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {teachers.length > 0 ? (
                      <div>
                        <Label className="text-sm text-muted-foreground">Teachers</Label>
                        <div className="mt-1 space-y-1">
                          {teachers.map((teacher) => (
                            <div key={teacher.id} className="flex items-center gap-2">
                              <Users className="h-4 w-4 text-muted-foreground" />
                              <span className="text-sm">
                                {teacher.staff?.first_name} {teacher.staff?.last_name}
                              </span>
                              <Badge variant={teacher.role === "primary" ? "default" : "outline"} className="text-xs">
                                {teacher.role}
                              </Badge>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="text-sm text-muted-foreground">No teacher assigned</div>
                    )}

                    <div className="flex gap-2 pt-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          router.push(
                            `/sis/gradebook/offerings/${offering.id}/items?term_period=${offering.term_period}`
                          )
                        }
                      >
                        <PenTool className="mr-2 h-4 w-4" />
                        Items
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          router.push(
                            `/sis/gradebook/offerings/${offering.id}/scores?term_period=${offering.term_period}`
                          )
                        }
                      >
                        <PenTool className="mr-2 h-4 w-4" />
                        Scores
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() =>
                          router.push(
                            `/sis/gradebook/offerings/${offering.id}/compute?term_period=${offering.term_period}`
                          )
                        }
                      >
                        <Calculator className="mr-2 h-4 w-4" />
                        Compute
                      </Button>
                    </div>

                    {organizationId && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="w-full"
                        onClick={() => {
                          setSelectedOffering(offering.id);
                          setAssignDialogOpen(true);
                        }}
                      >
                        <Users className="mr-2 h-4 w-4" />
                        Assign Teacher
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Assign Teacher Dialog */}
      <Dialog open={assignDialogOpen} onOpenChange={setAssignDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Assign Teacher</DialogTitle>
            <DialogDescription>
              Assign a teacher to this subject offering
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="teacher">Teacher *</Label>
              <Select
                value={assignFormData.staff_id}
                onValueChange={(value) => setAssignFormData({ ...assignFormData, staff_id: value })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select teacher" />
                </SelectTrigger>
                <SelectContent>
                  {staff.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.first_name} {s.last_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="role">Role</Label>
              <Select
                value={assignFormData.role}
                onValueChange={(value: "primary" | "co") =>
                  setAssignFormData({ ...assignFormData, role: value })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="primary">Primary</SelectItem>
                  <SelectItem value="co">Co-teacher</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAssignDialogOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleAssignTeacher} disabled={!assignFormData.staff_id}>
              Assign
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
