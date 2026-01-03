"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  LayoutDashboard,
  UserPlus,
  Users,
  GraduationCap,
  Calendar,
  MessageSquare,
  FileText,
  Settings,
  LogOut,
} from "lucide-react";
import { supabase } from "@/lib/supabase/client";

type Role = "principal" | "admin";

const allNavigationItems = [
  { label: "Dashboard", href: "/sis", icon: LayoutDashboard },
  { label: "Admissions", href: "/sis/admissions", icon: UserPlus },
  { label: "Batches", href: "/sis/batches", icon: Users },
  { label: "Students", href: "/sis/students", icon: GraduationCap },
  { label: "Attendance", href: "/sis/attendance", icon: Calendar },
  { label: "Communications", href: "/sis/communications", icon: MessageSquare },
  { label: "Reports", href: "/sis/reports", icon: FileText },
  { label: "Settings", href: "/sis/settings", icon: Settings },
];

export default function SISLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<Role>("principal");
  const [school, setSchool] = useState<string>("all");
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const checkSessionAndFetchRole = async () => {
      // Skip session check for auth routes
      if (pathname?.startsWith("/sis/auth")) {
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();
      if (!session) {
        router.push("/sis/auth/login");
        return;
      }

      // Fetch user profile role
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        // Default to 'principal' if profile not found
        setRole("principal");
        return;
      }

      setRole((profile.role as Role) || "principal");
    };

    checkSessionAndFetchRole();
  }, [router, pathname]);

  // Filter navigation items based on role
  const navigationItems = allNavigationItems.filter((item) => {
    if (role === "principal") {
      return true; // Show all items for principal
    }
    if (role === "admin") {
      // Hide Reports and Settings for admin
      return item.label !== "Reports" && item.label !== "Settings";
    }
    return true;
  });

  const handleLogout = async () => {
    await supabase.auth.signOut();
    await fetch("/sis/auth/logout", { method: "POST" });
    router.push("/sis/auth/login");
    router.refresh();
  };

  const isAuthRoute = pathname?.startsWith("/sis/auth");

  // Render auth pages without shell
  if (isAuthRoute) {
    return <>{children}</>;
  }

  return (
    <div className="flex min-h-screen flex-col">
      {/* Top Bar */}
      <header className="border-b bg-background">
        <div className="flex h-14 items-center justify-between gap-4 px-4 md:px-6">
          <h1 className="text-lg font-semibold">vSchool · SIS</h1>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <label htmlFor="school-select" className="text-sm font-medium">
                School:
              </label>
              {mounted && (
                <Select value={school} onValueChange={setSchool}>
                  <SelectTrigger className="w-[180px]">
                    <SelectValue className="truncate" placeholder="All Schools" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All Schools</SelectItem>
                    <SelectItem value="a">School A</SelectItem>
                    <SelectItem value="b">School B</SelectItem>
                    <SelectItem value="c">School Carlo Vittorio Fernandez Beltran</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
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
          <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible md:p-4">
            {navigationItems.map((item) => {
              const Icon = item.icon;
              return (
                <Button
                  key={item.href}
                  variant="ghost"
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

