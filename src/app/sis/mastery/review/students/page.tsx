"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Search, GraduationCap } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";

export default function MasteryReviewStudentsPage() {
  const router = useRouter();
  const { organizationId, isLoading: orgLoading } = useOrganization();
  const [students, setStudents] = useState<Array<{
    id: string;
    first_name: string | null;
    last_name: string | null;
    student_number: string | null;
  }>>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading || !organizationId) return;

      // Fetch user role
      const { data: { session } } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        if (profile?.role) {
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
        }
      }

      // Fetch students that the teacher has context with
      // For now, fetch all students in the organization
      // In the future, this could be filtered by teacher-student relationships
      let query = supabase
        .from("students")
        .select("id, first_name, last_name, student_number")
        .eq("organization_id", organizationId)
        .order("first_name");

      const { data, error } = await query;
      if (error) {
        console.error("Error fetching students", error);
      } else {
        setStudents(data || []);
      }

      setLoading(false);
    };

    fetchData();
  }, [organizationId, orgLoading]);

  const filteredStudents = students.filter((student) => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    const fullName = `${student.first_name || ""} ${student.last_name || ""}`.toLowerCase();
    const studentNumber = student.student_number?.toLowerCase() || "";
    return fullName.includes(query) || studentNumber.includes(query);
  });

  const handleStudentSelect = (studentId: string) => {
    router.push(`/sis/mastery/review/students/${studentId}`);
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Mastery Review</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Mastery Review</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Select a student to review and submit mastery proposals
        </p>
      </div>

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
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
          </div>

          {filteredStudents.length > 0 ? (
            <div className="max-h-96 overflow-y-auto border rounded-md">
              {filteredStudents.map((student) => (
                <div
                  key={student.id}
                  className="p-4 hover:bg-muted cursor-pointer border-b last:border-b-0 transition-colors"
                  onClick={() => handleStudentSelect(student.id)}
                >
                  <div className="flex items-center gap-3">
                    <GraduationCap className="h-5 w-5 text-muted-foreground" />
                    <div className="flex-1">
                      <p className="font-medium">
                        {student.first_name} {student.last_name}
                      </p>
                      {student.student_number && (
                        <p className="text-sm text-muted-foreground">
                          Student #: {student.student_number}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8 text-muted-foreground">
              {searchQuery ? "No students found matching your search." : "No students available."}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
