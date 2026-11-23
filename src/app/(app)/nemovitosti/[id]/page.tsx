import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { STAVY_NEMOVITOSTI, korun, datum } from "@/lib/format";
import { Chyba, Nadpis } from "@/components/Chyba";

export default async function DetailNemovitosti({ params, searchParams }: PageProps<"/nemovitosti/[id]">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data: x } = await supabase.from("nemovitost")
    .select("*, typ:typ_nemovitosti(nazev), nadrazena:nadrazena_id(id, nazev), vlastnictvi(podil_citatel, podil_jmenovatel, vlastnik(nazev, zkratka))")
    .eq("id", id).maybeSingle();
  if (!x) notFound();

  const [jednotky, smlouvy, vynosnost] = await Promise.all([
    supabase.from("nemovitost").select("id, typ_kod, nazev, stav").eq("nadrazena_id", id).order("nazev"),
    supabase.from("najemni_smlouva").select("id, variabilni_symbol, datum_od, datum_do, stav, najemni_smlouva_osoba(osoba(jmeno, prijmeni, nazev_firmy))").eq("nemovitost_id", id).order("datum_od", { ascending: false }),
    supabase.from("v_vynosnost").select("*").eq("nemovitost_id", id).order("rok", { ascending: false }),
  ]);

  const udaje: [string, string][] = [
    ["Typ", `${x.typ_kod} – ${x.typ?.nazev ?? ""}`],
    ["Stav", STAVY_NEMOVITOSTI[x.stav]],
    ["Katastr", [x.katastralni_uzemi, x.lv && "LV " + x.lv, x.parcelni_cislo && "parc. " + x.parcelni_cislo].filter(Boolean).join(", ") || "–"],
    ["Adresa", [x.ulice, x.cislo_popisne, x.obec, x.psc].filter(Boolean).join(" ") || "–"],
    ["Plocha", x.plocha_m2 ? `${x.plocha_m2} m²` : "–"],
    ["Pořízení", `${korun(x.porizovaci_cena)} (${datum(x.datum_porizeni)})`],
    ["Tržní hodnota", korun(x.trzni_hodnota)],
    ["Vlastník", (x.vlastnictvi ?? []).map((v: { podil_citatel: number; podil_jmenovatel: number; vlastnik: { nazev: string } }) =>
      `${v.vlastnik?.nazev}${v.podil_jmenovatel > 1 ? ` (${v.podil_citatel}/${v.podil_jmenovatel})` : ""}`).join(", ") || "–"],
  ];

  return (
    <>
      <Nadpis titulek={x.nazev}
        podtitulek={x.nadrazena ? `Součást: ${x.nadrazena.nazev}` : undefined}
        akce={<div className="flex gap-2">
          {x.drive_folder_url && <a href={x.drive_folder_url} target="_blank" className="tlacitko-svetle">Složka na Disku ↗</a>}
          <Link href={`/smlouvy/nova?nemovitost=${x.id}`} className="tlacitko">+ Nájemní smlouva</Link>
        </div>} />
      <Chyba text={chyba} />

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="karta">
          <h2 className="mb-3 font-semibold">Údaje</h2>
          <dl className="space-y-2 text-sm">
            {udaje.map(([k, v]) => <div key={k}><dt className="stitek">{k}</dt><dd>{v}</dd></div>)}
          </dl>
          {x.poznamka && <p className="mt-3 text-sm text-slate-600">{x.poznamka}</p>}
        </section>

        <div className="space-y-6 lg:col-span-2">
          <section className="karta">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Jednotky</h2>
              <Link href={`/nemovitosti/nova?nadrazena=${x.id}`} className="text-sm odkaz">+ Přidat jednotku</Link>
            </div>
            {(jednotky.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Bez jednotek.</p> : (
              <ul className="space-y-1 text-sm">{(jednotky.data ?? []).map((j) =>
                <li key={j.id}><span className="mr-2 text-xs font-semibold text-slate-500">{j.typ_kod}</span>
                  <Link href={`/nemovitosti/${j.id}`} className="odkaz">{j.nazev}</Link> · {STAVY_NEMOVITOSTI[j.stav]}</li>)}</ul>
            )}
          </section>

          <section className="karta">
            <h2 className="mb-3 font-semibold">Nájemní smlouvy</h2>
            {(smlouvy.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Žádné smlouvy.</p> : (
              <table className="tabulka"><tbody>
                {(smlouvy.data ?? []).map((s) => (
                  <tr key={s.id}>
                    <td><Link href={`/smlouvy/${s.id}`} className="odkaz">VS {s.variabilni_symbol}</Link></td>
                    <td>{(s.najemni_smlouva_osoba as unknown as { osoba: { jmeno: string; prijmeni: string; nazev_firmy: string } }[])
                      .map((o) => o.osoba?.nazev_firmy ?? `${o.osoba?.jmeno ?? ""} ${o.osoba?.prijmeni ?? ""}`).join(", ")}</td>
                    <td>{datum(s.datum_od)} – {s.datum_do ? datum(s.datum_do) : "neurčito"}</td>
                    <td>{s.stav}</td>
                  </tr>))}
              </tbody></table>
            )}
          </section>

          <section className="karta overflow-x-auto">
            <h2 className="mb-3 font-semibold">Výnosnost</h2>
            {(vynosnost.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Zatím bez dat.</p> : (
              <table className="tabulka">
                <thead><tr><th>Rok</th><th className="text-right">Předepsáno</th><th className="text-right">Vybráno</th><th className="text-right">Náklady</th><th className="text-right">Čistý výnos</th><th className="text-right">% z pořízení</th></tr></thead>
                <tbody>{(vynosnost.data ?? []).map((v) => (
                  <tr key={v.rok}><td>{v.rok}</td><td className="text-right">{korun(v.najem_predepsany)}</td><td className="text-right">{korun(v.najem_vybrany)}</td>
                    <td className="text-right">{korun(v.provozni_naklady)}</td><td className="text-right font-medium">{korun(v.cisty_provozni_vynos)}</td>
                    <td className="text-right">{v.vynos_z_porizeni_pct != null ? `${v.vynos_z_porizeni_pct} %` : "–"}</td></tr>))}
                </tbody>
              </table>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
