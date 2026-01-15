"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingAuth, setCheckingAuth] = useState(true);

  useEffect(() => {
    const checkAuth = async () => {
      try {
        // Check if code is verified (from API callback)
        const code = searchParams.get('code');
        const verified = searchParams.get('verified');
        const email = searchParams.get('email');
        
        if (code && verified === 'true' && email) {
          // Code was verified server-side - we can proceed without session
          // The password update will use Admin API
          console.log("Code verified server-side, proceeding without session");
          setCheckingAuth(false);
          return;
        }
        
        // First, check for code parameter in query string (magic link flow)
        if (code) {
          // Try to exchange code on client side first (where cookies are available)
          // If that fails, redirect to server-side handler
          try {
            console.log("Attempting client-side code exchange...");
            const { data, error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
            
            if (!exchangeError && data?.session) {
              console.log("Client-side code exchange succeeded");
              // Clear code from URL
              window.history.replaceState(null, '', window.location.pathname);
              setCheckingAuth(false);
              return;
            }
            
            // If client-side exchange fails (likely due to missing flow state),
            // redirect to server-side handler
            if (exchangeError) {
              console.log("Client-side exchange failed, redirecting to server handler:", exchangeError.message);
              router.push(`/api/auth/callback?code=${encodeURIComponent(code)}&type=recovery`);
              return;
            }
          } catch (err: any) {
            console.error("Error in client-side code exchange:", err);
            // Fallback to server-side handler
            router.push(`/api/auth/callback?code=${encodeURIComponent(code)}&type=recovery`);
            return;
          }
        }

        // Check if there's a hash fragment (PKCE flow from email link)
        if (typeof window !== 'undefined') {
          const hash = window.location.hash;
          if (hash && hash.length > 1) {
            // Parse hash fragment to extract tokens
            const hashParams = new URLSearchParams(hash.substring(1));
            const accessToken = hashParams.get('access_token');
            const refreshToken = hashParams.get('refresh_token');
            const type = hashParams.get('type');
            
            if (accessToken && refreshToken && type === 'recovery') {
              try {
                // Set the session manually from hash fragments
                const { data: { session }, error: sessionError } = await supabase.auth.setSession({
                  access_token: accessToken,
                  refresh_token: refreshToken,
                });
                
                if (sessionError || !session) {
                  router.push("/sis/auth/login?error=Invalid or expired password reset link");
                  return;
                }
                
                // Clear the hash and continue
                window.history.replaceState(null, '', window.location.pathname);
                setCheckingAuth(false);
                return;
              } catch (err) {
                console.error("Error setting session from hash:", err);
                router.push("/sis/auth/login?error=Failed to process password reset link");
                return;
              }
            }
          }
        }

        // Check for existing session
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError || !session) {
          // Not authenticated - redirect to login
          router.push("/sis/auth/login?error=Please use the password reset link from your email");
          return;
        }

        // User is authenticated (from recovery link)
        setCheckingAuth(false);
      } catch (err) {
        console.error("Error checking auth:", err);
        router.push("/sis/auth/login");
      }
    };

    checkAuth();
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validate passwords match
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }

    // Validate password strength
    if (password.length < 8) {
      setError("Password must be at least 8 characters long");
      return;
    }

    setLoading(true);

    try {
      // Check if we have a verified code/token (from server-side verification)
      const code = searchParams.get('code');
      const token = searchParams.get('token');
      const verified = searchParams.get('verified');
      const email = searchParams.get('email');
      
      if ((code || token) && verified === 'true' && email) {
        // Use Admin API to update password (bypasses session requirement)
        const response = await fetch('/api/auth/reset-password', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            code: code || undefined,
            token: token || undefined,
            email,
            password,
          }),
        });

        const data = await response.json();

        if (!response.ok) {
          setError(data.error || "Failed to reset password");
          setLoading(false);
          return;
        }

        // Password reset successfully - redirect to login with success message
        router.push("/sis/auth/login?message=Password reset successfully. Please sign in with your new password.");
        router.refresh();
        return;
      }

      // Normal flow: Update user password (requires session)
      const { error: updateError } = await supabase.auth.updateUser({
        password: password,
      });

      if (updateError) {
        setError(updateError.message || "Failed to reset password");
        setLoading(false);
        return;
      }

      // Password reset successfully - redirect to login with success message
      router.push("/sis/auth/login?message=Password reset successfully. Please sign in with your new password.");
      router.refresh();
    } catch (err: any) {
      setError(err.message || "An unexpected error occurred");
      setLoading(false);
    }
  };

  if (checkingAuth) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">vSchool · SIS</h1>
          <p className="text-muted-foreground text-sm">Reset your password</p>
        </div>

        <Card>
          <CardContent className="p-6">
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="password">New Password</Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your new password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
                <p className="text-xs text-muted-foreground">
                  Password must be at least 8 characters long
                </p>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirm New Password</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Confirm your new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={8}
                />
              </div>

              {error && (
                <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
                  {error}
                </div>
              )}

              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? (
                  <>
                    <Loader2 className="mr-2 size-4 animate-spin" />
                    Resetting password...
                  </>
                ) : (
                  "Reset Password"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

export default function ResetPasswordPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    }>
      <ResetPasswordForm />
    </Suspense>
  );
}
