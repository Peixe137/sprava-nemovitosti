import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { DRUHY_PREDPISU, STAVY_POHLEDAVKY, PERIODY, korun, datum, mesic } from "@/lib/format";
import { Odeslat } from "@/components/Odeslat";
import { Chyba, Nadpis } from "@/components/Chyba";
import { doplnitPredpisy, prepocitatPlatby, zaplaceno, pridatPolozku, ukoncitPolozku, smazatPolozku, pridatKontakt, odebratKontakt } from "../actions";

export default async function DetailSmlouvy({ params, searchParams }: PageProps<"/smlouvy/[id]">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data: s } = await supabase.from("najemni_smlouva")
    .select("*, nemovitost(id, nazev), pronajimatel:pronajimatel_id(nazev), najemni_smlouva_osoba(role, funkce, poznamka, osoba(*))")
    .eq("id", id).maybeSingle();
  if (!s) notFound();

  const [predpis, pohledavky] = await Promise.all([
    supabase.from("predpis_polozka").select("*").eq("smlouva_id", id).order("platnost_od"),
    supabase.from("pohledavka").select("*").eq("smlouva_id", id).order("obdobi", { ascending: false }),
  ]);
  const dnes = new Date().toISOString().slice(0, 10);
  const dluh = (pohledavky.data ?? []).filter((p) => ["otevrena", "castecne"].includes(p.stav) && p.splatnost < dnes)
    .reduce((a, p) => a + Number(p.castka) - Number(p.uhrazeno), 0);
  type Os = { role: string; funkce: string | null; poznamka: string | null; osoba: { id: string; jmeno: string | null; prijmeni: string | null; nazev_firmy: string | null; email: string | null; telefon: string | null; preferovany_kanal: string } };
  const osoby = (s.najemni_smlouva_osoba as Os[]).sort((a, b) => (a.role === "najemce" ? -1 : 0) - (b.role === "najemce" ? -1 : 0));
  const ROLE: Record<string, string> = { najemce: "Nájemce", spolunajemce: "Spolunájemce", rucitel: "Ručitel", kontakt: "Kontakt" };
  const pristiMesic = (() => { const d = new Date(); d.setMonth(d.getMonth() + 1, 1); return d.toISOString().slice(0, 10); })();
  const tento = dnes.slice(0, 7);

  return (
    <>
      <Nadpis titulek={`Smlouva VS ${s.variabilni_symbol}`}
        podtitulek={`${s.cislo_smlouvy ? `č. ${s.cislo_smlouvy} · ` : ""}${s.nemovitost?.nazev} · pronajímatel ${s.pronajimatel?.nazev}`}
        akce={<div className="flex flex-wrap gap-2">
          <form action={doplnitPredpisy.bind(null, id)}><button className="tlacitko-svetle">Doplnit platby do aktuálního měsíce</button></form>
          <form action={prepocitatPlatby.bind(null, id)}><Odeslat svetle>Přepočítat platby podle předpisu</Odeslat></form>
        </div>} />
      <Chyba text={chyba} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <section className="karta text-sm">
            <h2 className="mb-3 font-semibold">Nájemník a kontakty</h2>
            <ul className="space-y-3">
              {osoby.map((o) => (
                <li key={o.osoba.id} className="group">
                  <div className="flex items-baseline justify-between gap-2">
                    <span className="font-medium">{o.osoba.nazev_firmy ?? `${o.osoba.jmeno ?? ""} ${o.osoba.prijmeni ?? ""}`}</span>
                    <span className="text-xs text-slate-500">{o.funkce ?? ROLE[o.role]}</span>
                  </div>
                  <div className="flex flex-wrap gap-x-3">
                    {o.osoba.telefon && <a href={`tel:${o.osoba.telefon.replace(/\s/g, "")}`} className="odkaz">☎ {o.osoba.telefon}</a>}
                    {o.osoba.email && <a href={`mailto:${o.osoba.email}`} className="odkaz">✉ {o.osoba.email}</a>}
                    {!o.osoba.telefon && !o.osoba.email && <span className="text-slate-400">bez kontaktu</span>}
                  </div>
                  {o.poznamka && <div className="text-xs text-slate-500">{o.poznamka}</div>}
                  {o.role === "najemce" ? <div className="text-xs text-slate-500">upozornění přes: {o.osoba.preferovany_kanal}</div>
                    : <form action={odebratKontakt.bind(null, id, o.osoba.id)}><button className="text-xs text-slate-400 hover:text-red-700">odebrat</button></form>}
                </li>))}
            </ul>
            <details className="mt-4 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-blue-700">+ Přidat kontaktní osobu</summary>
              <form action={pridatKontakt.bind(null, id)} className="mt-3 grid gap-2 sm:grid-cols-2">
                <input name="jmeno" placeholder="Jméno" className="pole" />
                <input name="prijmeni" placeholder="Příjmení" className="pole" />
                <input name="funkce" placeholder="Funkce (vedoucí pobočky, účetní…)" className="pole sm:col-span-2" />
                <input name="telefon" placeholder="Telefon" className="pole" />
                <input name="email" type="email" placeholder="E-mail" className="pole" />
                <select name="role" className="pole"><option value="kontakt">Kontakt</option><option value="spolunajemce">Spolunájemce</option><option value="rucitel">Ručitel</option></select>
                <input name="poznamka" placeholder="Co má na starosti" className="pole" />
                <div className="sm:col-span-2"><Odeslat>Přidat</Odeslat></div>
              </form>
            </details>
          </section>
          <section className="karta text-sm">
            <h2 className="mb-3 font-semibold">Podmínky</h2>
            <dl className="space-y-2">
              <div><dt className="stitek">Období</dt><dd>{datum(s.datum_od)} – {s.datum_do ? datum(s.datum_do) : "doba neurčitá"}</dd></div>
              <div><dt className="stitek">Splatnost</dt><dd>{s.den_splatnosti}. den v měsíci{s.splatnost_predem ? " (předem)" : ""}</dd></div>
              <div><dt className="stitek">Kauce</dt><dd>{korun(s.kauce_castka)}</dd></div>
              <div><dt className="stitek">Nemovitost</dt><dd><Link href={`/nemovitosti/${s.nemovitost?.id}`} className="odkaz">{s.nemovitost?.nazev}</Link></dd></div>
            </dl>
          </section>
          <section className="karta text-sm">
            <h2 className="mb-3 font-semibold">Předpis plateb</h2>
            <ul className="divide-y divide-slate-100">
              {(predpis.data ?? []).map((p) => {
                const skoncila = p.platnost_do && p.platnost_do < dnes;
                return (
                  <li key={p.id} className={`py-2 ${skoncila ? "text-slate-400" : ""}`}>
                    <div className="flex justify-between gap-2">
                      <span>{DRUHY_PREDPISU[p.druh] ?? p.druh}{p.popis ? ` – ${p.popis}` : ""}</span>
                      <span className="whitespace-nowrap">{korun(p.castka)} <span className="text-xs text-slate-500">{PERIODY[p.perioda] ?? ""}</span></span>
                    </div>
                    <div className="flex items-center justify-between text-xs text-slate-500">
                      <span>od {datum(p.platnost_od)}{p.platnost_do ? ` do ${datum(p.platnost_do)}` : ""}</span>
                      {!p.platnost_do && (
                        <details className="text-right"><summary className="cursor-pointer text-blue-700">ukončit / smazat</summary>
                          <form action={ukoncitPolozku.bind(null, id, p.id)} className="mt-1 flex items-center justify-end gap-1">
                            <span>poslední měsíc</span><input type="month" name="do" defaultValue={tento} className="pole w-36 py-1" />
                            <button className="rounded border border-slate-300 px-2 py-1 hover:bg-slate-50">Ukončit</button>
                          </form>
                          <form action={smazatPolozku.bind(null, id, p.id)} className="mt-1"><button className="text-slate-400 hover:text-red-700">smazat úplně (zadaná omylem – platby se přepočítají)</button></form>
                        </details>)}
                    </div>
                  </li>);
              })}
            </ul>
            <details className="mt-3 border-t border-slate-100 pt-3">
              <summary className="cursor-pointer text-blue-700">+ Přidat položku / změnit nájem</summary>
              <form action={pridatPolozku.bind(null, id)} className="mt-3 grid gap-2 sm:grid-cols-2">
                <select name="druh" className="pole">{Object.entries(DRUHY_PREDPISU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <input name="popis" placeholder="upřesnění" className="pole" />
                <input name="castka" required placeholder="Kč" inputMode="decimal" className="pole" />
                <select name="perioda" className="pole">{Object.entries(PERIODY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
                <label className="block sm:col-span-2"><span className="stitek">Platí od měsíce</span><input type="date" name="platnost_od" defaultValue={pristiMesic} className="pole" /></label>
                <p className="text-xs text-slate-500 sm:col-span-2">Při změně nájmu starou položku ukončete (nebo smažte, pokud byla zadaná špatně) a přidejte novou. Platby se pak samy přepočítají – už zaplacené částky zůstanou a rozdělí se od nejstarší.</p>
                <div className="sm:col-span-2"><Odeslat>Přidat</Odeslat></div>
              </form>
            </details>
          </section>
        </div>

        <section className="karta overflow-x-auto lg:col-span-2">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="font-semibold">Platby</h2>
            {dluh > 0 && <span className="rounded-full bg-red-50 px-3 py-1 text-sm font-medium text-red-700">Dluh {korun(dluh)}</span>}
          </div>
          {(pohledavky.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Zatím žádné platby.</p> : (
            <table className="tabulka">
              <thead><tr><th>Měsíc</th><th>Splatnost</th><th className="text-right">Částka</th><th className="text-right">Uhrazeno</th><th>Stav</th><th></th></tr></thead>
              <tbody>{(pohledavky.data ?? []).map((p) => {
                const zbyva = Number(p.castka) - Number(p.uhrazeno);
                const poSplatnosti = zbyva > 0 && p.splatnost < dnes;
                return (
                  <tr key={p.id}>
                    <td>{mesic(p.obdobi)}</td>
                    <td className={poSplatnosti ? "font-medium text-red-700" : ""}>{datum(p.splatnost)}</td>
                    <td className="text-right">{korun(p.castka)}</td>
                    <td className="text-right">{korun(p.uhrazeno)}</td>
                    <td>{STAVY_POHLEDAVKY[p.stav]}</td>
                    <td className="text-right">
                      {zbyva > 0 && (
                        <form action={zaplaceno.bind(null, id, p.id, zbyva)} className="flex items-center justify-end gap-2">
                          <input name="castka" placeholder={String(zbyva)} inputMode="decimal" className="pole w-24 py-1" />
                          <button className="rounded-md border border-slate-300 px-2 py-1 text-xs hover:bg-slate-50">Zaplaceno</button>
                        </form>)}
                    </td>
                  </tr>);
              })}</tbody>
            </table>
          )}
          <p className="mt-3 text-xs text-slate-500">Platby se zatím zapisují ručně. Po napojení Fio banky se budou párovat automaticky podle variabilního symbolu.</p>
        </section>
      </div>
    </>
  );
}
