import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { Castka } from "@/components/Castka";
import { datum } from "@/lib/format";
import { vypocitatVyuctovani } from "@/lib/vyuctovani";
import { ulozitVyuctovani } from "../../../vyuctovani-actions";

const KLIC: Record<string, string> = { spotreba: "spotřeba", plocha: "plocha", pevny: "přímo jednotky" };

/** Náhled vyúčtování služeb – spočítá se automaticky, částky jde před uložením upravit. */
export default async function NoveVyuctovani({ params, searchParams }: PageProps<"/smlouvy/[id]/vyuctovani/nove">) {
  const { id } = await params;
  const sp = await searchParams;
  const rok = new Date().getFullYear() - (new Date().getMonth() < 6 ? 1 : 0);
  const od = typeof sp.od === "string" ? sp.od : `${rok}-01-01`;
  const doo = typeof sp.do === "string" ? sp.do : `${rok}-12-31`;
  const supabase = await supabaseServer();
  let v: Awaited<ReturnType<typeof vypocitatVyuctovani>> | null = null, chyba: string | null = null;
  try { v = await vypocitatVyuctovani(supabase, id, od, doo); } catch (e) { chyba = e instanceof Error ? e.message : "Chyba výpočtu"; }
  const naklady = v?.radky.reduce((a, r) => a + r.naklad, 0) ?? 0, zalohy = v?.radky.reduce((a, r) => a + r.zalohy, 0) ?? 0;

  return (
    <>
      <Nadpis titulek="Vyúčtování služeb" podtitulek={v ? `${v.jednotka.nazev} · za ${datum(v.od)} – ${datum(v.do)}` : ""} />
      <Chyba text={typeof sp.chyba === "string" ? sp.chyba : chyba ?? undefined} />
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="block"><span className="stitek">Období od</span><input type="date" name="od" defaultValue={od} className="pole w-auto" /></label>
        <label className="block"><span className="stitek">do</span><input type="date" name="do" defaultValue={doo} className="pole w-auto" /></label>
        <button className="tlacitko-svetle">Přepočítat</button>
      </form>
      {v && (
        <form action={ulozitVyuctovani.bind(null, id)} className="karta overflow-x-auto text-sm">
          <input type="hidden" name="od" value={v.od} /><input type="hidden" name="do" value={v.do} />
          {v.radky.length === 0 ? <p className="text-slate-500">V období nejsou žádné zálohy ani náklady k přeúčtování. Náklady označíte ve Finance → Náklady polem „přeúčtovat nájemci“.</p> : (
            <table className="tabulka">
              <thead><tr><th>Služba</th><th>Rozúčtování</th><th className="text-right">Náklad (Kč)</th><th className="text-right">Zálohy (Kč)</th><th className="text-right">Rozdíl</th></tr></thead>
              <tbody>{v.radky.map((r) => (
                <tr key={r.sluzba} className="align-top">
                  <td><b>{r.nazev}</b>{r.poznamka && <div className="mt-1 max-w-xl text-xs text-slate-500">{r.poznamka}</div>}
                    <input type="hidden" name="sluzba" value={r.sluzba} /><input type="hidden" name={`klic_${r.sluzba}`} value={r.klic} />
                    <input type="hidden" name={`podil_${r.sluzba}`} value={r.podil ?? ""} /><input type="hidden" name={`pozn_${r.sluzba}`} value={r.poznamka} /></td>
                  <td className="whitespace-nowrap">{KLIC[r.klic]}{r.podil != null && <div className="text-xs text-slate-500">{(r.podil * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} %</div>}</td>
                  <td className="text-right"><input name={`naklad_${r.sluzba}`} defaultValue={r.naklad.toFixed(2)} inputMode="decimal" className="pole w-32 py-1 text-right" /></td>
                  <td className="text-right"><input name={`zalohy_${r.sluzba}`} defaultValue={r.zalohy.toFixed(2)} inputMode="decimal" className="pole w-32 py-1 text-right" /></td>
                  <td className="text-right"><Castka v={r.naklad - r.zalohy} /></td>
                </tr>))}
                <tr className="border-t-2 border-slate-300 font-semibold"><td colSpan={2}>Celkem</td><td className="text-right"><Castka v={naklady} /></td><td className="text-right"><Castka v={zalohy} /></td>
                  <td className="text-right">{naklady - zalohy > 0 ? <>nedoplatek <Castka v={naklady - zalohy} /></> : <>přeplatek <Castka v={zalohy - naklady} /></>}</td></tr>
              </tbody>
            </table>
          )}
          <label className="mt-4 block"><span className="stitek">Poznámka pro nájemce</span><textarea name="poznamka" rows={2} className="pole" /></label>
          <p className="mt-2 text-xs text-slate-500">Částky jde ručně upravit. Rozdíl a celkový výsledek se po uložení přepočítají podle zadaných hodnot. Nedoplatek se zapíše do plateb ke smlouvě se splatností 30 dnů.</p>
          <div className="mt-3 flex gap-2"><Odeslat>Uložit vyúčtování</Odeslat><Link href={`/smlouvy/${id}`} className="tlacitko-svetle">Zpět</Link></div>
        </form>
      )}
    </>
  );
}
