import { type NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';

/**
 * Handle Supabase auth callbacks with code parameter
 * This handles password reset links that come with ?code=... parameter
 * For password reset (recovery), uses service role to bypass PKCE flow state requirement
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const token = searchParams.get('token'); // Token from Admin API generateLink
  const type = searchParams.get('type') as 'recovery' | 'signup' | 'invite' | null;
  const next = searchParams.get('next');
  const email = searchParams.get('email'); // Email from request-reset API

  // For recovery type, we might have token or email instead of code
  // Allow recovery type without code (we'll use email for Admin API password update)
  if (!code && !token && type !== 'recovery') {
    // No code parameter - redirect to login
    const loginUrl = new URL('/sis/auth/login', request.url);
    loginUrl.searchParams.set('error', 'Invalid authentication link');
    return NextResponse.redirect(loginUrl);
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    const loginUrl = new URL('/sis/auth/login', request.url);
    loginUrl.searchParams.set('error', 'Server configuration error');
    return NextResponse.redirect(loginUrl);
  }

  // For password reset (recovery), handle token from Admin API or code from regular flow
  if (type === 'recovery') {
    try {
      // If we have a token from Admin API generateLink, use verifyOtp
      if (token) {
        console.log('Processing password reset with Admin API token...');
        
        const response = NextResponse.next();
        const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
          cookies: {
            get(name: string) {
              return request.cookies.get(name)?.value;
            },
            set(name: string, value: string, options: any) {
              request.cookies.set({
                name,
                value,
                ...options,
              });
              response.cookies.set({
                name,
                value,
                ...options,
              });
            },
            remove(name: string, options: any) {
              request.cookies.set({
                name,
                value: '',
                ...options,
              });
              response.cookies.set({
                name,
                value: '',
                ...options,
              });
            },
          },
        });

        // Verify the token from Admin API generateLink
        const { data, error: verifyError } = await supabase.auth.verifyOtp({
          type: 'recovery',
          token_hash: token,
        });

        if (!verifyError && data?.session) {
          console.log('Password reset token verified, session created for user:', data.session.user?.email);
          const redirectUrl = new URL('/sis/auth/reset-password', request.url);
          return NextResponse.redirect(redirectUrl, {
            headers: response.headers,
          });
        }
      }

      // If we have email, redirect with it for Admin API password update
      if (email) {
        console.log('Redirecting with email for Admin API password update');
        const redirectUrl = new URL('/sis/auth/reset-password', request.url);
        redirectUrl.searchParams.set('email', email);
        redirectUrl.searchParams.set('verified', 'true');
        if (code) redirectUrl.searchParams.set('code', code);
        if (token) redirectUrl.searchParams.set('token', token);
        return NextResponse.redirect(redirectUrl);
      }

      // Fallback: redirect with code for client-side handling
      console.log('Redirecting with code for client-side handling');
      const redirectUrl = new URL('/sis/auth/reset-password', request.url);
      if (code) redirectUrl.searchParams.set('code', code);
      return NextResponse.redirect(redirectUrl);
      
    } catch (err: any) {
      console.error('Error processing password reset callback:', err);
      const loginUrl = new URL('/sis/auth/login', request.url);
      const errorMsg = err?.message || 'An error occurred processing your request';
      loginUrl.searchParams.set('error', errorMsg);
      return NextResponse.redirect(loginUrl);
    }
  }

  // For other types, use @supabase/ssr with PKCE flow state
  const response = NextResponse.next();
  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      get(name: string) {
        return request.cookies.get(name)?.value;
      },
      set(name: string, value: string, options: any) {
        request.cookies.set({
          name,
          value,
          ...options,
        });
        response.cookies.set({
          name,
          value,
          ...options,
        });
      },
      remove(name: string, options: any) {
        request.cookies.set({
          name,
          value: '',
          ...options,
        });
        response.cookies.set({
          name,
          value: '',
          ...options,
        });
      },
    },
  });

  try {
    // Ensure we have a code for non-recovery types
    if (!code) {
      const loginUrl = new URL('/sis/auth/login', request.url);
      loginUrl.searchParams.set('error', 'Invalid authentication link');
      return NextResponse.redirect(loginUrl);
    }
    
    console.log('Processing auth callback (non-recovery), code:', code.substring(0, 10) + '...', 'type:', type);
    
    // Try to exchange the code - @supabase/ssr should handle PKCE flow state from cookies
    const { data, error } = await supabase.auth.exchangeCodeForSession(code);

    if (error) {
      console.error('Error exchanging code for session:', {
        message: error.message,
        status: error.status,
        name: error.name,
      });
      
      const loginUrl = new URL('/sis/auth/login', request.url);
      const errorMsg = error.message || 'Invalid or expired link. Please try again.';
      loginUrl.searchParams.set('error', errorMsg);
      return NextResponse.redirect(loginUrl);
    }

    if (!data || !data.session) {
      console.error('No session returned from code exchange');
      const loginUrl = new URL('/sis/auth/login', request.url);
      loginUrl.searchParams.set('error', 'Failed to create session');
      return NextResponse.redirect(loginUrl);
    }

    console.log('Code exchanged successfully, session created for user:', data.session.user?.email);
    
    // Determine redirect URL
    // For invite/signup, use next parameter if provided, otherwise default to set-password
    let redirectUrl: URL;
    if (type === 'invite' || type === 'signup') {
      redirectUrl = next 
        ? new URL(next, request.url)
        : new URL('/sis/auth/set-password', request.url);
    } else if (next) {
      redirectUrl = new URL(next, request.url);
    } else {
      redirectUrl = new URL('/sis', request.url);
    }
    
    // The createServerClient automatically handles setting cookies via the cookie handlers
    return NextResponse.redirect(redirectUrl, {
      headers: response.headers,
    });
  } catch (err: any) {
    console.error('Error processing auth callback:', err);
    const loginUrl = new URL('/sis/auth/login', request.url);
    const errorMsg = err?.message || 'An error occurred processing your request';
    loginUrl.searchParams.set('error', errorMsg);
    return NextResponse.redirect(loginUrl);
  }
}
