"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ExternalLink, Users, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight } from "lucide-react";

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
  const [schools, setSchools] = useState<School[]>([]); // For filter dropdown
  const [programs, setPrograms] = useState<Program[]>([]); // For filter dropdown
  const [sections, setSections] = useState<Section[]>([]); // For filter dropdown
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterSchool, setFilterSchool] = useState<string>("all");
  const [filterProgram, setFilterProgram] = useState<string>("all");
  const [filterSection, setFilterSection] = useState<string>("all");
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

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
        setSchools(schoolsData || []); // Also set array for filter dropdown
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
        setPrograms(programsData || []); // Also set array for filter dropdown
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
        setSections(sectionsData || []); // Also set array for filter dropdown
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

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterSchool, filterProgram, filterSection]);

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

  // Filter, search, and sort enrollments
  const filteredAndSortedEnrollments = enrollments.filter((enrollment) => {
    // Search filter (name)
    if (searchQuery) {
      const fullName = `${enrollment.first_name} ${enrollment.last_name}`.toLowerCase();
      if (!fullName.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // School filter
    if (filterSchool !== "all" && enrollment.school_id !== filterSchool) {
      return false;
    }

    // Program filter
    if (filterProgram !== "all" && enrollment.program_id !== filterProgram) {
      return false;
    }

    // Section filter
    if (filterSection !== "all") {
      if (filterSection === "unassigned" && enrollment.section_id !== null) {
        return false;
      }
      if (filterSection !== "unassigned" && enrollment.section_id !== filterSection) {
        return false;
      }
    }

    return true;
  }).sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: string | number;
    let bValue: string | number;

    switch (sortColumn) {
      case "name":
        aValue = `${a.last_name}, ${a.first_name}`.toLowerCase();
        bValue = `${b.last_name}, ${b.first_name}`.toLowerCase();
        break;
      case "school":
        aValue = getSchoolName(a);
        bValue = getSchoolName(b);
        break;
      case "program":
        aValue = getProgramName(a);
        bValue = getProgramName(b);
        break;
      case "section":
        const aSection = getSectionName(a) || "";
        const bSection = getSectionName(b) || "";
        aValue = aSection.toLowerCase();
        bValue = bSection.toLowerCase();
        break;
      case "created_at":
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedEnrollments.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedEnrollments = filteredAndSortedEnrollments.slice(startIndex, endIndex);

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      // Toggle direction if same column
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get sort icon for column header
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="size-3 ml-1 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="size-3 ml-1" />
    ) : (
      <ArrowDown className="size-3 ml-1" />
    );
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

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

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
        <>
          {/* Table Header with Filters */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Showing {filteredAndSortedEnrollments.length} of {enrollments.length} enrollments
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterSchool} onValueChange={setFilterSchool}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="School" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterProgram} onValueChange={setFilterProgram}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Program" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Programs</SelectItem>
                  {programs.map((program) => (
                    <SelectItem key={program.id} value={program.id}>
                      {program.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSection} onValueChange={setFilterSection}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Sections</SelectItem>
                  <SelectItem value="unassigned">Unassigned</SelectItem>
                  {sections.map((section) => (
                    <SelectItem key={section.id} value={section.id}>
                      {section.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Name
                      {getSortIcon("name")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("school")}
                  >
                    <div className="flex items-center">
                      School
                      {getSortIcon("school")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("program")}
                  >
                    <div className="flex items-center">
                      Program
                      {getSortIcon("program")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("section")}
                  >
                    <div className="flex items-center">
                      Section
                      {getSortIcon("section")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center">
                      Enrolled Date
                      {getSortIcon("created_at")}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedEnrollments.map((enrollment) => {
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

        {/* Pagination Controls */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between mt-4">
            <div className="text-sm text-muted-foreground">
              Page {currentPage} of {totalPages}
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
              >
                <ChevronLeft className="size-4" />
                Previous
              </Button>
              <div className="flex items-center gap-1">
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                  // Show first page, last page, current page, and pages around current
                  if (
                    page === 1 ||
                    page === totalPages ||
                    (page >= currentPage - 1 && page <= currentPage + 1)
                  ) {
                    return (
                      <Button
                        key={page}
                        variant={currentPage === page ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(page)}
                        className="w-9"
                      >
                        {page}
                      </Button>
                    );
                  } else if (page === currentPage - 2 || page === currentPage + 2) {
                    return (
                      <span key={page} className="px-2 text-muted-foreground">
                        ...
                      </span>
                    );
                  }
                  return null;
                })}
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
              >
                Next
                <ChevronRight className="size-4" />
              </Button>
            </div>
          </div>
        )}
      </>
      )}
    </div>
  );
}
