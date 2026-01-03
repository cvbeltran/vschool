"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download } from "lucide-react";

interface Admission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  batch_id: string | null;
}

type Role = "principal" | "admin";

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
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

      // Fetch admissions
      const { data, error } = await supabase
        .from("admissions")
        .select("id, first_name, last_name, email, status, batch_id")
        .order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching admissions:", error);
        setLoading(false);
        return;
      }

      setAdmissions(data || []);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Admissions</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const handleExport = () => {
    window.location.href = "/sis/admissions/export";
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold">Admissions</h1>
        {role === "principal" && (
          <Button onClick={handleExport} variant="outline" className="gap-2">
            <Download className="size-4" />
            Export CSV
          </Button>
        )}
      </div>

      {admissions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No admissions yet
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
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Batch
                </th>
              </tr>
            </thead>
            <tbody>
              {admissions.map((admission) => (
                <tr key={admission.id} className="border-b">
                  <td className="px-4 py-3 text-sm">
                    {admission.last_name}, {admission.first_name}
                  </td>
                  <td className="px-4 py-3 text-sm">{admission.email}</td>
                  <td className="px-4 py-3 text-sm">{admission.status}</td>
                  <td className="px-4 py-3 text-sm">
                    {admission.batch_id || "—"}
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

