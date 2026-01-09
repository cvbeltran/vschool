"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Search, ArrowUpDown, ArrowUp, ArrowDown, ChevronLeft, ChevronRight, Loader2, ExternalLink } from "lucide-react";
import { normalizeRole, canPerform } from "@/lib/rbac";
import { useRouter } from "next/navigation";
import { useOrganization } from "@/lib/hooks/use-organization";

interface Staff {
  id: string;
  user_id: string | null;
  staff_id: string;
  first_name: string;
  middle_name: string | null;
  last_name: string;
  suffix: string | null;
  email_address: string;
  mobile_number: string | null;
  created_at: string;
  // Joined data
  position_title_id?: string | null;
  department_id?: string | null;
  school_id?: string | null;
}

interface PositionTitle {
  id: string;
  code: string;
  label: string;
}

interface Department {
  id: string;
  label: string;
}

interface School {
  id: string;
  name: string;
}

export default function StaffPage() {
  const router = useRouter();
  const { organizationId, isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [staff, setStaff] = useState<Staff[]>([]);
  const [positionTitles, setPositionTitles] = useState<PositionTitle[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [originalRole, setOriginalRole] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage] = useState(10);
  
  // Search and filter state
  const [searchQuery, setSearchQuery] = useState("");
  const [filterPosition, setFilterPosition] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterSchool, setFilterSchool] = useState<string>("all");
  
  // Sorting state
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<"asc" | "desc">("desc");
  
  // Form data
  const [formData, setFormData] = useState({
    email: "",
    first_name: "",
    middle_name: "",
    last_name: "",
    suffix: "",
    position_title_id: "",
  });

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
          setOriginalRole(profile.role);
        }
      }

      // Fetch position titles
      const { data: positionTaxonomy } = await supabase
        .from("taxonomies")
        .select("id")
        .eq("key", "position_title")
        .single();

      if (positionTaxonomy) {
        const { data: positionData } = await supabase
          .from("taxonomy_items")
          .select("id, code, label")
          .eq("taxonomy_id", positionTaxonomy.id)
          .order("sort_order", { ascending: true });

        if (positionData) {
          setPositionTitles(positionData.map((item: any) => ({
            id: item.id,
            code: item.code,
            label: item.label,
          })));
        }
      }

      // Fetch departments
      const { data: deptTaxonomy } = await supabase
        .from("taxonomies")
        .select("id")
        .eq("key", "department")
        .single();

      if (deptTaxonomy) {
        const { data: deptData } = await supabase
          .from("taxonomy_items")
          .select("id, label")
          .eq("taxonomy_id", deptTaxonomy.id)
          .order("sort_order", { ascending: true });

        if (deptData) {
          setDepartments(deptData.map((item: any) => ({
            id: item.id,
            label: item.label,
          })));
        }
      }

      // Fetch schools - filter by organization_id unless super admin
      let schoolsQuery = supabase
        .from("schools")
        .select("id, name");
      
      if (!isSuperAdmin && organizationId) {
        schoolsQuery = schoolsQuery.eq("organization_id", organizationId);
      }
      
      const { data: schoolsData } = await schoolsQuery.order("name", { ascending: true });

      if (schoolsData) {
        setSchools(schoolsData);
      }

      // Fetch staff with employment data
      await fetchStaff();
    };

    if (!orgLoading) {
      fetchData();
    }
  }, [organizationId, isSuperAdmin, orgLoading]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, filterPosition, filterDepartment, filterSchool]);

  const fetchStaff = async () => {
    try {
      let query = supabase
        .from("staff")
        .select(`
          id,
          user_id,
          staff_id,
          first_name,
          middle_name,
          last_name,
          suffix,
          email_address,
          mobile_number,
          created_at,
          staff_employment (
            position_title_id,
            department_id,
            school_id
          )
        `);
      
      if (!isSuperAdmin && organizationId) {
        query = query.eq("organization_id", organizationId);
      }
      
      const { data, error } = await query.order("created_at", { ascending: false });

      if (error) {
        console.error("Error fetching staff:", error);
        setError(error.message || "Failed to fetch staff.");
        setLoading(false);
        return;
      }

      // Transform data to flatten employment info
      const transformedData = (data || []).map((s: any) => {
        const employment = Array.isArray(s.staff_employment) && s.staff_employment.length > 0
          ? s.staff_employment[0]
          : null;
        
        return {
          ...s,
          position_title_id: employment?.position_title_id || null,
          department_id: employment?.department_id || null,
          school_id: employment?.school_id || null,
        };
      });

      setStaff(transformedData);
      setError(null);
    } catch (err: any) {
      console.error("Error:", err);
      setError(err.message || "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const getPositionTitleLabel = (positionTitleId: string | null) => {
    if (!positionTitleId) return "—";
    const position = positionTitles.find((p) => p.id === positionTitleId);
    return position ? position.label : "Unknown";
  };

  const getDepartmentLabel = (departmentId: string | null) => {
    if (!departmentId) return "—";
    const dept = departments.find((d) => d.id === departmentId);
    return dept ? dept.label : "Unknown";
  };

  const getSchoolName = (schoolId: string | null) => {
    if (!schoolId) return "—";
    const school = schools.find((s) => s.id === schoolId);
    return school ? school.name : "Unknown";
  };

  const handleCreate = () => {
    setFormData({
      email: "",
      first_name: "",
      middle_name: "",
      last_name: "",
      suffix: "",
      position_title_id: "",
    });
    setIsDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setCreating(true);

    try {
      // Get user's organization_id
      const {
        data: { session },
      } = await supabase.auth.getSession();
      
      let organizationId: string | null = null;
      if (session) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", session.user.id)
          .single();
        organizationId = profile?.organization_id || null;
      }

      if (!organizationId) {
        setError("User is not associated with an organization.");
        setCreating(false);
        return;
      }

      const response = await fetch("/sis/staff/create", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          first_name: formData.first_name,
          middle_name: formData.middle_name || null,
          last_name: formData.last_name,
          suffix: formData.suffix || null,
          position_title_id: formData.position_title_id,
          organization_id: organizationId,
        }),
      });

      const result = await response.json();

      if (!response.ok) {
        setError(result.error || "Failed to create staff member");
        setCreating(false);
        return;
      }

      setSuccessMessage(result.message || "Staff member created successfully");
      setIsDialogOpen(false);
      await fetchStaff();
    } catch (err: any) {
      console.error("Error creating staff:", err);
      setError(err.message || "Failed to create staff member");
    } finally {
      setCreating(false);
    }
  };

  // Filter, search, and sort staff
  const filteredAndSortedStaff = staff.filter((member) => {
    // Search filter (name or email)
    if (searchQuery) {
      const fullName = `${member.first_name} ${member.middle_name || ""} ${member.last_name} ${member.suffix || ""}`.toLowerCase();
      const email = member.email_address.toLowerCase();
      if (!fullName.includes(searchQuery.toLowerCase()) && !email.includes(searchQuery.toLowerCase())) {
        return false;
      }
    }

    // Position filter
    if (filterPosition !== "all" && member.position_title_id !== filterPosition) {
      return false;
    }

    // Department filter
    if (filterDepartment !== "all" && member.department_id !== filterDepartment) {
      return false;
    }

    // School filter
    if (filterSchool !== "all" && member.school_id !== filterSchool) {
      return false;
    }

    return true;
  }).sort((a, b) => {
    if (!sortColumn) return 0;

    let aValue: string | number;
    let bValue: string | number;

    switch (sortColumn) {
      case "name":
        aValue = `${a.last_name}, ${a.first_name}`.toLowerCase();
        bValue = `${b.last_name}, ${b.first_name}`.toLowerCase();
        break;
      case "staff_id":
        aValue = a.staff_id;
        bValue = b.staff_id;
        break;
      case "email":
        aValue = a.email_address.toLowerCase();
        bValue = b.email_address.toLowerCase();
        break;
      case "position":
        aValue = getPositionTitleLabel(a.position_title_id);
        bValue = getPositionTitleLabel(b.position_title_id);
        break;
      case "department":
        aValue = getDepartmentLabel(a.department_id);
        bValue = getDepartmentLabel(b.department_id);
        break;
      case "school":
        aValue = getSchoolName(a.school_id);
        bValue = getSchoolName(b.school_id);
        break;
      case "created_at":
        aValue = new Date(a.created_at).getTime();
        bValue = new Date(b.created_at).getTime();
        break;
      default:
        return 0;
    }

    if (aValue < bValue) return sortDirection === "asc" ? -1 : 1;
    if (aValue > bValue) return sortDirection === "asc" ? 1 : -1;
    return 0;
  });

  // Pagination calculations
  const totalPages = Math.ceil(filteredAndSortedStaff.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const endIndex = startIndex + itemsPerPage;
  const paginatedStaff = filteredAndSortedStaff.slice(startIndex, endIndex);

  // Handle column sorting
  const handleSort = (column: string) => {
    if (sortColumn === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortColumn(column);
      setSortDirection("asc");
    }
  };

  // Get sort icon for column header
  const getSortIcon = (column: string) => {
    if (sortColumn !== column) {
      return <ArrowUpDown className="size-3 ml-1 text-muted-foreground" />;
    }
    return sortDirection === "asc" ? (
      <ArrowUp className="size-3 ml-1" />
    ) : (
      <ArrowDown className="size-3 ml-1" />
    );
  };

  const formatDate = (dateString: string) => {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
      });
    } catch {
      return "—";
    }
  };

  const canEdit = canPerform(role, "create", "staff", originalRole);

  if (loading) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Staff</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Staff</h1>
          <p className="text-sm text-muted-foreground mt-1">
            HR Management: Manage staff members and their information
          </p>
        </div>
        {canEdit && (
          <Button onClick={handleCreate} className="gap-2">
            <Plus className="size-4" />
            Add Staff
          </Button>
        )}
      </div>

      {error && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">{error}</div>
          </CardContent>
        </Card>
      )}

      {successMessage && (
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-green-600">{successMessage}</div>
          </CardContent>
        </Card>
      )}

      {/* Search Bar */}
      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 size-4 text-muted-foreground" />
        <Input
          placeholder="Search by name or email..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-9"
        />
      </div>

      {!error && staff.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <div className="text-muted-foreground mb-2">No staff members yet</div>
            <div className="text-sm text-muted-foreground">
              {canEdit ? "Create your first staff member to get started." : "Staff members will appear here once created."}
            </div>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Table Header with Filters */}
          <div className="flex items-center justify-between mb-2">
            <div className="text-sm text-muted-foreground">
              Showing {filteredAndSortedStaff.length} of {staff.length} staff members
            </div>
            <div className="flex items-center gap-2">
              <Select value={filterPosition} onValueChange={setFilterPosition}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Position" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Positions</SelectItem>
                  {positionTitles.map((position) => (
                    <SelectItem key={position.id} value={position.id}>
                      {position.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterDepartment} onValueChange={setFilterDepartment}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="Department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Departments</SelectItem>
                  {departments.map((dept) => (
                    <SelectItem key={dept.id} value={dept.id}>
                      {dept.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={filterSchool} onValueChange={setFilterSchool}>
                <SelectTrigger className="w-[160px] h-9">
                  <SelectValue placeholder="School" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Schools</SelectItem>
                  {schools.map((school) => (
                    <SelectItem key={school.id} value={school.id}>
                      {school.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full border-collapse">
              <thead>
                <tr className="border-b">
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("staff_id")}
                  >
                    <div className="flex items-center">
                      Staff ID
                      {getSortIcon("staff_id")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("name")}
                  >
                    <div className="flex items-center">
                      Name
                      {getSortIcon("name")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("email")}
                  >
                    <div className="flex items-center">
                      Email
                      {getSortIcon("email")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("position")}
                  >
                    <div className="flex items-center">
                      Position
                      {getSortIcon("position")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("department")}
                  >
                    <div className="flex items-center">
                      Department
                      {getSortIcon("department")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("school")}
                  >
                    <div className="flex items-center">
                      School
                      {getSortIcon("school")}
                    </div>
                  </th>
                  <th 
                    className="px-4 py-3 text-left text-sm font-medium cursor-pointer hover:bg-muted/50"
                    onClick={() => handleSort("created_at")}
                  >
                    <div className="flex items-center">
                      Created
                      {getSortIcon("created_at")}
                    </div>
                  </th>
                  <th className="px-4 py-3 text-left text-sm font-medium">Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStaff.map((member) => {
                  const fullName = `${member.last_name}, ${member.first_name}${member.middle_name ? ` ${member.middle_name}` : ""}${member.suffix ? ` ${member.suffix}` : ""}`;
                  
                  return (
                    <tr key={member.id} className="border-b">
                      <td className="px-4 py-3 text-sm font-mono">{member.staff_id}</td>
                      <td className="px-4 py-3 text-sm">{fullName}</td>
                      <td className="px-4 py-3 text-sm">{member.email_address}</td>
                      <td className="px-4 py-3 text-sm">
                        {getPositionTitleLabel(member.position_title_id)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getDepartmentLabel(member.department_id)}
                      </td>
                      <td className="px-4 py-3 text-sm">
                        {getSchoolName(member.school_id)}
                      </td>
                      <td className="px-4 py-3 text-sm">{formatDate(member.created_at)}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => router.push(`/sis/staff/${member.id}`)}
                          className="gap-1"
                        >
                          <ExternalLink className="size-3" />
                          View
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div className="text-sm text-muted-foreground">
                Page {currentPage} of {totalPages}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                >
                  <ChevronLeft className="size-4" />
                  Previous
                </Button>
                <div className="flex items-center gap-1">
                  {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => {
                    if (
                      page === 1 ||
                      page === totalPages ||
                      (page >= currentPage - 1 && page <= currentPage + 1)
                    ) {
                      return (
                        <Button
                          key={page}
                          variant={currentPage === page ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                          className="w-9"
                        >
                          {page}
                        </Button>
                      );
                    } else if (page === currentPage - 2 || page === currentPage + 2) {
                      return (
                        <span key={page} className="px-2 text-muted-foreground">
                          ...
                        </span>
                      );
                    }
                    return null;
                  })}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                >
                  Next
                  <ChevronRight className="size-4" />
                </Button>
              </div>
            </div>
          )}
        </>
      )}

      {/* Create Staff Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Add Staff Member</DialogTitle>
            <DialogDescription>
              Create a new staff member account. A verification email will be sent to the provided email address.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit}>
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email Address *</Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  placeholder="staff@example.com"
                />
                <p className="text-xs text-muted-foreground">
                  Verification email will be sent to this address
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="first_name">First Name *</Label>
                  <Input
                    id="first_name"
                    value={formData.first_name}
                    onChange={(e) => setFormData({ ...formData, first_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="middle_name">Middle Name</Label>
                  <Input
                    id="middle_name"
                    value={formData.middle_name}
                    onChange={(e) => setFormData({ ...formData, middle_name: e.target.value })}
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="last_name">Last Name *</Label>
                  <Input
                    id="last_name"
                    value={formData.last_name}
                    onChange={(e) => setFormData({ ...formData, last_name: e.target.value })}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="suffix">Suffix</Label>
                  <Input
                    id="suffix"
                    value={formData.suffix}
                    onChange={(e) => setFormData({ ...formData, suffix: e.target.value })}
                    placeholder="Jr., Sr., II, III"
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="position_title_id">Position/Role *</Label>
                <Select
                  value={formData.position_title_id}
                  onValueChange={(value) => setFormData({ ...formData, position_title_id: value })}
                  required
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Select position" />
                  </SelectTrigger>
                  <SelectContent>
                    {positionTitles.map((position) => (
                      <SelectItem key={position.id} value={position.id}>
                        {position.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {error && (
                <div className="text-sm text-destructive bg-destructive/10 p-3 rounded">
                  {error}
                </div>
              )}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsDialogOpen(false)}
                disabled={creating}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={creating}>
                {creating && <Loader2 className="size-4 mr-2 animate-spin" />}
                Create Staff
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
