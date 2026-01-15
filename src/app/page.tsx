"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import Image from "next/image";

function HomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Check if there's a code parameter (Supabase auth callback)
    const code = searchParams.get('code');
    const type = searchParams.get('type');
    
    if (code) {
      // Redirect based on type
      if (type === 'recovery') {
        // Password reset - redirect to reset password page with code
        router.push(`/sis/auth/reset-password?code=${encodeURIComponent(code)}`);
      } else if (type === 'invite' || type === 'signup') {
        // Invite or signup - redirect to set password page
        router.push(`/sis/auth/set-password?code=${encodeURIComponent(code)}`);
      } else {
        // Other types - use API callback handler
        const next = searchParams.get('next');
        let callbackUrl = `/api/auth/callback?code=${encodeURIComponent(code)}`;
        if (type) {
          callbackUrl += `&type=${encodeURIComponent(type)}`;
        }
        if (next) {
          callbackUrl += `&next=${encodeURIComponent(next)}`;
        }
        router.push(callbackUrl);
      }
      return;
    }

    // Check for hash fragments (PKCE flow)
    if (typeof window !== 'undefined') {
      const hash = window.location.hash;
      if (hash && hash.length > 1) {
        // Has hash fragment - redirect to appropriate handler
        const hashParams = new URLSearchParams(hash.substring(1));
        const type = hashParams.get('type');
        
        if (type === 'recovery') {
          router.push('/sis/auth/reset-password');
        } else if (type === 'invite' || type === 'signup') {
          router.push('/sis/auth/set-password');
        } else {
          router.push('/sis/auth/callback');
        }
        return;
      }
    }

    // No auth parameters - redirect to login
    router.push('/sis/auth/login');
  }, [router, searchParams]);

  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 font-sans dark:bg-black">
      <main className="flex min-h-screen w-full max-w-3xl flex-col items-center justify-between py-32 px-16 bg-white dark:bg-black sm:items-start">
        <Image
          className="dark:invert"
          src="/next.svg"
          alt="Next.js logo"
          width={100}
          height={20}
          priority
        />
        <div className="flex flex-col items-center gap-6 text-center sm:items-start sm:text-left">
          <h1 className="max-w-xs text-3xl font-semibold leading-10 tracking-tight text-black dark:text-zinc-50">
            To get started, edit the page.tsx file.
          </h1>
          <p className="max-w-md text-lg leading-8 text-zinc-600 dark:text-zinc-400">
            Looking for a starting point or more instructions? Head over to{" "}
            <a
              href="https://vercel.com/templates?framework=next.js&utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Templates
            </a>{" "}
            or the{" "}
            <a
              href="https://nextjs.org/learn?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
              className="font-medium text-zinc-950 dark:text-zinc-50"
            >
              Learning
            </a>{" "}
            center.
          </p>
        </div>
        <div className="flex flex-col gap-4 text-base font-medium sm:flex-row">
          <a
            className="flex h-12 w-full items-center justify-center gap-2 rounded-full bg-foreground px-5 text-background transition-colors hover:bg-[#383838] dark:hover:bg-[#ccc] md:w-[158px]"
            href="https://vercel.com/new?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            <Image
              className="dark:invert"
              src="/vercel.svg"
              alt="Vercel logomark"
              width={16}
              height={16}
            />
            Deploy Now
          </a>
          <a
            className="flex h-12 w-full items-center justify-center rounded-full border border-solid border-black/[.08] px-5 transition-colors hover:border-transparent hover:bg-black/[.04] dark:border-white/[.145] dark:hover:bg-[#1a1a1a] md:w-[158px]"
            href="https://nextjs.org/docs?utm_source=create-next-app&utm_medium=appdir-template-tw&utm_campaign=create-next-app"
            target="_blank"
            rel="noopener noreferrer"
          >
            Documentation
          </a>
        </div>
      </main>
    </div>
  );
}

export default function Home() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <HomeContent />
    </Suspense>
  );
}
