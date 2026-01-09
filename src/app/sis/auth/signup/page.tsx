"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";

export default function SignupPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    // User account fields
    email: "",
    password: "",
    confirmPassword: "",
    // Organization fields
    organizationName: "",
    organizationEmail: "",
    contactNumber: "",
    registeredBusinessAddress: "",
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    // Validation
    if (!formData.email || !formData.password || !formData.confirmPassword) {
      setError("Please fill in all user account fields.");
      setLoading(false);
      return;
    }

    if (formData.password !== formData.confirmPassword) {
      setError("Passwords do not match.");
      setLoading(false);
      return;
    }

    if (formData.password.length < 8) {
      setError("Password must be at least 8 characters long.");
      setLoading(false);
      return;
    }

    if (!formData.organizationName || !formData.organizationEmail || !formData.registeredBusinessAddress) {
      setError("Please fill in all organization fields.");
      setLoading(false);
      return;
    }

    try {
      const response = await fetch("/api/auth/signup", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: formData.email,
          password: formData.password,
          organizationName: formData.organizationName,
          organizationEmail: formData.organizationEmail,
          contactNumber: formData.contactNumber || null,
          registeredBusinessAddress: formData.registeredBusinessAddress,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setError(data.error || "Failed to create account. Please try again.");
        setLoading(false);
        return;
      }

      // Success - redirect to login with message to check email
      router.push("/sis/auth/login?message=Account created successfully! Please check your email to confirm your account before signing in.");
    } catch (err) {
      setError("An unexpected error occurred. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-2xl space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">vSchool · SIS</h1>
          <p className="text-muted-foreground text-sm">Create your account and organization</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-6">
              {/* User Account Section */}
              <div className="space-y-4">
                <h2 className="text-lg font-semibold">User Account</h2>
                
                <div className="space-y-2">
                  <Label htmlFor="email">Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="email"
                    type="email"
                    placeholder="email@example.com"
                    value={formData.email}
                    onChange={(e) =>
                      setFormData({ ...formData, email: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password">Password <span className="text-destructive">*</span></Label>
                  <Input
                    id="password"
                    type="password"
                    placeholder="••••••••"
                    value={formData.password}
                    onChange={(e) =>
                      setFormData({ ...formData, password: e.target.value })
                    }
                    required
                    disabled={loading}
                    minLength={8}
                  />
                  <p className="text-xs text-muted-foreground">
                    Password must be at least 8 characters long
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirm Password <span className="text-destructive">*</span></Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder="••••••••"
                    value={formData.confirmPassword}
                    onChange={(e) =>
                      setFormData({ ...formData, confirmPassword: e.target.value })
                    }
                    required
                    disabled={loading}
                    minLength={8}
                  />
                </div>
              </div>

              {/* Organization Section */}
              <div className="space-y-4 border-t pt-4">
                <h2 className="text-lg font-semibold">Organization Information</h2>
                
                <div className="space-y-2">
                  <Label htmlFor="organizationName">Organization Name <span className="text-destructive">*</span></Label>
                  <Input
                    id="organizationName"
                    type="text"
                    placeholder="Acme School District"
                    value={formData.organizationName}
                    onChange={(e) =>
                      setFormData({ ...formData, organizationName: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="organizationEmail">Organization Email <span className="text-destructive">*</span></Label>
                  <Input
                    id="organizationEmail"
                    type="email"
                    placeholder="contact@organization.com"
                    value={formData.organizationEmail}
                    onChange={(e) =>
                      setFormData({ ...formData, organizationEmail: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="contactNumber">Contact Number</Label>
                  <Input
                    id="contactNumber"
                    type="tel"
                    placeholder="+1 (555) 123-4567"
                    value={formData.contactNumber}
                    onChange={(e) =>
                      setFormData({ ...formData, contactNumber: e.target.value })
                    }
                    disabled={loading}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="registeredBusinessAddress">Registered Business Address <span className="text-destructive">*</span></Label>
                  <textarea
                    id="registeredBusinessAddress"
                    className="flex min-h-[80px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                    placeholder="123 Main St, City, State, ZIP Code"
                    value={formData.registeredBusinessAddress}
                    onChange={(e) =>
                      setFormData({ ...formData, registeredBusinessAddress: e.target.value })
                    }
                    required
                    disabled={loading}
                  />
                </div>
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <div className="flex flex-col gap-2">
                <Button type="submit" className="w-full" disabled={loading}>
                  {loading ? "Creating account..." : "Create Account"}
                </Button>
                <div className="text-center text-sm text-muted-foreground">
                  Already have an account?{" "}
                  <a href="/sis/auth/login" className="text-primary hover:underline">
                    Sign in
                  </a>
                </div>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
