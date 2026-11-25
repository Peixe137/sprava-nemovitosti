import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Nadpis } from "@/components/Chyba";
import { HledatNemovitost } from "@/components/HledatNemovitost";
import { moznostiNemovitosti } from "@/lib/vyberNemovitosti";
import { korun, datum } from "@/lib/format";

type N = {
  osoba_id: string; smlouva_id: string; role: string; najemnik: string; ico: string | null; telefon: string | null; email: string | null;
  nemovitost_id: string; nemovitost: string; nadrazena_id: string | null; variabilni_symbol: string; datum_od: string; datum_do: string | null;
  aktivni: boolean; dluh: number; otevrene_terminy: number; kontaktu: number;
};
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function Najemnici({ searchParams }: PageProps<"/najemnici">) {
  const sp = await searchParams;
  const q = String(sp.q ?? "").trim();
  const nem = String(sp.nemovitost ?? "");
  const stav = String(sp.stav ?? "aktivni");      // aktivni | neaktivni | vse
  const finance = String(sp.finance ?? "");       // dluzi | nedluzi
  const ukoly = sp.ukoly === "1";
  const supabase = await supabaseServer();
  const [{ data }, moznosti] = await Promise.all([
    supabase.from("v_najemnici").select("*").order("najemnik"),
    moznostiNemovitosti(supabase, { vcetneArchivu: true }),
  ]);
  const vse = (data ?? []) as N[];
  // nemovitost = i jednotky pod vybranou budovou
  const podBudovou = new Set(vse.filter((r) => r.nadrazena_id === nem).map((r) => r.nemovitost_id));
  const slova = norm(q).split(/\s+/).filter(Boolean);
  const radky = vse.filter((r) =>
    (stav === "vse" || (stav === "aktivni" ? r.aktivni : !r.aktivni))
    && (!nem || r.nemovitost_id === nem || podBudovou.has(r.nemovitost_id))
    && (!finance || (finance === "dluzi" ? Number(r.dluh) > 0 : Number(r.dluh) <= 0))
    && (!ukoly || r.otevrene_terminy > 0)
    && slova.every((w) => norm(`${r.najemnik} ${r.ico ?? ""} ${r.telefon ?? ""} ${r.email ?? ""} ${r.nemovitost} ${r.variabilni_symbol}`).includes(w)));
  const dluhCelkem = radky.reduce((s, r) => s + Number(r.dluh), 0);
  const Chip = ({ jmeno, hodnota, text, aktualni }: { jmeno: string; hodnota: string; text: string; aktualni: string }) => {
    const p = new URLSearchParams(Object.entries({ q, nemovitost: nem, stav, finance, ukoly: ukoly ? "1" : "" }).filter(([, v]) => v) as [string, string][]);
    if (hodnota) p.set(jmeno, hodnota); else p.delete(jmeno);
    return <Link href={`/najemnici?${p}`} className={`rounded-full px-3 py-1 ${aktualni === hodnota ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{text}</Link>;
  };

  return (
    <>
      <Nadpis titulek="Nájemníci" podtitulek={`${radky.length} nájemníků${dluhCelkem > 0 ? ` · dluží celkem ${korun(dluhCelkem)}` : ""}`}
        akce={<Link href="/smlouvy/nova" className="tlacitko">+ Nájemní smlouva</Link>} />
      <form action="/najemnici" className="mb-3 grid gap-2 sm:grid-cols-[1fr_1fr_auto]">
        <input type="search" name="q" defaultValue={q} placeholder="Hledat jméno, firmu, IČO, telefon, VS…" className="pole" />
        <HledatNemovitost name="nemovitost" moznosti={moznosti} vychozi={nem} prazdna="Všechny nemovitosti" />
        <input type="hidden" name="stav" value={stav} />{finance && <input type="hidden" name="finance" value={finance} />}{ukoly && <input type="hidden" name="ukoly" value="1" />}
        <button className="tlacitko-svetle">Hledat</button>
      </form>
      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
        <Chip jmeno="stav" hodnota="aktivni" text="Aktivní" aktualni={stav} />
        <Chip jmeno="stav" hodnota="neaktivni" text="Neaktivní" aktualni={stav} />
        <Chip jmeno="stav" hodnota="vse" text="Všichni" aktualni={stav} />
        <span className="mx-2 text-slate-300">|</span>
        <Chip jmeno="finance" hodnota="" text="Dluh: vše" aktualni={finance} />
        <Chip jmeno="finance" hodnota="dluzi" text="Dluží" aktualni={finance} />
        <Chip jmeno="finance" hodnota="nedluzi" text="Nedluží" aktualni={finance} />
        <span className="mx-2 text-slate-300">|</span>
        <Chip jmeno="ukoly" hodnota={ukoly ? "" : "1"} text={ukoly ? "✓ Jen s otevřenými termíny" : "Jen s otevřenými termíny"} aktualni={ukoly ? "" : "x"} />
      </div>
      <div className="karta overflow-x-auto">
        {radky.length === 0 ? <p className="text-sm text-slate-500">Žádní nájemníci neodpovídají filtru.</p> : (
          <table className="tabulka">
            <thead><tr><th>Nájemník</th><th>Kontakt</th><th>Nemovitost</th><th>Smlouva</th><th className="text-right">Dluh</th><th className="text-right">Termíny</th></tr></thead>
            <tbody>{radky.map((r) => (
              <tr key={r.smlouva_id + r.osoba_id}>
                <td><Link href={`/osoby/${r.osoba_id}`} className="font-medium hover:underline">{r.najemnik}</Link>
                  <div className="text-xs text-slate-500">{[r.role === "spolunajemce" ? "spolunájemce" : null, r.ico && `IČO ${r.ico}`, r.kontaktu > 0 && `${r.kontaktu} kontaktních osob`].filter(Boolean).join(" · ")}</div></td>
                <td className="text-sm">{r.telefon && <div><a href={`tel:${r.telefon.replace(/\s/g, "")}`} className="odkaz">{r.telefon}</a></div>}
                  {r.email && <div><a href={`mailto:${r.email}`} className="odkaz">{r.email}</a></div>}{!r.telefon && !r.email && "–"}</td>
                <td><Link href={`/nemovitosti/${r.nemovitost_id}`} className="hover:underline">{r.nemovitost}</Link></td>
                <td className="whitespace-nowrap"><Link href={`/smlouvy/${r.smlouva_id}`} className="odkaz">VS {r.variabilni_symbol}</Link>
                  <div className="text-xs text-slate-500">{datum(r.datum_od)} – {r.datum_do ? datum(r.datum_do) : "neurčito"} · {r.aktivni ? <span className="plus">aktivní</span> : "neaktivní"}</div></td>
                <td className={`text-right font-medium ${Number(r.dluh) > 0 ? "minus" : "plus"}`}>{Number(r.dluh) > 0 ? korun(r.dluh) : "0 Kč"}</td>
                <td className="text-right">{r.otevrene_terminy > 0 ? <span className="rounded bg-amber-50 px-1.5 text-amber-800">{r.otevrene_terminy}</span> : "–"}</td>
              </tr>))}
            </tbody>
          </table>)}
      </div>
    </>
  );
}
