"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { useOrganization } from "@/lib/hooks/use-organization";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";

interface Organization {
  id: string;
  name: string;
}

interface OrganizationSwitcherProps {
  selectedOrganizationId: string | null;
  onOrganizationChange: (orgId: string | null) => void;
}

export function OrganizationSwitcher({
  selectedOrganizationId,
  onOrganizationChange,
}: OrganizationSwitcherProps) {
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [organizations, setOrganizations] = useState<Organization[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Only fetch if user is confirmed to be super admin
    if (!orgLoading && isSuperAdmin) {
      fetchOrganizations();
    } else if (!orgLoading && !isSuperAdmin) {
      // Not a super admin, don't show switcher
      setLoading(false);
    }
  }, [isSuperAdmin, orgLoading]);

  const fetchOrganizations = async () => {
    try {
      setLoading(true);
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setLoading(false);
        return;
      }

      const response = await fetch("/api/admin/organizations", {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: "Unknown error" }));
        console.error("Failed to fetch organizations:", {
          status: response.status,
          statusText: response.statusText,
          error: errorData.error || "Failed to fetch organizations",
        });
        
        // If it's a 403 (Forbidden), the user might not be a super admin
        // In this case, we should just show an empty list silently
        if (response.status === 403) {
          setOrganizations([]);
          return;
        }
        
        throw new Error(errorData.error || "Failed to fetch organizations");
      }

      const data = await response.json();
      setOrganizations(data);
    } catch (err: any) {
      console.error("Error fetching organizations:", err);
      // Set empty array on error to prevent UI issues
      setOrganizations([]);
    } finally {
      setLoading(false);
    }
  };

  // Don't render if not a super admin or still loading
  if (orgLoading || loading || !isSuperAdmin) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin text-muted-foreground" />
        <span className="text-sm text-muted-foreground">Loading...</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <label htmlFor="org-switcher" className="text-sm font-medium">
        Organization:
      </label>
      <Select
        value={selectedOrganizationId || "all"}
        onValueChange={(value) => {
          onOrganizationChange(value === "all" ? null : value);
          // Store in localStorage for persistence
          if (typeof window !== "undefined") {
            if (value === "all") {
              localStorage.removeItem("superAdminSelectedOrgId");
            } else {
              localStorage.setItem("superAdminSelectedOrgId", value);
            }
          }
        }}
      >
        <SelectTrigger id="org-switcher" className="w-[200px]">
          <SelectValue placeholder="Select organization" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">View All</SelectItem>
          {organizations.map((org) => (
            <SelectItem key={org.id} value={org.id}>
              {org.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
