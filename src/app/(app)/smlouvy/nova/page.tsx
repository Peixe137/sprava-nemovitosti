import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Odeslat } from "@/components/Odeslat";
import { Chyba, Nadpis } from "@/components/Chyba";
import { pridatSmlouvu } from "../actions";
import { AresTlacitko } from "@/components/AresTlacitko";

export default async function NovaSmlouva({ searchParams }: PageProps<"/smlouvy/nova">) {
  const { chyba, nemovitost } = await searchParams;
  const supabase = await supabaseServer();
  const [nem, vl] = await Promise.all([
    supabase.from("nemovitost").select("id, nazev").order("nazev"),
    supabase.from("vlastnik").select("id, nazev, zkratka").order("nazev"),
  ]);

  const Pole = ({ name, label, type = "text", ...rest }: { name: string; label: string; type?: string; [k: string]: unknown }) => (
    <label className="block"><span className="stitek">{label}</span><input name={name} type={type} className="pole" {...rest} /></label>
  );

  return (
    <>
      <Nadpis titulek="Nová nájemní smlouva" podtitulek="Po uložení se automaticky vygenerují měsíční platby od začátku nájmu do dneška." />
      <Chyba text={chyba} />
      {((nem.data ?? []).length === 0 || (vl.data ?? []).length === 0) && (
        <p className="mb-4 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
          Nejdřív potřebujete aspoň jednu <Link href="/nemovitosti/nova" className="odkaz">nemovitost</Link> a jednoho <Link href="/vlastnici" className="odkaz">vlastníka</Link>.
        </p>
      )}
      <form action={pridatSmlouvu} className="karta max-w-3xl space-y-5">
        <fieldset className="grid gap-3 sm:grid-cols-2">
          <legend className="mb-2 text-sm font-semibold">Co a kdo pronajímá</legend>
          <label className="block"><span className="stitek">Nemovitost</span>
            <select name="nemovitost_id" required defaultValue={String(nemovitost ?? "")} className="pole">
              <option value="" disabled>— vyberte —</option>
              {(nem.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
            </select></label>
          <label className="block"><span className="stitek">Pronajímatel</span>
            <select name="pronajimatel_id" required className="pole">
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
          <Pole name="variabilni_symbol" label="Variabilní symbol" required inputMode="numeric" />
          <Pole name="cislo_smlouvy" label="Číslo smlouvy" />
          <Pole name="den_splatnosti" label="Splatnost (den v měsíci)" type="number" min={1} max={31} defaultValue={15} />
          <Pole name="datum_od" label="Nájem od" type="date" required />
          <Pole name="datum_do" label="Nájem do (prázdné = neurčito)" type="date" />
          <Pole name="kauce_castka" label="Kauce Kč" inputMode="decimal" />
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-5">
          <legend className="mb-2 text-sm font-semibold">Měsíční platby (Kč)</legend>
          <Pole name="najem" label="Nájem" required inputMode="decimal" />
          <Pole name="zaloha_voda" label="Záloha voda" inputMode="decimal" />
          <Pole name="zaloha_teplo" label="Záloha teplo" inputMode="decimal" />
          <Pole name="zaloha_elektrina" label="Záloha elektřina" inputMode="decimal" />
          <Pole name="zaloha_sluzby" label="Ostatní služby" inputMode="decimal" />
        </fieldset>

        <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} className="pole" /></label>
        <div className="flex gap-3"><Odeslat>Uložit smlouvu</Odeslat><Link href="/smlouvy" className="tlacitko-svetle">Zrušit</Link></div>
      </form>
    </>
  );
}
