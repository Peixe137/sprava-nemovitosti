import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { STAVY_NEMOVITOSTI, VYUZITI, korun, datum, DUVODY_ARCHIVACE } from "@/lib/format";
import { pronajateIds } from "@/lib/obsazenost";
import { Chyba, Nadpis } from "@/components/Chyba";
import { pridatKatastralniPolozku, smazatKatastralniPolozku, upravitKatastralniPolozku } from "../actions";
import { Odeslat } from "@/components/Odeslat";

export default async function DetailNemovitosti({ params, searchParams }: PageProps<"/nemovitosti/[id]">) {
  const { id } = await params;
  const { chyba, uprav } = await searchParams;
  const supabase = await supabaseServer();
  const { data: x } = await supabase.from("nemovitost")
    .select("*, typ:typ_nemovitosti(nazev), nadrazena:nadrazena_id(id, nazev, drive_folder_url, cislo_popisne), vlastnictvi(podil_citatel, podil_jmenovatel, vlastnik(nazev, zkratka))")
    .eq("id", id).maybeSingle();
  if (!x) notFound();

  const [jednotky, smlouvy, vynosnost, katastr] = await Promise.all([
    supabase.from("nemovitost").select("id, typ_kod, nazev, stav, vyuziti, archivovano_dne").eq("nadrazena_id", id).order("nazev"),
    supabase.from("najemni_smlouva").select("id, variabilni_symbol, datum_od, datum_do, stav, najemni_smlouva_osoba(osoba(jmeno, prijmeni, nazev_firmy))").eq("nemovitost_id", id).order("datum_od", { ascending: false }),
    supabase.from("v_vynosnost").select("*").eq("nemovitost_id", id).order("rok", { ascending: false }),
    supabase.from("katastralni_polozka").select("*").eq("nemovitost_id", id).order("druh").order("cislo_parcely"),
  ]);
  const polozky = katastr.data ?? [];
  const jedn = (jednotky.data ?? []).filter((j) => !j.archivovano_dne);
  const { data: smlJednotek } = jedn.length
    ? await supabase.from("najemni_smlouva").select("nemovitost_id, datum_od, datum_do, stav").in("nemovitost_id", jedn.map((j) => j.id))
    : { data: [] };
  const pronajato = pronajateIds([...(smlJednotek ?? []), ...(smlouvy.data ?? []).map((s) => ({ ...s, nemovitost_id: id }))]);
  const obsazenost = jedn.length
    ? `${jedn.filter((j) => pronajato.has(j.id)).length} z ${jedn.length} jednotek pronajato`
    : x.vyuziti === "pronajem" ? (pronajato.has(id) ? "Pronajato" : "Volné") : "";
  // jednotka bez vlastní podsložky otevře složku budovy
  const disk: string | null = x.drive_folder_url ?? x.nadrazena?.drive_folder_url ?? null;
  const vymeraCelkem = polozky.filter((k) => k.druh === "parcela").reduce((a, k) => a + Number(k.vymera_m2 ?? 0), 0);
  const DRUH: Record<string, string> = { parcela: "Pozemek", stavba: "Stavba", jednotka: "Jednotka" };

  const udaje: [string, string][] = [
    ["Typ", `${x.typ_kod} – ${x.typ?.nazev ?? ""}`],
    ["Fáze", STAVY_NEMOVITOSTI[x.stav] ?? x.stav],
    ["Využití", [VYUZITI[x.vyuziti], obsazenost].filter(Boolean).join(" · ")],
    ...(x.patro != null ? [["Patro", x.patro === 0 ? "přízemí" : `${x.patro}.`] as [string, string]] : []),
    ...(x.kod_jednotky ? [["Označení jednotky", `${x.nadrazena?.cislo_popisne ? x.nadrazena.cislo_popisne + "-" : ""}${String(x.kod_jednotky).padStart(3, "0")}`] as [string, string]] : []),
    ["Katastr", [x.katastralni_uzemi, x.lv && "LV " + x.lv, x.parcelni_cislo && "parc. " + x.parcelni_cislo].filter(Boolean).join(", ") || "–"],
    ["Adresa", ([x.ulice, x.cislo_popisne, x.obec, x.psc].filter(Boolean).join(" ") || "–") + (x.nadrazena ? " (z budovy)" : "")],
    ["Plocha", x.plocha_m2 ? `${x.plocha_m2} m²` : "–"],
    ["Pořízení", `${korun(x.porizovaci_cena)} (${datum(x.datum_porizeni)})`],
    ["Tržní hodnota", korun(x.trzni_hodnota)],
    ["Vlastník", (x.vlastnictvi ?? []).map((v: { podil_citatel: number; podil_jmenovatel: number; vlastnik: { nazev: string } }) =>
      `${v.vlastnik?.nazev}${v.podil_jmenovatel > 1 ? ` (${v.podil_citatel}/${v.podil_jmenovatel})` : ""}`).join(", ") || "–"],
  ];

  return (
    <>
      {x.archivovano_dne && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        V archivu od {datum(x.archivovano_dne)} – {DUVODY_ARCHIVACE[x.duvod_archivace ?? "jine"]}. Obnovit jde přes Upravit.</div>}
      {x.upozorneni && <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">⚠ {x.upozorneni}</div>}
      <Nadpis titulek={x.nazev}
        podtitulek={x.nadrazena ? `Součást: ${x.nadrazena.nazev}` : undefined}
        akce={<div className="flex flex-wrap gap-2">
          {disk ? <a href={disk} target="_blank" rel="noopener" className="tlacitko-svetle">Otevřít složku na Disku ↗</a>
            : <Link href={`/nemovitosti/${x.id}/upravit`} className="tlacitko-svetle text-slate-500">+ odkaz na složku Disku</Link>}
          <Link href={`/nemovitosti/${x.id}/upravit`} className="tlacitko-svetle">Upravit</Link>
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
          <section id="katastr" className="karta overflow-x-auto">
            <div className="mb-3 flex items-baseline justify-between">
              <h2 className="font-semibold">Katastr – z čeho se nemovitost skládá</h2>
              {vymeraCelkem > 0 && <span className="text-sm text-slate-500">pozemky celkem {vymeraCelkem.toLocaleString("cs-CZ")} m²</span>}
            </div>
            {polozky.length === 0 ? <p className="mb-3 text-sm text-slate-500">Zatím žádné pozemky, stavby ani jednotky.</p> : (
              <table className="tabulka mb-4">
                <thead><tr><th>Druh</th><th>K.ú.</th><th>Označení</th><th>LV</th><th className="text-right">Výměra</th><th>Podíl</th><th></th></tr></thead>
                <tbody>{polozky.map((k) => [
                  <tr key={k.id}>
                    <td>{DRUH[k.druh]}{k.druh_pozemku && <div className="text-xs text-slate-500">{k.druh_pozemku}</div>}</td>
                    <td>{k.katastralni_uzemi ?? "–"}</td>
                    <td>{k.druh === "parcela" ? `parc. ${k.cislo_parcely ?? "?"}` : k.druh === "stavba" ? `č.p. ${k.cislo_popisne ?? "?"}${k.cislo_parcely ? ` na parc. ${k.cislo_parcely}` : ""}` : `jedn. ${k.cislo_jednotky ?? "?"}`}
                      {k.poznamka && <div className="text-xs text-slate-500">{k.poznamka}</div>}</td>
                    <td>{k.lv ?? "–"}</td>
                    <td className="text-right">{k.vymera_m2 ? `${Number(k.vymera_m2).toLocaleString("cs-CZ")} m²` : "–"}</td>
                    <td>{k.podil_jmenovatel ? `${k.podil_citatel}/${k.podil_jmenovatel}` : "–"}</td>
                    <td className="text-right whitespace-nowrap">
                      <a href={`?uprav=${k.id}#katastr`} className="text-xs text-blue-700 hover:underline">upravit</a>
                      <form action={smazatKatastralniPolozku.bind(null, id, k.id)} className="inline"><button className="ml-3 text-xs text-slate-400 hover:text-red-700">odebrat</button></form>
                    </td>
                  </tr>,
                  uprav === k.id && (
                    <tr key={k.id + "-e"}><td colSpan={7} className="bg-slate-50">
                      <form action={upravitKatastralniPolozku.bind(null, id, k.id)} className="grid gap-2 py-2 sm:grid-cols-4">
                        <label className="block"><span className="stitek">Druh</span>
                          <select name="druh" defaultValue={k.druh} className="pole"><option value="parcela">Pozemek</option><option value="stavba">Stavba</option><option value="jednotka">Jednotka</option></select></label>
                        <label className="block"><span className="stitek">K.ú.</span><input name="katastralni_uzemi" defaultValue={k.katastralni_uzemi ?? ""} className="pole" /></label>
                        <label className="block"><span className="stitek">Parcela</span><input name="cislo_parcely" defaultValue={k.cislo_parcely ?? ""} className="pole" /></label>
                        <label className="block"><span className="stitek">LV</span><input name="lv" defaultValue={k.lv ?? ""} className="pole" /></label>
                        <label className="block"><span className="stitek">Č.p.</span><input name="cislo_popisne" defaultValue={k.cislo_popisne ?? ""} className="pole" /></label>
                        <label className="block"><span className="stitek">Č. jednotky</span><input name="cislo_jednotky" defaultValue={k.cislo_jednotky ?? ""} className="pole" /></label>
                        <label className="block"><span className="stitek">Výměra m²</span><input name="vymera_m2" defaultValue={k.vymera_m2 ?? ""} className="pole" /></label>
                        <label className="block"><span className="stitek">Druh pozemku</span><input name="druh_pozemku" defaultValue={k.druh_pozemku ?? ""} className="pole" /></label>
                        <label className="block"><span className="stitek">Podíl</span><div className="flex items-center gap-1"><input name="podil_citatel" defaultValue={k.podil_citatel ?? ""} className="pole" />/<input name="podil_jmenovatel" defaultValue={k.podil_jmenovatel ?? ""} className="pole" /></div></label>
                        <label className="block sm:col-span-2"><span className="stitek">Poznámka</span><input name="poznamka" defaultValue={k.poznamka ?? ""} className="pole" /></label>
                        <div className="flex items-end gap-2"><Odeslat>Uložit</Odeslat><a href="?#katastr" className="tlacitko-svetle">Zrušit</a></div>
                      </form>
                    </td></tr>
                  ),
                ])}
                </tbody>
              </table>
            )}
            <details className="rounded-lg border border-slate-200 p-3">
              <summary className="cursor-pointer text-sm font-medium">+ Přidat pozemek, stavbu nebo jednotku</summary>
              <form action={pridatKatastralniPolozku.bind(null, id)} className="mt-3 grid gap-3 sm:grid-cols-4">
                <label className="block"><span className="stitek">Druh</span>
                  <select name="druh" className="pole"><option value="parcela">Pozemek (parcela)</option><option value="stavba">Stavba</option><option value="jednotka">Jednotka</option></select></label>
                <label className="block"><span className="stitek">Katastrální území</span><input name="katastralni_uzemi" defaultValue={x.katastralni_uzemi ?? ""} className="pole" /></label>
                <label className="block"><span className="stitek">Číslo parcely</span><input name="cislo_parcely" placeholder="1435/1" className="pole" /></label>
                <label className="block"><span className="stitek">LV</span><input name="lv" defaultValue={x.lv ?? ""} className="pole" /></label>
                <label className="block"><span className="stitek">Č.p. (u stavby)</span><input name="cislo_popisne" className="pole" /></label>
                <label className="block"><span className="stitek">Č. jednotky</span><input name="cislo_jednotky" placeholder="733/5" className="pole" /></label>
                <label className="block"><span className="stitek">Podíl</span><div className="flex items-center gap-1"><input name="podil_citatel" inputMode="numeric" className="pole" /><span>/</span><input name="podil_jmenovatel" inputMode="numeric" className="pole" /></div></label>
                <label className="block"><span className="stitek">Výměra m²</span><input name="vymera_m2" inputMode="decimal" className="pole" /></label>
                <label className="block sm:col-span-3"><span className="stitek">Poznámka</span><input name="poznamka" className="pole" /></label>
                <div className="flex flex-col justify-end gap-2">
                  <label className="flex items-center gap-2 text-xs"><input type="checkbox" name="z_ruian" defaultChecked /> doplnit výměru a druh z RÚIAN</label>
                  <Odeslat className="justify-center">Přidat</Odeslat>
                </div>
              </form>
            </details>
          </section>

          <section className="karta">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="font-semibold">Jednotky</h2>
              <Link href={`/nemovitosti/nova?nadrazena=${x.id}`} className="text-sm odkaz">+ Přidat jednotku</Link>
            </div>
            {(jednotky.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Bez jednotek.</p> : (
              <ul className="space-y-1 text-sm">{(jednotky.data ?? []).map((j) =>
                <li key={j.id}><span className="mr-2 text-xs font-semibold text-slate-500">{j.typ_kod}</span>
                  <Link href={`/nemovitosti/${j.id}`} className="odkaz">{j.nazev}</Link> · {j.archivovano_dne ? <span className="text-slate-400">archiv</span> : j.vyuziti === "pronajem" ? (pronajato.has(j.id) ? "pronajato" : <span className="text-blue-700">volné</span>) : VYUZITI[j.vyuziti]}</li>)}</ul>
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
