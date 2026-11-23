import { supabaseServer } from "@/lib/supabase/server";
import { DRUHY_VLASTNIKA } from "@/lib/format";
import { Odeslat } from "@/components/Odeslat";
import { Chyba, Nadpis } from "@/components/Chyba";
import { pridatVlastnika } from "./actions";
import { AresTlacitko } from "@/components/AresTlacitko";

export default async function Vlastnici({ searchParams }: PageProps<"/vlastnici">) {
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("vlastnik").select("*").order("nazev");

  return (
    <>
      <Nadpis titulek="Vlastníci" podtitulek="Vaše firmy, vy osobně a klienti, jejichž nemovitosti spravujete" />
      <Chyba text={chyba} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="karta overflow-x-auto lg:col-span-2">
          {(data ?? []).length === 0 ? <p className="text-sm text-slate-500">Zatím žádní vlastníci.</p> : (
            <table className="tabulka">
              <thead><tr><th>Název</th><th>Tag</th><th>Druh</th><th>IČO</th><th>DPH</th></tr></thead>
              <tbody>
                {(data ?? []).map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium">{v.nazev}</td>
                    <td>{v.zkratka ? "@" + v.zkratka : "–"}</td>
                    <td>{DRUHY_VLASTNIKA[v.druh]}</td>
                    <td>{v.ico ?? "–"}</td>
                    <td>{v.platce_dph ? "plátce" : "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <form action={pridatVlastnika} className="karta space-y-3">
          <h2 className="font-semibold">Přidat vlastníka</h2>
          <div className="grid grid-cols-2 items-end gap-3">
            <label className="block"><span className="stitek">IČO</span><input name="ico" inputMode="numeric" className="pole" /></label>
            <AresTlacitko mapovani={{ nazev: "nazev", dic: "dic", adresa: "adresa", pravni_forma: "pravni_forma", platce_dph: "platce_dph", ico: "ico" }} />
          </div>
          <label className="block"><span className="stitek">Název / jméno</span><input name="nazev" required className="pole" /></label>
          <label className="block"><span className="stitek">Druh</span>
            <select name="druh" className="pole">{Object.entries(DRUHY_VLASTNIKA).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="stitek">Firemní tag</span><input name="zkratka" placeholder="např. CTX" className="pole" /></label>
            <label className="block"><span className="stitek">Forma</span>
              <select name="pravni_forma" className="pole"><option value="PO">Právnická osoba</option><option value="FO">Fyzická osoba</option></select></label>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <label className="block"><span className="stitek">DIČ</span><input name="dic" className="pole" /></label>
            <label className="flex items-center gap-2 self-end pb-2 text-sm"><input type="checkbox" name="platce_dph" /> Plátce DPH</label>
          </div>
          <label className="block"><span className="stitek">Adresa / sídlo</span><input name="adresa" className="pole" /></label>
          <label className="block"><span className="stitek">E-mail</span><input name="email" type="email" className="pole" /></label>
          <label className="block"><span className="stitek">Telefon</span><input name="telefon" className="pole" /></label>
          <Odeslat>Uložit</Odeslat>
        </form>
      </div>
    </>
  );
}
