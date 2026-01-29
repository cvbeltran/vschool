"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Plus, Search } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { listPortfolioItems, type PortfolioArtifact } from "@/lib/phase6/portfolio";
import { normalizeRole } from "@/lib/rbac";
import { useOrganization } from "@/lib/hooks/use-organization";

interface StudentInfo {
  id: string;
  first_name: string | null;
  last_name: string | null;
  student_number: string | null;
}

export default function MyPortfolioPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [artifacts, setArtifacts] = useState<PortfolioArtifact[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isStudent, setIsStudent] = useState<boolean | null>(null);
  const [role, setRole] = useState<"student" | "teacher" | "admin" | "principal" | null>(null);
  const [viewingStudentId, setViewingStudentId] = useState<string | null>(null);
  const [viewingStudent, setViewingStudent] = useState<StudentInfo | null>(null);
  const [students, setStudents] = useState<StudentInfo[]>([]);
  const [studentSearch, setStudentSearch] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return; // Wait for organization context
      
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        
        if (!session) {
          setError("Please log in to access your portfolio");
          setIsStudent(false);
          setLoading(false);
          return;
        }

        // Get user role from profile
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, organization_id")
          .eq("id", session.user.id)
          .single();

        if (!profile) {
          setError("Profile not found");
          setIsStudent(false);
          setLoading(false);
          return;
        }

        const normalizedRole = normalizeRole(profile.role || "");
        setRole(normalizedRole);

        // Check for student query parameter
        const studentParam = searchParams.get("student");
        
        // Clear viewing student if no param
        if (!studentParam) {
          setViewingStudentId(null);
          setViewingStudent(null);
        }
        
        // If teacher/admin with student param, view that student's portfolio
        if ((normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "principal") && studentParam) {
          setViewingStudentId(studentParam);
          setIsStudent(false);
          
          // Fetch student info
          let studentQuery = supabase
            .from("students")
            .select("id, first_name, last_name, student_number")
            .eq("id", studentParam);
          
          if (organizationId) {
            studentQuery = studentQuery.eq("organization_id", organizationId);
          }
          
          const { data: student, error: studentError } = await studentQuery.single();
          
          if (studentError) {
            console.error("Error fetching student:", studentError);
            setError("Student not found");
            setArtifacts([]);
            setLoading(false);
            return;
          }
          
          if (student) {
            setViewingStudent(student);
            const data = await listPortfolioItems({
              scope: "student",
              studentId: studentParam,
            });
            setArtifacts(data);
            setError(null);
          } else {
            setError("Student not found");
            setArtifacts([]);
          }
          setLoading(false);
          return;
        }

        // If teacher/admin without student param, fetch students list for selector
        if ((normalizedRole === "teacher" || normalizedRole === "admin" || normalizedRole === "principal") && !studentParam) {
          setIsStudent(false);
          setError(null);
          setArtifacts([]);
          
          // Fetch students for selector - use organizationId from hook
          if (organizationId) {
            const { data: studentsData, error: studentsError } = await supabase
              .from("students")
              .select("id, first_name, last_name, student_number")
              .eq("organization_id", organizationId)
              .order("first_name")
              .limit(500);
            
            if (studentsError) {
              console.error("Error fetching students:", studentsError);
              setError("Failed to load students list");
            } else if (studentsData) {
              setStudents(studentsData);
              if (studentsData.length === 0) {
                setError("No students found in your organization");
              }
            }
          } else {
            setError("Organization context not available");
          }
          
          setLoading(false);
          return;
        }

        // For students: try to match student by email
        const { data: user } = await supabase.auth.getUser();
        let studentFound = false;
        let currentStudentId: string | null = null;
        
        if (user?.user?.email && organizationId) {
          const { data: student } = await supabase
            .from("students")
            .select("id, first_name, last_name, student_number")
            .eq("primary_email", user.user.email)
            .eq("organization_id", organizationId)
            .maybeSingle();
          
          if (student) {
            studentFound = true;
            currentStudentId = student.id;
            setViewingStudentId(student.id);
            setViewingStudent(student);
          }
        }

        if (!studentFound) {
          setIsStudent(false);
          setError(null);
          setLoading(false);
          return;
        }

        setIsStudent(true);
        const data = await listPortfolioItems({
          scope: "self",
        });
        setArtifacts(data);
        setError(null);
      } catch (err: any) {
        console.error("Error fetching portfolio artifacts:", err);
        if (err.message?.includes("Student ID not found")) {
          setIsStudent(false);
          setError(null);
        } else {
          setError(err.message || "Failed to load portfolio artifacts");
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [searchParams, organizationId, orgLoading]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">
          {viewingStudent ? `${viewingStudent.first_name} ${viewingStudent.last_name}'s Portfolio` : "My Portfolio"}
        </h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  // Filter students by search
  const filteredStudents = students.filter((student) => {
    if (viewingStudentId && student.id === viewingStudentId) {
      return false; // Don't show selected student in search results
    }
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.toLowerCase();
    const studentNumber = student.student_number?.toLowerCase() || "";
    const search = studentSearch.toLowerCase();
    return fullName.includes(search) || studentNumber.includes(search);
  });

  const handleStudentSelect = (studentId: string | null) => {
    // Clear viewing student state immediately
    setViewingStudentId(null);
    setViewingStudent(null);
    setArtifacts([]);
    
    if (studentId) {
      router.push(`/sis/phase6/portfolio/my?student=${studentId}`);
    } else {
      // Use replace to avoid adding to history
      router.replace(`/sis/phase6/portfolio/my`);
    }
  };

  // Show student selector if teacher/admin without student selected
  if (isStudent === false && !viewingStudentId && (role === "teacher" || role === "admin" || role === "principal")) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Portfolio</h1>
        
        {/* Student Selector */}
        <Card>
          <CardHeader>
            <CardTitle>Select Student</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Search Students</Label>
              <div className="relative">
                <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Search by name or student number..."
                  value={studentSearch}
                  onChange={(e) => setStudentSearch(e.target.value)}
                  className="pl-8"
                />
              </div>
            </div>
            {filteredStudents.length > 0 && (
              <div className="max-h-60 overflow-y-auto border rounded-md">
                {filteredStudents.map((student) => (
                  <div
                    key={student.id}
                    className="p-3 hover:bg-muted cursor-pointer border-b last:border-b-0"
                    onClick={() => handleStudentSelect(student.id)}
                  >
                    <p className="font-medium">
                      {student.first_name} {student.last_name}
                    </p>
                    {student.student_number && (
                      <p className="text-sm text-muted-foreground">
                        Student #: {student.student_number}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            )}
            {filteredStudents.length === 0 && studentSearch && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No students found matching "{studentSearch}"
              </p>
            )}
            {filteredStudents.length === 0 && !studentSearch && students.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                No students found in your organization. Please ensure students are enrolled.
              </p>
            )}
            {filteredStudents.length === 0 && !studentSearch && students.length > 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">
                Start typing to search for students, or use a link from a lesson log, attendance session, or progress monitoring page.
              </p>
            )}
          </CardContent>
        </Card>
      </div>
    );
  }

  // Show message for non-student users who aren't teachers/admins
  if (isStudent === false && !viewingStudentId && role !== "teacher" && role !== "admin" && role !== "principal") {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">My Portfolio</h1>
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              This page is only available for students. Please ensure your account is linked to a student record.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  const pageTitle = viewingStudent
    ? `${viewingStudent.first_name} ${viewingStudent.last_name}'s Portfolio${viewingStudent.student_number ? ` (${viewingStudent.student_number})` : ""}`
    : "My Portfolio";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">{pageTitle}</h1>
        {isStudent && (
          <Button onClick={() => router.push("/sis/phase6/portfolio/my/new")}>
            <Plus className="mr-2 h-4 w-4" />
            Create Artifact
          </Button>
        )}
        {!isStudent && viewingStudentId && (
          <Button variant="outline" onClick={() => handleStudentSelect(null)}>
            Select Different Student
          </Button>
        )}
      </div>

      {error && (
        <div className="text-sm text-destructive bg-destructive/10 border border-destructive/20 rounded-md p-3">
          {error}
        </div>
      )}

      {artifacts.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">
              {isStudent
                ? "No portfolio artifacts found. Create your first artifact to get started."
                : viewingStudent
                ? `No portfolio artifacts found for ${viewingStudent.first_name} ${viewingStudent.last_name}.`
                : "No portfolio artifacts found."}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
          {artifacts.map((artifact) => (
            <Card key={artifact.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <p className="font-medium">{artifact.title}</p>
                      <Badge variant="outline" className="text-xs">
                        {artifact.artifact_type}
                      </Badge>
                    </div>
                    {artifact.description && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {artifact.description}
                      </p>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const detailUrl = viewingStudentId
                        ? `/sis/phase6/portfolio/my/${artifact.id}?student=${viewingStudentId}`
                        : `/sis/phase6/portfolio/my/${artifact.id}`;
                      router.push(detailUrl);
                    }}
                  >
                    View
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
