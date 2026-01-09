"use client";

import { useEffect, useState, ReactElement } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, CheckCircle, XCircle, UserCheck, Loader2, Clock, ExternalLink, Info, ChevronLeft, ChevronRight, Search, ArrowUpDown, ArrowUp, ArrowDown, X } from "lucide-react";
import { normalizeRole, canPerform } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface Admission {
  id: string;
  school_id: string;
  program_id: string;
  section_id: string | null;
  school_year_id: string | null;
  first_name: string;
  last_name: string;
  email: string | null;
  status: string;
  created_at: string;
}

interface SchoolYear {
  id: string;
  year_label: string;
  start_date: string;
  end_date: string;
}

interface School {
  id: string;
  name: string;
}

interface Program {
  id: string;
  school_id: string;
  name: string;
  code: string;
}

interface Section {
  id: string;
  school_id: string;
  program_id: string;
  name: string;
  code: string;
}

export default function AdmissionsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [programs, setPrograms] = useState<Program[]>([]);
  const [sections, setSections] = useState<Section[]>([]); // All sections for table display
  const [formSections, setFormSections] = useState<Section[]>([]); // Sections filtered for form
  const [schoolYears, setSchoolYears] = useState<SchoolYear[]>([]); // School years with PLANNING status
  const [allSchoolYears, setAllSchoolYears] = useState<Map<string, SchoolYear>>(new Map()); // All school years for display
  const [studentIdMap, setStudentIdMap] = useState<Map<string, string>>(new Map()); // Map admission_id -> student_id
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null); // Store original role for RBAC differentiation
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [rejectingId, setRejectingId] = useState<string | null>(null);
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [filterSchoolYear, setFilterSchoolYear] = useState<string>("all");
  const [filterSchool, setFilterSchool] = useState<string>("all");
  // Sorting state - default to status sorting (pending, accepted, enrolled, rejected)
  const [sortColumn, setSortColumn] = useState<string | null>("status");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("asc");
  const [formData, setFormData] = useState({
    school_year_id: "",
    school_id: "",
    program_id: "",
    section_id: "",
    first_name: "",
    last_name: "",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return; // Wait for organization context
      
      // Fetch user role
      let userRole: "principal" | "admin" | "teacher" = "principal";
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
          const normalizedRole = normalizeRole(profile.role);
          userRole = normalizedRole;
          setRole(normalizedRole);
          setOriginalRole(profile.role); // Store original role for RBAC differentiation
        }
      }

      // Fetch schools - filter by organization_id unless super admin
      let schoolsQuery = supabase
        .from("schools")
        .select("id, name");
      
      if (!isSuperAdmin && organizationId) {
        schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
      }
      
      const { data: schoolsData, error: schoolsError } = await schoolsQuery.order("name", { ascending: true });

      if (schoolsError) {
        console.error("Error fetching schools:", schoolsError);
        setError("Failed to load schools.");
      } else {
        setSchools(schoolsData || []);
      }

      // Fetch all programs for display (used in table) - filter by organization_id unless super admin
      let programsQuery = supabase
        .from("programs")
        .select("id, school_id, name, code");
      
      if (!isSuperAdmin && organizationId) {
        programsQuery = programsQuery.eq("organization_id", organizationId);
      }
      
      const { data: programsData, error: programsError } = await programsQuery.order("name", { ascending: true });

      if (programsError) {
        console.error("Error fetching programs:", programsError);
      } else {
        setPrograms(programsData || []);
      }

      // Fetch all sections for display (used in table) - filter by organization_id unless super admin
      let sectionsQuery = supabase
        .from("sections")
        .select("id, school_id, program_id, name, code");
      
      if (!isSuperAdmin && organizationId) {
        sectionsQuery = sectionsQuery.eq("organization_id", organizationId);
      }
      
      const { data: sectionsData, error: sectionsError } = await sectionsQuery.order("name", { ascending: true });

      if (sectionsError) {
        console.error("Error fetching sections:", sectionsError);
      } else {
        setSections(sectionsData || []);
      }

      // Fetch school years with PLANNING status only (for form)
      // First, get the PLANNING status taxonomy item ID
      const { data: planningStatus } = await supabase
        .from("taxonomy_items")
        .select("id")
        .eq("code", "PLANNING")
        .single();

      if (planningStatus) {
        let schoolYearsQuery = supabase
          .from("school_years")
          .select("id, year_label, start_date, end_date")
          .eq("status_id", planningStatus.id);
        
        if (!isSuperAdmin && organizationId) {
          schoolYearsQuery = schoolYearsQuery.eq("organization_id", organizationId);
        }
        
        const { data: schoolYearsData, error: schoolYearsError } = await schoolYearsQuery.order("start_date", { ascending: false });

        if (schoolYearsError) {
          console.error("Error fetching school years:", schoolYearsError);
        } else {
          setSchoolYears(schoolYearsData || []);
        }
      }

      // Fetch ALL school years for display (to show in table) - filter by organization_id unless super admin
      let allSchoolYearsQuery = supabase
        .from("school_years")
        .select("id, year_label, start_date, end_date");
      
      if (!isSuperAdmin && organizationId) {
        allSchoolYearsQuery = allSchoolYearsQuery.eq("organization_id", organizationId);
      }
      
      const { data: allSchoolYearsData, error: allSchoolYearsError } = await allSchoolYearsQuery.order("start_date", { ascending: false });

      if (!allSchoolYearsError && allSchoolYearsData) {
        const schoolYearMap = new Map<string, SchoolYear>();
        allSchoolYearsData.forEach((sy) => {
          schoolYearMap.set(sy.id, sy);
        });
        setAllSchoolYears(schoolYearMap);
      }

      // Fetch admissions - filter by organization_id unless super admin
      let admissionsQuery = supabase
        .from("admissions")
        .select("id, school_id, program_id, section_id, school_year_id, first_name, last_name, email, status, created_at");
      
      if (!isSuperAdmin && organizationId) {
        admissionsQuery = admissionsQuery.eq("organization_id", organizationId);
      }
      
      const { data, error: fetchError } = await admissionsQuery.order("created_at", { ascending: false });

      if (fetchError) {
        const errorMessage = fetchError?.message || fetchError?.toString() || "Unknown error";
        console.error("Error fetching admissions:", {
          message: errorMessage,
          code: fetchError?.code,
          details: fetchError?.details,
          hint: fetchError?.hint,
        });
        setError(errorMessage || "Failed to fetch admissions. Please check your permissions.");
        setLoading(false);
        return;
      }

      setAdmissions(data || []);

      // Fetch student IDs for enrolled admissions (for "View Student" button)
      const enrolledAdmissionIds = (data || []).filter(a => a.status === "enrolled").map(a => a.id);
      if (enrolledAdmissionIds.length > 0) {
        const { data: studentsData, error: studentsError } = await supabase
          .from("students")
          .select("id, admission_id")
          .in("admission_id", enrolledAdmissionIds);

        if (!studentsError && studentsData) {
          const map = new Map<string, string>();
          studentsData.forEach(student => {
            if (student.admission_id) {
              map.set(student.admission_id, student.id);
            }
          });
          setStudentIdMap(map);
        }
      }

      setError(null);
      setLoading(false);
    };

    if (!orgLoading) {
      fetchData();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Refresh programs when school changes in form
  useEffect(() => {
    if (!isDialogOpen || !formData.school_id) return;

    const fetchProgramsForSchool = async () => {
      const { data: programsData, error: programsError } = await supabase
        .from("programs")
        .select("id, school_id, name, code")
        .eq("school_id", formData.school_id)
        .order("name", { ascending: true });

      if (!programsError && programsData) {
        setPrograms(programsData);
      }
    };

    fetchProgramsForSchool();
  }, [formData.school_id, isDialogOpen]);

  // Refresh form sections when program changes in form (for dropdown only)
  useEffect(() => {
    if (!isDialogOpen || !formData.program_id) {
      setFormSections([]);
      return;
    }

    // Filter sections from the global sections array for the selected program
    const filteredSections = sections.filter((s) => s.program_id === formData.program_id);
    setFormSections(filteredSections);
  }, [formData.program_id, isDialogOpen, sections]);

  // Reset to page 1 when admissions change, search, filters, or sorting change
  useEffect(() => {
    setCurrentPage(1);
  }, [admissions.length, searchQuery, filterStatus, filterSchoolYear, filterSchool, sortColumn, sortDirection]);

  const handleCreate = () => {
    setFormData({
      school_year_id: "",
      school_id: "",
      program_id: "",
      section_id: "",
      first_name: "",
      last_name: "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async () => {
    if (!formData.first_name || !formData.last_name || !formData.school_year_id || !formData.school_id || !formData.program_id) {
      setError("Please fill in all required fields.");
      return;
    }

    setError(null);
    setSuccessMessage(null);

    // Get user's organization_id for the admission
    const {
      data: { session },
    } = await supabase.auth.getSession();
    let organizationId: string | null = null;
    
    if (session) {
      const { data: profile } = await supabase
        .from("profiles")
        .select("organization_id")
        .eq("id", session.user.id)
        .single();
      organizationId = profile?.organization_id || null;
    }

    if (!organizationId) {
      setError("User is not associated with an organization.");
      return;
    }

    // Create new admission with status "pending"
    const { error: createError } = await supabase.from("admissions").insert([
      {
        school_year_id: formData.school_year_id,
        school_id: formData.school_id,
        program_id: formData.program_id,
        section_id: formData.section_id || null,
        first_name: formData.first_name,
        last_name: formData.last_name,
        status: "pending",
        organization_id: organizationId,
      },
    ]);

    if (createError) {
      const errorDetails = {
        message: createError.message,
        details: createError.details,
        hint: createError.hint,
        code: createError.code,
      };
      console.error("Error creating admission:", errorDetails);
      setError(createError.message || "Failed to create admission. Please check your permissions.");
      return;
    }

    // Refresh admissions list
    const { data: refreshData, error: refreshError } = await supabase
      .from("admissions")
      .select("id, school_id, program_id, section_id, school_year_id, first_name, last_name, email, status, created_at")
      .order("created_at", { ascending: false });

    if (refreshError) {
      const errorDetails = {
        message: refreshError.message,
        details: refreshError.details,
        hint: refreshError.hint,
        code: refreshError.code,
      };
      console.error("Error refreshing admissions:", errorDetails);
      setError(refreshError.message || "Failed to refresh admissions list.");
    } else if (refreshData) {
      setAdmissions(refreshData);
      setError(null);
      setSuccessMessage(`Admission created for ${formData.first_name} ${formData.last_name}`);
      setTimeout(() => setSuccessMessage(null), 3000);
    }

    setIsDialogOpen(false);
    setFormData({
      school_year_id: "",
      school_id: "",
      program_id: "",
      section_id: "",
      first_name: "",
      last_name: "",
    });
  };

  const handleAccept = async (admissionId: string) => {
    setAcceptingId(admissionId);
    setError(null);
    setSuccessMessage(null);

    const { error: updateError } = await supabase
      .from("admissions")
      .update({ status: "accepted" })
      .eq("id", admissionId);

    if (updateError) {
      console.error("Error accepting admission:", updateError);
      setError(updateError.message || "Failed to accept admission.");
      setAcceptingId(null);
      return;
    }

    // Refresh admissions list
    const { data } = await supabase
      .from("admissions")
      .select("id, school_id, program_id, section_id, school_year_id, first_name, last_name, email, status, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      setAdmissions(data);
      const admission = data.find(a => a.id === admissionId);
      if (admission) {
        setSuccessMessage(`Admission accepted for ${admission.first_name} ${admission.last_name}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    }
    setAcceptingId(null);
  };

  const handleReject = async (admissionId: string) => {
    setRejectingId(admissionId);
    setError(null);
    setSuccessMessage(null);

    const { error: updateError } = await supabase
      .from("admissions")
      .update({ status: "rejected" })
      .eq("id", admissionId);

    if (updateError) {
      console.error("Error rejecting admission:", updateError);
      setError(updateError.message || "Failed to reject admission.");
      setRejectingId(null);
      return;
    }

    // Refresh admissions list
    const { data } = await supabase
      .from("admissions")
      .select("id, school_id, program_id, section_id, school_year_id, first_name, last_name, email, status, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      setAdmissions(data);
      const admission = data.find(a => a.id === admissionId);
      if (admission) {
        setSuccessMessage(`Admission rejected for ${admission.first_name} ${admission.last_name}`);
        setTimeout(() => setSuccessMessage(null), 3000);
      }
    }
    setRejectingId(null);
  };

  const handleEnroll = async (admission: Admission) => {
    // INVARIANT: Admission → Student is 1:1 and traceable
    // Guard: Prevent enrolling if already enrolled (status check is authoritative)
    if (admission.status === "enrolled") {
      setError("This admission has already been enrolled.");
      return;
    }

    setEnrollingId(admission.id);
    setError(null);
    setSuccessMessage(null);

    // INVARIANT ENFORCEMENT: Check if student exists for this admission using admission_id
    // Removed invalid assumption: name-based matching violates 1:1 invariant
    const { data: existingStudent, error: checkError } = await supabase
      .from("students")
      .select("id")
      .eq("admission_id", admission.id)
      .maybeSingle();

    if (checkError) {
      // Fail fast if admission_id column doesn't exist - schema mismatch
      if ((checkError.code === "42703" || checkError.code === "PGRST204") && 
          checkError.message?.includes("admission_id")) {
        setError("Database schema mismatch: admission_id column required. Please run migration: ALTER TABLE students ADD COLUMN admission_id UUID REFERENCES admissions(id);");
        setEnrollingId(null);
        return;
      }
      console.error("Error checking for existing student:", checkError);
      setError("Failed to verify enrollment status. Please try again.");
      setEnrollingId(null);
      return;
    }

    if (existingStudent) {
      setError("A student record already exists for this admission. Cannot enroll twice.");
      setEnrollingId(null);
      return;
    }

    // Update admission status to "enrolled" (authoritative source)
    const { error: updateError } = await supabase
      .from("admissions")
      .update({ status: "enrolled" })
      .eq("id", admission.id);

    if (updateError) {
      console.error("Error updating admission:", updateError);
      setError(updateError.message || "Failed to enroll admission.");
      setEnrollingId(null);
      return;
    }

    // INVARIANT ENFORCEMENT: Create student with admission_id (required for traceability)
    // Removed invalid assumption: creating students without admission_id violates traceability
    const studentData = {
      first_name: admission.first_name,
      last_name: admission.last_name,
      email: admission.email,
      admission_id: admission.id, // Required for 1:1 traceability
    };

    const { data: studentResult, error: createError } = await supabase.from("students").insert([studentData]).select().single();

    if (createError) {
      // Fail fast if admission_id column doesn't exist - schema mismatch
      if ((createError.code === "42703" || createError.code === "PGRST204") && 
          createError.message?.includes("admission_id")) {
        setError("Database schema mismatch: admission_id column required. Please run migration: ALTER TABLE students ADD COLUMN admission_id UUID REFERENCES admissions(id);");
        setEnrollingId(null);
        return;
      }
      console.error("Error creating student:", createError);
      console.error("Error message:", createError.message);
      console.error("Error code:", createError.code);
      console.error("Error details:", createError.details);
      console.error("Error hint:", createError.hint);
      setError(createError.message || "Failed to create student record.");
      setEnrollingId(null);
      return;
    }

    // Refresh admissions list
    const { data } = await supabase
      .from("admissions")
      .select("id, school_id, program_id, section_id, school_year_id, first_name, last_name, email, status, created_at")
      .order("created_at", { ascending: false });

    if (data) {
      setAdmissions(data);
      
      // Update student ID map for the newly enrolled admission
      if (studentResult?.id && admission.id) {
        const newMap = new Map(studentIdMap);
        newMap.set(admission.id, studentResult.id);
        setStudentIdMap(newMap);
      }
      
      setError(null);
      setSuccessMessage(`Successfully enrolled ${admission.first_name} ${admission.last_name}`);
      setEnrollingId(null);
      
      // Redirect to student detail page after 1.5 seconds
      if (studentResult?.id) {
        setTimeout(() => {
          router.push(`/sis/students/${studentResult.id}`);
        }, 1500);
      }
    }
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Admissions</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Use explicit RBAC check for create/update permissions (pass originalRole to differentiate registrar)
  const canCreate = canPerform(role, "create", "admissions", originalRole);
  const canUpdate = canPerform(role, "update", "admissions", originalRole);
  const canEdit = canCreate || canUpdate;

  // Helper functions for display
  const getSchoolName = (schoolId: string) => {
    return schools.find((s) => s.id === schoolId)?.name || "Unknown";
  };

  const getProgramName = (programId: string) => {
    return programs.find((p) => p.id === programId)?.name || "Unknown";
  };

  const getSectionName = (sectionId: string | null) => {
    if (!sectionId) return "Unassigned";
    return sections.find((s) => s.id === sectionId)?.name || "Unknown";
  };

  const getSchoolYearLabel = (schoolYearId: string | null) => {
    if (!schoolYearId) return "—";
    return allSchoolYears.get(schoolYearId)?.year_label || "Unknown";
  };

  // Filter, search, and sort admissions
  // If no search and no filters, ensure default sort by status
  const shouldUseDefaultSort = !searchQuery && filterStatus === "all" && filterSchoolYear === "all" && filterSchool === "all";
  
  const filteredAndSortedAdmissions = admissions.filter((admission) => {
    // Search filter (name)
    if (searchQuery) {
      const fullName = `${admission.first_name} ${admission.last_name}`.toLowerCase();
      if (!fullName.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // Status filter
    if (filterStatus !== "all" && admission.status !== filterStatus) {
      return false;
    }

    // School year filter
    if (filterSchoolYear !== "all" && admission.school_year_id !== filterSchoolYear) {
      return false;
    }

    // School filter
    if (filterSchool !== "all" && admission.school_id !== filterSchool) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    // Determine effective sort column and direction
    const effectiveSortColumn = shouldUseDefaultSort ? "status" : (sortColumn || null);
    const effectiveSortDirection = shouldUseDefaultSort ? "asc" : (sortColumn ? sortDirection : "desc");
    
    if (!effectiveSortColumn) return 0;

    let aValue: string | number;
    let bValue: string | number;

    switch (effectiveSortColumn) {
      case "name":
        aValue = `${a.last_name}, ${a.first_name}`.toLowerCase();
        bValue = `${b.last_name}, ${b.first_name}`.toLowerCase();
        break;
      case "school_year":
        aValue = getSchoolYearLabel(a.school_year_id);
        bValue = getSchoolYearLabel(b.school_year_id);
        break;
      case "school":
        aValue = getSchoolName(a.school_id);
        bValue = getSchoolName(b.school_id);
        break;
      case "program":
        aValue = getProgramName(a.program_id);
        bValue = getProgramName(b.program_id);
        break;
      case "section":
        aValue = getSectionName(a.section_id);
        bValue = getSectionName(b.section_id);
        break;
      case "status":
        // Custom status order: pending, accepted, enrolled, rejected (rejected always last)
        const statusOrder: Record<string, number> = {
          pending: 1,
          accepted: 2,
          enrolled: 3,
          rejected: 4,
        };
        
        // If one is rejected, it always goes to bottom (regardless of sort direction)
        if (a.status === "rejected" && b.status !== "rejected") return 1;
        if (b.status === "rejected" && a.status !== "rejected") return -1;
        if (a.status === "rejected" && b.status === "rejected") return 0;
        
        // For other statuses, use the order and respect sort direction
        const aStatusOrder = statusOrder[a.status] || 999;
        const bStatusOrder = statusOrder[b.status] || 999;
        aValue = aStatusOrder;
        bValue = bStatusOrder;
        break;
      case "created_at":
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return effectiveSortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return effectiveSortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedAdmissions.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedAdmissions = filteredAndSortedAdmissions.slice(startIndex, endIndex);

  // Handle column sorting
  const handleSort = (column: string) => {
    const effectiveSortColumn = shouldUseDefaultSort ? "status" : (sortColumn || null);
    const effectiveSortDirection = shouldUseDefaultSort ? "asc" : (sortColumn ? sortDirection : "desc");
    
    if (effectiveSortColumn === column) {
      // Toggle direction if same column
      setSortDirection(effectiveSortDirection === "asc" ? "desc" : "asc");
    } else {
      // Set new column and default to ascending
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get sort icon for column header
  const getSortIcon = (column: string) => {
    const effectiveSortColumn = shouldUseDefaultSort ? "status" : (sortColumn || null);
    const effectiveSortDirection = shouldUseDefaultSort ? "asc" : (sortColumn ? sortDirection : "desc");
    const isStatusDefault = column === "status" && shouldUseDefaultSort;
    const isCurrentlySorted = effectiveSortColumn === column || isStatusDefault;
    
    if (!isCurrentlySorted) {
      return <ArrowUpDown className="size-3 ml-1 text-muted-foreground" />;
    }
    return effectiveSortDirection === "asc" ? (
      <ArrowUp className="size-3 ml-1" />
    ) : (
      <ArrowDown className="size-3 ml-1" />
    );
  };


  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { color: string; icon: ReactElement; label: string }> = {
      pending: {
        color: "text-yellow-600",
        icon: <Clock className="size-3" />,
        label: "Pending",
      },
      accepted: {
        color: "text-blue-600",
        icon: <CheckCircle className="size-3" />,
        label: "Accepted",
      },
      rejected: {
        color: "text-red-600",
        icon: <XCircle className="size-3" />,
        label: "Rejected",
      },
      enrolled: {
        color: "text-green-600",
        icon: <UserCheck className="size-3" />,
        label: "Enrolled",
      },
    };
    return statusConfig[status] || { color: "text-muted-foreground", icon: null, label: status };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Admissions</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Decision layer: Manage applicant intake and enrollment decisions
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add Admission
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-green-600">{successMessage}</div>
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

      {!error && admissions.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No admissions yet</div>
            <div className="text-sm text-muted-foreground">
              {canEdit ? "Create your first admission to get started." : "Admissions will appear here once created."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table Header with Filters */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Showing {filteredAndSortedAdmissions.length} of {admissions.length} admissions
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="w-[140px] h-9">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Statuses</SelectItem>
                  <SelectItem value="pending">Pending</SelectItem>
                  <SelectItem value="enrolled">Enrolled</SelectItem>
                  <SelectItem value="accepted">Accepted</SelectItem>
                  <SelectItem value="rejected">Rejected</SelectItem>
                </SelectContent>
              </Select>

              <Select value={filterSchoolYear} onValueChange={setFilterSchoolYear}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="School Year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All School Years</SelectItem>
                  {Array.from(allSchoolYears.values()).map((sy) => (
                    <SelectItem key={sy.id} value={sy.id}>
                      {sy.year_label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

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
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                <th 
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("name")}
                >
                  <div className="flex items-center">
                    Name
                    {getSortIcon("name")}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("school_year")}
                >
                  <div className="flex items-center">
                    School Year
                    {getSortIcon("school_year")}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("school")}
                >
                  <div className="flex items-center">
                    School
                    {getSortIcon("school")}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("program")}
                >
                  <div className="flex items-center">
                    Program
                    {getSortIcon("program")}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("section")}
                >
                  <div className="flex items-center">
                    Section
                    {getSortIcon("section")}
                  </div>
                </th>
                <th 
                  className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50 select-none"
                  onClick={() => handleSort("status")}
                >
                  <div className="flex items-center">
                    Status
                    {getSortIcon("status")}
                  </div>
                </th>
                {canEdit && (
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                )}
              </tr>
            </thead>
              <tbody>
                {paginatedAdmissions.map((admission) => (
                <tr key={admission.id} className="border-b">
                  <td className="px-4 py-3 text-sm">
                    {admission.last_name}, {admission.first_name}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {admission.school_year_id ? (
                      <span className="font-medium">{getSchoolYearLabel(admission.school_year_id)}</span>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">{getSchoolName(admission.school_id)}</td>
                  <td className="px-4 py-3 text-sm">{getProgramName(admission.program_id)}</td>
                  <td className="px-4 py-3 text-sm">
                    {admission.section_id ? (
                      getSectionName(admission.section_id)
                    ) : (
                      <span className="text-muted-foreground">Unassigned</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {(() => {
                      const statusConfig = getStatusBadge(admission.status);
                      return (
                        <span className={`flex items-center gap-1.5 ${statusConfig.color}`}>
                          {statusConfig.icon}
                          {statusConfig.label}
                        </span>
                      );
                    })()}
                  </td>
                  {canEdit && (
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {admission.status === "enrolled" ? (
                          // Enrolled admissions: Read-only, "View Student" only
                          <TooltipProvider>
                            <Tooltip>
                              <TooltipTrigger asChild>
                                {studentIdMap.has(admission.id) ? (
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => router.push(`/sis/students/${studentIdMap.get(admission.id)}`)}
                                    className="gap-1 text-green-600 hover:text-green-700"
                                  >
                                    <ExternalLink className="size-4" />
                                    View Student
                                  </Button>
                                ) : (
                                  <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                                    <UserCheck className="size-4" />
                                    Enrolled
                                  </span>
                                )}
                              </TooltipTrigger>
                              <TooltipContent>
                                <p className="text-xs">Admissions are locked after enrollment</p>
                              </TooltipContent>
                            </Tooltip>
                          </TooltipProvider>
                        ) : admission.status === "rejected" ? (
                          <div className="flex items-center gap-2">
                            <span className="text-sm text-muted-foreground">No actions available</span>
                            <TooltipProvider>
                              <Tooltip>
                                <TooltipTrigger>
                                  <Info className="size-4 text-muted-foreground" />
                                </TooltipTrigger>
                                <TooltipContent>
                                  <p className="text-xs">Rejected admissions cannot be modified</p>
                                </TooltipContent>
                              </Tooltip>
                            </TooltipProvider>
                          </div>
                        ) : admission.status === "accepted" ? (
                          // Accepted admissions: ONLY "Enroll" action
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleEnroll(admission)}
                            disabled={enrollingId === admission.id}
                            className="gap-1 text-green-600 hover:text-green-700 disabled:opacity-50"
                          >
                            {enrollingId === admission.id ? (
                              <>
                                <Loader2 className="size-4 animate-spin" />
                                Enrolling...
                              </>
                            ) : (
                              <>
                                <UserCheck className="size-4" />
                                Enroll
                              </>
                            )}
                          </Button>
                        ) : admission.status === "pending" ? (
                          // Pending admissions: Accept/Reject only (no Enroll until accepted)
                          <>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleAccept(admission.id)}
                              disabled={acceptingId === admission.id || rejectingId === admission.id || enrollingId === admission.id}
                              className="gap-1 text-blue-600 hover:text-blue-700 disabled:opacity-50"
                            >
                              {acceptingId === admission.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <CheckCircle className="size-4" />
                              )}
                              Accept
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReject(admission.id)}
                              disabled={acceptingId === admission.id || rejectingId === admission.id || enrollingId === admission.id}
                              className="gap-1 text-red-600 hover:text-red-700 disabled:opacity-50"
                            >
                              {rejectingId === admission.id ? (
                                <Loader2 className="size-4 animate-spin" />
                              ) : (
                                <XCircle className="size-4" />
                              )}
                              Reject
                            </Button>
                          </>
                        ) : null}
                      </div>
                    </td>
                  )}
                </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {filteredAndSortedAdmissions.length > itemsPerPage && (
            <div className="flex items-center justify-between border-t pt-4">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedAdmissions.length)} of {filteredAndSortedAdmissions.length} admissions
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
                  {Array.from({ length: Math.max(1, totalPages) }, (_, i) => i + 1).map((page) => {
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
                          className="min-w-[2.5rem]"
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return <span key={page} className="px-2">...</span>;
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

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add Admission</DialogTitle>
            <DialogDescription>
              Create a new admission entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {mounted && schoolYears.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="school_year_id">School Year <span className="text-destructive">*</span></Label>
                <Select
                  value={formData.school_year_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, school_year_id: value });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school year" />
                  </SelectTrigger>
                  <SelectContent>
                    {schoolYears.map((schoolYear) => (
                      <SelectItem key={schoolYear.id} value={schoolYear.id}>
                        {schoolYear.year_label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground">
                  Only school years with Planning status are available for new admissions.
                </p>
              </div>
            )}
            {mounted && schoolYears.length === 0 && (
              <div className="space-y-2">
                <Label>School Year</Label>
                <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
                  No school years with Planning status available. Please create a school year with Planning status in Calendar Settings.
                </div>
              </div>
            )}
            <div className="space-y-2">
              <Label htmlFor="first_name">First Name</Label>
              <Input
                id="first_name"
                value={formData.first_name}
                onChange={(e) =>
                  setFormData({ ...formData, first_name: e.target.value })
                }
                placeholder="Applicant first name"
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="last_name">Last Name</Label>
              <Input
                id="last_name"
                value={formData.last_name}
                onChange={(e) =>
                  setFormData({ ...formData, last_name: e.target.value })
                }
                placeholder="Applicant last name"
                required
              />
            </div>
            {mounted && schools.length > 0 && (
              <div className="space-y-2">
                <Label htmlFor="school_id">School</Label>
                <Select
                  value={formData.school_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, school_id: value, program_id: "", section_id: "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select school" />
                  </SelectTrigger>
                  <SelectContent>
                    {schools.map((school) => (
                      <SelectItem key={school.id} value={school.id}>
                        {school.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {mounted && formData.school_id && (
              <div className="space-y-2">
                <Label htmlFor="program_id">Program</Label>
                <Select
                  value={formData.program_id}
                  onValueChange={(value) => {
                    setFormData({ ...formData, program_id: value, section_id: "" });
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select program" />
                  </SelectTrigger>
                  <SelectContent>
                    {programs
                      .filter((p) => p.school_id === formData.school_id)
                      .map((program) => (
                        <SelectItem key={program.id} value={program.id}>
                          {program.name} ({program.code})
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            {mounted && formData.program_id && (
              <>
                {formSections.length > 0 ? (
                  <div className="space-y-2">
                    <Label htmlFor="section_id">Section (Optional)</Label>
                    <Select
                      value={formData.section_id}
                      onValueChange={(value) =>
                        setFormData({ ...formData, section_id: value })
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select section (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">None</SelectItem>
                        {formSections.map((section) => (
                          <SelectItem key={section.id} value={section.id}>
                            {section.name} ({section.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-sm text-muted-foreground">
                      Section assignment can be done later
                    </p>
                  </div>
                )}
              </>
            )}
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setIsDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Create
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
