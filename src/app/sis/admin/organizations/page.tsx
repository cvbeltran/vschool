"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { useOrganization } from "@/lib/hooks/use-organization";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { Loader2, ArrowLeft, Plus } from "lucide-react";
import Link from "next/link";

interface OrganizationFormData {
  name: string;
  email: string;
  contact_number: string;
  registered_business_address: string;
  website: string;
  tax_id: string;
  registration_number: string;
  phone: string;
  fax: string;
  description: string;
  timezone: string;
  currency: string;
  is_active: boolean;
}

export default function OrganizationsPage() {
  const router = useRouter();
  const { isSuperAdmin, isLoading: orgLoading } = useOrganization();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [formData, setFormData] = useState<OrganizationFormData>({
    name: "",
    email: "",
    contact_number: "",
    registered_business_address: "",
    website: "",
    tax_id: "",
    registration_number: "",
    phone: "",
    fax: "",
    description: "",
    timezone: "Asia/Manila",
    currency: "PHP",
    is_active: true,
  });

  useEffect(() => {
    if (!orgLoading && !isSuperAdmin) {
      router.push("/sis");
      return;
    }
  }, [isSuperAdmin, orgLoading, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessMessage(null);

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session) {
        setError("No active session");
        setLoading(false);
        return;
      }

      // Prepare data (remove empty strings, convert to null)
      const submitData: any = {
        name: formData.name,
        email: formData.email,
        registered_business_address: formData.registered_business_address,
        timezone: formData.timezone,
        currency: formData.currency,
        is_active: formData.is_active,
      };

      // Add optional fields only if they have values
      if (formData.contact_number) submitData.contact_number = formData.contact_number;
      if (formData.website) submitData.website = formData.website;
      if (formData.tax_id) submitData.tax_id = formData.tax_id;
      if (formData.registration_number) submitData.registration_number = formData.registration_number;
      if (formData.phone) submitData.phone = formData.phone;
      if (formData.fax) submitData.fax = formData.fax;
      if (formData.description) submitData.description = formData.description;

      const response = await fetch("/api/admin/organizations", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${session.access_token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(submitData),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to create organization");
      }

      setSuccessMessage("Organization created successfully!");
      setIsDialogOpen(false);
      // Reset form
      setFormData({
        name: "",
        email: "",
        contact_number: "",
        registered_business_address: "",
        website: "",
        tax_id: "",
        registration_number: "",
        phone: "",
        fax: "",
        description: "",
        timezone: "Asia/Manila",
        currency: "PHP",
        is_active: true,
      });
      // Redirect to admin dashboard
      router.push("/sis/admin");
    } catch (err: any) {
      console.error("Error creating organization:", err);
      setError(err.message || "Failed to create organization");
    } finally {
      setLoading(false);
    }
  };

  if (orgLoading) {
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
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/sis/admin">
            <ArrowLeft className="mr-2 size-4" />
            Back
          </Link>
        </Button>
        <div>
          <h1 className="text-2xl font-semibold">Create Organization</h1>
          <p className="text-muted-foreground">Add a new organization to the system</p>
        </div>
      </div>

      {error && (
        <div className="rounded-lg border border-destructive bg-destructive/10 p-4 text-destructive">
          {error}
        </div>
      )}

      {successMessage && (
        <div className="rounded-lg border border-green-500 bg-green-500/10 p-4 text-green-700 dark:text-green-400">
          {successMessage}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle>Organization Details</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="name">
                  Organization Name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  value={formData.email}
                  onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="contact_number">Contact Number</Label>
                <Input
                  id="contact_number"
                  value={formData.contact_number}
                  onChange={(e) => setFormData({ ...formData, contact_number: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="website">Website</Label>
                <Input
                  id="website"
                  type="url"
                  value={formData.website}
                  onChange={(e) => setFormData({ ...formData, website: e.target.value })}
                />
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="registered_business_address">
                  Registered Business Address <span className="text-destructive">*</span>
                </Label>
                <Textarea
                  id="registered_business_address"
                  value={formData.registered_business_address}
                  onChange={(e) =>
                    setFormData({ ...formData, registered_business_address: e.target.value })
                  }
                  required
                  rows={3}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="tax_id">Tax ID</Label>
                <Input
                  id="tax_id"
                  value={formData.tax_id}
                  onChange={(e) => setFormData({ ...formData, tax_id: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="registration_number">Registration Number</Label>
                <Input
                  id="registration_number"
                  value={formData.registration_number}
                  onChange={(e) =>
                    setFormData({ ...formData, registration_number: e.target.value })
                  }
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="phone">Phone</Label>
                <Input
                  id="phone"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="fax">Fax</Label>
                <Input
                  id="fax"
                  value={formData.fax}
                  onChange={(e) => setFormData({ ...formData, fax: e.target.value })}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="timezone">Timezone</Label>
                <Select
                  value={formData.timezone}
                  onValueChange={(value) => setFormData({ ...formData, timezone: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Asia/Manila">Asia/Manila (PHT)</SelectItem>
                    <SelectItem value="UTC">UTC</SelectItem>
                    <SelectItem value="America/New_York">America/New_York (EST)</SelectItem>
                    <SelectItem value="Europe/London">Europe/London (GMT)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label htmlFor="currency">Currency</Label>
                <Select
                  value={formData.currency}
                  onValueChange={(value) => setFormData({ ...formData, currency: value })}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="PHP">PHP (Philippine Peso)</SelectItem>
                    <SelectItem value="USD">USD (US Dollar)</SelectItem>
                    <SelectItem value="EUR">EUR (Euro)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="description">Description</Label>
                <Textarea
                  id="description"
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  rows={3}
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-4 pt-4">
              <Button type="button" variant="outline" asChild>
                <Link href="/sis/admin">Cancel</Link>
              </Button>
              <Button type="submit" disabled={loading}>
                {loading && <Loader2 className="mr-2 size-4 animate-spin" />}
                Create Organization
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
