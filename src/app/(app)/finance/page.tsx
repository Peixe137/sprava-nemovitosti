import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { KATEGORIE_NAKLADU, MESICE, korun } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";

export default async function FinancePrehled({ searchParams }: PageProps<"/finance">) {
  const { rok } = await searchParams;
  const r = Number(rok) || new Date().getFullYear();
  const od = `${r}-01-01`, doo = `${r}-12-31`;
  const supabase = await supabaseServer();
  const [pohl, nakl, dluh] = await Promise.all([
    supabase.from("pohledavka").select("obdobi, castka, uhrazeno").eq("druh", "mesicni").gte("obdobi", od).lte("obdobi", doo),
    supabase.from("naklad").select("datum, kategorie, castka_celkem, sluzba_vyuctovani").gte("datum", od).lte("datum", doo),
    supabase.from("v_dluznici").select("dluh"),
  ]);

  const mesice = MESICE.map((m) => ({ m, predepsano: 0, vybrano: 0, naklady: 0 }));
  for (const p of pohl.data ?? []) {
    const i = new Date(p.obdobi + "T00:00:00").getMonth();
    mesice[i].predepsano += Number(p.castka); mesice[i].vybrano += Number(p.uhrazeno);
  }
  const struktura = new Map<string, number>();
  for (const n of nakl.data ?? []) {
    const i = new Date(n.datum + "T00:00:00").getMonth();
    mesice[i].naklady += Number(n.castka_celkem);
    struktura.set(n.kategorie, (struktura.get(n.kategorie) ?? 0) + Number(n.castka_celkem));
  }
  const predepsano = mesice.reduce((s, x) => s + x.predepsano, 0);
  const vybrano = mesice.reduce((s, x) => s + x.vybrano, 0);
  const naklady = mesice.reduce((s, x) => s + x.naklady, 0);
  const dluhCelkem = (dluh.data ?? []).reduce((s, d) => s + Number(d.dluh), 0);
  const maxSloupec = Math.max(1, ...mesice.map((x) => Math.max(x.vybrano, x.naklady, x.predepsano)));
  const strukturaRazena = [...struktura.entries()].sort((a, b) => b[1] - a[1]);

  const dlazdice = [
    { text: "Čistý výsledek", hodnota: korun(vybrano - naklady), pozn: "vybráno minus náklady", zvyraznit: true },
    { text: "Vybráno", hodnota: korun(vybrano), pozn: predepsano ? `${Math.round((vybrano / predepsano) * 100)} % z předepsaných ${korun(predepsano)}` : "zatím nic předepsáno" },
    { text: "Náklady", hodnota: korun(naklady), pozn: `${(nakl.data ?? []).length} položek`, href: "/finance/naklady" },
    { text: "Dluží celkem", hodnota: korun(dluhCelkem), pozn: "po splatnosti, všechna léta", href: "/finance/dluznici", varovani: dluhCelkem > 0 },
  ];

  return (
    <>
      <Nadpis titulek="Finance" podtitulek={`Přehled za rok ${r}. Nájemné a zálohy podle měsíce, ke kterému patří.`}
        akce={<form className="flex gap-2"><select name="rok" defaultValue={r} className="pole w-auto">
          {[0, 1, 2, 3].map((i) => <option key={i}>{new Date().getFullYear() - i}</option>)}</select>
          <button className="tlacitko-svetle">Zobrazit</button></form>} />

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dlazdice.map((d) => {
          const obsah = (<>
            <div className={`stitek ${d.zvyraznit ? "text-slate-300" : ""}`}>{d.text}</div>
            <div className={`text-2xl font-semibold ${d.varovani ? "text-red-700" : ""}`}>{d.hodnota}</div>
            <div className={`text-xs ${d.zvyraznit ? "text-slate-300" : "text-slate-500"}`}>{d.pozn}</div>
          </>);
          const cls = d.zvyraznit ? "rounded-xl bg-slate-900 p-5 text-white shadow-sm" : "karta";
          return d.href ? <Link key={d.text} href={d.href} className={`${cls} hover:border-slate-300`}>{obsah}</Link> : <div key={d.text} className={cls}>{obsah}</div>;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="karta lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-semibold">Cashflow {r}</h2>
            <div className="flex gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-900" />Vybráno</span>
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-slate-300" />Náklady</span>
              <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-blue-500" />Předepsáno</span>
            </div>
          </div>
          <div className="flex h-56 items-end gap-2">
            {mesice.map((x) => (
              <div key={x.m} className="flex flex-1 flex-col items-center gap-1" title={`${x.m}: vybráno ${korun(x.vybrano)}, náklady ${korun(x.naklady)}, předepsáno ${korun(x.predepsano)}`}>
                <div className="relative flex h-48 w-full items-end justify-center gap-0.5">
                  <div className="w-1/3 rounded-t bg-slate-900" style={{ height: `${(x.vybrano / maxSloupec) * 100}%` }} />
                  <div className="w-1/3 rounded-t bg-slate-300" style={{ height: `${(x.naklady / maxSloupec) * 100}%` }} />
                  {x.predepsano > 0 && <div className="absolute inset-x-0 h-0.5 bg-blue-500" style={{ bottom: `${(x.predepsano / maxSloupec) * 100}%` }} />}
                </div>
                <div className="text-xs text-slate-500">{x.m}</div>
              </div>
            ))}
          </div>
        </section>

        <section className="karta">
          <h2 className="mb-4 font-semibold">Struktura nákladů</h2>
          {strukturaRazena.length === 0 ? <p className="text-sm text-slate-500">Zatím žádné náklady. <Link href="/finance/naklady" className="odkaz">Zadat náklad</Link></p> : (
            <ul className="space-y-3 text-sm">
              {strukturaRazena.map(([k, v]) => (
                <li key={k}>
                  <div className="mb-1 flex justify-between"><span>{KATEGORIE_NAKLADU[k] ?? k}</span><span className="font-medium">{korun(v)}</span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className="h-1.5 rounded-full bg-slate-700" style={{ width: `${(v / naklady) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
