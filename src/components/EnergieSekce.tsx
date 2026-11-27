import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Odeslat } from "@/components/Odeslat";
import { OdecetFormular } from "@/components/OdecetFormular";
import { organizace } from "@/components/Prilohy";
import { Castka } from "@/components/Castka";
import { KOMODITY, DRUHY_MERIDEL, JEDNOTKY_MERIDEL, UCEL_MERIDLA, datum, cislo } from "@/lib/format";
import { pridatOdberneMisto, ukoncitOdberneMisto, pridatMeridlo } from "@/app/(app)/meridla/actions";

type M = { id: string; nemovitost_id: string; druh: string; ucel: string; vyrobni_cislo: string | null; umisteni: string | null; jednotka: string | null; cejch_do: string | null; aktivni: boolean };
type O = { meridlo_id: string; datum: string; stav: number };

/** Energie a měřidla nemovitosti: odběrná místa, měřidla, poslední odečty, zápis odečtu. U budovy i měřidla jednotek. */
export async function EnergieSekce({ nemovitostId, jednotky }: { nemovitostId: string; jednotky: { id: string; nazev: string }[] }) {
  const supabase = await supabaseServer();
  const idsVse = [nemovitostId, ...jednotky.map((j) => j.id)];
  const [om, mer, dod, org] = await Promise.all([
    supabase.from("odberne_misto").select("id, komodita, ean_eic, zaloha_mesicne, na_koho, platnost_od, platnost_do, poznamka, dodavatel:dodavatel_id(nazev_firmy, prijmeni)").eq("nemovitost_id", nemovitostId).order("komodita"),
    supabase.from("meridlo").select("id, nemovitost_id, druh, ucel, vyrobni_cislo, umisteni, jednotka, cejch_do, aktivni").in("nemovitost_id", idsVse).order("druh"),
    supabase.from("osoba").select("id, nazev_firmy, prijmeni, jmeno").eq("je_dodavatel", true).order("nazev_firmy"),
    organizace(),
  ]);
  const meridla = (mer.data ?? []) as M[];
  const { data: odecty } = meridla.length
    ? await supabase.from("odecet").select("meridlo_id, datum, stav").in("meridlo_id", meridla.map((m) => m.id)).order("datum", { ascending: false })
    : { data: [] as O[] };
  const posledni = (id: string) => (odecty ?? []).filter((o) => o.meridlo_id === id).slice(0, 2) as O[];
  const dnes = new Date().toISOString().slice(0, 10);
  const za60 = (() => { const d = new Date(); d.setDate(d.getDate() + 60); return d.toISOString().slice(0, 10); })();
  const nazevJednotky = new Map(jednotky.map((j) => [j.id, j.nazev]));
  const vlastni = meridla.filter((m) => m.nemovitost_id === nemovitostId);
  const jednotek = meridla.filter((m) => m.nemovitost_id !== nemovitostId);

  const radekMeridla = (m: M, sJednotkou: boolean) => {
    const [a, b] = posledni(m.id);
    const j = m.jednotka ?? JEDNOTKY_MERIDEL[m.druh];
    return [
      <tr key={m.id} className={m.aktivni ? "" : "opacity-50"}>
        <td>{DRUHY_MERIDEL[m.druh]}{m.ucel !== "jednotka" && <div className="text-xs text-violet-700">{UCEL_MERIDLA[m.ucel]}</div>}
          {sJednotkou && <div className="text-xs"><Link href={`/nemovitosti/${m.nemovitost_id}#energie`} className="odkaz">{nazevJednotky.get(m.nemovitost_id)}</Link></div>}</td>
        <td>{m.vyrobni_cislo ?? "–"}{m.umisteni && <div className="text-xs text-slate-500">{m.umisteni}</div>}</td>
        <td className={m.cejch_do && m.cejch_do < dnes ? "font-medium text-red-700" : m.cejch_do && m.cejch_do <= za60 ? "text-amber-700" : ""}>{m.cejch_do ? datum(m.cejch_do) : "–"}</td>
        <td className="whitespace-nowrap">{a ? <>{cislo(a.stav)} {j}<div className="text-xs text-slate-500">{datum(a.datum)}</div></> : <span className="text-slate-400">bez odečtu</span>}</td>
        <td className="whitespace-nowrap">{a && b ? <>{cislo(Number(a.stav) - Number(b.stav))} {j}<div className="text-xs text-slate-500">od {datum(b.datum)}</div></> : "–"}</td>
        <td className="text-right"><Link href={`/meridla/${m.id}`} className="text-xs text-blue-700 hover:underline">historie a fotky</Link></td>
      </tr>,
      m.aktivni && (
        <tr key={m.id + "-o"}><td colSpan={6} className="border-b-0 pt-0 pb-3">
          <details><summary className="cursor-pointer text-xs text-blue-700">Zapsat odečet</summary>
            <div className="mt-2"><OdecetFormular meridloId={m.id} org={org} jednotka={j} /></div></details>
        </td></tr>),
    ];
  };

  return (
    <section id="energie" className="karta overflow-x-auto lg:col-span-3">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-semibold">Energie a měřidla</h2>
        <Link href={`/odecty?nemovitost=${nemovitostId}`} className="text-sm odkaz">Hromadné odečty →</Link>
      </div>

      <h3 className="mb-2 text-sm font-semibold">Odběrná místa</h3>
      {(om.data ?? []).length === 0 ? <p className="mb-3 text-sm text-slate-500">Žádná odběrná místa.</p> : (
        <table className="tabulka mb-3 text-sm">
          <thead><tr><th>Komodita</th><th>EAN / EIC</th><th>Dodavatel</th><th className="text-right">Záloha / měs.</th><th>Smlouvu má</th><th>Platnost</th><th></th></tr></thead>
          <tbody>{(om.data ?? []).map((o) => {
            const d = o.dodavatel as unknown as { nazev_firmy: string | null; prijmeni: string | null } | null;
            return (
              <tr key={o.id} className={o.platnost_do && o.platnost_do < dnes ? "opacity-50" : ""}>
                <td>{KOMODITY[o.komodita]}{o.poznamka && <div className="text-xs text-slate-500">{o.poznamka}</div>}</td>
                <td className="font-mono text-xs">{o.ean_eic ?? "–"}</td>
                <td>{d?.nazev_firmy ?? d?.prijmeni ?? "–"}</td>
                <td className="text-right">{o.zaloha_mesicne != null ? <Castka v={o.zaloha_mesicne} /> : "–"}</td>
                <td>{o.na_koho === "najemce" ? "nájemce" : "vlastník (přeúčtovává se)"}</td>
                <td className="whitespace-nowrap text-xs">{o.platnost_od ? datum(o.platnost_od) : "…"} – {o.platnost_do ? datum(o.platnost_do) : ""}</td>
                <td className="text-right">{!o.platnost_do && <form action={ukoncitOdberneMisto.bind(null, nemovitostId, o.id)}><button className="text-xs text-slate-400 hover:text-red-700">ukončit</button></form>}</td>
              </tr>);
          })}</tbody>
        </table>
      )}
      <details className="mb-5 rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">+ Přidat odběrné místo</summary>
        <form action={pridatOdberneMisto.bind(null, nemovitostId)} className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <label className="block"><span className="stitek">Komodita</span><select name="komodita" className="pole">{Object.entries(KOMODITY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block"><span className="stitek">EAN / EIC</span><input name="ean_eic" className="pole font-mono" /></label>
          <label className="block"><span className="stitek">Dodavatel</span>
            <select name="dodavatel_id" className="pole" defaultValue=""><option value="">–</option>{(dod.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nazev_firmy ?? `${x.prijmeni ?? ""} ${x.jmeno ?? ""}`}</option>)}</select></label>
          <label className="block"><span className="stitek">Záloha dodavateli / měsíc</span><input name="zaloha_mesicne" inputMode="decimal" className="pole" /></label>
          <label className="block"><span className="stitek">Smlouvu s dodavatelem má</span>
            <select name="na_koho" className="pole"><option value="vlastnik">Vlastník (přeúčtovává se nájemci)</option><option value="najemce">Nájemce (platí sám)</option></select></label>
          <label className="block"><span className="stitek">Platí od</span><input type="date" name="platnost_od" className="pole" /></label>
          <label className="block sm:col-span-2"><span className="stitek">Poznámka</span><input name="poznamka" placeholder="např. společné prostory, sklep…" className="pole" /></label>
          <div className="sm:col-span-4"><Odeslat>Přidat</Odeslat></div>
        </form>
      </details>

      <h3 className="mb-2 text-sm font-semibold">Měřidla{jednotky.length > 0 ? " budovy (hlavní a společné prostory)" : ""}</h3>
      {vlastni.length === 0 ? <p className="mb-3 text-sm text-slate-500">Žádná měřidla.</p> : (
        <table className="tabulka mb-3 text-sm">
          <thead><tr><th>Měřidlo</th><th>Výrobní č. / umístění</th><th>Cejch do</th><th>Poslední stav</th><th>Spotřeba</th><th></th></tr></thead>
          <tbody>{vlastni.flatMap((m) => radekMeridla(m, false))}</tbody>
        </table>
      )}
      <details className="mb-5 rounded-lg border border-slate-200 p-3">
        <summary className="cursor-pointer text-sm font-medium">+ Přidat měřidlo</summary>
        <form action={pridatMeridlo.bind(null, nemovitostId)} className="mt-3 grid gap-3 text-sm sm:grid-cols-4">
          <label className="block"><span className="stitek">Druh</span><select name="druh" className="pole">{Object.entries(DRUHY_MERIDEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block"><span className="stitek">Účel</span>
            <select name="ucel" className="pole" defaultValue={jednotky.length ? "hlavni" : "jednotka"}>{Object.entries(UCEL_MERIDLA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <label className="block"><span className="stitek">Výrobní číslo</span><input name="vyrobni_cislo" className="pole" /></label>
          <label className="block"><span className="stitek">Umístění</span><input name="umisteni" placeholder="koupelna, sklep, rozvaděč…" className="pole" /></label>
          <label className="block"><span className="stitek">Platnost cejchu do</span><input type="date" name="cejch_do" className="pole" /></label>
          <label className="block"><span className="stitek">Jednotka</span><input name="jednotka" placeholder="m³ / kWh / GJ – podle druhu" className="pole" /></label>
          <label className="block"><span className="stitek">Odběrné místo</span>
            <select name="odberne_misto_id" className="pole" defaultValue=""><option value="">–</option>{(om.data ?? []).map((o) => <option key={o.id} value={o.id}>{KOMODITY[o.komodita]} {o.ean_eic ?? ""}</option>)}</select></label>
          <label className="block"><span className="stitek">Poznámka</span><input name="poznamka" className="pole" /></label>
          <label className="block"><span className="stitek">Počáteční stav (nepovinné)</span><input name="stav" inputMode="decimal" className="pole" /></label>
          <label className="block"><span className="stitek">ke dni</span><input type="date" name="datum_stavu" defaultValue={dnes} className="pole" /></label>
          <div className="flex items-end sm:col-span-2"><Odeslat>Přidat měřidlo</Odeslat></div>
        </form>
      </details>

      {jednotky.length > 0 && (<>
        <h3 className="mb-2 text-sm font-semibold">Měřidla jednotek</h3>
        {jednotek.length === 0 ? <p className="text-sm text-slate-500">Jednotky zatím nemají měřidla – přidáte je v detailu jednotky.</p> : (
          <table className="tabulka text-sm">
            <thead><tr><th>Měřidlo</th><th>Výrobní č. / umístění</th><th>Cejch do</th><th>Poslední stav</th><th>Spotřeba</th><th></th></tr></thead>
            <tbody>{jednotek.flatMap((m) => radekMeridla(m, true))}</tbody>
          </table>
        )}
        <p className="mt-2 text-xs text-slate-500">Hlavní (patní) měřidla budovy a měřidla společných prostor slouží k rozúčtování: spotřeba společných prostor = měřidlo společných prostor, jinak hlavní měřidlo minus součet jednotek. Rozpočítává se podle plochy jednotek.</p>
      </>)}
    </section>
  );
}
