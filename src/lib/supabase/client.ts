import { createBrowserClient } from "@supabase/ssr";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

// Use createBrowserClient from @supabase/ssr to properly handle PKCE code verifiers
// This stores the code verifier in cookies, making it accessible across page loads
export const supabase = createBrowserClient(supabaseUrl, supabaseAnonKey, {
  global: {
    headers: {
      "x-client-info": "vschool-staging",
    },
  },
});

