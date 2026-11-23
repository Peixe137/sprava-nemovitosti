"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

type Polozka = { href: string; text: string };
type Sekce = { nadpis: string; polozky: Polozka[]; pripravujeme?: boolean };

const SEKCE: Sekce[] = [
  { nadpis: "", polozky: [{ href: "/", text: "Přehled" }] },
  { nadpis: "Nemovitosti", polozky: [{ href: "/nemovitosti", text: "Seznam" }, { href: "/nemovitosti/nova", text: "Nová" }] },
  { nadpis: "Nájemníci", polozky: [{ href: "/smlouvy", text: "Nájemní smlouvy" }, { href: "/vlastnici", text: "Vlastníci" }] },
  { nadpis: "Finance", polozky: [
    { href: "/finance", text: "Přehled" }, { href: "/finance/dluznici", text: "Dlužníci" },
    { href: "/finance/platby", text: "Platby" }, { href: "/finance/naklady", text: "Náklady" },
  ] },
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
          {s.nadpis && <div className="mb-1 px-3 text-[11px] font-semibold tracking-wider text-slate-400 uppercase">{s.nadpis}</div>}
          <div className="flex gap-1 md:flex-col">
            {s.polozky.map((p) => s.pripravujeme ? (
              <span key={p.text} className="rounded-lg px-3 py-1.5 text-sm whitespace-nowrap text-slate-300">{p.text}</span>
            ) : (
              <Link key={p.href} href={p.href}
                className={`rounded-lg px-3 py-1.5 text-sm whitespace-nowrap ${aktivni(p.href) ? "bg-slate-900 font-medium text-white" : "text-slate-700 hover:bg-slate-100"}`}>
                {p.text}
              </Link>
            ))}
          </div>
        </div>
      ))}
    </nav>
  );
}
