import Link from "next/link";
import { STAVY_NEMOVITOSTI, VYUZITI } from "@/lib/format";
import { RuianAdresa } from "@/components/RuianAdresa";
import { Odeslat } from "@/components/Odeslat";
import { PatriPod } from "@/components/PatriPod";
import { CisloJednotky } from "@/components/CisloJednotky";
import { datum } from "@/lib/format";

type Zaznam = Record<string, string | number | null | undefined>;
type Props = {
  akce: (f: FormData) => Promise<void>;
  zrusit: string;
  typy: { kod: string; nazev: string }[];
  vlastnici: { id: string; nazev: string; zkratka: string | null }[];
  budovy: { id: string; nazev: string }[];
  // vyplněno = formulář jednotky pod budovou; údaje níže se z budovy propisují
  rodic?: { id: string; nazev: string; drive_folder_url: string | null; ulice?: string | null; cislo_popisne?: string | null; obec?: string | null;
    katastralni_uzemi?: string | null; lv?: string | null; datum_porizeni?: string | null; vlastnici?: string } | null;
  v?: Zaznam;              // výchozí hodnoty (úprava)
  vlastnictvi?: { vlastnik_id: string; podil_citatel: number; podil_jmenovatel: number } | null;
  vice_vlastniku?: boolean;
};

const Pole = ({ name, label, type = "text", v, ...rest }: { name: string; label: string; type?: string; v?: Zaznam; [k: string]: unknown }) => (
  <label className="block"><span className="stitek">{label}</span>
    <input name={name} type={type} defaultValue={v?.[name] != null ? String(v[name]) : undefined} className="pole" {...rest} /></label>
);

