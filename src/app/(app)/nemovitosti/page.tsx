import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { STAVY_NEMOVITOSTI, VYUZITI, DUVODY_ARCHIVACE, korun, datum } from "@/lib/format";
import { pronajateIds } from "@/lib/obsazenost";
import { Nadpis } from "@/components/Chyba";

type Nem = { id: string; nadrazena_id: string | null; typ_kod: string; nazev: string; stav: string; vyuziti: string; upozorneni: string | null; obec: string | null; ulice: string | null; cislo_popisne: string | null; psc: string | null; zem_sirka: number | null; zem_delka: number | null; lv: string | null; trzni_hodnota: number | null; drive_folder_url: string | null; archivovano_dne: string | null; duvod_archivace: string | null; vlastnictvi: { vlastnik: { nazev: string; zkratka: string | null } | null }[] };

export default async function Nemovitosti({ searchParams }: PageProps<"/nemovitosti">) {
  const sp = await searchParams;
  const archiv = sp.archiv === "1";
  const q = String(sp.q ?? "").trim();
  const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();
  const supabase = await supabaseServer();
  const { data } = await supabase.from("nemovitost")
    .select("id, nadrazena_id, typ_kod, nazev, stav, vyuziti, upozorneni, obec, ulice, cislo_popisne, psc, zem_sirka, zem_delka, lv, trzni_hodnota, drive_folder_url, archivovano_dne, duvod_archivace, vlastnictvi(vlastnik(nazev, zkratka))")
    .order("nazev");
  const vsechny = (data ?? []) as unknown as Nem[];
  const pocetArchiv = vsechny.filter((x) => x.archivovano_dne).length;
  // hledání: všechna slova v názvu, adrese, LV; u jednotky ukáže i její budovu
  const slova = norm(q).split(/\s+/).filter(Boolean);
  const sedi = (x: Nem) => slova.every((w) => norm([x.nazev, x.ulice, x.cislo_popisne, x.obec, x.psc, x.lv && "LV " + x.lv].filter(Boolean).join(" ")).includes(w));
  const vArchivu = vsechny.filter((x) => !!x.archivovano_dne === archiv);
  const nalezene = new Set(vArchivu.filter(sedi).map((x) => x.id));
  const vse = slova.length ? vArchivu.filter((x) => nalezene.has(x.id) || vArchivu.some((d) => d.nadrazena_id === x.id && nalezene.has(d.id))) : vArchivu;
  const koreny = vse.filter((x) => !x.nadrazena_id || !vse.some((y) => y.id === x.nadrazena_id));
  const deti = (id: string) => vse.filter((x) => x.nadrazena_id === id);
  const { data: sml } = await supabase.from("najemni_smlouva").select("nemovitost_id, datum_od, datum_do, stav").eq("stav", "aktivni");
  const pronajato = pronajateIds(sml ?? []);
  const adresa = (x: Nem) => [[x.ulice, x.cislo_popisne].filter(Boolean).join(" "), x.obec].filter(Boolean).join(", ");
  // Mapy.cz: přesný bod podle souřadnic z RÚIAN, jinak hledání podle adresy
  const mapa = (x: Nem) => x.zem_sirka && x.zem_delka
    ? `https://mapy.cz/zakladni?source=coor&id=${x.zem_delka}%2C${x.zem_sirka}&x=${x.zem_delka}&y=${x.zem_sirka}&z=18`
    : `https://mapy.cz/zakladni?q=${encodeURIComponent([adresa(x), x.psc].filter(Boolean).join(" "))}`;
  const stavText = (x: Nem) => {
    const d = deti(x.id);
    const obs = d.length ? `${d.filter((j) => pronajato.has(j.id)).length}/${d.length} pronajato`
      : x.vyuziti === "pronajem" ? (pronajato.has(x.id) ? "Pronajato" : "Volné") : VYUZITI[x.vyuziti];
    return x.stav === "drzeni" ? obs : `${STAVY_NEMOVITOSTI[x.stav]} · ${obs}`;
  };

  const disk = (x: Nem) => x.drive_folder_url ?? vsechny.find((y) => y.id === x.nadrazena_id)?.drive_folder_url ?? null;
  const Radek = ({ x, odsazeni }: { x: Nem; odsazeni?: boolean }) => (
    <tr>
      <td className={odsazeni ? "pl-8" : ""}>
        <span className="mr-2 inline-block w-6 rounded bg-slate-100 text-center text-xs font-semibold">{x.typ_kod}</span>
        <Link href={`/nemovitosti/${x.id}`} className="odkaz">{x.nazev}</Link>
      </td>
      <td>{adresa(x) ? <a href={mapa(x)} target="_blank" rel="noopener" className="hover:underline" title="Otevřít na Mapy.cz">
        {adresa(x)} <span className="text-blue-700">↗</span></a> : "–"}</td>
      <td>{x.lv ? "LV " + x.lv : "–"}</td>
      <td>{x.vlastnictvi.map((v) => v.vlastnik?.zkratka ? "@" + v.vlastnik.zkratka : v.vlastnik?.nazev).join(", ") || "–"}</td>
      <td>{x.archivovano_dne ? <span className="text-slate-500">{DUVODY_ARCHIVACE[x.duvod_archivace ?? "jine"]?.split(" (")[0]} {datum(x.archivovano_dne)}</span> : <span className={stavText(x) === "Volné" ? "text-blue-700" : ""}>{stavText(x)}{x.upozorneni && <span title={x.upozorneni} className="ml-1 text-amber-600">⚠</span>}</span>}</td>
      <td className="text-right">{odsazeni ? "" : korun(x.trzni_hodnota)}</td>
      <td className="text-right">{disk(x) && <a href={disk(x)!} target="_blank" rel="noopener" className="tlacitko-svetle px-2 py-1 text-xs">Disk ↗</a>}</td>
    </tr>
  );

  return (
    <>
      <Nadpis titulek="Nemovitosti" podtitulek={`${vse.length} záznamů`}
        akce={<Link href="/nemovitosti/nova" className="tlacitko">+ Přidat nemovitost</Link>} />
      <form className="mb-4 flex max-w-xl gap-2" action="/nemovitosti">
        {archiv && <input type="hidden" name="archiv" value="1" />}
        <input type="search" name="q" defaultValue={q} placeholder="Hledat nemovitost – název, ulice, obec, LV…" className="pole" />
        <button className="tlacitko-svetle">Hledat</button>
        {q && <Link href={archiv ? "/nemovitosti?archiv=1" : "/nemovitosti"} className="tlacitko-svetle">Zrušit</Link>}
      </form>
      <div className="mb-4 flex gap-1 text-sm">
        <Link href="/nemovitosti" className={`rounded-lg px-3 py-1.5 ${!archiv ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Aktivní</Link>
        <Link href="/nemovitosti?archiv=1" className={`rounded-lg px-3 py-1.5 ${archiv ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Archiv{pocetArchiv ? ` (${pocetArchiv})` : ""}</Link>
      </div>
      <div className="karta overflow-x-auto">
        {vse.length === 0 ? (
          <p className="text-sm text-slate-500">{archiv ? "Archiv je prázdný. Prodané nemovitosti a ukončené správy se archivují přes Upravit." : "Zatím žádné nemovitosti. Začněte tlačítkem „Přidat nemovitost“."}</p>
        ) : (
          <table className="tabulka">
            <thead><tr><th>Název</th><th>Adresa</th><th>LV</th><th>Vlastník</th><th>Stav</th><th className="text-right">Tržní hodnota</th><th></th></tr></thead>
            <tbody>
              {koreny.map((k) => [<Radek key={k.id} x={k} />, ...deti(k.id).map((d) => <Radek key={d.id} x={d} odsazeni />)])}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
