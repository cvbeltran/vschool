"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useOrganization } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { KPICard } from "@/components/sis/kpi-card";
import { Loader2, ArrowLeft, Edit, Trash2, Power, PowerOff } from "lucide-react";
import Link from "next/link";

interface Organization {
  id: string;
  name: string;
  email: string;
  contact_number: string | null;
  registered_business_address: string;
  website: string | null;
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
  user_count: number;
  student_count: number;
  school_count: number;
  staff_count: number;
}

export default function OrganizationDetailPage() {
  const router = useRouter();
  const params = useParams();
  const orgId = params.id as string;
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [organization, setOrganization] = useState<Organization | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) {
      router.push("/sis");
      return;
    }

    if (isSuperAdmin && orgId) {
      fetchOrganization();
    }
  }, [isSuperAdmin, orgLoading, orgId, router]);

  const fetchOrganization = async () => {
    try {
      setLoading(true);
      setError(null);

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("No active session");
        setLoading(false);
        return;
      }

      const response = await fetch(`/api/admin/organizations/${orgId}`, {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      });

      if (!response.ok) {
        if (response.status === 404) {
          setError("Organization not found");
        } else {
          throw new Error("Failed to fetch organization");
        }
        setLoading(false);
        return;
      }

      const data = await response.json();
      setOrganization(data);
    } catch (err: any) {
      console.error("Error fetching organization:", err);
      setError(err.message || "Failed to load organization");
    } finally {
      setLoading(false);
    }
  };

  const handleToggleActive = async () => {
    if (!organization) return;

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
        body: JSON.stringify({ is_active: !organization.is_active }),
      });

      if (!response.ok) {
        throw new Error("Failed to update organization");
      }

      // Refresh data
      await fetchOrganization();
    } catch (err: any) {
      console.error("Error updating organization:", err);
      setError(err.message || "Failed to update organization");
    }
  };

  const handleDelete = async () => {
    if (!organization) return;

    if (
      !confirm(
        `Are you sure you want to delete "${organization.name}"? This action cannot be undone.`
      )
    ) {
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

      // Redirect to admin dashboard
      router.push("/sis/admin");
    } catch (err: any) {
      console.error("Error deleting organization:", err);
      setError(err.message || "Failed to delete organization");
    }
  };

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

  if (error && !organization) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sis/admin">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      </div>
    );
  }

  if (!organization) {
    return null;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="sm" asChild>
            <Link href="/sis/admin">
              <ArrowLeft className="mr-2 size-4" />
              Back
            </Link>
          </Button>
          <div>
            <h1 className="text-2xl font-semibold">{organization.name}</h1>
            <p className="text-muted-foreground">Organization details and statistics</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant={organization.is_active ? "default" : "secondary"}>
            {organization.is_active ? "Active" : "Inactive"}
          </Badge>
          <Button variant="outline" size="sm" onClick={handleToggleActive}>
            {organization.is_active ? (
              <>
                <PowerOff className="mr-2 size-4" />
                Deactivate
              </>
            ) : (
              <>
                <Power className="mr-2 size-4" />
                Activate
              </>
            )}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handleDelete}
            className="text-destructive hover:text-destructive"
          >
            <Trash2 className="mr-2 size-4" />
            Delete
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {/* Statistics */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-4">
        <KPICard title="Users" value={organization.user_count} />
        <KPICard title="Students" value={organization.student_count} />
        <KPICard title="Schools" value={organization.school_count} />
        <KPICard title="Staff" value={organization.staff_count} />
      </div>

      {/* Organization Details */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Contact Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">Email</div>
              <div>{organization.email}</div>
            </div>
            {organization.contact_number && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Contact Number</div>
                <div>{organization.contact_number}</div>
              </div>
            )}
            {organization.phone && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Phone</div>
                <div>{organization.phone}</div>
              </div>
            )}
            {organization.fax && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Fax</div>
                <div>{organization.fax}</div>
              </div>
            )}
            {organization.website && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Website</div>
                <a
                  href={organization.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:underline"
                >
                  {organization.website}
                </a>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Business Information</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div>
              <div className="text-sm font-medium text-muted-foreground">
                Registered Business Address
              </div>
              <div>{organization.registered_business_address}</div>
            </div>
            {organization.tax_id && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Tax ID</div>
                <div>{organization.tax_id}</div>
              </div>
            )}
            {organization.registration_number && (
              <div>
                <div className="text-sm font-medium text-muted-foreground">Registration Number</div>
                <div>{organization.registration_number}</div>
              </div>
            )}
            <div>
              <div className="text-sm font-medium text-muted-foreground">Timezone</div>
              <div>{organization.timezone}</div>
            </div>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Currency</div>
              <div>{organization.currency}</div>
            </div>
          </CardContent>
        </Card>
      </div>

      {organization.description && (
        <Card>
          <CardHeader>
            <CardTitle>Description</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-sm">{organization.description}</p>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle>System Information</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <div className="text-sm font-medium text-muted-foreground">Created</div>
            <div>{new Date(organization.created_at).toLocaleString()}</div>
          </div>
          <div>
            <div className="text-sm font-medium text-muted-foreground">Last Updated</div>
            <div>{new Date(organization.updated_at).toLocaleString()}</div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
