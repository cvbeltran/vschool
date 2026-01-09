import { createClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_URL");
}

if (!supabaseServiceRoleKey) {
  throw new Error("Missing env.SUPABASE_SERVICE_ROLE_KEY");
}

if (!supabaseAnonKey) {
  throw new Error("Missing env.NEXT_PUBLIC_SUPABASE_ANON_KEY");
}

export const supabaseServer = createClient(
  supabaseUrl,
  supabaseServiceRoleKey,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }
);

/**
 * Get authenticated user from request (for API routes)
 * Checks Authorization header or cookies for access token
 */
export async function getAuthenticatedUser(request: Request) {
  // Try to get token from Authorization header first
  const authHeader = request.headers.get("authorization");
  let accessToken: string | null = null;

  if (authHeader?.startsWith("Bearer ")) {
    accessToken = authHeader.replace("Bearer ", "");
  } else {
    // Try to get from cookies (for server-side rendering)
    const cookieStore = await cookies();
    const accessTokenCookie = cookieStore.get("sb-access-token");
    if (accessTokenCookie) {
      accessToken = accessTokenCookie.value;
    }
  }

  if (!accessToken) {
    return { user: null, error: "No access token provided" };
  }

  // Verify token and get user
  const { data: { user }, error } = await supabaseServer.auth.getUser(accessToken);

  if (error || !user) {
    return { user: null, error: error?.message || "Invalid token" };
  }

  return { user, error: null };
}
