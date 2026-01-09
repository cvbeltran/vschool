"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, ExternalLink } from "lucide-react";
import { useOrganization } from "@/lib/hooks/use-organization";

interface Student {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  batch_id: string | null;
}

type Role = "principal" | "admin";

export default function StudentsPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [role, setRole] = useState<Role>("principal");

  useEffect(() => {
    const fetchData = async () => {
      if (orgLoading) return; // Wait for organization context

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

      // Fetch students - filter by organization_id unless super admin
      let query = supabase
        .from("students")
        .select("id, first_name, last_name, email, batch_id");
      
      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching students:", error);
        setLoading(false);
        return;
      }

      setStudents(data || []);
      setLoading(false);
    };

    fetchData();
  }, [organizationId, isSuperAdmin, orgLoading]);

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
        <div>
          <h1 className="text-2xl font-semibold">Students</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Identity & record layer: Manage student identity information
          </p>
        </div>
        {role === "principal" && (
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="size-4" />
            Export CSV
          </Button>
        )}
      </div>

      {students.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No students yet</div>
            <div className="text-sm text-muted-foreground">
              Students will appear here after admissions are enrolled.
            </div>
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
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody>
              {students.map((student) => (
                <tr key={student.id} className="border-b hover:bg-muted/50">
                  <td className="px-4 py-3 text-sm">
                    {student.last_name}, {student.first_name}
                  </td>
                  <td className="px-4 py-3 text-sm">{student.email || <span className="text-muted-foreground">—</span>}</td>
                  <td className="px-4 py-3 text-sm">
                    {student.batch_id || <span className="text-muted-foreground">Unassigned</span>}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/sis/students/${student.id}`)}
                      className="gap-1"
                    >
                      View
                      <ExternalLink className="size-3" />
                    </Button>
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

