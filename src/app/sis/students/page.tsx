"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  batch_id: string | null;
}

type Role = "principal" | "admin";

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("principal");

  useEffect(() => {
    const fetchData = async () => {
      // Fetch user role
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
          setRole((profile.role as Role) || "principal");
        }
      }

      // Fetch students
      const { data, error } = await supabase
        .from("students")
        .select("id, first_name, last_name, email, batch_id")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching students:", error);
        setLoading(false);
        return;
      }

      setStudents(data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Students</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const handleExport = () => {
    window.location.href = "/sis/students/export";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Students</h1>
        {role === "principal" && (
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="size-4" />
            Export CSV
          </Button>
        )}
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No students yet
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Email
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Batch
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b">
                  <td className="px-4 py-3 text-sm">
                    {student.last_name}, {student.first_name}
                  </td>
                  <td className="px-4 py-3 text-sm">{student.email}</td>
                  <td className="px-4 py-3 text-sm">
                    {student.batch_id || "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

