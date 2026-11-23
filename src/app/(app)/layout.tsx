import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { odhlasit } from "../prihlaseni/actions";

const MENU = [
  { href: "/", text: "Přehled" },
  { href: "/nemovitosti", text: "Nemovitosti" },
  { href: "/smlouvy", text: "Nájemní smlouvy" },
  { href: "/dluznici", text: "Dlužníci" },
  { href: "/vlastnici", text: "Vlastníci" },
];

export default async function AppLayout({ children }: LayoutProps<"/">) {
  const supabase = await supabaseServer();
  const { data } = await supabase.auth.getClaims();
  const { data: org } = await supabase.from("organizace").select("nazev").limit(1).maybeSingle();

  return (
    <div className="flex min-h-screen flex-col md:flex-row">
      <aside className="border-b border-slate-200 bg-white md:w-60 md:border-r md:border-b-0">
        <div className="p-5">
          <div className="text-lg font-semibold">Správa nemovitostí</div>
          <div className="truncate text-xs text-slate-500">{org?.nazev}</div>
        </div>
        <nav className="flex gap-1 overflow-x-auto px-3 pb-3 md:flex-col">
          {MENU.map((m) => (
            <Link key={m.href} href={m.href}
              className="rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap text-slate-700 hover:bg-slate-100">
              {m.text}
            </Link>
          ))}
        </nav>
        <form action={odhlasit} className="hidden px-5 pb-5 md:block">
          <div className="mb-2 truncate text-xs text-slate-500">{String(data?.claims?.email ?? "")}</div>
          <button className="text-sm text-slate-600 hover:underline">Odhlásit se</button>
        </form>
      </aside>
      <main className="flex-1 p-5 md:p-8">{children}</main>
    </div>
  );
}
