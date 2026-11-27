import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { DRUHY_MERIDEL, JEDNOTKY_MERIDEL, datum, cislo } from "@/lib/format";
import { ulozitProtokol } from "../../../protokol-actions";

/** Nový předávací protokol – převzetí nebo předání, se stavy všech měřidel jednotky. */
export default async function NovyProtokol({ params, searchParams }: PageProps<"/smlouvy/[id]/protokol/novy">) {
  const { id } = await params;
  const sp = await searchParams;
  const druh = sp.druh === "predani" ? "predani" : "prevzeti";
  const supabase = await supabaseServer();
  const { data: s } = await supabase.from("najemni_smlouva").select("id, variabilni_symbol, datum_od, datum_do, nemovitost_id, nemovitost(nazev)").eq("id", id).maybeSingle();
  if (!s) notFound();
  const { data: mer } = await supabase.from("meridlo").select("id, druh, vyrobni_cislo, umisteni, jednotka").eq("nemovitost_id", s.nemovitost_id).eq("aktivni", true).order("druh");
  const { data: odecty } = (mer ?? []).length
    ? await supabase.from("odecet").select("meridlo_id, datum, stav").in("meridlo_id", (mer ?? []).map((m) => m.id)).order("datum", { ascending: false })
    : { data: [] };
  const posledni = new Map<string, { datum: string; stav: number }>();
  for (const o of odecty ?? []) if (!posledni.has(o.meridlo_id)) posledni.set(o.meridlo_id, o);
  const vychoziDatum = druh === "prevzeti" ? s.datum_od : s.datum_do ?? new Date().toISOString().slice(0, 10);

  return (
    <>
      <Nadpis titulek={druh === "prevzeti" ? "Předávací protokol – převzetí" : "Předávací protokol – předání (vrácení)"}
        podtitulek={`${(s.nemovitost as unknown as { nazev: string }).nazev} · smlouva VS ${s.variabilni_symbol}`} />
      <Chyba text={typeof sp.chyba === "string" ? sp.chyba : undefined} />
      <form action={ulozitProtokol.bind(null, id)} className="karta max-w-3xl space-y-5 text-sm">
        <input type="hidden" name="druh" value={druh} />
        <label className="block max-w-xs"><span className="stitek">Datum předání</span><input type="date" name="datum" defaultValue={vychoziDatum} required className="pole" /></label>
        <div>
          <h2 className="mb-2 font-semibold">Stavy měřidel</h2>
          {(mer ?? []).length === 0 ? (
            <p className="text-slate-500">Jednotka nemá zapsaná měřidla. <Link href={`/nemovitosti/${s.nemovitost_id}#energie`} className="odkaz">Přidat měřidla</Link> (a pak se sem vraťte), nebo stavy napište do poznámky.</p>
          ) : (
            <table className="tabulka">
              <thead><tr><th>Měřidlo</th><th>Poslední známý stav</th><th>Stav při {druh === "prevzeti" ? "převzetí" : "předání"}</th></tr></thead>
              <tbody>{(mer ?? []).map((m) => {
                const p = posledni.get(m.id); const j = m.jednotka ?? JEDNOTKY_MERIDEL[m.druh];
                return (
                  <tr key={m.id}>
                    <td>{DRUHY_MERIDEL[m.druh]}<div className="text-xs text-slate-500">{[m.vyrobni_cislo && `č. ${m.vyrobni_cislo}`, m.umisteni].filter(Boolean).join(" · ")}</div></td>
                    <td>{p ? `${cislo(p.stav)} ${j} (${datum(p.datum)})` : "–"}</td>
                    <td><div className="flex items-center gap-1"><input name={`stav_${m.id}`} inputMode="decimal" className="pole w-32 py-1" /><span className="text-xs text-slate-500">{j}</span></div></td>
                  </tr>);
              })}</tbody>
            </table>
          )}
        </div>
        <label className="block"><span className="stitek">Klíče a čipy (počet, druh)</span><textarea name="klice" rows={2} placeholder="2× klíč od bytu, 1× od schránky, 1× čip vchod" className="pole" /></label>
        <label className="block"><span className="stitek">Stav bytu / vybavení</span><textarea name="stav_popis" rows={3} placeholder="Byt čistý, vymalováno, kuchyňská linka s spotřebiči…" className="pole" /></label>
        <label className="block"><span className="stitek">Závady a poškození</span><textarea name="zavady" rows={2} className="pole" /></label>
        <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} className="pole" /></label>
        <p className="text-xs text-slate-500">Po uložení se stavy zapíší jako {druh === "prevzeti" ? "počáteční" : "konečné"} odečty a můžete přidat fotky a vytisknout protokol k podpisu.</p>
        <Odeslat>Uložit protokol</Odeslat>
      </form>
    </>
  );
}
