"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";

type Role = "principal" | "admin" | "registrar";

// Normalize role (registrar = admin)
function normalizeRole(role: string | null): "principal" | "admin" {
  if (role === "principal") return "principal";
  return "admin"; // admin, registrar, or any other role
}

// Role capabilities (matches layout.tsx)
const roleCapabilities: Record<
  "principal" | "admin",
  { canViewReports: boolean }
> = {
  principal: { canViewReports: true },
  admin: { canViewReports: false },
};

export default function ReportsPage() {
  const router = useRouter();
  const [role, setRole] = useState<"principal" | "admin">("principal");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchRole = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();
        const normalizedRole = normalizeRole(profile?.role || null);
        setRole(normalizedRole);

        // Check access
        if (!roleCapabilities[normalizedRole].canViewReports) {
          router.push("/sis");
          return;
        }
      }
      setLoading(false);
    };

    fetchRole();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Reports</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold">Reports</h1>
      <Card>
        <CardContent className="py-8 text-center text-muted-foreground">
          Reports coming soon
        </CardContent>
      </Card>
    </div>
  );
}

