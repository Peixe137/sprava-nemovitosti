import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Nadpis } from "@/components/Chyba";
import { korun, datum } from "@/lib/format";
import { Castka } from "@/components/Castka";

type Radek = {
  id: string; variabilni_symbol: string; kauce_castka: number; kauce_prijata_dne: string | null; kauce_vracena_dne: string | null; stav: string;
  nemovitost: { nazev: string } | null; najemni_smlouva_osoba: { role: string; osoba: { jmeno: string | null; prijmeni: string | null; nazev_firmy: string | null } | null }[];
  pohledavka: { druh: string; castka: number; uhrazeno: number }[];
};

/** Přehled kaucí: složené (drží se), čekající na zaplacení a vrácené. */
export default async function Kauce() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("najemni_smlouva")
    .select("id, variabilni_symbol, kauce_castka, kauce_prijata_dne, kauce_vracena_dne, stav, nemovitost(nazev), najemni_smlouva_osoba(role, osoba(jmeno, prijmeni, nazev_firmy)), pohledavka(druh, castka, uhrazeno)")
    .gt("kauce_castka", 0).order("datum_od", { ascending: false });
  const radky = ((data ?? []) as unknown as Radek[]).map((r) => {
    const p = r.pohledavka.find((x) => x.druh === "kauce");
    const slozeno = p ? Number(p.uhrazeno) : r.kauce_prijata_dne ? Number(r.kauce_castka) : 0;
    const najemce = r.najemni_smlouva_osoba.find((o) => o.role === "najemce")?.osoba;
    return { ...r, slozeno, najemce: najemce?.nazev_firmy ?? [najemce?.prijmeni, najemce?.jmeno].filter(Boolean).join(" ") };
  });
  const drzime = radky.filter((r) => !r.kauce_vracena_dne).reduce((a, r) => a + r.slozeno, 0);
  const cekame = radky.filter((r) => !r.kauce_vracena_dne).reduce((a, r) => a + Math.max(0, Number(r.kauce_castka) - r.slozeno), 0);
  const vraceno = radky.filter((r) => r.kauce_vracena_dne).reduce((a, r) => a + r.slozeno, 0);

  return (
    <>
      <Nadpis titulek="Kauce" podtitulek="Složené jistoty nájemníků – kolik držíme, co ještě nepřišlo a co se vrátilo" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <div className="dlazdice-zelena"><div className="stitek">Složené kauce celkem</div><div className="text-2xl font-semibold plus"><Castka v={drzime} /></div><div className="text-xs text-slate-500">drží se u nás, k vrácení po skončení nájmu</div></div>
        <div className={cekame > 0 ? "dlazdice-oranzova" : "dlazdice-zelena"}><div className="stitek">Čeká na zaplacení</div><div className={`text-2xl font-semibold ${cekame > 0 ? "text-amber-700" : "plus"}`}><Castka v={cekame} /></div><div className="text-xs text-slate-500">kauce ze smluv, které ještě nepřišly</div></div>
        <div className="dlazdice-zelena"><div className="stitek">Vráceno</div><div className="text-2xl font-semibold"><Castka v={vraceno} /></div><div className="text-xs text-slate-500">po skončených nájmech</div></div>
      </div>
      <section className="karta overflow-x-auto">
        {radky.length === 0 ? <p className="text-sm text-slate-500">Žádná smlouva zatím nemá kauci. Výši kauce zadáte ve smlouvě (Podmínky → Upravit podmínky).</p> : (
          <table className="tabulka">
            <thead><tr><th>Nájemník</th><th>Nemovitost</th><th className="text-right">Kauce</th><th className="text-right">Složeno</th><th>Stav</th></tr></thead>
            <tbody>{radky.map((r) => (
              <tr key={r.id}>
                <td><Link href={`/smlouvy/${r.id}`} className="odkaz">{r.najemce || `VS ${r.variabilni_symbol}`}</Link></td>
                <td>{r.nemovitost?.nazev}</td>
                <td className="text-right"><Castka v={r.kauce_castka} /></td>
                <td className="text-right plus">{r.slozeno ? korun(r.slozeno) : "–"}</td>
                <td>{r.kauce_vracena_dne ? <span className="text-slate-500">vrácena {datum(r.kauce_vracena_dne)}</span>
                  : r.slozeno >= Number(r.kauce_castka) ? <span className="plus">složena{r.kauce_prijata_dne ? ` ${datum(r.kauce_prijata_dne)}` : ""}</span>
                  : <span className="text-amber-700">čeká{r.slozeno ? ` (chybí ${korun(Number(r.kauce_castka) - r.slozeno)})` : ""}</span>}</td>
              </tr>))}</tbody>
          </table>
        )}
        <p className="mt-3 text-xs text-slate-500">Kauce se zapisuje jako platba ke smlouvě (splatná dnem začátku nájmu): zaplatíte ji tlačítkem v Platbách smlouvy, nebo se spáruje z bankovního výpisu podle VS.</p>
      </section>
    </>
  );
}
