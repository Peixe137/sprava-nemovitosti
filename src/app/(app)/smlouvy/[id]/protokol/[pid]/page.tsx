import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba } from "@/components/Chyba";
import { Tisk } from "@/components/Tisk";
import { Odeslat } from "@/components/Odeslat";
import { Prilohy, nactiPrilohy, organizace } from "@/components/Prilohy";
import { DRUHY_MERIDEL, JEDNOTKY_MERIDEL, datum, cislo } from "@/lib/format";
import { upravitProtokol } from "../../../protokol-actions";

type Os = { role: string; osoba: { jmeno: string | null; prijmeni: string | null; nazev_firmy: string | null; ico: string | null; adresa: string | null } };

/** Předávací protokol k tisku / PDF s podpisy. */
export default async function Protokol({ params, searchParams }: PageProps<"/smlouvy/[id]/protokol/[pid]">) {
  const { id, pid } = await params;
  const sp = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: p }, { data: s }] = await Promise.all([
    supabase.from("predavaci_protokol").select("*").eq("id", pid).maybeSingle(),
    supabase.from("najemni_smlouva").select("id, variabilni_symbol, cislo_smlouvy, nemovitost(nazev, ulice, cislo_popisne, obec, psc), pronajimatel:pronajimatel_id(nazev, ico, adresa), najemni_smlouva_osoba(role, osoba(jmeno, prijmeni, nazev_firmy, ico, adresa))").eq("id", id).maybeSingle(),
  ]);
  if (!p || !s) notFound();
  const { data: odecty } = await supabase.from("odecet").select("id, stav, meridlo(druh, vyrobni_cislo, umisteni, jednotka)").eq("protokol_id", pid);
  const [fotky, org] = await Promise.all([nactiPrilohy("predavaci_protokol", [pid]), organizace()]);
  const n = s.nemovitost as unknown as { nazev: string; ulice: string | null; cislo_popisne: string | null; obec: string | null; psc: string | null };
  const pr = s.pronajimatel as unknown as { nazev: string; ico: string | null; adresa: string | null } | null;
  const najemci = (s.najemni_smlouva_osoba as unknown as Os[]).filter((o) => ["najemce", "spolunajemce"].includes(o.role));
  const jmeno = (o: Os["osoba"]) => o.nazev_firmy ?? [o.jmeno, o.prijmeni].filter(Boolean).join(" ");
  const prevzeti = p.druh === "prevzeti";
  const odevzdava = prevzeti ? "Pronajímatel předává" : "Nájemce vrací";
  const blok = (nadpis: string, text: string | null) => text ? <div className="mb-4"><h3 className="mb-1 font-semibold">{nadpis}</h3><p className="whitespace-pre-line">{text}</p></div> : null;

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/smlouvy/${id}`} className="odkaz text-sm">← Zpět na smlouvu</Link>
        <Tisk />
      </div>
      <Chyba text={typeof sp.chyba === "string" ? sp.chyba : undefined} />
      <article className="karta text-sm leading-relaxed print:border-0 print:shadow-none">
        <h1 className="mb-1 text-xl font-semibold">Předávací protokol – {prevzeti ? "převzetí" : "předání (vrácení)"} předmětu nájmu</h1>
        <p className="mb-5 text-slate-500">k nájemní smlouvě {s.cislo_smlouvy ? `č. ${s.cislo_smlouvy}, ` : ""}VS {s.variabilni_symbol} · datum {datum(p.datum)}</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div><div className="stitek">Pronajímatel</div><b>{pr?.nazev}</b>{pr?.ico && <div>IČO {pr.ico}</div>}{pr?.adresa && <div>{pr.adresa}</div>}</div>
          <div><div className="stitek">Nájemce</div>{najemci.map((o, i) => <div key={i}><b>{jmeno(o.osoba)}</b>{o.osoba.ico && <div>IČO {o.osoba.ico}</div>}{o.osoba.adresa && <div>{o.osoba.adresa}</div>}</div>)}</div>
        </div>
        <div className="mb-5"><div className="stitek">Předmět nájmu</div><b>{n.nazev}</b><div>{[[n.ulice, n.cislo_popisne].filter(Boolean).join(" "), [n.psc, n.obec].filter(Boolean).join(" ")].filter(Boolean).join(", ")}</div></div>
        <p className="mb-4">{odevzdava} níže uvedený předmět nájmu ve stavu popsaném v tomto protokolu.</p>
        <h3 className="mb-1 font-semibold">Stavy měřidel</h3>
        {(odecty ?? []).length === 0 ? <p className="mb-4 text-slate-500">Bez měřidel.</p> : (
          <table className="tabulka mb-4">
            <thead><tr><th>Měřidlo</th><th>Výrobní číslo</th><th>Umístění</th><th className="text-right">Stav</th></tr></thead>
            <tbody>{(odecty ?? []).map((o) => {
              const m = o.meridlo as unknown as { druh: string; vyrobni_cislo: string | null; umisteni: string | null; jednotka: string | null };
              return <tr key={o.id}><td>{DRUHY_MERIDEL[m.druh]}</td><td>{m.vyrobni_cislo ?? "–"}</td><td>{m.umisteni ?? "–"}</td><td className="text-right font-medium">{cislo(o.stav)} {m.jednotka ?? JEDNOTKY_MERIDEL[m.druh]}</td></tr>;
            })}</tbody>
          </table>
        )}
        {blok("Klíče a čipy", p.klice)}
        {blok("Stav předmětu nájmu a vybavení", p.stav_popis)}
        {blok("Závady a poškození", p.zavady)}
        {blok("Poznámka", p.poznamka)}
        {(fotky.get(pid)?.length ?? 0) > 0 && <p className="mb-4">Fotodokumentace: {fotky.get(pid)!.length} snímků, uložena u protokolu v systému správy.</p>}
        <p className="mb-10">Obě strany potvrzují, že údaje v protokolu odpovídají skutečnosti.</p>
        <div className="grid grid-cols-2 gap-10 pt-6">
          <div className="border-t border-slate-400 pt-1 text-center text-xs">Pronajímatel{pr?.nazev ? ` – ${pr.nazev}` : ""}</div>
          <div className="border-t border-slate-400 pt-1 text-center text-xs">Nájemce{najemci[0] ? ` – ${jmeno(najemci[0].osoba)}` : ""}</div>
        </div>
      </article>

      <section className="karta mt-6 text-sm print:hidden">
        <h2 className="mb-2 font-semibold">Fotky k protokolu</h2>
        <Prilohy seznam={fotky.get(pid) ?? []} org={org} tabulka="predavaci_protokol" zaznamId={pid} cesta={`/smlouvy/${id}/protokol/${pid}`} />
      </section>
      <details className="karta mt-6 text-sm print:hidden">
        <summary className="cursor-pointer font-medium">Upravit texty protokolu</summary>
        <form action={upravitProtokol.bind(null, id, pid)} className="mt-3 space-y-3">
          <label className="block"><span className="stitek">Klíče a čipy</span><textarea name="klice" rows={2} defaultValue={p.klice ?? ""} className="pole" /></label>
          <label className="block"><span className="stitek">Stav bytu / vybavení</span><textarea name="stav_popis" rows={3} defaultValue={p.stav_popis ?? ""} className="pole" /></label>
          <label className="block"><span className="stitek">Závady</span><textarea name="zavady" rows={2} defaultValue={p.zavady ?? ""} className="pole" /></label>
          <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} defaultValue={p.poznamka ?? ""} className="pole" /></label>
          <Odeslat>Uložit</Odeslat>
        </form>
      </details>
    </div>
  );
}
