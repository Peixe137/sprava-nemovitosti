"use server";
import { redirect } from "next/navigation";
import { headers } from "next/headers";
import { supabaseServer } from "@/lib/supabase/server";

export async function prihlasit(formData: FormData) {
  const supabase = await supabaseServer();
  const { error } = await supabase.auth.signInWithPassword({
    email: String(formData.get("email") ?? "").trim(),
    password: String(formData.get("heslo") ?? ""),
  });
  if (error) redirect("/prihlaseni?chyba=1");
  redirect("/");
}

export async function odhlasit() {
  const supabase = await supabaseServer();
  await supabase.auth.signOut();
  redirect("/prihlaseni");
}

const zaklad = async () => { const h = await headers(); return `${h.get("x-forwarded-proto") ?? "https"}://${h.get("x-forwarded-host") ?? h.get("host")}`; };

export async function zapomenuteHeslo(formData: FormData) {
  const email = String(formData.get("email") ?? "").trim();
  if (email) {
    const supabase = await supabaseServer();
    await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${await zaklad()}/heslo` });
  }
  redirect("/prihlaseni?odeslano=1"); // stejná odpověď vždy – neprozradí, zda účet existuje
}

export async function prihlasitGoogle() {
  const supabase = await supabaseServer();
  const { data, error } = await supabase.auth.signInWithOAuth({ provider: "google", options: { redirectTo: `${await zaklad()}/auth/callback` } });
  if (error || !data.url) redirect("/prihlaseni?chyba=google");
  redirect(data.url);
}
