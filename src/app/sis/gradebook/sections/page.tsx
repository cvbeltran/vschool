"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { BookOpen, PenTool, Calculator, ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { getSectionsContext, type SectionContext } from "@/lib/gradebook-section-context";

interface Section {
  id: string;
  name: string;
  code: string;
}

export default function SectionsPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [sections, setSections] = useState<Section[]>([]);
  const [sectionsContext, setSectionsContext] = useState<Map<string, SectionContext>>(new Map());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSections = async () => {
      if (orgLoading || !organizationId) return;
      try {
        setLoading(true);
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          throw new Error("Not authenticated");
        }

        // Fetch sections - teachers see only sections they teach
        const { data: profile, error: profileError } = await supabase
          .from("profiles")
          .select("role, id")
          .eq("id", session.user.id)
          .single();

        if (profileError) {
          throw new Error(`Failed to fetch profile: ${profileError.message}`);
        }

        if (!profile) {
          throw new Error("Profile not found");
        }

        let query = supabase
          .from("sections")
          .select("id, name, code")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("name", { ascending: true });

        // If teacher/mentor, filter by sections they teach via staff -> section_teachers OR section_subject_teachers
        if (profile.role === "teacher" || profile.role === "mentor") {
          // First, find the staff record for this user
          const { data: staffRecord, error: staffError } = await supabase
            .from("staff")
            .select("id")
            .eq("user_id", session.user.id)
            .single();

          if (staffError) {
            // Staff record not found - teacher might not have staff record yet
            console.warn("Staff record not found for user:", staffError.message);
            setSections([]);
            setLoading(false);
            return;
          }

          if (!staffRecord) {
            // User has no staff record - can't be assigned to sections
            setSections([]);
            setLoading(false);
            return;
          }

          // Find sections where this staff member is assigned as homeroom teacher
          const { data: sectionTeachers, error: sectionTeachersError } = await supabase
            .from("section_teachers")
            .select("section_id")
            .eq("staff_id", staffRecord.id)
            .is("end_date", null)
            .is("archived_at", null);

          if (sectionTeachersError) {
            throw new Error(`Failed to fetch section teachers: ${sectionTeachersError.message}`);
          }

          // Find sections where this staff member is assigned to teach specific subjects
          const { data: subjectTeachers, error: subjectTeachersError } = await supabase
            .from("section_subject_teachers")
            .select(`
              section_subject_offering_id,
              offering:section_subject_offerings!inner(section_id)
            `)
            .eq("staff_id", staffRecord.id)
            .is("end_date", null)
            .is("archived_at", null);

          if (subjectTeachersError) {
            throw new Error(`Failed to fetch subject teachers: ${subjectTeachersError.message}`);
          }

          // Collect all section IDs from both assignment types
          const sectionIds = new Set<string>();
          
          // Add sections from homeroom assignment
          if (sectionTeachers && sectionTeachers.length > 0) {
            sectionTeachers.forEach((st) => {
              sectionIds.add(st.section_id);
            });
          }

          // Add sections from subject-specific assignment
          if (subjectTeachers && subjectTeachers.length > 0) {
            subjectTeachers.forEach((st: any) => {
              const offering = st.offering as any;
              if (offering?.section_id) {
                sectionIds.add(offering.section_id);
              }
            });
          }

          if (sectionIds.size > 0) {
            query = query.in("id", Array.from(sectionIds));
          } else {
            // Teacher with no sections assigned (neither homeroom nor subject-specific)
            setSections([]);
            setLoading(false);
            return;
          }
        }
        // Admin/Principal see all sections (no filtering needed)

        const { data, error } = await query;

        if (error) {
          throw new Error(`Failed to fetch sections: ${error.message}`);
        }
        const sectionsList = data || [];
        setSections(sectionsList);

        // Fetch context for all sections
        if (sectionsList.length > 0) {
          const sectionIds = sectionsList.map((s: Section) => s.id);
          const contextMap = await getSectionsContext(sectionIds);
          setSectionsContext(contextMap);
        }
      } catch (error: any) {
        console.error("Error fetching sections", error);
        const errorMessage = error?.message || error?.toString() || JSON.stringify(error) || "Failed to load sections";
        toast({
          title: "Error",
          description: errorMessage,
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [orgLoading, organizationId]);

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="flex items-center justify-center h-64">
          <p>Loading sections...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">My Sections</h1>
        <p className="text-muted-foreground mt-1">
          Select a section to manage graded items, enter scores, or compute grades
        </p>
      </div>

      {sections.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">No sections found</h3>
            <p className="text-muted-foreground">
              You don't have access to any sections yet. Contact your administrator.
            </p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Sections</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Code</TableHead>
                  <TableHead>Name</TableHead>
                  <TableHead>School</TableHead>
                  <TableHead>Grade Level</TableHead>
                  <TableHead>Subject</TableHead>
                  <TableHead>Actions</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sections.map((section) => {
                  const context = sectionsContext.get(section.id);
                  return (
                    <TableRow key={section.id}>
                      <TableCell className="font-mono">{section.code}</TableCell>
                      <TableCell>{section.name}</TableCell>
                      <TableCell>{context?.school_name || "-"}</TableCell>
                      <TableCell>
                        {context?.grade_level ? (
                          <Badge variant="outline">{context.grade_level}</Badge>
                        ) : (
                          "-"
                        )}
                      </TableCell>
                      <TableCell>
                        {context?.subject_name ? (
                          <Badge variant="secondary">
                            {context.subject_code} - {context.subject_name}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-sm">Not set</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Button
                          size="sm"
                          variant="default"
                          onClick={() => router.push(`/sis/gradebook/sections/${section.id}/subjects`)}
                        >
                          View Subjects
                          <ArrowRight className="ml-2 h-4 w-4" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
