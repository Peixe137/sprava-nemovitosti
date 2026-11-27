import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Zprava } from "@/components/Zprava";
import { Odeslat } from "@/components/Odeslat";
import { HledatNemovitost } from "@/components/HledatNemovitost";
import { moznostiNemovitosti } from "@/lib/vyberNemovitosti";
import { DRUHY_TERMINU, PRIORITY, OPAKOVANI, datum } from "@/lib/format";
import { Prilohy, nactiPrilohy, organizace } from "@/components/Prilohy";
import { pridatTermin, upravitTermin, splnitTermin, znovuOtevrit, smazatTermin } from "./actions";

type T = { id: string; druh: string; nazev: string; datum: string; priorita: string; popis: string | null; opakovani: string; upozornit_dni: number;
  splneno: boolean; splneno_dne: string | null; nemovitost_id: string | null; nemovitost: { nazev: string } | null };

function Formular({ akce, v, moznosti, tlacitko }: { akce: (f: FormData) => Promise<void>; v?: T; moznosti: Awaited<ReturnType<typeof moznostiNemovitosti>>; tlacitko: string }) {
  return (
    <form action={akce} className="grid gap-3 text-sm sm:grid-cols-4">
      <label className="block sm:col-span-2"><span className="stitek">Co</span><input name="nazev" required defaultValue={v?.nazev} placeholder="Revize plynu, výměna zámku, pojistka…" className="pole" /></label>
      <label className="block"><span className="stitek">Druh</span>
        <select name="druh" defaultValue={v?.druh ?? "ukol"} className="pole">{Object.entries(DRUHY_TERMINU).filter(([k]) => k !== "konec_smlouvy").map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select></label>
      <label className="block"><span className="stitek">Důležitost</span>
        <select name="priorita" defaultValue={v?.priorita ?? "dulezite"} className="pole">{Object.entries(PRIORITY).map(([k, x]) => <option key={k} value={k}>{x.text}</option>)}</select></label>
      <label className="block"><span className="stitek">Termín</span><input type="date" name="datum" required defaultValue={v?.datum ?? new Date().toISOString().slice(0, 10)} className="pole" /></label>
      <label className="block"><span className="stitek">Opakování</span>
        <select name="opakovani" defaultValue={v?.opakovani ?? "zadne"} className="pole">{Object.entries(OPAKOVANI).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select></label>
      <label className="block"><span className="stitek">Upozornit dní předem</span><input type="number" name="upozornit_dni" min={0} max={365} defaultValue={v?.upozornit_dni ?? 14} className="pole" /></label>
      <label className="block"><span className="stitek">Nemovitost</span><HledatNemovitost name="nemovitost" moznosti={moznosti} vychozi={v?.nemovitost_id ?? ""} prazdna="Bez nemovitosti" /></label>
      <label className="block sm:col-span-3"><span className="stitek">Poznámka</span><textarea name="popis" rows={2} defaultValue={v?.popis ?? ""} className="pole" /></label>
      <div className="flex items-end"><Odeslat className="w-full justify-center">{tlacitko}</Odeslat></div>
    </form>
  );
}

/** Úkoly, termíny a revize – barva podle důležitosti (urgentní červeně, důležité zeleně, nedůležité šedě). */
export default async function Terminy({ searchParams }: PageProps<"/terminy">) {
  const sp = await searchParams;
  const zobrazit = sp.zobrazit === "splnene" ? "splnene" : "otevrene";
  const priorita = typeof sp.priorita === "string" ? sp.priorita : "";
  const nem = typeof sp.nemovitost === "string" ? sp.nemovitost : "";
  const uprav = typeof sp.uprav === "string" ? sp.uprav : "";
  const supabase = await supabaseServer();
  let q = supabase.from("termin").select("id, druh, nazev, datum, priorita, popis, opakovani, upozornit_dni, splneno, splneno_dne, nemovitost_id, nemovitost(nazev)")
    .eq("splneno", zobrazit === "splnene").order(zobrazit === "splnene" ? "splneno_dne" : "datum", { ascending: zobrazit !== "splnene" }).limit(300);
  if (priorita) q = q.eq("priorita", priorita);
  const [{ data }, moznosti, podrizene] = await Promise.all([
    q, moznostiNemovitosti(supabase, { vcetneArchivu: false }),
    nem ? supabase.from("nemovitost").select("id").eq("nadrazena_id", nem) : Promise.resolve({ data: [] as { id: string }[] }),
  ]);
  const ids = new Set([nem, ...(podrizene.data ?? []).map((x) => x.id)]);
  const PORADI: Record<string, number> = { urgentni: 0, dulezite: 1, nedulezite: 2 };
  const dnes = new Date().toISOString().slice(0, 10);
  const radky = ((data ?? []) as unknown as T[]).filter((r) => !nem || (r.nemovitost_id && ids.has(r.nemovitost_id)))
    .sort((a, b) => zobrazit === "splnene" ? 0 : (Number(b.datum < dnes) - Number(a.datum < dnes)) || (PORADI[a.priorita] - PORADI[b.priorita]) || a.datum.localeCompare(b.datum));
  const [prilohy, org] = await Promise.all([nactiPrilohy("termin", radky.map((r) => r.id)), organizace()]);
  const cestaZpet = "/terminy";
  const pocet = (p: string) => radky.filter((r) => r.priorita === p).length;
  const odkaz = (zmena: Record<string, string>) => `/terminy?${new URLSearchParams(Object.entries({ zobrazit, priorita, nemovitost: nem, ...zmena }).filter(([, v]) => v && v !== "otevrene"))}`;

  return (
    <>
      <Nadpis titulek="Úkoly a termíny" podtitulek="Revize, pojištění, daně a běžné úkoly k nemovitostem" />
      <Chyba text={typeof sp.chyba === "string" ? sp.chyba : undefined} />
      <Zprava />
      <details className="karta mb-6" open={radky.length === 0 && zobrazit === "otevrene"}>
        <summary className="cursor-pointer font-medium">+ Nový úkol nebo termín</summary>
        <div className="mt-3"><Formular akce={pridatTermin} moznosti={moznosti} tlacitko="Přidat" /></div>
      </details>

      <div className="mb-4 flex flex-wrap items-center gap-1.5 text-sm">
        {[["otevrene", "Otevřené"], ["splnene", "Splněné"]].map(([k, x]) => (
          <Link key={k} href={odkaz({ zobrazit: k })} className={`rounded-full px-3 py-1 ${zobrazit === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{x}</Link>))}
        <span className="mx-2 text-slate-300">|</span>
        <Link href={odkaz({ priorita: "" })} className={`rounded-full px-3 py-1 ${!priorita ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Vše</Link>
        {Object.entries(PRIORITY).map(([k, x]) => (
          <Link key={k} href={odkaz({ priorita: k })} className={`flex items-center gap-1.5 rounded-full px-3 py-1 ${priorita === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>
            <i className={`inline-block h-2 w-2 rounded-full ${x.tecka}`} />{x.text}{!priorita && pocet(k) ? ` (${pocet(k)})` : ""}</Link>))}
        <div className="ml-auto w-64"><HledatNemovitost name="nemovitost" moznosti={moznosti} vychozi={nem} prazdna="Všechny nemovitosti"
          navigace={`/terminy?${new URLSearchParams(Object.entries({ zobrazit, priorita }).filter(([, v]) => v && v !== "otevrene"))}&nemovitost=`} /></div>
      </div>

      <section className="karta">
        {radky.length === 0 ? <p className="text-sm text-slate-500">{zobrazit === "splnene" ? "Zatím nic splněno." : "Žádné otevřené úkoly ani termíny."}</p> : (
          <ul className="space-y-2">{radky.map((r) => {
            const p = PRIORITY[r.priorita] ?? PRIORITY.dulezite;
            const pozde = !r.splneno && r.datum < dnes;
            return (
              <li key={r.id} className={`rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm ${p.radek} ${r.splneno ? "opacity-60" : ""}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-xs ${p.stitek}`}>{p.text}</span>
                      <b className={r.splneno ? "line-through" : ""}>{r.nazev}</b>
                      <span className="text-xs text-slate-500">{DRUHY_TERMINU[r.druh] ?? r.druh}{r.opakovani !== "zadne" ? ` · ${OPAKOVANI[r.opakovani].toLowerCase()}` : ""}</span>
                    </div>
                    {r.nemovitost && <Link href={`/nemovitosti/${r.nemovitost_id}`} className="text-xs odkaz">{r.nemovitost.nazev}</Link>}
                    {r.popis && <div className="mt-1 whitespace-pre-line text-xs text-slate-600">{r.popis}</div>}
                    {(prilohy.get(r.id)?.length ?? 0) > 0 && uprav !== r.id && <div className="mt-2"><Prilohy seznam={prilohy.get(r.id)!} org={org} tabulka="termin" zaznamId={r.id} cesta={cestaZpet} nahravat={false} /></div>}
                  </div>
                  <div className="flex items-center gap-3 whitespace-nowrap">
                    <span className={pozde ? "font-semibold text-red-700" : "text-slate-600"}>{r.splneno ? `splněno ${datum(r.splneno_dne)}` : `${pozde ? "po termínu · " : ""}${datum(r.datum)}`}</span>
                    {r.splneno
                      ? <form action={znovuOtevrit.bind(null, r.id)}><button className="text-xs text-slate-500 hover:underline">vrátit</button></form>
                      : <form action={splnitTermin.bind(null, r.id)}><button className="rounded-md border border-emerald-300 bg-emerald-50 px-2 py-1 text-xs text-emerald-800 hover:bg-emerald-100">✓ Splněno</button></form>}
                    <Link href={odkaz({ uprav: r.id })} className="text-xs text-blue-700 hover:underline">{(prilohy.get(r.id)?.length ?? 0) ? `📎 ${prilohy.get(r.id)!.length} · ` : ""}upravit / přílohy</Link>
                  </div>
                </div>
                {uprav === r.id && (
                  <div className="mt-3 border-t border-slate-100 pt-3">
                    <Formular akce={upravitTermin.bind(null, r.id)} v={r} moznosti={moznosti} tlacitko="Uložit" />
                    <div className="mt-3"><div className="stitek mb-1">Fotky a dokumenty</div>
                      <Prilohy seznam={prilohy.get(r.id) ?? []} org={org} tabulka="termin" zaznamId={r.id} cesta={cestaZpet} /></div>
                    <form action={smazatTermin.bind(null, r.id)} className="mt-2 text-right"><button className="text-xs text-slate-400 hover:text-red-700">smazat</button></form>
                  </div>)}
              </li>);
          })}</ul>
        )}
      </section>
    </>
  );
}
