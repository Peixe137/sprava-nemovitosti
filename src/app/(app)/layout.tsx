import { Suspense } from "react";
import { Menu } from "@/components/Menu";
import { Hledani } from "@/components/Hledani";
import { Zprava } from "@/components/Zprava";
import { ROLE, mojeRole } from "@/lib/role";
import { supabaseServer } from "@/lib/supabase/server";
import { odhlasit } from "../prihlaseni/actions";

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const [{ data: org }, role] = await Promise.all([supabase.from("organizace").select("nazev").limit(1).maybeSingle(), mojeRole(supabase)]);

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-slate-50/70 md:w-60 md:border-r md:border-b-0 print:hidden">
        <div className="p-5">
          <div className="text-lg font-semibold">Správa nemovitostí</div>
          <div className="truncate text-xs text-slate-500">{org?.nazev}</div>
        </div>
        <Suspense><Hledani /></Suspense>
        <Menu />
        <form action={odhlasit} className="hidden px-5 pb-5 md:block">
          <div className="truncate text-xs text-slate-500">{String(data?.claims?.email ?? "")}</div>
          <div className="mb-2 text-xs text-slate-400">{ROLE[role ?? ""] ?? ""}</div>
          <button className="text-sm text-slate-600 hover:underline">Odhlásit se</button>
        </form>
      </aside>
      <main className="flex-1 p-5 md:p-8 print:p-0">
        {role === "host" && <p className="mb-4 rounded-lg bg-slate-100 px-3 py-2 text-sm text-slate-600">Režim jen pro čtení (role Host).</p>}
        <Suspense><Zprava /></Suspense>
        {children}
      </main>
    </div>
  );
}
