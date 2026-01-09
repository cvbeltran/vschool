"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { useOrganization } from "@/lib/hooks/use-organization";

interface Batch {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export default function BatchesPage() {
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [batches, setBatches] = useState<Batch[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchBatches = async () => {
      if (orgLoading) return; // Wait for organization context
      
      let query = supabase
        .from("batches")
        .select("id, name, status, start_date, end_date");
      
      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching batches:", error);
        setLoading(false);
        return;
      }

      setBatches(data || []);
      setLoading(false);
    };

    if (!orgLoading) {
      fetchBatches();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  const formatDateRange = (startDate: string | null, endDate: string | null) => {
    if (!startDate && !endDate) {
      return "—";
    }
    if (startDate && endDate) {
      const start = new Date(startDate).toLocaleDateString();
      const end = new Date(endDate).toLocaleDateString();
      return `${start} - ${end}`;
    }
    if (startDate) {
      return `${new Date(startDate).toLocaleDateString()} - —`;
    }
    return `— - ${new Date(endDate!).toLocaleDateString()}`;
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Batches</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Batches</h1>

      {batches.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No batches yet
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
                  Status
                </th>
                <th className="px-4 py-3 text-left text-sm font-medium">
                  Date Range
                </th>
              </tr>
            </thead>
            <tbody>
              {batches.map((batch) => (
                <tr key={batch.id} className="border-b">
                  <td className="px-4 py-3 text-sm">{batch.name}</td>
                  <td className="px-4 py-3 text-sm">{batch.status}</td>
                  <td className="px-4 py-3 text-sm">
                    {formatDateRange(batch.start_date, batch.end_date)}
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

