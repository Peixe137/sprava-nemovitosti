import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { STAVY_NEMOVITOSTI } from "@/lib/format";
import { Chyba, Nadpis } from "@/components/Chyba";
import { pridatNemovitost } from "../actions";

export default async function NovaNemovitost({ searchParams }: PageProps<"/nemovitosti/nova">) {
  const { chyba, nadrazena } = await searchParams;
  const supabase = await supabaseServer();
  const [typy, nemovitosti, vlastnici] = await Promise.all([
    supabase.from("typ_nemovitosti").select("kod, nazev").order("kod"),
    supabase.from("nemovitost").select("id, nazev").is("nadrazena_id", null).order("nazev"),
    supabase.from("vlastnik").select("id, nazev, zkratka").order("nazev"),
  ]);

  const Pole = ({ name, label, type = "text", ...rest }: { name: string; label: string; type?: string; [k: string]: unknown }) => (
    <label className="block"><span className="stitek">{label}</span><input name={name} type={type} className="pole" {...rest} /></label>
  );

  return (
    <>
      <Nadpis titulek="Nová nemovitost" />
      <Chyba text={chyba} />
      <form action={pridatNemovitost} className="karta max-w-3xl space-y-5">
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="stitek">Typ</span>
            <select name="typ_kod" required className="pole">{(typy.data ?? []).map((t) => <option key={t.kod} value={t.kod}>{t.kod} – {t.nazev}</option>)}</select></label>
          <div className="sm:col-span-2"><Pole name="nazev" label="Název (podle konvence složek)" required placeholder="J ZIZKOV LV1234 (Praha Kubelíkova 733)" /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="block"><span className="stitek">Patří pod (budova / areál)</span>
            <select name="nadrazena_id" defaultValue={String(nadrazena ?? "")} className="pole">
              <option value="">— samostatná nemovitost —</option>
              {(nemovitosti.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
            </select></label>
          <label className="block"><span className="stitek">Stav</span>
            <select name="stav" className="pole">{Object.entries(STAVY_NEMOVITOSTI).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        </div>

        <fieldset className="grid gap-3 sm:grid-cols-4">
          <legend className="mb-2 text-sm font-semibold">Vlastník</legend>
          <label className="block sm:col-span-2"><span className="stitek">Vlastník</span>
            <select name="vlastnik_id" className="pole">
              <option value="">— doplním později —</option>
              {(vlastnici.data ?? []).map((v) => <option key={v.id} value={v.id}>{v.nazev}{v.zkratka ? ` (@${v.zkratka})` : ""}</option>)}
            </select></label>
          <Pole name="podil_citatel" label="Podíl" type="number" min={1} defaultValue={1} />
          <Pole name="podil_jmenovatel" label="z celku" type="number" min={1} defaultValue={1} />
          {(vlastnici.data ?? []).length === 0 && <p className="text-xs text-slate-500 sm:col-span-4">Nejdřív přidejte vlastníka v sekci <Link href="/vlastnici" className="odkaz">Vlastníci</Link>.</p>}
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-4">
          <legend className="mb-2 text-sm font-semibold">Katastr a adresa</legend>
          <Pole name="katastralni_uzemi" label="Katastrální území" />
          <Pole name="lv" label="LV" />
          <Pole name="parcelni_cislo" label="Parcela" />
          <Pole name="cislo_popisne" label="Číslo popisné" />
          <div className="sm:col-span-2"><Pole name="ulice" label="Ulice" /></div>
          <Pole name="obec" label="Obec" />
          <Pole name="psc" label="PSČ" />
        </fieldset>

        <fieldset className="grid gap-3 sm:grid-cols-4">
          <legend className="mb-2 text-sm font-semibold">Ekonomika</legend>
          <Pole name="plocha_m2" label="Plocha m²" inputMode="decimal" />
          <Pole name="porizovaci_cena" label="Pořizovací cena" inputMode="decimal" />
          <Pole name="datum_porizeni" label="Datum pořízení" type="date" />
          <Pole name="trzni_hodnota" label="Tržní hodnota" inputMode="decimal" />
        </fieldset>

        <Pole name="drive_folder_url" label="Odkaz na složku Google Disk" type="url" />
        <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} className="pole" /></label>
        <div className="flex gap-3"><button className="tlacitko">Uložit</button><Link href="/nemovitosti" className="tlacitko-svetle">Zrušit</Link></div>
      </form>
    </>
  );
}
