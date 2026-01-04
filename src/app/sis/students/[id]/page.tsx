"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft } from "lucide-react";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string | null;
  admission_id: string | null;
  created_at: string;
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

interface Admission {
  id: string;
  first_name: string;
  last_name: string;
  status: string;
  school_id: string | null;
  program_id: string | null;
  section_id: string | null;
}

export default function StudentDetailPage() {
  const params = useParams();
  const router = useRouter();
  const studentId = params.id as string;
  
  const [student, setStudent] = useState<Student | null>(null);
  const [school, setSchool] = useState<School | null>(null);
  const [program, setProgram] = useState<Program | null>(null);
  const [section, setSection] = useState<Section | null>(null);
  const [admission, setAdmission] = useState<Admission | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!studentId) {
        setError("Student ID is required");
        setLoading(false);
        return;
      }

      // INVARIANT: Students MUST have admission_id for traceability
      // Fail fast if admission_id column doesn't exist - schema mismatch
      const { data: studentData, error: studentError } = await supabase
        .from("students")
        .select(`
          id,
          first_name,
          last_name,
          email,
          admission_id,
          created_at
        `)
        .eq("id", studentId)
        .single();

      if (studentError) {
        // Fail fast if admission_id column doesn't exist - schema mismatch
        if ((studentError.code === "42703" || studentError.code === "PGRST204") && 
            studentError.message?.includes("admission_id")) {
          setError("Database schema mismatch: admission_id column required. Please run migration: ALTER TABLE students ADD COLUMN admission_id UUID REFERENCES admissions(id);");
        } else {
          console.error("Error fetching student:", studentError);
          setError(studentError.message || "Failed to fetch student.");
        }
        setLoading(false);
        return;
      }

      if (!studentData) {
        setError("Student not found");
        setLoading(false);
        return;
      }

      setStudent(studentData);

      // INVARIANT: Student views derive context ONLY from admission via admission_id
      // Removed invalid assumption: name-based matching violates traceability
      if (!studentData.admission_id) {
        // Legacy record without admission_id - cannot derive context
        // This is acceptable for display, but context will be missing
        setLoading(false);
        return;
      }

      // Fetch admission via admission_id to get school/program/section
      const { data: admissionData, error: admissionError } = await supabase
        .from("admissions")
        .select("id, first_name, last_name, status, school_id, program_id, section_id")
        .eq("id", studentData.admission_id)
        .single();

      if (admissionError) {
        console.error("Error fetching admission:", admissionError);
        setError(`Failed to fetch admission: ${admissionError.message}`);
        setLoading(false);
        return;
      }

      if (!admissionData) {
        setError("Admission not found for this student.");
        setLoading(false);
        return;
      }

      setAdmission(admissionData);

      // Fetch school if school_id exists in admission
      if (admissionData.school_id) {
        const { data: schoolData, error: schoolError } = await supabase
          .from("schools")
          .select("id, name")
          .eq("id", admissionData.school_id)
          .single();

        if (!schoolError && schoolData) {
          setSchool(schoolData);
        }
      }

      // Fetch program if program_id exists in admission
      if (admissionData.program_id) {
        const { data: programData, error: programError } = await supabase
          .from("programs")
          .select("id, name")
          .eq("id", admissionData.program_id)
          .single();

        if (!programError && programData) {
          setProgram(programData);
        }
      }

      // Fetch section if section_id exists in admission
      if (admissionData.section_id) {
        const { data: sectionData, error: sectionError } = await supabase
          .from("sections")
          .select("id, name")
          .eq("id", admissionData.section_id)
          .single();

        if (!sectionError && sectionData) {
          setSection(sectionData);
        }
      }

      setLoading(false);
    };

    fetchData();
  }, [studentId]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Student Details</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (error || !student) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Button variant="ghost" onClick={() => router.back()}>
            <ArrowLeft className="size-4 mr-2" />
            Back
          </Button>
          <h1 className="text-2xl font-semibold">Student Details</h1>
        </div>
        <Card>
          <CardContent className="py-8 text-center text-destructive">
            {error || "Student not found"}
          </CardContent>
        </Card>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Button variant="ghost" onClick={() => router.back()}>
          <ArrowLeft className="size-4 mr-2" />
          Back
        </Button>
        <h1 className="text-2xl font-semibold">Student Details</h1>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Identity</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground">Name</div>
            <div className="text-lg font-medium">
              {student.last_name}, {student.first_name}
            </div>
          </div>
          {student.email && (
            <div>
              <div className="text-sm text-muted-foreground">Email</div>
              <div className="text-lg">{student.email}</div>
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Current Enrollment</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <div className="text-sm text-muted-foreground mb-1">School</div>
            <div className="text-lg">
              {school ? (
                school.name
              ) : student.admission_id ? (
                <span className="text-muted-foreground">Unknown</span>
              ) : (
                <span className="text-muted-foreground italic">Legacy record (no admission reference)</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Program</div>
            <div className="text-lg">
              {program ? (
                program.name
              ) : student.admission_id ? (
                <span className="text-muted-foreground">Unknown</span>
              ) : (
                <span className="text-muted-foreground italic">Legacy record (no admission reference)</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Section</div>
            <div className="text-lg">
              {section ? (
                section.name
              ) : (
                <span className="text-muted-foreground italic">Unassigned</span>
              )}
            </div>
          </div>
          <div>
            <div className="text-sm text-muted-foreground mb-1">Enrolled Date</div>
            <div className="text-lg">{formatDate(student.created_at)}</div>
          </div>
          {admission && (
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                Enrollment details are derived from the admission record. To modify enrollment, update the admission record.
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {admission ? (
        <Card>
          <CardHeader>
            <CardTitle>Admission Reference</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <div className="text-sm text-muted-foreground mb-1">Admission ID</div>
              <div className="text-lg font-mono text-sm break-all">{admission.id}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground mb-1">Status</div>
              <div className="text-lg capitalize">{admission.status}</div>
            </div>
            <div className="pt-2 border-t">
              <div className="text-xs text-muted-foreground">
                This student was enrolled from admission. Enrollment details are derived from the admission record and cannot be modified here.
              </div>
            </div>
          </CardContent>
        </Card>
      ) : student.admission_id ? (
        <Card>
          <CardHeader>
            <CardTitle>Admission Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground">
              Admission record not found. This may indicate a data inconsistency.
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>Admission Reference</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-sm text-muted-foreground italic">
              Legacy record: No admission reference available. This student was created before the admission tracking system was implemented.
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

