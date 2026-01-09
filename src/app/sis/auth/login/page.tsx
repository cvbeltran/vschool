"use client";

import { useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);

  // Check for session on mount (handles hash fragments from PKCE flow)
  useEffect(() => {
    const checkSession = async () => {
      // Check if there's a hash fragment (PKCE flow)
      if (typeof window === 'undefined') {
        setCheckingSession(false);
        return;
      }

      const hash = window.location.hash;
      const hasHash = hash && hash.length > 1;
      
      if (hasHash) {
        // Parse hash fragment to extract tokens
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const expiresIn = hashParams.get('expires_in');
        const tokenType = hashParams.get('token_type');
        const type = hashParams.get('type') || searchParams.get("type");
        
        if (accessToken && refreshToken) {
          try {
            // Set the session manually
            const { data: { session }, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError) {
              console.error("Error setting session:", sessionError);
              setCheckingSession(false);
              setError("Failed to complete authentication. Please try again.");
              return;
            }
            
            if (session) {
              // Session established - check if this is from an invite
              if (type === "invite") {
                // Clear the hash and redirect to set password page
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                setCheckingSession(false);
                router.push("/sis/auth/set-password");
                return;
              } else {
                // Regular login - go to main app
                window.history.replaceState(null, '', window.location.pathname + window.location.search);
                setCheckingSession(false);
                router.push("/sis");
                return;
              }
            }
          } catch (err) {
            console.error("Error processing hash fragment:", err);
            setCheckingSession(false);
            setError("Failed to complete authentication. Please try again.");
            return;
          }
        } else {
          // Hash exists but no tokens - might be an error
          const errorParam = hashParams.get('error') || hashParams.get('error_description');
          setCheckingSession(false);
          if (errorParam) {
            setError(decodeURIComponent(errorParam));
          } else {
            setError("Invalid authentication response. Please try again.");
          }
          return;
        }
      } else {
        // No hash fragment - check for error or message in URL
        setCheckingSession(false);
        const urlError = searchParams.get("error");
        const urlMessage = searchParams.get("message");
        if (urlError) {
          setError(decodeURIComponent(urlError));
        }
        if (urlMessage) {
          setMessage(decodeURIComponent(urlMessage));
        }
      }
    };

    checkSession();
  }, [router, searchParams]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        // Check if error is due to unconfirmed email
        const errorMessage = error.message.toLowerCase();
        if (
          errorMessage.includes("email not confirmed") ||
          errorMessage.includes("email_not_confirmed") ||
          errorMessage.includes("confirm your email") ||
          errorMessage.includes("email confirmation")
        ) {
          setError(
            "Your email address has not been confirmed. Please check your email inbox and click the confirmation link before signing in."
          );
        } else {
          setError(error.message);
        }
        setLoading(false);
        return;
      }

      // Check if user has organization_id in profile
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("organization_id")
          .eq("id", user.id)
          .single();
        
        if (!profile?.organization_id) {
          // User doesn't have an organization - redirect to signup or show error
          setError("Your account is not associated with an organization. Please contact your administrator.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }
      }

      router.push("/sis");
      router.refresh();
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  // Show loading state while checking session
  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4">
          <div className="size-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
          <p className="text-muted-foreground">Completing authentication...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">vSchool · SIS</h1>
          <p className="text-muted-foreground text-sm">Sign in to continue</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              placeholder="email@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="password">Password</Label>
            <Input
              id="password"
              type="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
            />
          </div>

          {message && (
            <div className="rounded-md bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 p-3 text-sm text-green-800 dark:text-green-200">
              {message}
            </div>
          )}

          {error && (
            <div className="rounded-md bg-destructive/10 p-3 text-sm text-destructive">
              {error}
            </div>
          )}

          <Button type="submit" className="w-full" disabled={loading}>
            {loading ? "Signing in..." : "Sign in"}
          </Button>
          
          <div className="text-center text-sm text-muted-foreground">
            Don't have an account?{" "}
            <a href="/sis/auth/signup" className="text-primary hover:underline">
              Sign up
            </a>
          </div>
        </form>
      </div>
    </div>
  );
}

