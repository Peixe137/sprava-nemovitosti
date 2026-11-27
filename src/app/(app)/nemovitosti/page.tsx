import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { STAVY_NEMOVITOSTI, VYUZITI, DUVODY_ARCHIVACE, datum } from "@/lib/format";
import { TabulkaNemovitosti, type RadekNem } from "@/components/TabulkaNemovitosti";
import { budouciNajem, denPred, pronajateIds } from "@/lib/obsazenost";
import { Nadpis } from "@/components/Chyba";

type Nem = { id: string; nadrazena_id: string | null; typ_kod: string; nazev: string; stav: string; vyuziti: string; upozorneni: string | null; obec: string | null; ulice: string | null; cislo_popisne: string | null; psc: string | null; zem_sirka: number | null; zem_delka: number | null; lv: string | null; trzni_hodnota: number | null; porizovaci_cena: number | null; drive_folder_url: string | null; archivovano_dne: string | null; duvod_archivace: string | null; vlastnictvi: { vlastnik: { id: string; nazev: string; zkratka: string | null } | null }[] };

export default async function Nemovitosti({ searchParams }: PageProps<"/nemovitosti">) {
  const sp = await searchParams;
  const archiv = sp.archiv === "1";
  const q = String(sp.q ?? "").trim();
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("nemovitost")
    .select("id, nadrazena_id, typ_kod, nazev, stav, vyuziti, upozorneni, obec, ulice, cislo_popisne, psc, zem_sirka, zem_delka, lv, trzni_hodnota, porizovaci_cena, drive_folder_url, archivovano_dne, duvod_archivace, vlastnictvi(vlastnik(id, nazev, zkratka))")
    .order("nazev");
  const vsechny = (data ?? []) as unknown as Nem[];
  const pocetArchiv = vsechny.filter((x) => x.archivovano_dne).length;
  // hledání: všechna slova v názvu, adrese, LV; u jednotky ukáže i její budovu
  const slova = norm(q).split(/\s+/).filter(Boolean);
  const sedi = (x: Nem) => slova.every((w) => norm([x.nazev, x.ulice, x.cislo_popisne, x.obec, x.psc, x.lv && "LV " + x.lv].filter(Boolean).join(" ")).includes(w));
  const vArchivu = vsechny.filter((x) => !!x.archivovano_dne === archiv);
  const nalezene = new Set(vArchivu.filter(sedi).map((x) => x.id));
  const vse = slova.length ? vArchivu.filter((x) => nalezene.has(x.id) || vArchivu.some((d) => d.nadrazena_id === x.id && nalezene.has(d.id))) : vArchivu;
  // filtry: vlastník (víc najednou) a fáze; jednotka zůstane s budovou, když budova vyhovuje
  const pole = (k: string) => ([] as string[]).concat((sp[k] as string | string[] | undefined) ?? []).filter(Boolean);
  const vlFiltr = pole("vl"), stavFiltr = pole("stav");
  const vlastniciVse = [...new Map(vsechny.flatMap((x) => x.vlastnictvi.map((v) => v.vlastnik)).filter(Boolean).map((v) => [v!.id, v!])).values()]
    .sort((a, b) => a.nazev.localeCompare(b.nazev, "cs"));
  const vyhovuje = (x: Nem) => (!vlFiltr.length || x.vlastnictvi.some((v) => v.vlastnik && vlFiltr.includes(v.vlastnik.id))) && (!stavFiltr.length || stavFiltr.includes(x.stav));
  const vybrane = vse.filter((x) => vyhovuje(x) || (x.nadrazena_id && vse.some((y) => y.id === x.nadrazena_id && vyhovuje(y))));
  const deti = (id: string) => vse.filter((x) => x.nadrazena_id === id);
  const { data: sml } = await supabase.from("najemni_smlouva").select("nemovitost_id, datum_od, datum_do, stav").eq("stav", "aktivni");
  const pronajato = pronajateIds(sml ?? []);
  const budouci = budouciNajem(sml ?? []);
  const adresa = (x: Nem) => [[x.ulice, x.cislo_popisne].filter(Boolean).join(" "), x.obec].filter(Boolean).join(", ");
  // Mapy.cz: přesný bod podle souřadnic z RÚIAN, jinak hledání podle adresy
  const mapa = (x: Nem) => x.zem_sirka && x.zem_delka
    ? `https://mapy.cz/zakladni?source=coor&id=${x.zem_delka}%2C${x.zem_sirka}&x=${x.zem_delka}&y=${x.zem_sirka}&z=18`
    : `https://mapy.cz/zakladni?q=${encodeURIComponent([adresa(x), x.psc].filter(Boolean).join(" "))}`;
  const stavText = (x: Nem) => {
    const d = deti(x.id);
    const obs = d.length ? `${d.filter((j) => pronajato.has(j.id)).length}/${d.length} pronajato`
      : x.vyuziti === "pronajem" ? (pronajato.has(x.id) ? "Pronajato" : budouci.has(x.id) ? `V rezervaci do ${datum(denPred(budouci.get(x.id)!))}` : "Volné") : VYUZITI[x.vyuziti];
    return x.stav === "drzeni" ? obs : `${STAVY_NEMOVITOSTI[x.stav]} · ${obs}`;
  };

  const disk = (x: Nem) => x.drive_folder_url ?? vsechny.find((y) => y.id === x.nadrazena_id)?.drive_folder_url ?? null;
  const radky: RadekNem[] = vybrane.map((x) => ({
    id: x.id, nadrazena_id: x.nadrazena_id, typ_kod: x.typ_kod, nazev: x.nazev, adresa: adresa(x), mapa: adresa(x) ? mapa(x) : null, lv: x.lv,
    vlastnik: x.vlastnictvi.map((v) => v.vlastnik?.zkratka ? "@" + v.vlastnik.zkratka : v.vlastnik?.nazev).join(", "),
    stav: x.archivovano_dne ? `${DUVODY_ARCHIVACE[x.duvod_archivace ?? "jine"]?.split(" (")[0]} ${datum(x.archivovano_dne)}` : stavText(x),
    volne: !x.archivovano_dne && stavText(x) === "Volné", upozorneni: x.upozorneni,
    porizovaci: x.nadrazena_id && vybrane.some((y) => y.id === x.nadrazena_id) ? null : x.porizovaci_cena,
    trzni: x.nadrazena_id && vybrane.some((y) => y.id === x.nadrazena_id) ? null : x.trzni_hodnota,
    disk: disk(x), jednotka: !!x.nadrazena_id,
  }));
  const odkazFiltru = (zmena: Record<string, string[]>) => {
    const p = new URLSearchParams();
    const hodnoty: Record<string, string[]> = { q: q ? [q] : [], archiv: archiv ? ["1"] : [], vl: vlFiltr, stav: stavFiltr, ...zmena };
    for (const [k, vs] of Object.entries(hodnoty)) vs.forEach((v) => p.append(k, v));
    return `/nemovitosti?${p}`;
  };
  const prepni = (pole: string[], h: string) => (pole.includes(h) ? pole.filter((x) => x !== h) : [...pole, h]);
  const chip = (zap: boolean) => `rounded-full border px-3 py-1 ${zap ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"}`;

  return (
    <>
      <Nadpis titulek="Nemovitosti" podtitulek={`${radky.filter((r) => !r.jednotka).length} nemovitostí, ${radky.filter((r) => r.jednotka).length} jednotek`}
        akce={<Link href="/nemovitosti/nova" className="tlacitko">+ Přidat nemovitost</Link>} />
      <form className="mb-3 flex max-w-xl gap-2" action="/nemovitosti">
        {archiv && <input type="hidden" name="archiv" value="1" />}
        {vlFiltr.map((v) => <input key={v} type="hidden" name="vl" value={v} />)}
        {stavFiltr.map((v) => <input key={v} type="hidden" name="stav" value={v} />)}
        <input type="search" name="q" defaultValue={q} placeholder="Hledat nemovitost – název, ulice, obec, LV…" className="pole" />
        <button className="tlacitko-svetle">Hledat</button>
        {q && <Link href={odkazFiltru({ q: [] })} className="tlacitko-svetle">Zrušit</Link>}
      </form>
      <div className="mb-4 space-y-2 text-sm">
        <div className="flex flex-wrap items-center gap-1.5">
          <Link href={odkazFiltru({ archiv: [] })} className={`rounded-lg px-3 py-1.5 ${!archiv ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Aktivní</Link>
          <Link href={odkazFiltru({ archiv: ["1"] })} className={`rounded-lg px-3 py-1.5 ${archiv ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Archiv{pocetArchiv ? ` (${pocetArchiv})` : ""}</Link>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="stitek mr-1">Vlastník</span>
          <Link href={odkazFiltru({ vl: [] })} className={chip(!vlFiltr.length)}>Všichni</Link>
          {vlastniciVse.map((v) => <Link key={v.id} href={odkazFiltru({ vl: prepni(vlFiltr, v.id) })} className={chip(vlFiltr.includes(v.id))} title={v.nazev}>{v.zkratka ? "@" + v.zkratka : v.nazev}</Link>)}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="stitek mr-1">Fáze</span>
          <Link href={odkazFiltru({ stav: [] })} className={chip(!stavFiltr.length)}>Všechny</Link>
          {Object.entries(STAVY_NEMOVITOSTI).map(([k, t]) => <Link key={k} href={odkazFiltru({ stav: prepni(stavFiltr, k) })} className={chip(stavFiltr.includes(k))}>{t}</Link>)}
        </div>
      </div>
      <div className="karta overflow-x-auto">
        {radky.length === 0 ? (
          <p className="text-sm text-slate-500">{archiv ? "Archiv je prázdný. Prodané nemovitosti a ukončené správy se archivují přes Upravit." : vse.length ? "Filtru nic neodpovídá." : "Zatím žádné nemovitosti. Začněte tlačítkem „Přidat nemovitost“."}</p>
        ) : (
          <TabulkaNemovitosti key={radky.map((r) => r.id).join()} radky={radky} archiv={archiv} />
        )}
        <p className="mt-3 text-xs text-slate-500">Zaškrtnutím vyberete, které nemovitosti se započítají do součtu. Vlastníky i fáze jde ve filtru kombinovat.</p>
      </div>
    </>
  );
}
