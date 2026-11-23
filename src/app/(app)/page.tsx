import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { korun, datum, mesic } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";

export default async function Prehled() {
  const supabase = await supabaseServer();
  const [nem, sml, dluh, terminy] = await Promise.all([
    supabase.from("nemovitost").select("id", { count: "exact", head: true }),
    supabase.from("najemni_smlouva").select("id", { count: "exact", head: true }).eq("stav", "aktivni"),
    supabase.from("v_dluznici").select("*").order("dni_po_splatnosti", { ascending: false }),
    supabase.from("v_terminy").select("*").order("datum").limit(8),
  ]);
  const dluznici = dluh.data ?? [];
  const dluhCelkem = dluznici.reduce((s, d) => s + Number(d.dluh), 0);

  const dlazdice = [
    { text: "Nemovitostí", hodnota: String(nem.count ?? 0), href: "/nemovitosti" },
    { text: "Aktivních smluv", hodnota: String(sml.count ?? 0), href: "/smlouvy" },
    { text: "Dluží celkem", hodnota: korun(dluhCelkem), href: "/dluznici", varovani: dluhCelkem > 0 },
  ];

  return (
    <>
      <Nadpis titulek="Přehled" />
      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        {dlazdice.map((d) => (
          <Link key={d.text} href={d.href} className="karta hover:border-slate-300">
            <div className="stitek">{d.text}</div>
            <div className={`text-2xl font-semibold ${d.varovani ? "text-red-700" : ""}`}>{d.hodnota}</div>
          </Link>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <section className="karta">
          <h2 className="mb-3 font-semibold">Po splatnosti</h2>
          {dluznici.length === 0 ? (
            <p className="text-sm text-slate-500">Nikdo nic nedluží.</p>
          ) : (
            <table className="tabulka">
              <tbody>
                {dluznici.slice(0, 8).map((d) => (
                  <tr key={d.pohledavka_id}>
                    <td><Link href={`/smlouvy/${d.smlouva_id}`} className="odkaz">{d.najemnik ?? d.nemovitost}</Link>
                      <div className="text-xs text-slate-500">{d.nemovitost} · {mesic(d.obdobi)}</div></td>
                    <td className="text-right font-medium text-red-700">{korun(d.dluh)}</td>
                    <td className="text-right text-xs text-slate-500">{d.dni_po_splatnosti} dní</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        <section className="karta">
          <h2 className="mb-3 font-semibold">Blížící se termíny</h2>
          {(terminy.data ?? []).length === 0 ? (
            <p className="text-sm text-slate-500">Žádné termíny v nejbližší době.</p>
          ) : (
            <table className="tabulka">
              <tbody>
                {(terminy.data ?? []).map((t) => (
                  <tr key={t.zdroj + t.id}><td>{t.nazev}</td><td className="text-right">{datum(t.datum)}</td></tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>
    </>
  );
}
