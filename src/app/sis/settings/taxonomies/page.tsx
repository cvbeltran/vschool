"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Settings, Info } from "lucide-react";
import { normalizeRole } from "@/lib/rbac";

interface Taxonomy {
  id: string;
  key: string;
  name: string;
  description: string | null;
  is_active: boolean;
  is_system: boolean;
  created_at: string;
}

export default function TaxonomiesPage() {
  const router = useRouter();
  const [taxonomies, setTaxonomies] = useState<Taxonomy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");

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
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
        }
      }

      // Fetch taxonomies
      const { data, error: fetchError } = await supabase
        .from("taxonomies")
        .select("id, key, name, description, is_active, is_system, created_at")
        .order("name", { ascending: true });

      if (fetchError) {
        // Log error details explicitly
        console.error("Error fetching taxonomies:", fetchError);
        console.error("Error message:", fetchError.message);
        console.error("Error code:", fetchError.code);
        console.error("Error details:", fetchError.details);
        console.error("Error hint:", fetchError.hint);
        
        // Distinguish between schema mismatch and table not found
        if (fetchError.code === "42703") {
          setError("Schema mismatch: Column does not exist. Please check that the taxonomies table has the expected columns.");
        } else if (fetchError.code === "42P01") {
          setError("Taxonomies table not found. Please run the SQL schema file (supabase_taxonomies_schema.sql) in your Supabase database.");
        } else {
          setError(fetchError.message || "Failed to fetch taxonomies. Please check your permissions.");
        }
        setLoading(false);
        return;
      }

      setTaxonomies(data || []);
      setError(null);
      setLoading(false);
    };

    fetchData();
  }, []);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Taxonomies</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  const getStatusBadge = (isActive: boolean) => {
    return isActive ? (
      <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
        Active
      </span>
    ) : (
      <span className="inline-flex items-center rounded-full bg-gray-100 px-2.5 py-0.5 text-xs font-medium text-gray-800">
        Inactive
      </span>
    );
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Taxonomies</h1>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {!error && taxonomies.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            No taxonomies available yet
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse">
            <thead>
              <tr className="border-b">
                <th className="px-4 py-3 text-left text-sm font-medium">Name</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Description</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
              </tr>
            </thead>
            <tbody>
              {taxonomies.map((taxonomy) => (
                <tr key={taxonomy.id} className="border-b">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{taxonomy.name}</span>
                      {taxonomy.is_system && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-800">
                          <Info className="size-3" />
                          System
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">
                    {taxonomy.description || "—"}
                  </td>
                  <td className="px-4 py-3 text-sm">{getStatusBadge(taxonomy.is_active)}</td>
                  <td className="px-4 py-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/sis/settings/taxonomies/${taxonomy.key}`)}
                      className="gap-1"
                    >
                      <Settings className="size-4" />
                      Manage
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
