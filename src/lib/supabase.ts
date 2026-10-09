import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'placeholder-anon-key';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-key';

// Client for public / browser-side queries
export const supabase = createClient(supabaseUrl, supabaseAnonKey);

// Admin client for backend serverless route handlers (bypasses RLS if needed)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);
