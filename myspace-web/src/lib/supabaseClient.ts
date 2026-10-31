import { createClient } from '@supabase/supabase-js';

const url = import.meta.env.EXPO_PUBLIC_SUPABASE_URL;
const key = import.meta.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

if (!url || !key) {
  throw new Error('Set EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY in the root .env file.');
}

export const supabase = createClient(url, key, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});
