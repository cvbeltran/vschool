"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

interface Admission {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  status: string;
  batch_id: string | null;
}

export default function AdmissionsPage() {
  const [admissions, setAdmissions] = useState<Admission[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAdmissions = async () => {
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

    fetchAdmissions();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Admissions</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Admissions</h1>

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

