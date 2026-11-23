import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { DRUHY_PREDPISU, STAVY_POHLEDAVKY, korun, datum, mesic } from "@/lib/format";
import { Chyba, Nadpis } from "@/components/Chyba";
import { doplnitPredpisy, zaplaceno } from "../actions";

export default async function DetailSmlouvy({ params, searchParams }: PageProps<"/smlouvy/[id]">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data: s } = await supabase.from("najemni_smlouva")
    .select("*, nemovitost(id, nazev), pronajimatel:pronajimatel_id(nazev), najemni_smlouva_osoba(role, osoba(*))")
    .eq("id", id).maybeSingle();
  if (!s) notFound();

  const [predpis, pohledavky] = await Promise.all([
    supabase.from("predpis_polozka").select("*").eq("smlouva_id", id).order("platnost_od"),
    supabase.from("pohledavka").select("*").eq("smlouva_id", id).order("obdobi", { ascending: false }),
  ]);
  const dnes = new Date().toISOString().slice(0, 10);
  const dluh = (pohledavky.data ?? []).filter((p) => ["otevrena", "castecne"].includes(p.stav) && p.splatnost < dnes)
    .reduce((a, p) => a + Number(p.castka) - Number(p.uhrazeno), 0);
  const osoby = s.najemni_smlouva_osoba as { role: string; osoba: { jmeno: string | null; prijmeni: string | null; nazev_firmy: string | null; email: string | null; telefon: string | null; preferovany_kanal: string } }[];

  return (
    <>
      <Nadpis titulek={`Smlouva VS ${s.variabilni_symbol}`}
        podtitulek={`${s.nemovitost?.nazev} · pronajímatel ${s.pronajimatel?.nazev}`}
        akce={<form action={doplnitPredpisy.bind(null, id)}><button className="tlacitko-svetle">Doplnit platby do aktuálního měsíce</button></form>} />
      <Chyba text={chyba} />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6">
          <section className="karta text-sm">
            <h2 className="mb-3 font-semibold">Nájemník</h2>
            {osoby.map((o, i) => (
              <div key={i} className="mb-2">
                <div className="font-medium">{o.osoba.nazev_firmy ?? `${o.osoba.jmeno ?? ""} ${o.osoba.prijmeni ?? ""}`}</div>
                <div className="text-slate-600">{o.osoba.telefon ?? "bez telefonu"} · {o.osoba.email ?? "bez e-mailu"}</div>
                <div className="text-xs text-slate-500">upozornění přes: {o.osoba.preferovany_kanal}</div>
              </div>))}
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
            <h2 className="mb-3 font-semibold">Měsíční předpis</h2>
            <table className="tabulka"><tbody>
              {(predpis.data ?? []).map((p) => (
                <tr key={p.id}><td>{DRUHY_PREDPISU[p.druh] ?? p.druh}<div className="text-xs text-slate-500">od {datum(p.platnost_od)}{p.platnost_do ? ` do ${datum(p.platnost_do)}` : ""}</div></td>
                  <td className="text-right">{korun(p.castka)}</td></tr>))}
            </tbody></table>
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
