"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase/client";

export interface Organization {
  id: string;
  name: string;
  email: string;
  contact_number: string | null;
  registered_business_address: string;
  website: string | null;
  logo_url: string | null;
  tax_id: string | null;
  registration_number: string | null;
  phone: string | null;
  fax: string | null;
  description: string | null;
  timezone: string;
  currency: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface UseOrganizationResult {
  organization: Organization | null;
  organizationId: string | null;
  isLoading: boolean;
  error: string | null;
  isSuperAdmin: boolean;
  selectedOrganizationId: string | null; // For super admin context switching
  setSelectedOrganizationId: (orgId: string | null) => void;
  refetch: () => Promise<void>;
}

/**
 * Hook to get current user's organization context
 * 
 * Returns:
 * - organization: Full organization data
 * - organizationId: Organization ID (for quick access)
 * - isLoading: Loading state
 * - error: Error message if any
 * - isSuperAdmin: Whether user is a super admin (can access all organizations)
 * - refetch: Function to refetch organization data
 */
export function useOrganization(): UseOrganizationResult {
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [organizationId, setOrganizationId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSuperAdmin, setIsSuperAdmin] = useState(false);
  const [selectedOrganizationId, setSelectedOrganizationIdState] = useState<string | null>(null);

  // Load selected organization ID from localStorage on mount (for super admin)
  useEffect(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem("superAdminSelectedOrgId");
      if (stored) {
        setSelectedOrganizationIdState(stored);
      }
    }
  }, []);

  const setSelectedOrganizationId = (orgId: string | null) => {
    setSelectedOrganizationIdState(orgId);
    if (typeof window !== "undefined") {
      if (orgId) {
        localStorage.setItem("superAdminSelectedOrgId", orgId);
      } else {
        localStorage.removeItem("superAdminSelectedOrgId");
      }
    }
  };

  const fetchOrganization = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Get current session
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("No active session");
        setIsLoading(false);
        return;
      }

      // Get user profile with organization_id and is_super_admin
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("organization_id, is_super_admin")
        .eq("id", session.user.id)
        .single();

      if (profileError || !profile) {
        setError("Failed to load user profile");
        setIsLoading(false);
        return;
      }

      // Check if super admin
      const superAdmin = profile.is_super_admin === true;
      setIsSuperAdmin(superAdmin);

      // If super admin, they can optionally select an organization context
      if (superAdmin) {
        // Load selected organization from localStorage if available
        if (typeof window !== "undefined") {
          const stored = localStorage.getItem("superAdminSelectedOrgId");
          if (stored) {
            setSelectedOrganizationIdState(stored);
            // Optionally fetch the selected organization for display
            const { data: selectedOrg } = await supabase
              .from("organizations")
              .select("*")
              .eq("id", stored)
              .single();
            if (selectedOrg) {
              setOrganization(selectedOrg as Organization);
              setOrganizationId(stored);
            }
          }
        }
        setIsLoading(false);
        return;
      }

      // Get organization_id from profile
      const orgId = profile.organization_id;
      setOrganizationId(orgId);

      if (!orgId) {
        setError("User is not associated with an organization");
        setIsLoading(false);
        return;
      }

      // Fetch organization data
      const { data: orgData, error: orgError } = await supabase
        .from("organizations")
        .select("*")
        .eq("id", orgId)
        .single();

      if (orgError || !orgData) {
        setError("Failed to load organization");
        setIsLoading(false);
        return;
      }

      setOrganization(orgData as Organization);
      setIsLoading(false);
    } catch (err) {
      console.error("Error fetching organization:", err);
      setError("An unexpected error occurred");
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchOrganization();
  }, []);

  // When super admin selects an organization, fetch its data
  useEffect(() => {
    if (isSuperAdmin && selectedOrganizationId) {
      const fetchSelectedOrg = async () => {
        const { data: selectedOrg, error: orgError } = await supabase
          .from("organizations")
          .select("*")
          .eq("id", selectedOrganizationId)
          .single();
        
        if (!orgError && selectedOrg) {
          setOrganization(selectedOrg as Organization);
          setOrganizationId(selectedOrganizationId);
        } else {
          setOrganization(null);
          setOrganizationId(null);
        }
      };
      
      fetchSelectedOrg();
    } else if (isSuperAdmin && !selectedOrganizationId) {
      // Clear organization when "View All" is selected
      setOrganization(null);
      setOrganizationId(null);
    }
  }, [isSuperAdmin, selectedOrganizationId]);

  return {
    organization,
    organizationId: isSuperAdmin && selectedOrganizationId ? selectedOrganizationId : organizationId,
    isLoading,
    error,
    isSuperAdmin,
    selectedOrganizationId,
    setSelectedOrganizationId,
    refetch: fetchOrganization,
  };
}
