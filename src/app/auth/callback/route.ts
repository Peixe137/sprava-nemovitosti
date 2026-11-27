import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase/server";

/** Návrat z přihlášení přes Google. Pustí dál jen toho, kdo je členem organizace (pozvaný administrátorem). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const supabase = await supabaseServer();
  if (!code) return NextResponse.redirect(new URL("/prihlaseni?chyba=google", url));
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/prihlaseni?chyba=google", url));
  const { data: role } = await supabase.rpc("moje_aktualni_role");
  if (!role) {
    await supabase.auth.signOut();
    return NextResponse.redirect(new URL("/prihlaseni?chyba=neclen", url));
  }
  return NextResponse.redirect(new URL("/", url));
}
