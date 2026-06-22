import { createClient } from '@supabase/supabase-js';

let supabaseClient: any = null;

// Default / fallback keys
const fallbackUrl = 'https://rrujgyjaabbdlchgwfvl.supabase.co';
const fallbackKey = 'sb_publishable_xvdxJly6rqjZIXF956JbcA_YFwGOjDh';

// Create a static fallback client initially
supabaseClient = createClient(fallbackUrl, fallbackKey);

// Fire an async fetch immediately to refresh with the real keys
export const configLoadedPromise = fetch('/api/config')
  .then((res) => res.json())
  .then((data) => {
    if (data.supabaseUrl && data.supabaseAnonKey) {
      console.log('[SUPABASE DYNAMIC CLIENT] Configured successfully with server keys:', data.supabaseUrl);
      supabaseClient = createClient(data.supabaseUrl, data.supabaseAnonKey);
      return true;
    }
    return false;
  })
  .catch((err) => {
    console.error('[SUPABASE DYNAMIC CLIENT] Config load failed:', err);
    return false;
  });

// Export a Proxy that dynamically resolves properties on the active supabaseClient
export const supabase = new Proxy({} as any, {
  get(target, prop) {
    const activeClient = supabaseClient || createClient(fallbackUrl, fallbackKey);
    const value = activeClient[prop];
    if (typeof value === 'function') {
      return value.bind(activeClient);
    }
    return value;
  },
  set(target, prop, value) {
    if (supabaseClient) {
      supabaseClient[prop] = value;
    }
    return true;
  }
});

export function getSupabase() {
  return supabase;
}
