"use client";
import { createBrowserClient } from "@supabase/ssr";

let klient: ReturnType<typeof createBrowserClient> | null = null;
export const supabaseBrowser = () => (klient ??= createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
