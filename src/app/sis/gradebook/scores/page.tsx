"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/lib/hooks/use-organization";
import { useToast } from "@/hooks/use-toast";
import { PenTool, ArrowRight } from "lucide-react";

export default function ScoreEntryPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const { toast } = useToast();
  const [sections, setSections] = useState<Array<{ id: string; name: string; code: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [selectedSectionId, setSelectedSectionId] = useState<string>("");

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
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, id")
          .eq("id", session.user.id)
          .single();

        let query = supabase
          .from("sections")
          .select("id, name, code")
          .eq("organization_id", organizationId)
          .is("archived_at", null)
          .order("name", { ascending: true });

        // If teacher/mentor, filter by sections they teach via staff -> section_teachers OR section_subject_teachers
        if (profile?.role === "teacher" || profile?.role === "mentor") {
          // First, find the staff record for this user
          const { data: staffRecord, error: staffError } = await supabase
            .from("staff")
            .select("id")
            .eq("user_id", session.user.id)
            .single();

          if (staffError || !staffRecord) {
            // Staff record not found - teacher might not have staff record yet
            console.warn("Staff record not found for user:", staffError?.message);
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

        if (error) throw error;
        setSections(data || []);
      } catch (error: any) {
        console.error("Error fetching sections", error);
        toast({
          title: "Error",
          description: error.message || "Failed to load sections",
          variant: "destructive",
        });
      } finally {
        setLoading(false);
      }
    };

    fetchSections();
  }, [orgLoading, organizationId, toast]);

  const handleContinue = () => {
    if (!selectedSectionId) {
      toast({
        title: "Selection Required",
        description: "Please select a section to continue",
        variant: "destructive",
      });
      return;
    }
    router.push(`/sis/gradebook/sections/${selectedSectionId}/scores`);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Score Entry</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Enter scores for students in a section
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PenTool className="size-5" />
            Select Section
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {loading ? (
            <div className="text-sm text-muted-foreground">Loading sections...</div>
          ) : sections.length === 0 ? (
            <div className="text-sm text-muted-foreground">
              No sections available. Please contact an administrator.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                <Label htmlFor="section-select">Section</Label>
                <Select value={selectedSectionId} onValueChange={setSelectedSectionId}>
                  <SelectTrigger id="section-select">
                    <SelectValue placeholder="Select a section" />
                  </SelectTrigger>
                  <SelectContent>
                    {sections.map((section) => (
                      <SelectItem key={section.id} value={section.id}>
                        {section.name} ({section.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button onClick={handleContinue} disabled={!selectedSectionId} className="w-full">
                Continue to Score Entry
                <ArrowRight className="ml-2 size-4" />
              </Button>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
