import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { datum } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";

export default async function Smlouvy() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("najemni_smlouva")
    .select("id, variabilni_symbol, datum_od, datum_do, stav, den_splatnosti, nemovitost(nazev), pronajimatel:pronajimatel_id(nazev), najemni_smlouva_osoba(osoba(jmeno, prijmeni, nazev_firmy))")
    .order("datum_od", { ascending: false });
  const radky = (data ?? []) as unknown as {
    id: string; variabilni_symbol: string; datum_od: string; datum_do: string | null; stav: string; den_splatnosti: number;
    nemovitost: { nazev: string }; pronajimatel: { nazev: string };
    najemni_smlouva_osoba: { osoba: { jmeno: string | null; prijmeni: string | null; nazev_firmy: string | null } }[];
  }[];

  return (
    <>
      <Nadpis titulek="Nájemní smlouvy" akce={<Link href="/smlouvy/nova" className="tlacitko">+ Nová smlouva</Link>} />
      <div className="karta overflow-x-auto">
        {radky.length === 0 ? <p className="text-sm text-slate-500">Zatím žádné smlouvy.</p> : (
          <table className="tabulka">
            <thead><tr><th>VS</th><th>Nájemník</th><th>Nemovitost</th><th>Pronajímatel</th><th>Období</th><th>Splatnost</th><th>Stav</th></tr></thead>
            <tbody>{radky.map((s) => (
              <tr key={s.id}>
                <td><Link href={`/smlouvy/${s.id}`} className="odkaz">{s.variabilni_symbol}</Link></td>
                <td>{s.najemni_smlouva_osoba.map((o) => o.osoba?.nazev_firmy ?? `${o.osoba?.prijmeni ?? ""} ${o.osoba?.jmeno ?? ""}`).join(", ")}</td>
                <td>{s.nemovitost?.nazev}</td>
                <td>{s.pronajimatel?.nazev}</td>
                <td>{datum(s.datum_od)} – {s.datum_do ? datum(s.datum_do) : "neurčito"}</td>
                <td>{s.den_splatnosti}. v měsíci</td>
                <td>{s.stav === "aktivni" && s.datum_od > new Date().toISOString().slice(0, 10) ? <>aktivní <span className="text-xs text-blue-700">(začíná {datum(s.datum_od)})</span></> : s.stav}</td>
              </tr>))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
