import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Odeslat } from "@/components/Odeslat";
import { Chyba, Nadpis } from "@/components/Chyba";
import { pridatSmlouvu } from "../actions";
import { AresTlacitko } from "@/components/AresTlacitko";
import { HledatNemovitost } from "@/components/HledatNemovitost";
import { moznostiNemovitosti } from "@/lib/vyberNemovitosti";
import { PolozkyPredpisu, type Polozka } from "@/components/PolozkyPredpisu";
import { lvAJednotka, cisloSmlouvy } from "@/lib/jednotka";
import { dnesIso } from "@/lib/format";

export default async function NovaSmlouva({ searchParams }: PageProps<"/smlouvy/nova">) {
  const { chyba, nemovitost } = await searchParams;
  const nemId = String(nemovitost ?? "");
  const supabase = await supabaseServer();
  const [nem, vl] = await Promise.all([
    moznostiNemovitosti(supabase),
    supabase.from("vlastnik").select("id, nazev, zkratka").order("nazev"),
  ]);

  // předvyplnění z nemovitosti a z poslední smlouvy na ní
  let vs: string | null = null, jednotka: Awaited<ReturnType<typeof lvAJednotka>> = null;
  let posledni: { den_splatnosti: number; kauce_castka: number | null; predpis_polozka: Polozka[] } | null = null;
  if (nemId) {
    const [n, v, p] = await Promise.all([
      lvAJednotka(supabase, nemId),
      supabase.rpc("navrhnout_vs", { p_nemovitost: nemId }),
      supabase.from("najemni_smlouva").select("den_splatnosti, kauce_castka, predpis_polozka(druh, popis, castka, perioda, platnost_do)")
        .eq("nemovitost_id", nemId).order("datum_od", { ascending: false }).limit(1).maybeSingle(),
    ]);
    jednotka = n; vs = v.data as string | null;
    if (p.data) posledni = { ...p.data, predpis_polozka: (p.data.predpis_polozka as (Polozka & { platnost_do: string | null })[]).filter((x) => !x.platnost_do) };
  }

  const Pole = ({ name, label, type = "text", ...rest }: { name: string; label: string; type?: string; [k: string]: unknown }) => (
    <label className="block"><span className="stitek">{label}</span><input name={name} type={type} className="pole" {...rest} /></label>
  );

  return (
    <>
      <Nadpis titulek="Nová nájemní smlouva" podtitulek="Po výběru nemovitosti se předvyplní pronajímatel, VS a platby z minulé smlouvy. Vše jde změnit." />
      <Chyba text={chyba} />
      {(nem.length === 0 || (vl.data ?? []).length === 0) && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nejdřív potřebujete aspoň jednu <Link href="/nemovitosti/nova" className="odkaz">nemovitost</Link> a jednoho <Link href="/vlastnici" className="odkaz">vlastníka</Link>.
        </p>
      )}
      <form key={nemId} action={pridatSmlouvu} className="karta max-w-3xl space-y-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Co a kdo pronajímá</legend>
          <label className="block"><span className="stitek">Nemovitost</span>
            <HledatNemovitost name="nemovitost_id" moznosti={nem} vychozi={nemId} required navigace="/smlouvy/nova?nemovitost=" /></label>
          <label className="block"><span className="stitek">Pronajímatel</span>
            <select name="pronajimatel_id" required defaultValue={jednotka?.vlastnik ?? undefined} className="pole">
              {(vl.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.nazev}{v.zkratka ? ` (@${v.zkratka})` : ""}</option>)}
            </select></label>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">Nájemník</legend>
          <Pole name="jmeno" label="Jméno" />
          <Pole name="prijmeni" label="Příjmení" />
          <Pole name="nazev_firmy" label="nebo název firmy" />
          <Pole name="ico" label="IČO (u firmy / podnikatele)" inputMode="numeric" />
          <div className="self-end"><AresTlacitko mapovani={{ nazev: "nazev_firmy", adresa: "adresa", ico: "ico" }} /></div>
          <Pole name="adresa" label="Adresa / sídlo" />
          <Pole name="email" label="E-mail" type="email" />
          <Pole name="telefon" label="Telefon" placeholder="+420…" />
          <label className="block"><span className="stitek">Upozorňovat přes</span>
            <select name="preferovany_kanal" className="pole"><option value="sms">SMS</option><option value="whatsapp">WhatsApp</option><option value="email">E-mail</option></select></label>
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-3">
          <legend className="mb-2 text-sm font-semibold">Smlouva</legend>
          <div>
            <Pole name="variabilni_symbol" label="Variabilní symbol" required inputMode="numeric" maxLength={10} defaultValue={vs ?? undefined} />
            {vs && jednotka && <p className="mt-1 text-xs text-slate-500">LV {jednotka.lv} · jednotka {jednotka.kod} · {vs.slice(-1)}. smlouva</p>}
            {nemId && !vs && <p className="mt-1 text-xs text-amber-700">Návrh nejde – nemovitost (ani budova) nemá vyplněné LV.</p>}
          </div>
          <div>
            <Pole name="cislo_smlouvy" label="Číslo smlouvy" placeholder={jednotka ? cisloSmlouvy(dnesIso(), jednotka.lv, jednotka.kod) : "RRMMDD-LV-JJJ"} />
            <p className="mt-1 text-xs text-slate-500">Prázdné = vytvoří se z data začátku nájmu, LV a jednotky.</p>
          </div>
          <Pole name="den_splatnosti" label="Splatnost (den v měsíci)" type="number" min={1} max={31} defaultValue={posledni?.den_splatnosti ?? 15} />
          <Pole name="datum_od" label="Nájem od" type="date" required />
          <Pole name="datum_do" label="Nájem do (prázdné = neurčito)" type="date" />
          <Pole name="kauce_castka" label="Kauce Kč" inputMode="decimal" defaultValue={posledni?.kauce_castka ?? undefined} />
        </fieldset>

        <fieldset>
          <legend className="mb-2 text-sm font-semibold">Platby – nájem a zálohy</legend>
          <PolozkyPredpisu vychozi={posledni?.predpis_polozka ?? []} />
          <p className="mt-2 text-xs text-slate-500">Čtvrtletní, pololetní a roční položky se předepisují v měsíci začátku nájmu a pak po uplynutí periody.</p>
        </fieldset>

        <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} className="pole" /></label>
        <div className="flex gap-3"><Odeslat>Uložit smlouvu</Odeslat><Link href="/smlouvy" className="tlacitko-svetle">Zrušit</Link></div>
      </form>
    </>
  );
}
