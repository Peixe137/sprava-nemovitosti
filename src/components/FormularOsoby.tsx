import { KATEGORIE_OSOB } from "@/lib/format";
import { Odeslat } from "@/components/Odeslat";
import { AresTlacitko } from "@/components/AresTlacitko";

type V = Record<string, unknown>;
const h = (v: V | undefined, k: string) => (v?.[k] == null ? undefined : String(v[k]));

/** Kontakt v adresáři – firma nebo člověk, s kategoriemi (řemeslník, dodavatel, právník…). */
export function FormularOsoby({ akce, v, tlacitko = "Uložit" }: { akce: (f: FormData) => Promise<void>; v?: V; tlacitko?: string }) {
  const kat = (v?.kategorie as string[] | undefined) ?? [];
  return (
    <form action={akce} className="karta space-y-3 text-sm">
      <div className="grid grid-cols-[1fr_auto] items-end gap-2">
        <label className="block"><span className="stitek">IČO</span><input name="ico" inputMode="numeric" defaultValue={h(v, "ico")} className="pole" /></label>
        <AresTlacitko mapovani={{ nazev: "nazev_firmy", adresa: "adresa", ico: "ico" }} />
      </div>
      <label className="block"><span className="stitek">Název firmy</span><input name="nazev_firmy" defaultValue={h(v, "nazev_firmy")} className="pole" /></label>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="stitek">Jméno</span><input name="jmeno" defaultValue={h(v, "jmeno")} className="pole" /></label>
        <label className="block"><span className="stitek">Příjmení</span><input name="prijmeni" defaultValue={h(v, "prijmeni")} className="pole" /></label>
      </div>
      <fieldset>
        <legend className="stitek">Kategorie</legend>
        <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1">
          {Object.entries(KATEGORIE_OSOB).map(([k, x]) => (
            <label key={k} className="flex items-center gap-1.5"><input type="checkbox" name="kategorie" value={k} defaultChecked={kat.includes(k)} />{x}</label>
          ))}
        </div>
        <p className="mt-1 text-xs text-slate-500">Nájemníky a vlastníky aplikace pozná sama ze smluv a nemovitostí.</p>
      </fieldset>
      <div className="grid grid-cols-2 gap-2">
        <label className="block"><span className="stitek">Telefon</span><input name="telefon" defaultValue={h(v, "telefon")} placeholder="+420…" className="pole" /></label>
        <label className="block"><span className="stitek">E-mail</span><input name="email" type="email" defaultValue={h(v, "email")} className="pole" /></label>
        <label className="block"><span className="stitek">WhatsApp</span><input name="whatsapp" defaultValue={h(v, "whatsapp")} className="pole" /></label>
        <label className="block"><span className="stitek">Web</span><input name="web" defaultValue={h(v, "web")} placeholder="https://…" className="pole" /></label>
      </div>
      <label className="block"><span className="stitek">Adresa / sídlo</span><input name="adresa" defaultValue={h(v, "adresa")} className="pole" /></label>
      <label className="block"><span className="stitek">Poznámka (co dělá, ceny, hodnocení…)</span><textarea name="poznamka" rows={2} defaultValue={h(v, "poznamka")} className="pole" /></label>
      <Odeslat>{tlacitko}</Odeslat>
    </form>
  );
}
