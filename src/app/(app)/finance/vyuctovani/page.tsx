import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Nadpis } from "@/components/Chyba";
import { Castka } from "@/components/Castka";
import { datum } from "@/lib/format";

/** Přehled vyúčtování služeb: co chybí za loňský rok, co je rozpracované a lhůty doručení. */
export default async function PrehledVyuctovani() {
  const supabase = await supabaseServer();
  const ted = new Date();
  const rok = ted.getMonth() >= 10 ? ted.getFullYear() : ted.getFullYear() - 1; // od listopadu už se chystá letošní
  const [vy, zal] = await Promise.all([
    supabase.from("vyuctovani").select("id, smlouva_id, obdobi_od, obdobi_do, vysledek, stav, lhuta_dorucit, najemni_smlouva(variabilni_symbol, nemovitost(nazev))").order("obdobi_od", { ascending: false }),
    supabase.from("predpis_polozka").select("smlouva_id, platnost_od, platnost_do, najemni_smlouva(variabilni_symbol, stav, nemovitost(nazev))").like("druh", "zaloha_%"),
  ]);
  type V = { id: string; smlouva_id: string; obdobi_od: string; obdobi_do: string; vysledek: number; stav: string; lhuta_dorucit: string; najemni_smlouva: { variabilni_symbol: string; nemovitost: { nazev: string } } };
  const vsechna = (vy.data ?? []) as unknown as V[];
  const maVyuctovani = new Set(vsechna.filter((v) => v.obdobi_od.startsWith(String(rok))).map((v) => v.smlouva_id));
  const chybi = new Map<string, { vs: string; nazev: string }>();
  for (const p of (zal.data ?? []) as unknown as { smlouva_id: string; platnost_od: string; platnost_do: string | null; najemni_smlouva: { variabilni_symbol: string; nemovitost: { nazev: string } } }[]) {
    const vRoce = p.platnost_od <= `${rok}-12-31` && (!p.platnost_do || p.platnost_do >= `${rok}-01-01`);
    if (vRoce && !maVyuctovani.has(p.smlouva_id)) chybi.set(p.smlouva_id, { vs: p.najemni_smlouva.variabilni_symbol, nazev: p.najemni_smlouva.nemovitost.nazev });
  }
  const dnes = ted.toISOString().slice(0, 10);

  return (
    <>
      <Nadpis titulek="Vyúčtování služeb" podtitulek={`Zálohy na služby proti skutečným nákladům · zákonná lhůta doručení do 30. 4. ${rok + 1}`} />
      <section className="karta mb-6 text-sm">
        <h2 className="mb-3 font-semibold">Chybí vyúčtování za rok {rok}</h2>
        {chybi.size === 0 ? <p className="text-slate-500">Všechny smlouvy se zálohami na služby mají vyúčtování.</p> : (
          <ul className="space-y-1">{[...chybi].map(([sid, x]) => (
            <li key={sid} className="flex flex-wrap items-center justify-between gap-2">
              <span>{x.nazev} · VS {x.vs}</span>
              <Link href={`/smlouvy/${sid}/vyuctovani/nove?od=${rok}-01-01&do=${rok}-12-31`} className="tlacitko-svetle px-2 py-1 text-xs">Vytvořit vyúčtování {rok}</Link>
            </li>))}</ul>
        )}
        <p className="mt-3 text-xs text-slate-500">Před vyúčtováním: zapište odečty měřidel k 31. 12. (Úkoly → Odečty měřidel) a u faktur za energie a služby označte ve Finance → Náklady, že se mají přeúčtovat.</p>
      </section>
      <section className="karta overflow-x-auto text-sm">
        <h2 className="mb-3 font-semibold">Všechna vyúčtování</h2>
        {vsechna.length === 0 ? <p className="text-slate-500">Zatím žádné.</p> : (
          <table className="tabulka">
            <thead><tr><th>Nemovitost / smlouva</th><th>Období</th><th className="text-right">Výsledek</th><th>Stav</th><th>Doručit do</th></tr></thead>
            <tbody>{vsechna.map((v) => (
              <tr key={v.id}>
                <td><Link href={`/smlouvy/${v.smlouva_id}/vyuctovani/${v.id}`} className="odkaz">{v.najemni_smlouva.nemovitost.nazev}</Link><div className="text-xs text-slate-500">VS {v.najemni_smlouva.variabilni_symbol}</div></td>
                <td className="whitespace-nowrap">{datum(v.obdobi_od)} – {datum(v.obdobi_do)}</td>
                <td className="text-right whitespace-nowrap">{Number(v.vysledek) > 0 ? "nedoplatek " : Number(v.vysledek) < 0 ? "přeplatek " : ""}<Castka v={Math.abs(Number(v.vysledek))} /></td>
                <td>{v.stav === "rozpracovano" ? "rozpracováno" : v.stav === "odeslano" ? "odesláno" : "vyrovnáno"}</td>
                <td className={v.stav === "rozpracovano" && v.lhuta_dorucit < dnes ? "font-medium text-red-700" : ""}>{datum(v.lhuta_dorucit)}</td>
              </tr>))}</tbody>
          </table>
        )}
      </section>
    </>
  );
}
