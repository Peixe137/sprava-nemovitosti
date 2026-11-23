"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Polozka = { href: string; text: string };
type Sekce = { nadpis: string; polozky: Polozka[]; pripravujeme?: boolean; barva?: string };

const SEKCE: Sekce[] = [
  { nadpis: "", polozky: [{ href: "/", text: "Přehled" }] },
  { nadpis: "Nemovitosti", barva: "bg-blue-500", polozky: [{ href: "/nemovitosti", text: "Seznam" }, { href: "/nemovitosti/nova", text: "Nová" }] },
  { nadpis: "Nájemníci", barva: "bg-violet-500", polozky: [{ href: "/smlouvy", text: "Nájemní smlouvy" }, { href: "/vlastnici", text: "Vlastníci" }] },
  { nadpis: "Finance", barva: "bg-emerald-500", polozky: [
    { href: "/finance", text: "Přehled" }, { href: "/finance/dluznici", text: "Dlužníci" },
    { href: "/finance/platby", text: "Platby" }, { href: "/finance/naklady", text: "Náklady" },
  ] },
  { nadpis: "Systém", barva: "bg-slate-400", polozky: [{ href: "/napoveda", text: "Nápověda" }] },
  { nadpis: "Připravujeme", pripravujeme: true, polozky: [
    { href: "#", text: "Revize a termíny" }, { href: "#", text: "Údržba" }, { href: "#", text: "Nastavení" },
  ] },
];

export function Menu() {
  const cesta = usePathname();
  const vse = SEKCE.filter((s) => !s.pripravujeme).flatMap((s) => s.polozky.map((p) => p.href));
  // aktivní je nejdelší položka, kterou adresa začíná ("/nemovitosti/123" → Seznam, "/nemovitosti/nova" → Nová)
  const nejlepsi = vse.filter((h) => (h === "/" ? cesta === "/" : cesta === h || cesta.startsWith(h + "/")))
    .sort((a, b) => b.length - a.length)[0];
  const aktivni = (href: string) => href === nejlepsi;
  return (
    <nav className="flex gap-4 overflow-x-auto px-3 pb-3 md:flex-col md:gap-5">
      {SEKCE.map((s) => (
        <div key={s.nadpis || "hlavni"} className="shrink-0">
          {s.nadpis && <div className="mb-1 flex items-center gap-2 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{s.barva && <i className={`inline-block h-1.5 w-1.5 rounded-full ${s.barva}`} />}{s.nadpis}</div>}
          <div className="flex gap-1 md:flex-col">
            {s.polozky.map((p) => s.pripravujeme ? (
              <span key={p.text} className="rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-slate-300">{p.text}</span>
            ) : (
              <Link key={p.href} href={p.href}
                className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${aktivni(p.href) ? "bg-blue-600 font-medium text-white shadow-sm" : "text-slate-700 hover:bg-blue-50 hover:text-blue-700"}`}>
                {p.text}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
