"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";

type Role = "principal" | "admin" | "registrar";

// Normalize role (registrar = admin)
function normalizeRole(role: string | null): "principal" | "admin" {
  if (role === "principal") return "principal";
  return "admin"; // admin, registrar, or any other role
}

// Role capabilities (matches layout.tsx)
const roleCapabilities: Record<
  "principal" | "admin",
  { canViewSettings: boolean }
> = {
  principal: { canViewSettings: true },
  admin: { canViewSettings: true },
};

export default function SettingsPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const checkAccess = async () => {
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

        // Check access
        if (!roleCapabilities[normalizedRole].canViewSettings) {
          router.push("/sis");
          return;
        }
      }
      setLoading(false);
      // Redirect to schools page (default settings page)
      router.push("/sis/settings/schools");
    };

    checkAccess();
  }, [router]);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Settings</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return null;
}