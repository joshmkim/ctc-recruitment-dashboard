import "server-only";

import { createClient } from "@supabase/supabase-js";

const url = process.env.SUPABASE_URL;
const secretKey = process.env.SUPABASE_SECRET_KEY;

if (!url || !secretKey) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SECRET_KEY. Copy .env.local.example to .env.local and fill both in.",
  );
}

// Uses a secret key, which bypasses row level security. Never import this from
// a client component.
export const supabase = createClient(url, secretKey, {
  auth: { persistSession: false },
});
