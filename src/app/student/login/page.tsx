"use client";

import { useState, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/lib/supabase/client";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [checkingSession, setCheckingSession] = useState(true);
  const [hasCheckedSession, setHasCheckedSession] = useState(false);

  // Check for session on mount
  useEffect(() => {
    const checkSession = async () => {
      // Prevent multiple checks
      if (hasCheckedSession) {
        return;
      }

      if (typeof window === 'undefined') {
        setCheckingSession(false);
        return;
      }

      // Check for hash fragments first (PKCE flow from invite links)
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        const hashParams = new URLSearchParams(hash.substring(1));
        const accessToken = hashParams.get('access_token');
        const refreshToken = hashParams.get('refresh_token');
        const type = hashParams.get('type');
        
        // If this is an invite with hash fragments, manually set the session
        if (type === 'invite' && accessToken && refreshToken) {
          setHasCheckedSession(true); // Mark as checked to prevent re-running
          
          try {
            // Manually set the session from hash fragments
            const { data: { session }, error: sessionError } = await supabase.auth.setSession({
              access_token: accessToken,
              refresh_token: refreshToken,
            });
            
            if (sessionError || !session) {
              console.error("Error setting session from hash:", sessionError);
              setError("Invalid or expired invitation link. Please contact your administrator.");
              setCheckingSession(false);
              return;
            }
            
            // Clear hash fragments from URL
            window.history.replaceState(null, '', window.location.pathname + window.location.search);
            
            // Session created from hash fragments - check if student needs to set password
            const { data: profile } = await supabase
              .from("profiles")
              .select("role")
              .eq("id", session.user.id)
              .single();

            if (!profile || profile.role !== "student") {
              // Not a student - sign out and show error
              await supabase.auth.signOut();
              setError("This login page is for students only.");
              setCheckingSession(false);
              return;
            }

            // Check must_reset_password flag
            const { data: student } = await supabase
              .from("students")
              .select("must_reset_password")
              .eq("profile_id", session.user.id)
              .single();

            if (student?.must_reset_password) {
              router.replace("/student/reset-password?fromInvite=true");
              return;
            } else {
              // Already set password - go to dashboard
              window.location.href = "/student/dashboard";
              return;
            }
          } catch (err) {
            console.error("Error processing invite hash:", err);
            setError("An error occurred while processing your invitation. Please contact your administrator.");
            setCheckingSession(false);
            return;
          }
        }
      }

      // Small delay to ensure signOut has completed if coming from logout
      await new Promise(resolve => setTimeout(resolve, 100));

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session) {
        // Check if user is a student and redirect accordingly
        const { data: profile } = await supabase
          .from("profiles")
          .select("role")
          .eq("id", session.user.id)
          .single();

        if (profile?.role === "student") {
          // Check must_reset_password flag
          const { data: student } = await supabase
            .from("students")
            .select("must_reset_password")
            .eq("profile_id", session.user.id)
            .single();

          // If student has an active session, they've already authenticated successfully
          // Only redirect to reset-password if flag is true AND they're coming from invite flow
          // For normal sessions, if flag is true but they can login, clear it
          if (student?.must_reset_password === true) {
            // Check if this session is from invite flow
            const urlParams = new URLSearchParams(window.location.search);
            const hash = window.location.hash;
            const isFromInvite = urlParams.has('code') || urlParams.has('type') || 
                                 (hash && hash.includes('type=invite'));
            
            if (isFromInvite) {
              setHasCheckedSession(true);
              router.replace("/student/reset-password");
            } else {
              // Normal session - they've proven they have a password, clear the flag
              // Wait for update to complete before redirecting to avoid race condition
              const { error: updateError } = await supabase
                .from("students")
                .update({ 
                  must_reset_password: false,
                  last_login_at: new Date().toISOString()
                })
                .eq("profile_id", session.user.id);
              
              if (updateError) {
                console.error("Error clearing must_reset_password flag:", updateError);
                // Still redirect to dashboard - the layout will handle clearing the flag
              }
              
              setHasCheckedSession(true);
              // Use window.location for full page reload to ensure layout is properly applied
              window.location.href = "/student/dashboard";
            }
            return;
          } else {
            setHasCheckedSession(true);
            // Use window.location for full page reload to ensure layout is properly applied
            window.location.href = "/student/dashboard";
            return;
          }
        } else {
          // Not a student, sign out and stay on login page
          await supabase.auth.signOut();
          setCheckingSession(false);
          setHasCheckedSession(true);
        }
      } else {
        // No session - stay on login page
        setCheckingSession(false);
        setHasCheckedSession(true);
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
  }, [router, searchParams, hasCheckedSession]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (signInError) {
        const errorMessage = signInError.message.toLowerCase();
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
          setError(signInError.message);
        }
        setLoading(false);
        return;
      }

      // Check if user is a student
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        const { data: profile } = await supabase
          .from("profiles")
          .select("role, organization_id")
          .eq("id", user.id)
          .single();

        if (!profile) {
          setError("Your account is not set up correctly. Please contact your administrator.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        if (profile.role !== "student") {
          setError("This login page is for students only. Staff should use the staff portal.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        if (!profile.organization_id) {
          setError("Your account is not associated with an organization. Please contact your administrator.");
          await supabase.auth.signOut();
          setLoading(false);
          return;
        }

        // Check must_reset_password flag
        const { data: student } = await supabase
          .from("students")
          .select("must_reset_password")
          .eq("profile_id", user.id)
          .single();

        // CRITICAL: If student can login successfully with password,
        // they've already set a password, so must_reset_password should be false
        // Only redirect to reset-password if this is coming from an invite email flow
        if (student?.must_reset_password === true) {
          // Check if this is from invite flow (has code/type in URL) or normal login
          const urlParams = new URLSearchParams(window.location.search);
          const isFromInvite = urlParams.has('code') || urlParams.has('type') || 
                               window.location.hash.includes('type=invite');
          
          if (isFromInvite) {
            // Coming from invite email - redirect to reset-password
            router.replace("/student/reset-password");
          } else {
            // Normal login - they've proven they have a password, clear the flag
            // Wait for update to complete before redirecting to avoid race condition
            const { error: updateError } = await supabase
              .from("students")
              .update({ 
                must_reset_password: false,
                last_login_at: new Date().toISOString()
              })
              .eq("profile_id", user.id);
            
            if (updateError) {
              console.error("Error clearing must_reset_password flag:", updateError);
              // Still redirect to dashboard - the layout will handle clearing the flag
            }
            
            // Use window.location for full page reload to ensure layout is properly applied
            window.location.href = "/student/dashboard";
          }
        } else {
          // Use window.location for full page reload to ensure layout is properly applied
          window.location.href = "/student/dashboard";
        }
      }
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
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md space-y-6">
        <div className="space-y-2 text-center">
          <h1 className="text-2xl font-semibold">Student Portal</h1>
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
        </form>
      </div>
    </div>
  );
}

export default function StudentLoginPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <LoginForm />
    </Suspense>
  );
}
