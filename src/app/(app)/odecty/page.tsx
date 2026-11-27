import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Zprava } from "@/components/Zprava";
import { Odeslat } from "@/components/Odeslat";
import { HledatNemovitost } from "@/components/HledatNemovitost";
import { moznostiNemovitosti } from "@/lib/vyberNemovitosti";
import { DRUHY_MERIDEL, JEDNOTKY_MERIDEL, UCEL_MERIDLA, DRUHY_ODECTU, datum, cislo } from "@/lib/format";
import { hromadneOdecty } from "../meridla/actions";

/** Hromadné odečty: stavy všech aktivních měřidel najednou (konec roku, kontrola). */
export default async function Odecty({ searchParams }: PageProps<"/odecty">) {
  const sp = await searchParams;
  const nem = typeof sp.nemovitost === "string" ? sp.nemovitost : "";
  const supabase = await supabaseServer();
  const [mer, moznosti, podrizene] = await Promise.all([
    supabase.from("meridlo").select("id, nemovitost_id, druh, ucel, vyrobni_cislo, umisteni, jednotka, nemovitost(nazev, nadrazena_id)").eq("aktivni", true),
    moznostiNemovitosti(supabase, {}),
    nem ? supabase.from("nemovitost").select("id").eq("nadrazena_id", nem) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const ids = new Set([nem, ...(podrizene.data ?? []).map((x) => x.id)]);
  type M = { id: string; nemovitost_id: string; druh: string; ucel: string; vyrobni_cislo: string | null; umisteni: string | null; jednotka: string | null; nemovitost: { nazev: string; nadrazena_id: string | null } };
  const meridla = ((mer.data ?? []) as unknown as M[]).filter((m) => !nem || ids.has(m.nemovitost_id))
    .sort((a, b) => a.nemovitost.nazev.localeCompare(b.nemovitost.nazev, "cs") || a.druh.localeCompare(b.druh));
  const { data: odecty } = meridla.length
    ? await supabase.from("odecet").select("meridlo_id, datum, stav").in("meridlo_id", meridla.map((m) => m.id)).order("datum", { ascending: false })
    : { data: [] };
  const posledni = new Map<string, { datum: string; stav: number }>();
  for (const o of odecty ?? []) if (!posledni.has(o.meridlo_id)) posledni.set(o.meridlo_id, o);
  const rok = new Date().getFullYear();
  const konecRoku = `${new Date().getMonth() >= 10 ? rok : rok - 1}-12-31`;

  return (
    <>
      <Nadpis titulek="Hromadné odečty" podtitulek="Stavy všech měřidel najednou – ke konci roku, při kontrole nebo před vyúčtováním" />
      <Chyba text={typeof sp.chyba === "string" ? sp.chyba : undefined} />
      <Zprava />
      <div className="mb-4 max-w-md"><span className="stitek">Nemovitost (budova včetně jednotek)</span>
        <HledatNemovitost name="nemovitost" moznosti={moznosti} vychozi={nem} prazdna="Všechny nemovitosti" navigace="/odecty?nemovitost=" /></div>
      <form action={hromadneOdecty} className="karta overflow-x-auto">
        {nem && <input type="hidden" name="nemovitost" value={nem} />}
        <div className="mb-4 flex flex-wrap items-end gap-3 text-sm">
          <label className="block"><span className="stitek">Datum odečtu</span><input type="date" name="datum" defaultValue={konecRoku} className="pole w-auto" /></label>
          <label className="block"><span className="stitek">Druh</span>
            <select name="druh" defaultValue="pravidelny" className="pole w-auto">{Object.entries(DRUHY_ODECTU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <p className="text-xs text-slate-500">Vyplňte jen měřidla, která máte odečtená, prázdná se přeskočí. Fotky přidáte u měřidla (odkaz „historie“).</p>
        </div>
        {meridla.length === 0 ? <p className="text-sm text-slate-500">Žádná aktivní měřidla. Přidáte je v detailu nemovitosti v sekci Energie a měřidla.</p> : (
          <table className="tabulka text-sm">
            <thead><tr><th>Nemovitost</th><th>Měřidlo</th><th>Poslední stav</th><th>Nový stav</th></tr></thead>
            <tbody>{meridla.map((m) => {
              const p = posledni.get(m.id); const j = m.jednotka ?? JEDNOTKY_MERIDEL[m.druh];
              return (
                <tr key={m.id}>
                  <td><Link href={`/nemovitosti/${m.nemovitost_id}#energie`} className="odkaz">{m.nemovitost.nazev}</Link></td>
                  <td>{DRUHY_MERIDEL[m.druh]}{m.ucel !== "jednotka" && <span className="text-xs text-violet-700"> · {UCEL_MERIDLA[m.ucel]}</span>}
                    <div className="text-xs text-slate-500">{[m.vyrobni_cislo && `č. ${m.vyrobni_cislo}`, m.umisteni].filter(Boolean).join(" · ")} · <Link href={`/meridla/${m.id}`} className="odkaz">historie</Link></div></td>
                  <td className="whitespace-nowrap">{p ? <>{cislo(p.stav)} {j} <span className="text-xs text-slate-500">({datum(p.datum)})</span></> : <span className="text-slate-400">–</span>}</td>
                  <td><div className="flex items-center gap-1"><input name={`stav_${m.id}`} inputMode="decimal" className="pole w-32 py-1" /><span className="text-xs text-slate-500">{j}</span></div></td>
                </tr>);
            })}</tbody>
          </table>
        )}
        {meridla.length > 0 && <div className="mt-4"><Odeslat>Uložit odečty</Odeslat></div>}
      </form>
    </>
  );
}
