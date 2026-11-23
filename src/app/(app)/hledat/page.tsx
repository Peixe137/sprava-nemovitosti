import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Nadpis } from "@/components/Chyba";

const SKUPINY: [string, string][] = [
  ["nemovitost", "Nemovitosti"], ["katastr", "Katastr"], ["osoba", "Nájemníci a kontakty"], ["vlastnik", "Vlastníci"],
  ["smlouva", "Nájemní smlouvy"], ["platba", "Platby"], ["naklad", "Náklady"], ["dokument", "Dokumenty"],
];
type Vysledek = { druh: string; id: string; titulek: string | null; popis: string | null; odkaz: string };

export default async function Hledat({ searchParams }: PageProps<"/hledat">) {
  const q = String((await searchParams).q ?? "").trim();
  let vysledky: Vysledek[] = [];
  let chyba: string | null = null;
  if (q.length >= 2) {
    const supabase = await supabaseServer();
    const { data, error } = await supabase.rpc("hledat", { q, p_limit: 20 });
    vysledky = (data ?? []) as Vysledek[];
    chyba = error?.message ?? null;
  }

  return (
    <>
      <Nadpis titulek={q ? `Hledání: „${q}“` : "Hledání"}
        podtitulek={q.length >= 2 ? `${vysledky.length} výsledků · bez ohledu na diakritiku` : undefined} />
      <form action="/hledat" className="mb-6 max-w-xl">
        <input name="q" type="search" defaultValue={q} autoFocus placeholder="Název, adresa, LV, parcela, jméno, IČO, VS, telefon…" className="pole" />
      </form>
      {chyba && <p className="text-sm text-red-700">{chyba}</p>}
      {q.length > 0 && q.length < 2 && <p className="text-sm text-slate-500">Zadejte aspoň 2 znaky.</p>}
      {q.length >= 2 && vysledky.length === 0 && !chyba && <p className="text-sm text-slate-500">Nic nenalezeno.</p>}
      <div className="grid gap-4 lg:grid-cols-2">
        {SKUPINY.map(([druh, nazev]) => {
          const s = vysledky.filter((v) => v.druh === druh);
          if (!s.length) return null;
          return (
            <section key={druh} className="karta">
              <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{nazev} · {s.length}</h2>
              <ul className="divide-y divide-slate-100">
                {s.map((v, i) => {
                  const ven = v.odkaz.startsWith("http");
                  const obsah = (<><div className="font-medium">{v.titulek ?? "–"}{ven && " ↗"}</div>
                    {v.popis && <div className="text-xs text-slate-500">{v.popis}</div>}</>);
                  return (
                    <li key={druh + v.id + i}>
                      {ven ? <a href={v.odkaz} target="_blank" rel="noopener" className="block rounded px-2 py-2 hover:bg-slate-50">{obsah}</a>
                        : <Link href={v.odkaz} className="block rounded px-2 py-2 hover:bg-slate-50">{obsah}</Link>}
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>
    </>
  );
}
