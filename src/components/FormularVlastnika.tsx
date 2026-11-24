import { DRUHY_VLASTNIKA } from "@/lib/format";
import { Odeslat } from "@/components/Odeslat";
import { AresTlacitko } from "@/components/AresTlacitko";
import { PoleZkratky } from "@/components/PoleZkratky";

type V = Record<string, string | number | boolean | null | undefined>;
const h = (v: V | undefined, k: string) => (v?.[k] == null ? undefined : String(v[k]));

/** Formulář vlastníka – nový i úprava (stejná pole, u úpravy předvyplněná). */
export function FormularVlastnika({ akce, v, tlacitko = "Uložit" }: { akce: (f: FormData) => Promise<void>; v?: V; tlacitko?: string }) {
  return (
    <form action={akce} className="karta space-y-3">
      <div className="grid grid-cols-2 items-end gap-3">
        <label className="block"><span className="stitek">IČO</span><input name="ico" inputMode="numeric" defaultValue={h(v, "ico")} className="pole" /></label>
        <AresTlacitko mapovani={{ nazev: "nazev", dic: "dic", adresa: "adresa", pravni_forma: "pravni_forma", platce_dph: "platce_dph", ico: "ico" }} />
      </div>
      <label className="block"><span className="stitek">Název / jméno</span><input name="nazev" required defaultValue={h(v, "nazev")} className="pole" /></label>
      <label className="block"><span className="stitek">Druh</span>
        <select name="druh" defaultValue={h(v, "druh") ?? "vlastni_firma"} className="pole">{Object.entries(DRUHY_VLASTNIKA).map(([k, x]) => <option key={k} value={k}>{x}</option>)}</select></label>
      <div className="grid grid-cols-2 gap-3">
        <PoleZkratky vychozi={h(v, "zkratka")} />
        <label className="block"><span className="stitek">Forma</span>
          <select name="pravni_forma" defaultValue={h(v, "pravni_forma") ?? "PO"} className="pole"><option value="PO">Právnická osoba</option><option value="FO">Fyzická osoba</option></select></label>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="stitek">DIČ</span><input name="dic" defaultValue={h(v, "dic")} className="pole" /></label>
        <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="platce_dph" defaultChecked={!!v?.platce_dph} /> Plátce DPH</label>
      </div>
      <label className="block"><span className="stitek">Adresa / sídlo</span><input name="adresa" defaultValue={h(v, "adresa")} className="pole" /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block"><span className="stitek">E-mail</span><input name="email" type="email" defaultValue={h(v, "email")} className="pole" /></label>
        <label className="block"><span className="stitek">Telefon</span><input name="telefon" defaultValue={h(v, "telefon")} className="pole" /></label>
      </div>
      {v && (
        <details className="rounded-lg border border-slate-200 px-3 py-2 text-sm" open={!!v.odmena_typ || !!v.dan_rezim}>
          <summary className="cursor-pointer text-slate-600">Odměna za správu a daně</summary>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <label className="block"><span className="stitek">Odměna za správu (u klienta)</span>
              <select name="odmena_typ" defaultValue={h(v, "odmena_typ") ?? ""} className="pole">
                <option value="">—</option><option value="procento_z_vybraneho">% z vybraného nájmu</option>
                <option value="pevna_mesicne">Pevná měsíčně</option><option value="pevna_za_jednotku">Pevná za jednotku</option>
              </select></label>
            <label className="block"><span className="stitek">Výše (Kč nebo %)</span><input name="odmena_hodnota" inputMode="decimal" defaultValue={h(v, "odmena_hodnota")} className="pole" /></label>
            <label className="block sm:col-span-2"><span className="stitek">Daňový režim (pro odhad zdanění výnosu)</span>
              <select name="dan_rezim" defaultValue={h(v, "dan_rezim") ?? ""} className="pole">
                <option value="">—</option><option value="DPPO">Firma (daň z příjmů PO)</option>
                <option value="FO_skutecne_vydaje">Fyzická osoba – skutečné výdaje</option><option value="FO_pausal_30">Fyzická osoba – paušál 30 %</option>
              </select></label>
          </div>
        </details>
      )}
      <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} defaultValue={h(v, "poznamka")} className="pole" /></label>
      <Odeslat>{tlacitko}</Odeslat>
    </form>
  );
}
