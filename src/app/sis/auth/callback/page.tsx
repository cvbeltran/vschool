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
        // Check if we have a session (Supabase client automatically processes hash fragments)
        const { data: { session }, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          console.error("Session error:", sessionError);
          router.push("/sis/auth/login?error=Authentication failed");
          return;
        }

        if (session) {
          // User is authenticated - check if they need to set password
          // For invite flow, redirect to set-password page
          const type = searchParams.get("type");
          
          if (type === "invite") {
            // Check if user has a password set by trying to get user metadata
            // If they were invited, they likely don't have a password yet
            router.push("/sis/auth/set-password");
          } else {
            // Regular login - go to main app
            router.push("/sis");
          }
        } else {
          // No session - redirect to login
          router.push("/sis/auth/login?error=No session found");
        }
      } catch (err) {
        console.error("Auth callback error:", err);
        router.push("/sis/auth/login?error=An error occurred");
      }
    };

    handleAuthCallback();
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center p-4">
      <div className="flex flex-col items-center gap-4">
        <Loader2 className="size-8 animate-spin text-primary" />
        <p className="text-muted-foreground">Completing authentication...</p>
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    }>
      <AuthCallbackForm />
    </Suspense>
  );
}
