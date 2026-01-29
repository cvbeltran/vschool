"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { studentSidebarConfig } from "@/lib/student-sidebar-config";

export default function StudentLayoutClient({
  children,
  mustResetPassword,
}: {
  children: React.ReactNode;
  mustResetPassword: boolean;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const verifyStudentRole = async () => {
      // Skip verification for auth routes
      if (pathname?.startsWith("/student/login") || pathname?.startsWith("/student/reset-password")) {
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        router.replace("/student/login");
        return;
      }

      // Verify user is a student
      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (!profile || profile.role !== "student") {
        // Not a student, redirect to staff login
        router.replace("/sis/auth/login");
        return;
      }

      // CRITICAL: Re-check must_reset_password flag from database
      // The server-side prop might be stale if user just logged in and cleared the flag
      // Only redirect to reset-password if:
      // 1. Flag is still true in database
      // 2. User is NOT coming from a normal login (has valid session with password auth)
      // 3. User is coming from invite flow (check URL params)
      const { data: student } = await supabase
        .from("students")
        .select("must_reset_password")
        .eq("profile_id", session.user.id)
        .single();

      if (student?.must_reset_password === true) {
        // Check if this is from invite flow (has code/type in URL) or normal login
        const urlParams = new URLSearchParams(window.location.search);
        const hash = window.location.hash;
        const isFromInvite = urlParams.has('code') || urlParams.has('type') || 
                             (hash && hash.includes('type=invite'));
        
        if (isFromInvite) {
          // Coming from invite email - redirect to reset-password
          if (pathname !== "/student/reset-password") {
            router.replace("/student/reset-password");
          }
        } else {
          // Normal login - they've proven they have a password, clear the flag
          // This handles the case where the flag wasn't cleared during login
          await supabase
            .from("students")
            .update({ 
              must_reset_password: false,
              last_login_at: new Date().toISOString()
            })
            .eq("profile_id", session.user.id);
          
          // Don't redirect if already on dashboard
          if (pathname === "/student/reset-password") {
            router.replace("/student/dashboard");
          }
        }
      }
    };

    verifyStudentRole();
  }, [mustResetPassword, pathname, router]);

  const handleLogout = async () => {
    await supabase.auth.signOut();
    // Clear any cached session data
    await supabase.auth.getSession();
    // Use replace instead of push to avoid back button issues
    router.replace("/student/login");
  };

  // Don't show sidebar on login/reset-password pages
  const isAuthRoute = pathname?.startsWith("/student/login") || pathname?.startsWith("/student/reset-password");

  if (isAuthRoute) {
    return <>{children}</>;
  }

  // Wait for client-side mount to prevent hydration mismatch
  if (!mounted) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Bar */}
      <header className="border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">vSchool · Student Portal</h1>
          </div>
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="sm"
              onClick={handleLogout}
              className="gap-2"
            >
              <LogOut className="size-4" />
              <span>Logout</span>
            </Button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col md:flex-row">
        {/* Sidebar */}
        <aside className="w-full border-b bg-muted/40 md:w-64 md:border-b-0 md:border-r">
          <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible md:p-4 md:gap-1">
            {studentSidebarConfig.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href || pathname?.startsWith(item.href + "/");
              return (
                <Button
                  key={item.href}
                  variant={isActive ? "secondary" : "ghost"}
                  className="w-full justify-start gap-2 md:w-full"
                  asChild
                >
                  <Link href={item.href}>
                    <Icon className="size-4 shrink-0" />
                    <span className="whitespace-nowrap">{item.label}</span>
                  </Link>
                </Button>
              );
            })}
          </nav>
        </aside>

        {/* Main Content */}
        <main className="flex-1 p-4 md:p-6">{children}</main>
      </div>
    </div>
  );
}
