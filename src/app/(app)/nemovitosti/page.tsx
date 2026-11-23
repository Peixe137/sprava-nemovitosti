import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { STAVY_NEMOVITOSTI, korun } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";

type Nem = { id: string; nadrazena_id: string | null; typ_kod: string; nazev: string; stav: string; obec: string | null; lv: string | null; trzni_hodnota: number | null; vlastnictvi: { vlastnik: { nazev: string; zkratka: string | null } | null }[] };

export default async function Nemovitosti() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("nemovitost")
    .select("id, nadrazena_id, typ_kod, nazev, stav, obec, lv, trzni_hodnota, vlastnictvi(vlastnik(nazev, zkratka))")
    .order("nazev");
  const vse = (data ?? []) as unknown as Nem[];
  const koreny = vse.filter((x) => !x.nadrazena_id || !vse.some((y) => y.id === x.nadrazena_id));
  const deti = (id: string) => vse.filter((x) => x.nadrazena_id === id);

  const Radek = ({ x, odsazeni }: { x: Nem; odsazeni?: boolean }) => (
    <tr>
      <td className={odsazeni ? "pl-8" : ""}>
        <span className="mr-2 inline-block w-6 rounded bg-slate-100 text-center text-xs font-semibold">{x.typ_kod}</span>
        <Link href={`/nemovitosti/${x.id}`} className="odkaz">{x.nazev}</Link>
      </td>
      <td>{x.obec ?? "–"}</td>
      <td>{x.lv ? "LV " + x.lv : "–"}</td>
      <td>{x.vlastnictvi.map((v) => v.vlastnik?.zkratka ? "@" + v.vlastnik.zkratka : v.vlastnik?.nazev).join(", ") || "–"}</td>
      <td>{STAVY_NEMOVITOSTI[x.stav]}</td>
      <td className="text-right">{korun(x.trzni_hodnota)}</td>
    </tr>
  );

  return (
    <>
      <Nadpis titulek="Nemovitosti" podtitulek={`${vse.length} záznamů`}
        akce={<Link href="/nemovitosti/nova" className="tlacitko">+ Přidat nemovitost</Link>} />
      <div className="karta overflow-x-auto">
        {vse.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím žádné nemovitosti. Začněte tlačítkem „Přidat nemovitost“.</p>
        ) : (
          <table className="tabulka">
            <thead><tr><th>Název</th><th>Obec</th><th>LV</th><th>Vlastník</th><th>Stav</th><th className="text-right">Tržní hodnota</th></tr></thead>
            <tbody>
              {koreny.map((k) => [<Radek key={k.id} x={k} />, ...deti(k.id).map((d) => <Radek key={d.id} x={d} odsazeni />)])}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
