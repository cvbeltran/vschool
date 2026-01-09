import { type EmailOtpType } from '@supabase/supabase-js';
import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as EmailOtpType | null;
  const next = searchParams.get('next') ?? '/sis/auth/set-password';

  if (token_hash && type) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      const loginUrl = new URL('/sis/auth/login', request.url);
      loginUrl.searchParams.set('error', 'Server configuration error');
      return NextResponse.redirect(loginUrl);
    }

    // Create client for PKCE flow
    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        flowType: 'pkce',
      },
    });

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Token verified successfully - user is now logged in
      // Redirect to password setup page
      return NextResponse.redirect(new URL(next, request.url));
    } else {
      console.error('Error verifying OTP:', error);
      // Redirect to login with error
      const loginUrl = new URL('/sis/auth/login', request.url);
      loginUrl.searchParams.set('error', 'Invalid or expired confirmation link');
      return NextResponse.redirect(loginUrl);
    }
  }

  // No token_hash or type - redirect to login
  const loginUrl = new URL('/sis/auth/login', request.url);
  loginUrl.searchParams.set('error', 'Missing confirmation parameters');
  return NextResponse.redirect(loginUrl);
}
