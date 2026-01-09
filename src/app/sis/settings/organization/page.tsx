"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useOrganization } from "@/lib/hooks/use-organization";
import { normalizeRole } from "@/lib/rbac";

export default function OrganizationSettingsPage() {
  const { organization, isLoading, error: orgError, refetch } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [role, setRole] = useState<"principal" | "admin" | "teacher">("principal");
  const [mounted, setMounted] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    contact_number: "",
    registered_business_address: "",
    website: "",
    logo_url: "",
    tax_id: "",
    registration_number: "",
    phone: "",
    fax: "",
    description: "",
    timezone: "UTC",
    currency: "USD",
  });

  useEffect(() => {
    setMounted(true);
  }, []);

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
        if (profile?.role) {
          const normalizedRole = normalizeRole(profile.role);
          setRole(normalizedRole);
        }
      }
    };
    fetchRole();
  }, []);

  useEffect(() => {
    if (organization) {
      setFormData({
        name: organization.name || "",
        email: organization.email || "",
        contact_number: organization.contact_number || "",
        registered_business_address: organization.registered_business_address || "",
        website: organization.website || "",
        logo_url: organization.logo_url || "",
        tax_id: organization.tax_id || "",
        registration_number: organization.registration_number || "",
        phone: organization.phone || "",
        fax: organization.fax || "",
        description: organization.description || "",
        timezone: organization.timezone || "UTC",
        currency: organization.currency || "USD",
      });
    }
  }, [organization]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);
    setLoading(true);

    if (!organization) {
      setError("Organization not found.");
      setLoading(false);
      return;
    }

    // Only admins and principals can update organization settings
    if (role !== "admin" && role !== "principal") {
      setError("You do not have permission to update organization settings.");
      setLoading(false);
      return;
    }

    try {
      const { error: updateError } = await supabase
        .from("organizations")
        .update({
          name: formData.name,
          email: formData.email,
          contact_number: formData.contact_number || null,
          registered_business_address: formData.registered_business_address,
          website: formData.website || null,
          logo_url: formData.logo_url || null,
          tax_id: formData.tax_id || null,
          registration_number: formData.registration_number || null,
          phone: formData.phone || null,
          fax: formData.fax || null,
          description: formData.description || null,
          timezone: formData.timezone,
          currency: formData.currency,
        })
        .eq("id", organization.id);

      if (updateError) {
        setError(updateError.message || "Failed to update organization settings.");
        setLoading(false);
        return;
      }

      setSuccessMessage("Organization settings updated successfully.");
      setTimeout(() => setSuccessMessage(null), 3000);
      refetch();
      setLoading(false);
    } catch (err) {
      setError("An unexpected error occurred.");
      setLoading(false);
    }
  };

  if (isLoading || !mounted) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <div className="text-muted-foreground text-sm">Loading...</div>
      </div>
    );
  }

  if (orgError || !organization) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <Card>
          <CardContent className="py-4">
            <div className="text-sm text-destructive">
              {orgError || "Organization not found"}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const canEdit = role === "admin" || role === "principal";

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">Organization Settings</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Manage your organization information and settings
        </p>
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

      <Card>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Basic Information */}
            <div className="space-y-4">
              <h2 className="text-lg font-semibold">Basic Information</h2>
              
              <div className="space-y-2">
                <Label htmlFor="name">Organization Name <span className="text-destructive">*</span></Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                  disabled={!canEdit || loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">Organization Email <span className="text-destructive">*</span></Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                  disabled={!canEdit || loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  type="tel"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                  disabled={!canEdit || loading}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registered_business_address">Registered Business Address <span className="text-destructive">*</span></Label>
                <textarea
                  id="registered_business_address"
                  className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.registered_business_address}
                  onChange={(e) => setFormData({ ...formData, registered_business_address: e.target.value })}
                  required
                  disabled={!canEdit || loading}
                />
              </div>
            </div>

            {/* Additional Information */}
            <div className="space-y-4 border-t pt-4">
              <h2 className="text-lg font-semibold">Additional Information</h2>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="website">Website</Label>
                  <Input
                    id="website"
                    type="url"
                    value={formData.website}
                    onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="logo_url">Logo URL</Label>
                  <Input
                    id="logo_url"
                    type="url"
                    value={formData.logo_url}
                    onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="tax_id">Tax ID</Label>
                  <Input
                    id="tax_id"
                    value={formData.tax_id}
                    onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registration_number">Registration Number</Label>
                  <Input
                    id="registration_number"
                    value={formData.registration_number}
                    onChange={(e) => setFormData({ ...formData, registration_number: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Phone</Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="fax">Fax</Label>
                  <Input
                    id="fax"
                    type="tel"
                    value={formData.fax}
                    onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="description">Description</Label>
                <textarea
                  id="description"
                  className="flex min-h-[100px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  disabled={!canEdit || loading}
                />
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="timezone">Timezone</Label>
                  <Input
                    id="timezone"
                    value={formData.timezone}
                    onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="currency">Currency</Label>
                  <Input
                    id="currency"
                    value={formData.currency}
                    onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                    disabled={!canEdit || loading}
                  />
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="flex justify-end gap-2 border-t pt-4">
                <Button type="submit" disabled={loading}>
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
              </div>
            )}
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
