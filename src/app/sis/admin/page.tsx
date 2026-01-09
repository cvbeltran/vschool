"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useOrganization } from "@/lib/hooks/use-organization";
import { KPICard } from "@/components/sis/kpi-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Building2,
  Users,
  GraduationCap,
  School,
  Briefcase,
  Plus,
  Search,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Edit,
  Trash2,
  Power,
  PowerOff,
} from "lucide-react";
import Link from "next/link";

interface SystemStats {
  totalOrganizations: number;
  totalUsers: number;
  totalStudents: number;
  totalSchools: number;
  totalStaff: number;
  activeOrganizations: number;
  inactiveOrganizations: number;
}

interface Organization {
  id: string;
  name: string;
  email: string;
  contact_number: string | null;
  is_active: boolean;
  created_at: string;
  user_count: number;
  student_count: number;
  school_count: number;
}

export default function SuperAdminPage() {
  const router = useRouter();
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [stats, setStats] = useState<SystemStats | null>(null);
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  const [sortColumn, setSortColumn] = useState<string | null>("created_at");
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");

  useEffect(() => {
    // Redirect if not super admin
    if (!orgLoading && !isSuperAdmin) {
      router.push("/sis");
      return;
    }

    if (isSuperAdmin) {
      fetchData();
    }
  }, [isSuperAdmin, orgLoading, router]);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      // Get access token
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("No active session");
        setLoading(false);
        return;
      }

      // Fetch stats
      const statsResponse = await fetch("/api/admin/stats", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!statsResponse.ok) {
        throw new Error("Failed to fetch statistics");
      }

      const statsData = await statsResponse.json();
      setStats(statsData);

      // Fetch organizations
      const orgsResponse = await fetch("/api/admin/organizations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!orgsResponse.ok) {
        throw new Error("Failed to fetch organizations");
      }

      const orgsData = await orgsResponse.json();
      setOrganizations(orgsData);
    } catch (err: any) {
      console.error("Error fetching data:", err);
      setError(err.message || "Failed to load data");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async (orgId: string, currentStatus: boolean) => {
    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("No active session");
        return;
      }

      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ is_active: !currentStatus }),
      });

      if (!response.ok) {
        throw new Error("Failed to update organization");
      }

      // Refresh data
      await fetchData();
    } catch (err: any) {
      console.error("Error updating organization:", err);
      setError(err.message || "Failed to update organization");
    }
  };

  const handleDelete = async (orgId: string, orgName: string) => {
    if (!confirm(`Are you sure you want to delete "${orgName}"? This action cannot be undone.`)) {
      return;
    }

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("No active session");
        return;
      }

      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Failed to delete organization");
      }

      // Refresh data
      await fetchData();
    } catch (err: any) {
      console.error("Error deleting organization:", err);
      setError(err.message || "Failed to delete organization");
    }
  };

  // Filter and sort organizations
  const filteredAndSortedOrgs = organizations
    .filter((org) => {
      // Search filter
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        if (
          !org.name.toLowerCase().includes(query) &&
          !org.email.toLowerCase().includes(query) &&
          !(org.contact_number?.toLowerCase().includes(query) ?? false)
        ) {
          return false;
        }
      }

      // Status filter
      if (filterStatus === "active" && !org.is_active) return false;
      if (filterStatus === "inactive" && org.is_active) return false;

      return true;
    })
    .sort((a, b) => {
      if (!sortColumn) return 0;

      let aValue: string | number;
      let bValue: string | number;

      switch (sortColumn) {
        case "name":
          aValue = a.name.toLowerCase();
          bValue = b.name.toLowerCase();
          break;
        case "email":
          aValue = a.email.toLowerCase();
          bValue = b.email.toLowerCase();
          break;
        case "created_at":
          aValue = new Date(a.created_at).getTime();
          bValue = new Date(b.created_at).getTime();
          break;
        case "user_count":
          aValue = a.user_count;
          bValue = b.user_count;
          break;
        default:
          return 0;
      }

      if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
      if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedOrgs.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedOrgs = filteredAndSortedOrgs.slice(startIndex, endIndex);

  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterStatus]);

  if (orgLoading || loading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!isSuperAdmin) {
    return null; // Will redirect
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Super Admin Dashboard</h1>
          <p className="text-muted-foreground">System-wide management and statistics</p>
        </div>
        <Button asChild>
          <Link href="/sis/admin/organizations">
            <Plus className="mr-2 size-4" />
            Create Organization
          </Link>
        </Button>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Statistics Section */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          <KPICard
            title="Total Organizations"
            value={stats.totalOrganizations}
            description={`${stats.activeOrganizations} active, ${stats.inactiveOrganizations} inactive`}
          />
          <KPICard title="Total Users" value={stats.totalUsers} />
          <KPICard title="Total Students" value={stats.totalStudents} />
          <KPICard title="Total Schools" value={stats.totalSchools} />
        </div>
      )}

      {/* Organizations List Section */}
      <Card>
        <CardHeader>
          <CardTitle>Organizations</CardTitle>
        </CardHeader>
        <CardContent>
          {/* Search and Filters */}
          <div className="mb-4 flex flex-col gap-4 md:flex-row md:items-center">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search organizations..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="w-full md:w-[180px]">
                <SelectValue placeholder="All Status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Status</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="inactive">Inactive</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Organizations Table */}
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b">
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                    onClick={() => handleSort("name")}
                  >
                    Name
                  </th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                    onClick={() => handleSort("email")}
                  >
                    Email
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Contact</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Status</th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                    onClick={() => handleSort("user_count")}
                  >
                    Users
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Students</th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Schools</th>
                  <th
                    className="cursor-pointer px-4 py-3 text-left text-sm font-medium"
                    onClick={() => handleSort("created_at")}
                  >
                    Created
                  </th>
                  <th className="px-4 py-3 text-right text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedOrgs.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="px-4 py-8 text-center text-muted-foreground">
                      No organizations found
                    </td>
                  </tr>
                ) : (
                  paginatedOrgs.map((org) => (
                    <tr key={org.id} className="border-b hover:bg-muted/50">
                      <td className="px-4 py-3 font-medium">{org.name}</td>
                      <td className="px-4 py-3 text-sm">{org.email}</td>
                      <td className="px-4 py-3 text-sm">{org.contact_number || "-"}</td>
                      <td className="px-4 py-3">
                        <Badge variant={org.is_active ? "default" : "secondary"}>
                          {org.is_active ? "Active" : "Inactive"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 text-sm">{org.user_count}</td>
                      <td className="px-4 py-3 text-sm">{org.student_count}</td>
                      <td className="px-4 py-3 text-sm">{org.school_count}</td>
                      <td className="px-4 py-3 text-sm">
                        {new Date(org.created_at).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="sm"
                            asChild
                            title="View Details"
                          >
                            <Link href={`/sis/admin/organizations/${org.id}`}>
                              <ExternalLink className="size-4" />
                            </Link>
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleToggleActive(org.id, org.is_active)}
                            title={org.is_active ? "Deactivate" : "Activate"}
                          >
                            {org.is_active ? (
                              <PowerOff className="size-4" />
                            ) : (
                              <Power className="size-4" />
                            )}
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleDelete(org.id, org.name)}
                            title="Delete"
                            className="text-destructive hover:text-destructive"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="mt-4 flex items-center justify-between">
              <div className="text-sm text-muted-foreground">
                Showing {startIndex + 1} to {Math.min(endIndex, filteredAndSortedOrgs.length)} of{" "}
                {filteredAndSortedOrgs.length} organizations
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4" />
                </Button>
                <div className="text-sm">
                  Page {currentPage} of {totalPages}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                  disabled={currentPage === totalPages}
                >
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
