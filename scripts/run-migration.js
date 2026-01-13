/**
 * Script to run RLS_OBS_AMS_PHASE_2.sql migration
 * 
 * Usage:
 *   node scripts/run-migration.js
 * 
 * Requires environment variables (from .env.local or system):
 *   - NEXT_PUBLIC_SUPABASE_URL
 *   - SUPABASE_SERVICE_ROLE_KEY
 * 
 * Note: Supabase JS client doesn't support executing raw SQL directly.
 * This script uses the Supabase Management API to execute the migration.
 * For production, consider using Supabase Dashboard SQL Editor or Supabase CLI.
 */

const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

// Try to load .env.local if it exists
try {
  const envPath = path.join(__dirname, '..', '.env.local');
  if (fs.existsSync(envPath)) {
    const envContent = fs.readFileSync(envPath, 'utf8');
    envContent.split('\n').forEach(line => {
      const [key, ...valueParts] = line.split('=');
      if (key && valueParts.length > 0) {
        const value = valueParts.join('=').trim().replace(/^["']|["']$/g, '');
        if (!process.env[key.trim()]) {
          process.env[key.trim()] = value;
        }
      }
    });
  }
} catch (e) {
  // Ignore if .env.local doesn't exist
}

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  console.error('Error: Missing required environment variables:');
  console.error('  - NEXT_PUBLIC_SUPABASE_URL');
  console.error('  - SUPABASE_SERVICE_ROLE_KEY');
  console.error('\nPlease set these in your environment or .env.local file.');
  console.error('\nAlternatively, run the migration using:');
  console.error('  1. Supabase Dashboard SQL Editor (recommended)');
  console.error('  2. Supabase CLI: supabase db push migrations/RLS_OBS_AMS_PHASE_2.sql');
  console.error('  3. psql: psql <connection-string> -f migrations/RLS_OBS_AMS_PHASE_2.sql');
  process.exit(1);
}

async function runMigration() {
  const migrationPath = path.join(__dirname, '..', 'migrations', 'RLS_OBS_AMS_PHASE_2.sql');
  const sql = fs.readFileSync(migrationPath, 'utf8');

  console.log('Running migration: RLS_OBS_AMS_PHASE_2.sql');
  console.log('This may take a few moments...\n');

  try {
    // Use Supabase Management API to execute SQL
    // Note: This requires the project's database URL, not the REST API URL
    const projectRef = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/)?.[1];
    
    if (!projectRef) {
      throw new Error('Could not extract project reference from Supabase URL');
    }

    // Use the Management API endpoint
    const managementUrl = `https://api.supabase.com/v1/projects/${projectRef}/database/query`;
    
    console.log('Executing migration via Supabase Management API...');
    
    const response = await fetch(managementUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${supabaseServiceRoleKey}`,
      },
      body: JSON.stringify({
        query: sql,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Migration failed (${response.status}): ${errorText}`);
    }

    const result = await response.json();
    console.log('✓ Migration completed successfully!');
    if (result.data) {
      console.log('Result:', JSON.stringify(result.data, null, 2));
    }
  } catch (error) {
    console.error('✗ Migration failed:');
    console.error(error.message);
    console.error('\nNote: The Supabase Management API may not be available.');
    console.error('For best results, use one of these methods:');
    console.error('\n1. Supabase Dashboard SQL Editor (recommended):');
    console.error('   - Go to your Supabase project dashboard');
    console.error('   - Navigate to SQL Editor');
    console.error('   - Copy and paste the contents of migrations/RLS_OBS_AMS_PHASE_2.sql');
    console.error('   - Click "Run"');
    console.error('\n2. Supabase CLI:');
    console.error('   supabase db push migrations/RLS_OBS_AMS_PHASE_2.sql');
    console.error('\n3. Direct psql connection:');
    console.error('   psql "postgresql://postgres:[password]@[host]:5432/postgres" -f migrations/RLS_OBS_AMS_PHASE_2.sql');
    process.exit(1);
  }
}

runMigration();
