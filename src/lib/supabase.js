import { createClient } from "@supabase/supabase-js";

const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(url && anonKey);

if (!isSupabaseConfigured) {
  console.warn("CareerFit Lab: Supabase is not configured. Application submissions are disabled.");
}

let publicSupabase;
let userSupabase;
let adminSupabase;

// Public operations must never inherit a persisted user or admin session.
export const getPublicSupabase = () => {
  if (!isSupabaseConfigured) return null;
  if (!publicSupabase) {
    publicSupabase = createClient(url, anonKey, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
        storageKey: "careerfit-public-auth",
      },
    });
  }
  return publicSupabase;
};

const getPersistedClient = (storageKey, currentClient, setClient) => {
  if (!isSupabaseConfigured) return null;
  if (!currentClient) {
    currentClient = createClient(url, anonKey, {
      auth: {
        persistSession: true,
        storageKey,
      },
    });
    setClient(currentClient);
  }
  return currentClient;
};

// Lazy access prevents one route from initializing the other auth context.
export const getUserSupabase = () => getPersistedClient(
  "careerfit-user-auth",
  userSupabase,
  (client) => { userSupabase = client; },
);

export const getAdminSupabase = () => getPersistedClient(
  "careerfit-admin-auth",
  adminSupabase,
  (client) => { adminSupabase = client; },
);
