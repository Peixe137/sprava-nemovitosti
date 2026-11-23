"use server";
import { redirect } from "next/navigation";
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
