import { Suspense } from "react";
import { Menu } from "@/components/Menu";
import { Hledani } from "@/components/Hledani";
import { supabaseServer } from "@/lib/supabase/server";
import { odhlasit } from "../prihlaseni/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const { data: org } = await supabase.from("organizace").select("nazev").limit(1).maybeSingle();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-slate-50/70 md:w-60 md:border-r md:border-b-0">
        <div className="p-5">
          <div className="text-lg font-semibold">Správa nemovitostí</div>
          <div className="truncate text-xs text-slate-500">{org?.nazev}</div>
        </div>
        <Suspense><Hledani /></Suspense>
        <Menu />
        <form action={odhlasit} className="hidden px-5 pb-5 md:block">
          <div className="mb-2 truncate text-xs text-slate-500">{String(data?.claims?.email ?? "")}</div>
          <button className="text-sm text-slate-600 hover:underline">Odhlásit se</button>
        </form>
      </aside>
      <main className="flex-1 p-5 md:p-8">{children}</main>
    </div>
  );
}
