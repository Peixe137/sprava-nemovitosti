import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { STAVY_NEMOVITOSTI, DUVODY_ARCHIVACE, korun, datum } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";

type Nem = { id: string; nadrazena_id: string | null; typ_kod: string; nazev: string; stav: string; obec: string | null; lv: string | null; trzni_hodnota: number | null; drive_folder_url: string | null; archivovano_dne: string | null; duvod_archivace: string | null; vlastnictvi: { vlastnik: { nazev: string; zkratka: string | null } | null }[] };

export default async function Nemovitosti({ searchParams }: PageProps<"/nemovitosti">) {
  const archiv = (await searchParams).archiv === "1";
  const supabase = await supabaseServer();
  const { data } = await supabase.from("nemovitost")
    .select("id, nadrazena_id, typ_kod, nazev, stav, obec, lv, trzni_hodnota, drive_folder_url, archivovano_dne, duvod_archivace, vlastnictvi(vlastnik(nazev, zkratka))")
    .order("nazev");
  const vsechny = (data ?? []) as unknown as Nem[];
  const pocetArchiv = vsechny.filter((x) => x.archivovano_dne).length;
  const vse = vsechny.filter((x) => !!x.archivovano_dne === archiv);
  const koreny = vse.filter((x) => !x.nadrazena_id || !vse.some((y) => y.id === x.nadrazena_id));
  const deti = (id: string) => vse.filter((x) => x.nadrazena_id === id);

  const disk = (x: Nem) => x.drive_folder_url ?? vsechny.find((y) => y.id === x.nadrazena_id)?.drive_folder_url ?? null;
  const Radek = ({ x, odsazeni }: { x: Nem; odsazeni?: boolean }) => (
    <tr>
      <td className={odsazeni ? "pl-8" : ""}>
        <span className="mr-2 inline-block w-6 rounded bg-slate-100 text-center text-xs font-semibold">{x.typ_kod}</span>
        <Link href={`/nemovitosti/${x.id}`} className="odkaz">{x.nazev}</Link>
      </td>
      <td>{x.obec ?? "–"}</td>
      <td>{x.lv ? "LV " + x.lv : "–"}</td>
      <td>{x.vlastnictvi.map((v) => v.vlastnik?.zkratka ? "@" + v.vlastnik.zkratka : v.vlastnik?.nazev).join(", ") || "–"}</td>
      <td>{x.archivovano_dne ? <span className="text-slate-500">{DUVODY_ARCHIVACE[x.duvod_archivace ?? "jine"]?.split(" (")[0]} {datum(x.archivovano_dne)}</span> : STAVY_NEMOVITOSTI[x.stav]}</td>
      <td className="text-right">{odsazeni ? "" : korun(x.trzni_hodnota)}</td>
      <td className="text-right">{disk(x) && <a href={disk(x)!} target="_blank" rel="noopener" className="tlacitko-svetle px-2 py-1 text-xs">Disk ↗</a>}</td>
    </tr>
  );

  return (
    <>
      <Nadpis titulek="Nemovitosti" podtitulek={`${vse.length} záznamů`}
        akce={<Link href="/nemovitosti/nova" className="tlacitko">+ Přidat nemovitost</Link>} />
      <div className="mb-4 flex gap-1 text-sm">
        <Link href="/nemovitosti" className={`rounded-lg px-3 py-1.5 ${!archiv ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Aktivní</Link>
        <Link href="/nemovitosti?archiv=1" className={`rounded-lg px-3 py-1.5 ${archiv ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-slate-100"}`}>Archiv{pocetArchiv ? ` (${pocetArchiv})` : ""}</Link>
      </div>
      <div className="karta overflow-x-auto">
        {vse.length === 0 ? (
          <p className="text-sm text-slate-500">{archiv ? "Archiv je prázdný. Prodané nemovitosti a ukončené správy se archivují přes Upravit." : "Zatím žádné nemovitosti. Začněte tlačítkem „Přidat nemovitost“."}</p>
        ) : (
          <table className="tabulka">
            <thead><tr><th>Název</th><th>Obec</th><th>LV</th><th>Vlastník</th><th>Stav</th><th className="text-right">Tržní hodnota</th><th></th></tr></thead>
            <tbody>
              {koreny.map((k) => [<Radek key={k.id} x={k} />, ...deti(k.id).map((d) => <Radek key={d.id} x={d} odsazeni />)])}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
