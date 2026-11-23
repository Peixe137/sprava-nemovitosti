import Link from "next/link";
import { Odeslat } from "@/components/Odeslat";
import { PLATFORMY } from "@/lib/format";

type R = Record<string, string | number | null | undefined>;
const Pole = ({ name, label, v, type = "text", ...rest }: { name: string; label: string; v?: R; type?: string; [k: string]: unknown }) => (
  <label className="block"><span className="stitek">{label}</span>
    <input name={name} type={type} defaultValue={v?.[name] != null ? String(v[name]) : undefined} className="pole" {...rest} /></label>
);

export function FormularRezervace({ akce, nemovitosti, v, vychoziNemovitost }: {
  akce: (f: FormData) => Promise<void>; nemovitosti: { id: string; nazev: string }[]; v?: R; vychoziNemovitost?: string;
}) {
  return (
    <form action={akce} className="karta max-w-3xl space-y-5">
      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Pobyt</legend>
        <label className="block sm:col-span-2"><span className="stitek">Nemovitost</span>
          <select name="nemovitost_id" required defaultValue={String(v?.nemovitost_id ?? vychoziNemovitost ?? "")} className="pole">
            <option value="" disabled>— vyberte —</option>
            {nemovitosti.map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
          </select></label>
        <label className="block"><span className="stitek">Platforma</span>
          <select name="platforma" defaultValue={String(v?.platforma ?? "airbnb")} className="pole">
            {Object.entries(PLATFORMY).map(([k, p]) => <option key={k} value={k}>{p.text}</option>)}
          </select></label>
        <Pole name="prijezd" label="Příjezd" type="date" required v={v} />
        <Pole name="odjezd" label="Odjezd" type="date" required v={v} />
        <Pole name="pocet_hostu" label="Počet hostů" type="number" min={1} v={v} />
        <Pole name="kod_rezervace" label="Kód rezervace" placeholder="HMABC123" v={v} />
        <label className="block"><span className="stitek">Stav</span>
          <select name="stav" defaultValue={String(v?.stav ?? "potvrzena")} className="pole">
            <option value="potvrzena">Potvrzená</option><option value="zrusena">Zrušená</option>
          </select></label>
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Host</legend>
        <Pole name="host" label="Jméno" v={v} />
        <Pole name="host_telefon" label="Telefon" v={v} />
        <Pole name="host_email" label="E-mail" type="email" v={v} />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold">Peníze (Kč)</legend>
        <Pole name="cena_ubytovani" label="Ubytování (zaplatil host)" inputMode="decimal" v={v} />
        <Pole name="uklid" label="Úklid" inputMode="decimal" v={v} />
        <Pole name="poplatek_platformy" label="Provize platformy" inputMode="decimal" v={v} />
        <Pole name="poplatek_z_pobytu" label="Poplatek z pobytu (pro obec)" inputMode="decimal" v={v} />
        <Pole name="vyplata" label="Výplata na účet" inputMode="decimal" placeholder="prázdné = dopočítá se" v={v} />
        <Pole name="datum_vyplaty" label="Datum výplaty" type="date" v={v} />
        <p className="text-xs text-slate-500 sm:col-span-3">Výplata se bez vyplnění dopočítá jako ubytování + úklid − provize. Poplatek z pobytu se vede zvlášť, protože se odvádí obci (přehled po čtvrtletích je v seznamu).</p>
      </fieldset>

      <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} defaultValue={String(v?.poznamka ?? "")} className="pole" /></label>
      <div className="flex gap-3"><Odeslat>Uložit rezervaci</Odeslat><Link href="/kratkodobe" className="tlacitko-svetle">Zrušit</Link></div>
    </form>
  );
}
