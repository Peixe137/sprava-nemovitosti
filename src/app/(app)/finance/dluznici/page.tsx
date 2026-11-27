import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { korun, datum, mesic } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";
import { Castka } from "@/components/Castka";

const PASMA = [
  { klic: "0-30", text: "0–30 dní", od: 1, do: 30, barva: "bg-amber-50 text-amber-800 border-amber-200" },
  { klic: "31-60", text: "31–60 dní", od: 31, do: 60, barva: "bg-orange-50 text-orange-800 border-orange-200" },
  { klic: "61-90", text: "61–90 dní", od: 61, do: 90, barva: "bg-red-50 text-red-700 border-red-200" },
  { klic: "90+", text: "90+ dní", od: 91, do: Infinity, barva: "bg-red-100 text-red-800 border-red-300" },
];

type Radek = { pohledavka_id: string; smlouva_id: string; variabilni_symbol: string; nemovitost: string; vlastnik: string; najemnik: string | null; obdobi: string; splatnost: string; dluh: number; dni_po_splatnosti: number };

export default async function Dluznici({ searchParams }: PageProps<"/finance/dluznici">) {
  const { pasmo } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("v_dluznici").select("*").order("dni_po_splatnosti", { ascending: false });
  const vse = (data ?? []) as Radek[];

  // seskupení po nájemních smlouvách (jeden nájemník = jeden řádek)
  const smlouvy = new Map<string, Radek & { mesicu: number; nejstarsi: number }>();
  for (const r of vse) {
    const s = smlouvy.get(r.smlouva_id);
    if (s) { s.dluh = Number(s.dluh) + Number(r.dluh); s.mesicu++; s.nejstarsi = Math.max(s.nejstarsi, r.dni_po_splatnosti); }
    else smlouvy.set(r.smlouva_id, { ...r, dluh: Number(r.dluh), mesicu: 1, nejstarsi: r.dni_po_splatnosti });
  }
  const dluznici = [...smlouvy.values()].sort((a, b) => b.dluh - a.dluh);
  const vPasmu = (d: { nejstarsi: number }, p: (typeof PASMA)[number]) => d.nejstarsi >= p.od && d.nejstarsi <= p.do;
  const vybrane = PASMA.find((p) => p.klic === pasmo);
  const zobrazeni = vybrane ? dluznici.filter((d) => vPasmu(d, vybrane)) : dluznici;
  const celkem = dluznici.reduce((s, d) => s + d.dluh, 0);

  return (
    <>
      <Nadpis titulek="Dlužníci" podtitulek="Nájemníci s nezaplacenými platbami po splatnosti, rozdělení podle stáří nejstaršího dluhu" />
      <div className="mb-6 grid gap-3 sm:grid-cols-5">
        <Link href="/finance/dluznici" className={`karta ${!vybrane ? "ring-2 ring-slate-900" : ""}`}>
          <div className="stitek">Celkem</div>
          <div className="text-xl font-semibold"><Castka v={celkem} /></div>
          <div className="text-xs text-slate-500">{dluznici.length} dlužníků</div>
        </Link>
        {PASMA.map((p) => {
          const v = dluznici.filter((d) => vPasmu(d, p));
          return (
            <Link key={p.klic} href={`/finance/dluznici?pasmo=${p.klic}`}
              className={`rounded-xl border p-5 ${p.barva} ${vybrane?.klic === p.klic ? "ring-2 ring-slate-900" : ""}`}>
              <div className="mb-1 text-xs font-medium tracking-wide uppercase opacity-80">{p.text}</div>
              <div className="text-xl font-semibold"><Castka v={v.reduce((s, d) => s + d.dluh, 0)} /></div>
              <div className="text-xs opacity-80">{v.length} dlužníků</div>
            </Link>
          );
        })}
      </div>

      <div className="karta overflow-x-auto">
        {zobrazeni.length === 0 ? (
          <p className="text-sm text-slate-500">Žádné nezaplacené platby po splatnosti.</p>
        ) : (
          <table className="tabulka">
            <thead><tr><th>Nájemník</th><th>Nemovitost</th><th>Vlastník</th><th>Nejstarší dluh</th><th className="text-right">Měsíců</th><th className="text-right">Dluh celkem</th><th className="text-right">Dní po splatnosti</th></tr></thead>
            <tbody>
              {zobrazeni.map((d) => (
                <tr key={d.smlouva_id}>
                  <td><Link href={`/smlouvy/${d.smlouva_id}`} className="odkaz">{d.najemnik ?? "–"}</Link>
                    <div className="text-xs text-slate-500">VS {d.variabilni_symbol}</div></td>
                  <td>{d.nemovitost}</td>
                  <td>{d.vlastnik}</td>
                  <td>{mesic(d.obdobi)} <span className="text-xs text-slate-500">(spl. {datum(d.splatnost)})</span></td>
                  <td className="text-right">{d.mesicu}</td>
                  <td className="text-right font-semibold text-red-700"><Castka v={d.dluh} /></td>
                  <td className={`text-right ${d.nejstarsi > 90 ? "font-semibold text-red-700" : ""}`}>{d.nejstarsi}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}