export function FormularNemovitosti({ akce, zrusit, typy, vlastnici, budovy, rodic, v, vlastnictvi, vice_vlastniku }: Props) {
  const uprava = !!v;
  const Stav = (<>
    <label className="block"><span className="stitek">Fáze</span>
      <select name="stav" defaultValue={String(v?.stav ?? "drzeni")} className="pole">
        {Object.entries(STAVY_NEMOVITOSTI).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
      </select></label>
    <label className="block"><span className="stitek">Využití</span>
      <select name="vyuziti" defaultValue={String(v?.vyuziti ?? "pronajem")} className="pole">
        {Object.entries(VYUZITI).map(([k, x]) => <option key={k} value={k}>{x}</option>)}
      </select></label>
  </>);
  const Upozorneni = <Pole name="upozorneni" label="Upozornění – co se řeší (právní vady, spor, exekuce…)" v={v} placeholder="nechte prázdné, pokud je vše v pořádku" />;

  // ----- jednotka pod budovou / areálem: jen to, co je pro jednotku vlastní -----
  if (rodic) {
    return (
      <form action={akce} className="karta max-w-3xl space-y-5">
        <input type="hidden" name="nadrazena_id" value={rodic.id} />
        <div className="rounded-lg bg-slate-50 px-4 py-3 text-sm">
          <div className="mb-1 text-slate-600">Jednotka v budově <b>{rodic.nazev}</b>. Z budovy se propisuje (a při změně budovy aktualizuje):</div>
          <dl className="grid gap-x-6 gap-y-1 sm:grid-cols-2">
            <div><dt className="inline text-slate-500">Vlastník: </dt><dd className="inline">{rodic.vlastnici || "–"}</dd></div>
            <div><dt className="inline text-slate-500">Adresa: </dt><dd className="inline">{[rodic.ulice, rodic.cislo_popisne, rodic.obec].filter(Boolean).join(" ") || "–"}</dd></div>
            <div><dt className="inline text-slate-500">Katastr: </dt><dd className="inline">{[rodic.katastralni_uzemi, rodic.lv && "LV " + rodic.lv].filter(Boolean).join(", ") || "–"}</dd></div>
            <div><dt className="inline text-slate-500">Datum pořízení: </dt><dd className="inline">{datum(rodic.datum_porizeni)}</dd></div>
          </dl>
          <div className="mt-1 text-xs text-slate-500">Pořizovací cena a tržní hodnota se vedou jen u budovy.</div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="block"><span className="stitek">Typ</span>
            <select name="typ_kod" defaultValue={String(v?.typ_kod ?? "J")} className="pole">
              {typy.filter((t) => ["J", "N", "O"].includes(t.kod)).map((t) => <option key={t.kod} value={t.kod}>{t.kod} – {t.nazev}</option>)}
            </select></label>
          <div className="sm:col-span-2"><Pole name="nazev" label="Název jednotky (= název podsložky)" required placeholder="NP001 (Pošta)" v={v} /></div>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          {Stav}
          <Pole name="plocha_m2" label="Plocha m²" inputMode="decimal" v={v} />
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <CisloJednotky patro={v?.patro != null ? Number(v.patro) : null} kod={v?.kod_jednotky != null ? String(v.kod_jednotky) : null} />
        </div>
        {!uprava && <Pole name="cislo_jednotky" label="Č. jednotky v katastru (je-li vymezena)" placeholder="147/1" />}
        {Upozorneni}
        <Pole name="drive_folder_url" label="Odkaz na podsložku na Disku (nepovinné)" type="url" v={v}
          placeholder={rodic.drive_folder_url ? "jinak se otevře složka budovy" : ""} />
        <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} defaultValue={String(v?.poznamka ?? "")} className="pole" /></label>
        <div className="flex gap-3"><Odeslat>{uprava ? "Uložit změny" : "Uložit jednotku"}</Odeslat><Link href={zrusit} className="tlacitko-svetle">Zrušit</Link></div>
      </form>
    );
  }

  // ----- samostatná nemovitost / budova / areál -----
  return (
    <form action={akce} className="karta max-w-3xl space-y-5">
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="block"><span className="stitek">Typ</span>
          <select name="typ_kod" required defaultValue={String(v?.typ_kod ?? "B")} className="pole">{typy.map((t) => <option key={t.kod} value={t.kod}>{t.kod} – {t.nazev}</option>)}</select></label>
        <div className="sm:col-span-2"><Pole name="nazev" label="Název (podle konvence složek)" required placeholder="B BECHYNE LV1910 (Bechyně nám. T. G. Masaryka 147)" v={v} /></div>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block"><span className="stitek">Patří pod (areál)</span>
          <PatriPod budovy={budovy.filter((b) => b.id !== v?.id)} vychozi={String(v?.nadrazena_id ?? "")} prepnout={!uprava} /></label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {Stav}
      </div>
      {Upozorneni}

      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold">Vlastník</legend>
        {vice_vlastniku ? <p className="text-sm text-slate-500 sm:col-span-4">Nemovitost má více spoluvlastníků – upravují se v detailu.</p> : (<>
          <label className="block sm:col-span-2"><span className="stitek">Vlastník</span>
            <select name="vlastnik_id" defaultValue={vlastnictvi?.vlastnik_id ?? ""} className="pole">
              <option value="">— doplním později —</option>
              {vlastnici.map((x) => <option key={x.id} value={x.id}>{x.nazev}{x.zkratka ? ` (@${x.zkratka})` : ""}</option>)}
            </select></label>
          <Pole name="podil_citatel" label="Podíl" type="number" min={1} defaultValue={vlastnictvi?.podil_citatel ?? 1} />
          <Pole name="podil_jmenovatel" label="z celku" type="number" min={1} defaultValue={vlastnictvi?.podil_jmenovatel ?? 1} />
          {vlastnici.length === 0 && <p className="text-xs text-slate-500 sm:col-span-4">Nejdřív přidejte vlastníka v sekci <Link href="/vlastnici" className="odkaz">Vlastníci</Link>.</p>}
        </>)}
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold">Katastr a adresa</legend>
        <div className="sm:col-span-4"><RuianAdresa /></div>
        <Pole name="katastralni_uzemi" label="Katastrální území" v={v} />
        <Pole name="lv" label="LV" v={v} />
        <Pole name="parcelni_cislo" label="Parcela" v={v} />
        <Pole name="cislo_popisne" label="Číslo popisné" v={v} />
        <div className="sm:col-span-2"><Pole name="ulice" label="Ulice" v={v} /></div>
        <Pole name="obec" label="Obec" v={v} />
        <Pole name="psc" label="PSČ" v={v} />
      </fieldset>

      <fieldset className="grid gap-3 sm:grid-cols-4">
        <legend className="mb-2 text-sm font-semibold">Ekonomika (za celou nemovitost)</legend>
        <Pole name="plocha_m2" label="Plocha m²" inputMode="decimal" v={v} />
        <Pole name="porizovaci_cena" label="Pořizovací cena" inputMode="decimal" v={v} />
        <Pole name="datum_porizeni" label="Datum pořízení" type="date" v={v} />
        <Pole name="trzni_hodnota" label="Tržní hodnota" inputMode="decimal" v={v} />
      </fieldset>

      <Pole name="drive_folder_url" label="Odkaz na složku Google Disk" type="url" v={v} />
      <label className="block"><span className="stitek">Poznámka</span><textarea name="poznamka" rows={2} defaultValue={String(v?.poznamka ?? "")} className="pole" /></label>
      <div className="flex gap-3"><Odeslat>{uprava ? "Uložit změny" : "Uložit"}</Odeslat><Link href={zrusit} className="tlacitko-svetle">Zrušit</Link></div>
    </form>
  );
}
