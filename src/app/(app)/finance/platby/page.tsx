import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { korun, datum } from "@/lib/format";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { BANKY } from "@/lib/vypisy";
import { nahratVypis, priraditPohyb, ignorovatPohyb } from "./actions";
import { Castka } from "@/components/Castka";

const STAV: Record<string, [string, string]> = {
  sparovano: ["Spárováno", "bg-green-50 text-green-800"],
  castecne: ["Přeplatek", "bg-amber-50 text-amber-800"],
  nesparovano: ["Nespárováno", "bg-red-50 text-red-700"],
  ignorovat: ["Ignorováno", "bg-slate-100 text-slate-600"],
  naklad: ["Náklad", "bg-slate-100 text-slate-600"],
};

export default async function Platby({ searchParams }: PageProps<"/finance/platby">) {
  const { filtr, chyba } = await searchParams;
  const supabase = await supabaseServer();
  let dotaz = supabase.from("bankovni_pohyb")
    .select("id, datum, castka, vs, protiucet, protiucet_banka, protiucet_nazev, zprava, stav_parovani, ucet:ucet_id(nazev, cislo_uctu)")
    .order("datum", { ascending: false }).limit(300);
  if (filtr === "prichozi") dotaz = dotaz.gt("castka", 0);
  if (filtr === "nesparovane") dotaz = dotaz.gt("castka", 0).neq("stav_parovani", "sparovano");
  const [{ data }, ucty, vlastnici, smlouvy] = await Promise.all([
    dotaz,
    supabase.from("bankovni_ucet").select("id, nazev, cislo_uctu, kod_banky, banka, posledni_sync").eq("aktivni", true).order("nazev"),
    supabase.from("vlastnik").select("id, nazev").order("nazev"),
    supabase.from("najemni_smlouva").select("id, variabilni_symbol, stav, nemovitost(nazev), najemni_smlouva_osoba(osoba(jmeno, prijmeni, nazev_firmy))").order("variabilni_symbol"),
  ]);
  const popisSmlouvy = (s: { variabilni_symbol: string; stav: string; nemovitost: unknown; najemni_smlouva_osoba: unknown }) => {
    const kdo = (s.najemni_smlouva_osoba as { osoba: { jmeno: string | null; prijmeni: string | null; nazev_firmy: string | null } | null }[])
      .map((o) => o.osoba?.nazev_firmy ?? `${o.osoba?.jmeno ?? ""} ${o.osoba?.prijmeni ?? ""}`.trim()).filter(Boolean).join(", ");
    return `VS ${s.variabilni_symbol} · ${kdo || "bez nájemníka"} · ${(s.nemovitost as { nazev: string } | null)?.nazev ?? ""}${s.stav !== "aktivni" ? " (ukončená)" : ""}`;
  };
  const moznosti = (smlouvy.data ?? []).sort((a, b) => Number(b.stav === "aktivni") - Number(a.stav === "aktivni"));
  const radky = (data ?? []) as unknown as {
    id: string; datum: string; castka: number; vs: string | null; protiucet: string | null; protiucet_banka: string | null;
    protiucet_nazev: string | null; zprava: string | null; stav_parovani: string; ucet: { nazev: string } | null;
  }[];

  const filtrOdkaz = (text: string, k?: string) => (
    <Link key={k ?? ""} href={k ? `/finance/platby?filtr=${k}` : "/finance/platby"}
      className={`rounded-lg px-3 py-1.5 text-sm ${filtr === k || (!k && !filtr) ? "bg-blue-600 text-white" : "border border-slate-300 bg-white"}`}>{text}</Link>
  );

  return (
    <>
      <Nadpis titulek="Platby" podtitulek="Pohyby na bankovních účtech a jejich spárování s nájemníky" />
      <Chyba text={chyba} />
      <details className="karta mb-6 text-sm" open={(ucty.data ?? []).length === 0}>
        <summary className="cursor-pointer font-medium">Nahrát výpis z banky (GPC nebo SEPA XML)</summary>
        <p className="mt-2 text-slate-600">Výpis z e-mailu nebo z internetového bankovnictví ve formátu <b>GPC</b> (ABO, umí ČSOB, KB, Česká spořitelna, Raiffeisenbank, Fio…) nebo <b>SEPA XML</b> (camt.053).
          Příchozí platby se samy spárují s předpisy podle variabilního symbolu, ostatní přiřadíte níže. Stejný výpis můžete nahrát znovu – nic se nezdvojí.</p>
        <form action={nahratVypis} className="mt-3 grid gap-3 sm:grid-cols-2">
          <label className="block sm:col-span-2"><span className="stitek">Soubor(y) s výpisem</span>
            <input type="file" name="soubor" multiple required accept=".gpc,.abo,.txt,.xml,.GPC,.ABO,.XML" className="pole" /></label>
          <label className="block"><span className="stitek">Účet</span>
            <select name="ucet_id" className="pole" defaultValue="">
              <option value="">Poznat podle čísla účtu ve výpisu</option>
              {(ucty.data ?? []).map((u) => <option key={u.id} value={u.id}>{u.nazev} ({u.cislo_uctu}/{u.kod_banky})</option>)}
            </select></label>
          <details className="sm:col-span-2">
            <summary className="cursor-pointer text-slate-600">Nový účet (vyplňte jen poprvé, když účet v aplikaci ještě není)</summary>
            <div className="mt-2 grid gap-2 sm:grid-cols-4">
              <label className="block"><span className="stitek">Název účtu</span><input name="novy_nazev" placeholder="ČSOB JPN Invest – nájmy" className="pole" /></label>
              <label className="block"><span className="stitek">Vlastník účtu</span>
                <select name="novy_vlastnik" className="pole" defaultValue=""><option value="">–</option>
                  {(vlastnici.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.nazev}</option>)}</select></label>
              <label className="block"><span className="stitek">Číslo účtu</span><input name="novy_cislo" placeholder="z výpisu" className="pole" /></label>
              <label className="block"><span className="stitek">Banka</span>
                <select name="novy_banka" className="pole" defaultValue="0300">
                  {Object.entries(BANKY).map(([k, n]) => <option key={k} value={k}>{n} ({k})</option>)}</select></label>
            </div>
          </details>
          <div className="sm:col-span-2"><Odeslat>Nahrát a spárovat</Odeslat></div>
        </form>
      </details>
      {(ucty.data ?? []).length > 0 && (
        <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
          {(ucty.data ?? []).map((u) => <span key={u.id}>{u.nazev} ({u.cislo_uctu}/{u.kod_banky}) · {u.banka === "IMPORT" ? "poslední výpis nahrán" : "poslední stažení"} {u.posledni_sync ? new Date(u.posledni_sync).toLocaleString("cs-CZ") : "zatím ne"}</span>)}
        </div>
      )}
      <div className="mb-4 flex gap-2">{filtrOdkaz("Vše")}{filtrOdkaz("Příchozí", "prichozi")}{filtrOdkaz("Nespárované", "nesparovane")}</div>
      <div className="karta overflow-x-auto">
        {radky.length === 0 ? <p className="text-sm text-slate-500">Žádné pohyby.</p> : (
          <table className="tabulka">
            <thead><tr><th>Datum</th><th>Účet</th><th>Protistrana</th><th>VS</th><th>Zpráva</th><th className="text-right">Částka</th><th>Stav</th></tr></thead>
            <tbody>{radky.map((r) => {
              const [text, barva] = STAV[r.stav_parovani] ?? [r.stav_parovani, ""];
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{datum(r.datum)}</td>
                  <td>{r.ucet?.nazev ?? "–"}</td>
                  <td>{r.protiucet_nazev ?? "–"}<div className="text-xs text-slate-500">{r.protiucet ? `${r.protiucet}/${r.protiucet_banka}` : ""}</div></td>
                  <td>{r.vs ?? "–"}</td>
                  <td className="max-w-xs truncate">{r.zprava ?? ""}</td>
                  <td className={`text-right font-medium ${Number(r.castka) < 0 ? "minus" : "plus"}`}><Castka v={r.castka} /></td>
                  <td>{Number(r.castka) > 0 && <span className={`rounded-full px-2 py-0.5 text-xs ${barva}`}>{text}</span>}
                    {Number(r.castka) > 0 && r.stav_parovani === "nesparovano" && (
                      <details className="mt-1 text-xs">
                        <summary className="cursor-pointer odkaz">Přiřadit</summary>
                        <form action={priraditPohyb.bind(null, r.id)} className="mt-1 flex gap-1">
                          <select name="smlouva_id" required className="pole min-w-56 text-xs" defaultValue="">
                            <option value="" disabled>Vyberte smlouvu…</option>
                            {moznosti.map((s) => <option key={s.id} value={s.id}>{popisSmlouvy(s)}</option>)}
                          </select>
                          <button className="tlacitko-svetle text-xs">OK</button>
                        </form>
                        <form action={ignorovatPohyb.bind(null, r.id)} className="mt-1"><button className="text-slate-500 hover:underline">Netýká se nájmů – skrýt</button></form>
                      </details>
                    )}</td>
                </tr>);
            })}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
