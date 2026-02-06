"use client";

import { useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { supabase } from "@/lib/supabase/client";
import { Loader2 } from "lucide-react";

function AuthCallbackForm() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        // Check for hash fragments first - Supabase needs to process them
        const hash = window.location.hash;
        const hasHashFragments = hash && hash.length > 1;
        
        // If we have hash fragments, wait a bit for Supabase to process them
        if (hasHashFragments) {
          // Give Supabase time to process hash fragments
          await new Promise(resolve => setTimeout(resolve, 500));
        }

        // Check if we have a session (Supabase client automatically processes hash fragments)
        let session = null;
        let attempts = 0;
        const maxAttempts = 5;
        
        // Retry getting session if we have hash fragments (Supabase might need time to process)
        while (attempts < maxAttempts) {
          const { data: { session: currentSession }, error: sessionError } = await supabase.auth.getSession();
          
          if (sessionError) {
            console.error("Session error:", sessionError);
            router.push("/student/login?error=Authentication failed");
            return;
          }

          if (currentSession) {
            session = currentSession;
            break;
          }

          // If we have hash fragments but no session yet, wait and retry
          if (hasHashFragments && attempts < maxAttempts - 1) {
            await new Promise(resolve => setTimeout(resolve, 300));
          }
          
          attempts++;
        }

        if (session) {
          // User is authenticated - check if they need to set password
          // For invite flow, redirect to reset-password page
          const type = searchParams.get("type");
          
          if (type === "invite" || searchParams.get("fromInvite") === "true" || hasHashFragments) {
            // Check must_reset_password flag
            const { data: student } = await supabase
              .from("students")
              .select("must_reset_password")
              .eq("profile_id", session.user.id)
              .single();

            if (student?.must_reset_password) {
              router.push("/student/reset-password?fromInvite=true");
            } else {
              // Already set password - go to dashboard
              router.push("/student/dashboard");
            }
          } else {
            // Regular login - go to dashboard
            router.push("/student/dashboard");
          }
        } else {
          // No session after retries - check if we have hash fragments
          if (hasHashFragments) {
            // Hash fragments present but no session - might be processing, redirect back to login with hash
            // The login page will handle it
            router.push("/student/login");
          } else {
            // No session and no hash - redirect to login
            router.push("/student/login?error=No session found");
          }
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        router.push("/student/login?error=An error occurred");
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex items-center gap-2">
        <Loader2 className="size-4 animate-spin" />
        <span className="text-muted-foreground">Authenticating...</span>
      </div>
    </div>
  );
}

export default function StudentAuthCallback() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center p-4">
        <div className="flex items-center gap-2">
          <Loader2 className="size-4 animate-spin" />
          <span className="text-muted-foreground">Loading...</span>
        </div>
      </div>
    }>
      <AuthCallbackForm />
    </Suspense>
  );
}
