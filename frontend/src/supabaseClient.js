import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

let supabase = null;
let error = null;

if (!supabaseUrl || !supabaseKey) {
  error = 'Missing environment variables: VITE_SUPABASE_URL or VITE_SUPABASE_ANON_KEY';
  console.error(error);
  // Criar um cliente dummy para evitar crash
  supabase = {
    auth: { getSession: async () => ({ data: { session: null } }) },
    from: () => ({}),
    storage: { from: () => ({}) }
  };
} else {
  supabase = createClient(supabaseUrl, supabaseKey);
}

export { supabase, error };
