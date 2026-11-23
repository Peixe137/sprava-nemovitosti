import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { korun, datum, mesic } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";

export default async function Dluznici() {
  const supabase = await supabaseServer();
  const { data } = await supabase.from("v_dluznici").select("*").order("dni_po_splatnosti", { ascending: false });
  const radky = data ?? [];
  const celkem = radky.reduce((s, d) => s + Number(d.dluh), 0);

  return (
    <>
      <Nadpis titulek="Dlužníci" podtitulek={`Celkem po splatnosti: ${korun(celkem)}`} />
      <div className="karta overflow-x-auto">
        {radky.length === 0 ? (
          <p className="text-sm text-slate-500">Žádné nezaplacené platby po splatnosti.</p>
        ) : (
          <table className="tabulka">
            <thead><tr><th>Nájemník</th><th>Nemovitost</th><th>Vlastník</th><th>Období</th><th>Splatnost</th><th className="text-right">Dluh</th><th className="text-right">Dní po splatnosti</th></tr></thead>
            <tbody>
              {radky.map((d) => (
                <tr key={d.pohledavka_id}>
                  <td><Link href={`/smlouvy/${d.smlouva_id}`} className="odkaz">{d.najemnik ?? "–"}</Link>
                    <div className="text-xs text-slate-500">VS {d.variabilni_symbol}</div></td>
                  <td>{d.nemovitost}</td>
                  <td>{d.vlastnik}</td>
                  <td>{mesic(d.obdobi)}</td>
                  <td>{datum(d.splatnost)}</td>
                  <td className="text-right font-medium text-red-700">{korun(d.dluh)}</td>
                  <td className={`text-right ${d.dni_po_splatnosti > 30 ? "font-semibold text-red-700" : ""}`}>{d.dni_po_splatnosti}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
