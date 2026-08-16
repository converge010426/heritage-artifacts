import { createClient } from '@supabase/supabase-js';

const getSupabase = () => {
  const supabaseUrl = (import.meta as any).env.VITE_SUPABASE_URL;
  const supabaseAnonKey = (import.meta as any).env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    // Return a proxy that throws a descriptive error only when a method is called
    return new Proxy({} as any, {
      get(_, prop) {
        return () => {
          throw new Error(
            `Supabase ${String(prop)} called but VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY is missing. ` +
            `Please configure these in your environment variables.`
          );
        };
      }
    });
  }

  return createClient(supabaseUrl, supabaseAnonKey);
};

export const supabase = getSupabase();
