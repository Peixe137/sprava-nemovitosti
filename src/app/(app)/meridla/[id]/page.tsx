import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { OdecetFormular } from "@/components/OdecetFormular";
import { Prilohy, nactiPrilohy, organizace } from "@/components/Prilohy";
import { DRUHY_MERIDEL, JEDNOTKY_MERIDEL, UCEL_MERIDLA, DRUHY_ODECTU, datum, cislo } from "@/lib/format";
import { upravitMeridlo, smazatOdecet } from "../actions";

/** Měřidlo: údaje, historie odečtů se spotřebou a fotkami. */
export default async function Meridlo({ params, searchParams }: PageProps<"/meridla/[id]">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data: m } = await supabase.from("meridlo").select("*, nemovitost(id, nazev)").eq("id", id).maybeSingle();
  if (!m) notFound();
  const { data: odecty } = await supabase.from("odecet").select("id, datum, stav, druh, poznamka, protokol_id, predavaci_protokol(smlouva_id, druh)").eq("meridlo_id", id).order("datum", { ascending: false }).order("vytvoreno", { ascending: false });
  const radky = (odecty ?? []) as unknown as { id: string; datum: string; stav: number; druh: string; poznamka: string | null; protokol_id: string | null; predavaci_protokol: { smlouva_id: string; druh: string } | null }[];
  const [fotky, org] = await Promise.all([nactiPrilohy("odecet", radky.map((r) => r.id)), organizace()]);
  const j = m.jednotka ?? JEDNOTKY_MERIDEL[m.druh];
  const nem = m.nemovitost as { id: string; nazev: string };

  return (
    <>
      <Nadpis titulek={`${DRUHY_MERIDEL[m.druh]}${m.vyrobni_cislo ? ` č. ${m.vyrobni_cislo}` : ""}`}
        podtitulek={<><Link href={`/nemovitosti/${nem.id}#energie`} className="odkaz">{nem.nazev}</Link>{m.umisteni ? ` · ${m.umisteni}` : ""} · {UCEL_MERIDLA[m.ucel]}{m.aktivni ? "" : " · neaktivní"}</>} />
      <Chyba text={typeof chyba === "string" ? chyba : undefined} />
      <div className="grid gap-6 lg:grid-cols-3">
        <section className="karta lg:col-span-2">
          <h2 className="mb-3 font-semibold">Odečty</h2>
          {m.aktivni && <div className="mb-4 rounded-lg bg-slate-50 p-3"><OdecetFormular meridloId={id} org={org} jednotka={j} /></div>}
          {radky.length === 0 ? <p className="text-sm text-slate-500">Zatím žádný odečet.</p> : (
            <table className="tabulka text-sm">
              <thead><tr><th>Datum</th><th className="text-right">Stav</th><th className="text-right">Spotřeba</th><th>Druh</th><th>Fotka / poznámka</th><th></th></tr></thead>
              <tbody>{radky.map((r, i) => {
                const pred = radky[i + 1];
                const spotreba = pred && r.druh !== "vymena" ? Number(r.stav) - Number(pred.stav) : null;
                return (
                  <tr key={r.id} className="align-top">
                    <td className="whitespace-nowrap">{datum(r.datum)}</td>
                    <td className="text-right whitespace-nowrap font-medium">{cislo(r.stav)} {j}</td>
                    <td className={`text-right whitespace-nowrap ${spotreba != null && spotreba < 0 ? "minus" : ""}`}>{spotreba != null ? `${cislo(spotreba)} ${j}` : "–"}</td>
                    <td>{DRUHY_ODECTU[r.druh]}{r.predavaci_protokol && <div className="text-xs"><Link href={`/smlouvy/${r.predavaci_protokol.smlouva_id}/protokol/${r.protokol_id}`} className="odkaz">předávací protokol</Link></div>}</td>
                    <td>{r.poznamka && <div className="mb-1 text-xs text-slate-600">{r.poznamka}</div>}
                      <Prilohy seznam={fotky.get(r.id) ?? []} org={org} tabulka="odecet" zaznamId={r.id} cesta={`/meridla/${id}`} nahravat={false} /></td>
                    <td className="text-right"><form action={smazatOdecet.bind(null, id, r.id)}><button className="text-xs text-slate-400 hover:text-red-700">smazat</button></form></td>
                  </tr>);
              })}</tbody>
            </table>
          )}
        </section>
        <section className="karta text-sm">
          <h2 className="mb-3 font-semibold">Údaje měřidla</h2>
          <form action={upravitMeridlo.bind(null, id, `/meridla/${id}`)} className="space-y-3">
            <label className="block"><span className="stitek">Druh</span><select name="druh" defaultValue={m.druh} className="pole">{Object.entries(DRUHY_MERIDEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="block"><span className="stitek">Účel</span><select name="ucel" defaultValue={m.ucel} className="pole">{Object.entries(UCEL_MERIDLA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="block"><span className="stitek">Výrobní číslo</span><input name="vyrobni_cislo" defaultValue={m.vyrobni_cislo ?? ""} className="pole" /></label>
            <label className="block"><span className="stitek">Umístění</span><input name="umisteni" defaultValue={m.umisteni ?? ""} className="pole" /></label>
            <label className="block"><span className="stitek">Jednotka</span><input name="jednotka" defaultValue={m.jednotka ?? ""} placeholder={JEDNOTKY_MERIDEL[m.druh]} className="pole" /></label>
            <label className="block"><span className="stitek">Platnost cejchu do</span><input type="date" name="cejch_do" defaultValue={m.cejch_do ?? ""} className="pole" /></label>
            <label className="block"><span className="stitek">Poznámka</span><input name="poznamka" defaultValue={m.poznamka ?? ""} className="pole" /></label>
            <label className="flex items-center gap-2"><input type="checkbox" name="aktivni" defaultChecked={m.aktivni} /> Aktivní (po výměně starého měřidla odškrtněte)</label>
            <Odeslat>Uložit</Odeslat>
          </form>
          <p className="mt-3 text-xs text-slate-500">Při výměně: u starého měřidla zapište konečný stav, odškrtněte Aktivní a v detailu nemovitosti přidejte nové měřidlo s počátečním stavem.</p>
        </section>
      </div>
    </>
  );
}
