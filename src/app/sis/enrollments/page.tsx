"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ExternalLink, Users } from "lucide-react";

interface Enrollment {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  batch_id: string | null;
  created_at: string;
  // These will be populated from admissions lookup (via admission_id if available, else name-based)
  admission_id?: string | null;
  school_id?: string | null;
  program_id?: string | null;
  section_id?: string | null;
}

interface School {
  id: string;
  name: string;
}

interface Program {
  id: string;
  name: string;
}

interface Section {
  id: string;
  name: string;
}

export default function EnrollmentsPage() {
  const router = useRouter();
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [schoolsMap, setSchoolsMap] = useState<Map<string, School>>(new Map());
  const [programsMap, setProgramsMap] = useState<Map<string, Program>>(new Map());
  const [sectionsMap, setSectionsMap] = useState<Map<string, Section>>(new Map());
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      // INVARIANT: Students derive context ONLY from admission via admission_id
      const { data: studentsData, error: studentsError } = await supabase
        .from("students")
        .select(`
          id,
          first_name,
          last_name,
          email,
          batch_id,
          admission_id,
          created_at
        `)
        .order("created_at", { ascending: false });

      if (studentsError) {
        // Fail fast if admission_id column doesn't exist - schema mismatch
        if ((studentsError.code === "42703" || studentsError.code === "PGRST204") && 
            studentsError.message?.includes("admission_id")) {
          setError("Database schema mismatch: admission_id column required. Please run migration: ALTER TABLE students ADD COLUMN admission_id UUID REFERENCES admissions(id);");
        } else {
          console.error("Enrollments fetch error:", studentsError);
          console.error("Error message:", studentsError.message);
          console.error("Error code:", studentsError.code);
          console.error("Error details:", studentsError.details);
          console.error("Error hint:", studentsError.hint);
          setError(studentsError.message || "Failed to fetch enrollments. Please check your permissions.");
        }
        setLoading(false);
        return;
      }

      // Fetch schools separately
      const { data: schoolsData, error: schoolsError } = await supabase
        .from("schools")
        .select("id, name")
        .order("name", { ascending: true });

      if (schoolsError) {
        console.error("Error fetching schools:", schoolsError);
        // Continue even if schools fail - will show "Unknown"
      } else {
        const schools = new Map<string, School>();
        (schoolsData || []).forEach((school) => {
          schools.set(school.id, school);
        });
        setSchoolsMap(schools);
      }

      // Fetch programs separately
      const { data: programsData, error: programsError } = await supabase
        .from("programs")
        .select("id, name")
        .order("name", { ascending: true });

      if (programsError) {
        console.error("Error fetching programs:", programsError);
        // Continue even if programs fail - will show "Unknown"
      } else {
        const programs = new Map<string, Program>();
        (programsData || []).forEach((program) => {
          programs.set(program.id, program);
        });
        setProgramsMap(programs);
      }

      // Fetch sections separately
      const { data: sectionsData, error: sectionsError } = await supabase
        .from("sections")
        .select("id, name")
        .order("name", { ascending: true });

      if (sectionsError) {
        console.error("Error fetching sections:", sectionsError);
        // Continue even if sections fail - will show "Unknown"
      } else {
        const sections = new Map<string, Section>();
        (sectionsData || []).forEach((section) => {
          sections.set(section.id, section);
        });
        setSectionsMap(sections);
      }

      // INVARIANT: Student views derive context ONLY from admission
      // Removed invalid assumption: name-based matching violates 1:1 traceability
      // TODO: Add academic_year filter when schema supports it
      // Example: .eq("academic_year", currentAcademicYear)
      const { data: admissionsData, error: admissionsError } = await supabase
        .from("admissions")
        .select("id, first_name, last_name, school_id, program_id, section_id, status")
        .eq("status", "enrolled");

      if (admissionsError) {
        console.error("Error fetching admissions:", admissionsError);
        setError(admissionsError.message || "Failed to fetch admissions.");
        setLoading(false);
        return;
      }

      if (!admissionsData || !studentsData) {
        setEnrollments([]);
        setLoading(false);
        return;
      }

      // Create map of admissions by id for reliable lookup via admission_id
      const admissionsMap = new Map<string, typeof admissionsData[0]>();
      admissionsData.forEach((admission) => {
        admissionsMap.set(admission.id, admission);
      });

      // INVARIANT: Enrollments represent ONLY students with valid admission_id from enrolled admissions
      // Filter students to only those with admission_id matching enrolled admissions
      const enrolledAdmissionIds = new Set(admissionsData.map(a => a.id));
      
      const enrichedStudents = studentsData
        .filter((student) => {
          // Only include students with admission_id that matches an enrolled admission
          return student.admission_id && enrolledAdmissionIds.has(student.admission_id);
        })
        .map((student) => {
          // Enrich with admission data (guaranteed to exist due to filter above)
          const admission = admissionsMap.get(student.admission_id!);
          return {
            ...student,
            school_id: admission?.school_id || null,
            program_id: admission?.program_id || null,
            section_id: admission?.section_id || null,
          };
        });

      setEnrollments(enrichedStudents);

      setError(null);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Enrollments</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Helper functions for display - safely handle missing relations (join in memory)
  const getSchoolName = (enrollment: Enrollment) => {
    // INVARIANT: Context derived ONLY from admission
    if (!enrollment.school_id) {
      return "Unknown";
    }
    const school = schoolsMap.get(enrollment.school_id);
    return school ? school.name : "Unknown";
  };

  const getProgramName = (enrollment: Enrollment) => {
    // INVARIANT: Context derived ONLY from admission
    if (!enrollment.program_id) {
      return "Unknown";
    }
    const program = programsMap.get(enrollment.program_id);
    return program ? program.name : "Unknown";
  };

  const getSectionName = (enrollment: Enrollment) => {
    // Handle null section_id - show "Unassigned"
    if (!enrollment.section_id) {
      return null; // Will display as "Unassigned" in UI
    }
    // Join in memory using Map
    const section = sectionsMap.get(enrollment.section_id);
    return section ? section.name : "Unknown";
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Enrollments</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Operational placement layer: View and manage enrolled students
        </p>
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {!error && enrollments.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No current enrollments</div>
            <div className="text-sm text-muted-foreground">
              Enrolled students will appear here after admissions are enrolled.
            </div>
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">School</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Program</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Section</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Enrolled Date</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {enrollments.map((enrollment) => {
                const sectionName = getSectionName(enrollment);
                const schoolName = getSchoolName(enrollment);
                const programName = getProgramName(enrollment);
                
                return (
                  <tr key={enrollment.id} className="border-b">
                    <td className="px-4 py-3 text-sm">
                      {enrollment.last_name}, {enrollment.first_name}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {schoolName || <span className="text-muted-foreground italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {programName || <span className="text-muted-foreground italic">Unknown</span>}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      {sectionName ? (
                        sectionName
                      ) : (
                        <span className="text-muted-foreground italic">Unassigned</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm">{formatDate(enrollment.created_at)}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/sis/students/${enrollment.id}`)}
                          className="gap-1"
                        >
                          <ExternalLink className="size-3" />
                          View Student
                        </Button>
                        {!sectionName && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => router.push(`/sis/students/${enrollment.id}`)}
                            className="gap-1 text-muted-foreground"
                          >
                            <Users className="size-3" />
                            Assign Section
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
