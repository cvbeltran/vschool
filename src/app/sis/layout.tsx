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
import { LogOut, ChevronDown, ChevronRight } from "lucide-react";
import { supabase } from "@/lib/supabase/client";
import { normalizeRole } from "@/lib/rbac";
import { getSidebarForRole, type NormalizedRole } from "@/lib/sidebar-config";
import { useOrganization } from "@/lib/hooks/use-organization";
import { OrganizationSwitcher } from "@/components/admin/organization-switcher";

export default function SISLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [school, setSchool] = useState<string>("all");
  const [mounted, setMounted] = useState(false);
  const { organization, isLoading: orgLoading, isSuperAdmin, selectedOrganizationId, setSelectedOrganizationId } = useOrganization();
  const [collapsedSections, setCollapsedSections] = useState<Set<number>>(new Set());

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

      // Fetch user profile role and super admin status
      const { data: profile, error } = await supabase
        .from("profiles")
        .select("role, is_super_admin")
        .eq("id", session.user.id)
        .single();

      if (error || !profile) {
        // Default to 'principal' if profile not found
        setRole("principal");
        return;
      }

      // Normalize role (registrar = admin)
      const normalizedRole = normalizeRole(profile.role);
      setRole(normalizedRole as "principal" | "admin" | "teacher");
    };

    checkSessionAndFetchRole();
  }, [router, pathname]);

  // Get filtered sidebar config for current role and super admin status
  const sidebarSections = getSidebarForRole(role, isSuperAdmin || false);

  // Initialize collapsed sections based on defaultCollapsed
  useEffect(() => {
    const initialCollapsed = new Set<number>();
    sidebarSections.forEach((section, index) => {
      if (section.collapsible && section.defaultCollapsed) {
        initialCollapsed.add(index);
      }
    });
    setCollapsedSections(initialCollapsed);
  }, [role, isSuperAdmin]); // Re-initialize when role or super admin status changes

  const toggleSection = (index: number) => {
    setCollapsedSections((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(index)) {
        newSet.delete(index);
      } else {
        newSet.add(index);
      }
      return newSet;
    });
  };

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
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold">vSchool · SIS</h1>
            {!orgLoading && (
              <>
                {isSuperAdmin ? (
                  <span className="text-sm text-muted-foreground">· Super Admin</span>
                ) : organization ? (
                  <span className="text-sm text-muted-foreground">· {organization.name}</span>
                ) : null}
              </>
            )}
          </div>
          <div className="flex items-center gap-4">
            {isSuperAdmin && !orgLoading && (
              <OrganizationSwitcher
                selectedOrganizationId={selectedOrganizationId}
                onOrganizationChange={setSelectedOrganizationId}
              />
            )}
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
          <nav className="flex flex-row gap-1 overflow-x-auto p-2 md:flex-col md:overflow-x-visible md:p-4 md:gap-1">
            {sidebarSections.map((section, sectionIndex) => {
              const isCollapsed = collapsedSections.has(sectionIndex);
              const isCollapsible = section.collapsible && section.label;
              
              return (
                <div key={sectionIndex} className="space-y-1">
                  {section.label && (
                    <div
                      className={`px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1 ${
                        isCollapsible ? "cursor-pointer hover:text-foreground transition-colors" : ""
                      }`}
                      onClick={() => isCollapsible && toggleSection(sectionIndex)}
                    >
                      {isCollapsible && (
                        <span className="flex items-center">
                          {isCollapsed ? (
                            <ChevronRight className="size-3" />
                          ) : (
                            <ChevronDown className="size-3" />
                          )}
                        </span>
                      )}
                      {section.label}
                    </div>
                  )}
                  {!isCollapsed && section.items.map((item) => {
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
                </div>
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

