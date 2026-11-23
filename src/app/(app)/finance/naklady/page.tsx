import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Odeslat } from "@/components/Odeslat";
import { KATEGORIE_NAKLADU, korun, datum, dnesIso } from "@/lib/format";
import { Chyba, Nadpis } from "@/components/Chyba";
import { pridatNaklad } from "../actions";

const SLUZBY: Record<string, string> = {
  voda: "Voda", teplo: "Teplo", tuv: "Teplá voda", elektrina_spol: "Elektřina spol. prostor", plyn: "Plyn",
  vytah: "Výtah", uklid: "Úklid", osvetleni: "Osvětlení", odpad: "Odpad", ostatni: "Ostatní služby",
};

export default async function Naklady({ searchParams }: PageProps<"/finance/naklady">) {
  const { chyba, ulozeno, nemovitost, rok } = await searchParams;
  const vybranyRok = Number(rok) || new Date().getFullYear();
  const supabase = await supabaseServer();

  let dotaz = supabase.from("naklad")
    .select("id, datum, kategorie, castka_bez_dph, dph, castka_celkem, poznamka, sluzba_vyuctovani, nemovitost(id, nazev), dodavatel:dodavatel_id(nazev_firmy, prijmeni)")
    .gte("datum", `${vybranyRok}-01-01`).lte("datum", `${vybranyRok}-12-31`)
    .order("datum", { ascending: false });
  if (nemovitost) dotaz = dotaz.eq("nemovitost_id", String(nemovitost));

  const [naklady, nem, dodavatele] = await Promise.all([
    dotaz,
    supabase.from("nemovitost").select("id, nazev").order("nazev"),
    supabase.from("osoba").select("id, nazev_firmy, prijmeni, jmeno").eq("je_dodavatel", true).order("nazev_firmy"),
  ]);
  const radky = (naklady.data ?? []) as unknown as {
    id: string; datum: string; kategorie: string; castka_bez_dph: number; dph: number; castka_celkem: number; poznamka: string | null;
    sluzba_vyuctovani: string | null; nemovitost: { id: string; nazev: string } | null; dodavatel: { nazev_firmy: string | null; prijmeni: string | null } | null;
  }[];
  const celkem = radky.reduce((s, r) => s + Number(r.castka_celkem), 0);

  return (
    <>
      <Nadpis titulek="Náklady" podtitulek={`Rok ${vybranyRok} · celkem ${korun(celkem)}`} />
      <Chyba text={chyba} />
      {ulozeno && <p className="mb-4 rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Náklad uložen.</p>}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-4 lg:col-span-2">
          <form className="flex flex-wrap gap-2">
            <select name="nemovitost" defaultValue={String(nemovitost ?? "")} className="pole w-auto">
              <option value="">Všechny nemovitosti</option>
              {(nem.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
            </select>
            <select name="rok" defaultValue={vybranyRok} className="pole w-auto">
              {[0, 1, 2, 3].map((i) => <option key={i}>{new Date().getFullYear() - i}</option>)}
            </select>
            <button className="tlacitko-svetle">Filtrovat</button>
          </form>

          <div className="karta overflow-x-auto">
            {radky.length === 0 ? <p className="text-sm text-slate-500">Žádné náklady za zvolené období.</p> : (
              <table className="tabulka">
                <thead><tr><th>Datum</th><th>Nemovitost</th><th>Kategorie</th><th>Popis</th><th className="text-right">Bez DPH</th><th className="text-right">Celkem</th></tr></thead>
                <tbody>{radky.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap">{datum(r.datum)}</td>
                    <td>{r.nemovitost ? <Link href={`/nemovitosti/${r.nemovitost.id}`} className="odkaz">{r.nemovitost.nazev}</Link> : "–"}</td>
                    <td>{KATEGORIE_NAKLADU[r.kategorie] ?? r.kategorie}
                      {r.sluzba_vyuctovani && <div className="text-xs text-blue-700">přeúčtovat: {SLUZBY[r.sluzba_vyuctovani]}</div>}</td>
                    <td>{r.poznamka ?? "–"}{r.dodavatel && <div className="text-xs text-slate-500">{r.dodavatel.nazev_firmy ?? r.dodavatel.prijmeni}</div>}</td>
                    <td className="text-right">{korun(r.castka_bez_dph)}</td>
                    <td className="text-right font-medium">{korun(r.castka_celkem)}</td>
                  </tr>))}
                </tbody>
              </table>
            )}
          </div>
        </div>

        <form action={pridatNaklad} className="karta space-y-3 self-start">
          <h2 className="font-semibold">Zadat náklad</h2>
          <label className="block"><span className="stitek">Nemovitost</span>
            <select name="nemovitost_id" required defaultValue={String(nemovitost ?? "")} className="pole">
              <option value="" disabled>— vyberte —</option>
              {(nem.data ?? []).map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
            </select></label>
          <label className="block"><span className="stitek">Kategorie</span>
            <select name="kategorie" required className="pole">
              {Object.entries(KATEGORIE_NAKLADU).filter(([k]) => k !== "porizeni").map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="stitek">Datum</span><input name="datum" type="date" required defaultValue={dnesIso()} className="pole" /></label>
            <label className="block"><span className="stitek">Částka Kč</span><input name="castka" required inputMode="decimal" className="pole" /></label>
          </div>
          <div className="grid grid-cols-2 items-end gap-3">
            <label className="flex items-center gap-2 pb-2 text-sm"><input type="checkbox" name="s_dph" /> Částka je s DPH</label>
            <label className="block"><span className="stitek">Sazba DPH</span>
              <select name="sazba_dph" className="pole"><option value="21">21 %</option><option value="12">12 %</option><option value="0">0 %</option></select></label>
          </div>
          <label className="block"><span className="stitek">Popis</span><input name="poznamka" className="pole" placeholder="např. Oprava kotle" /></label>
          <label className="block"><span className="stitek">Dodavatel</span>
            <select name="dodavatel_id" className="pole">
              <option value="">—</option>
              {(dodavatele.data ?? []).map((d) => <option key={d.id} value={d.id}>{d.nazev_firmy ?? `${d.prijmeni} ${d.jmeno ?? ""}`}</option>)}
            </select></label>
          <label className="block"><span className="stitek">Přeúčtovat nájemníkům ve vyúčtování</span>
            <select name="sluzba_vyuctovani" className="pole">
              <option value="">Ne – nese vlastník</option>
              {Object.entries(SLUZBY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select></label>
          <Odeslat>Uložit náklad</Odeslat>
        </form>
      </div>
    </>
  );
}
