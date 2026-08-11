import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const supabasePubKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY as string;

export function createBrowserClient(): SupabaseClient {
  return createClient(supabaseUrl, supabasePubKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
}

//A memory-saving technique to avoid constantly calling createBrowserClient()
let browserClient: SupabaseClient | null = null;

export function getSupabaseBrowser(): SupabaseClient {
  if (!browserClient) browserClient = createBrowserClient();
  return browserClient;
}

export function createServerClient(): SupabaseClient {

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY as string;

  const client = createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  }); 

  return client;
}
