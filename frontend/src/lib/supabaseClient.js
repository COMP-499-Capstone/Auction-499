import { createClient } from "@supabase/supabase-js";
// import this file elsewhere to make database calls 
const supabase = createClient(
    import.meta.env.VITE_SUPABASE_URL,
    import.meta.env.VITE_SUPABASE_KEY,
    {
        auth: {
            persistentSession: true,
            autoRefreshToken: true,
            detectSessionInUrl: true,
        },
    }
);

export default supabase;