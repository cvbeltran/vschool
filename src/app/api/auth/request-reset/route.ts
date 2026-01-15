import { type NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * API route to request password reset
 * Stores email temporarily and generates recovery link using Admin API
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { email } = body;

    if (!email) {
      return NextResponse.json(
        { error: 'Email is required' },
        { status: 400 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseServiceRoleKey || !supabaseAnonKey) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    // Use Admin API to generate a recovery link
    // This gives us a token_hash that we can verify without PKCE
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    // First, verify the user exists using Admin API
    const { data: users, error: listError } = await adminClient.auth.admin.listUsers();
    
    if (!listError) {
      const user = users.users.find(u => u.email?.toLowerCase() === email.toLowerCase());
      if (!user) {
        // Don't reveal that user doesn't exist (security best practice)
        // But log it for debugging
        console.log('Password reset requested for non-existent email:', email);
        return NextResponse.json({ 
          success: true,
          message: 'If an account exists with this email, you will receive a password reset link.'
        });
      }
    }

    // Use regular resetPasswordForEmail - this actually sends the email
    // Include email in redirect URL so we can use Admin API to update password
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000';
    const redirectUrl = `${siteUrl}/api/auth/callback?type=recovery&email=${encodeURIComponent(email)}`;
    
    console.log('Sending password reset email to:', email);
    console.log('Redirect URL:', redirectUrl);
    
    const regularClient = createClient(supabaseUrl, supabaseAnonKey);
    const { data, error } = await regularClient.auth.resetPasswordForEmail(email, {
      redirectTo: redirectUrl,
    });

    if (error) {
      console.error('Error sending password reset email:', error);
      console.error('Error details:', JSON.stringify(error, null, 2));
      
      // Check for rate limit error
      if (error.message?.includes('59 seconds') || error.message?.includes('rate limit')) {
        return NextResponse.json(
          { error: 'Please wait a moment before requesting another password reset. Check your email for the previous reset link.' },
          { status: 429 }
        );
      }
      
      return NextResponse.json(
        { error: error.message || 'Failed to send password reset email' },
        { status: 400 }
      );
    }

    console.log('Password reset email sent successfully to:', email);
    return NextResponse.json({ success: true });
  } catch (err: any) {
    console.error('Error requesting password reset:', err);
    return NextResponse.json(
      { error: err?.message || 'An error occurred' },
      { status: 500 }
    );
  }
}
