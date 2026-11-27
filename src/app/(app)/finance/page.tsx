import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { KATEGORIE_NAKLADU, MESICE, korun } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";
import { HledatNemovitost } from "@/components/HledatNemovitost";
import { moznostiNemovitosti } from "@/lib/vyberNemovitosti";
import { Castka } from "@/components/Castka";

type Cleneni = "mesic" | "ctvrtleti" | "rok";
const CLENENI: Record<Cleneni, string> = { mesic: "Měsíčně", ctvrtleti: "Čtvrtletně", rok: "Ročně" };
type Sloupec = { klic: string; popis: string; predepsano: number; vybrano: number; ostatni: number; naklady: number };

export default async function FinancePrehled({ searchParams }: PageProps<"/finance">) {
  const sp = await searchParams;
  const ted = new Date().getFullYear();
  const celkem = sp.rok === "celkem";
  const r = celkem ? ted : Number(sp.rok) || ted;
  const cleneni: Cleneni = (["mesic", "ctvrtleti", "rok"] as const).find((c) => c === sp.cleneni) ?? (celkem ? "rok" : "mesic");
  const nemId = typeof sp.nemovitost === "string" ? sp.nemovitost : "";

  const supabase = await supabaseServer();
  const [pohl, nakl, ost, rez, dluh, smlouvy, podrizene, moznosti, kauce] = await Promise.all([
    supabase.from("pohledavka").select("obdobi, castka, uhrazeno, smlouva_id").eq("druh", "mesicni"),
    supabase.from("naklad").select("datum, kategorie, castka_celkem, nemovitost_id"),
    supabase.from("prijem_ostatni").select("datum, castka, nemovitost_id"),
    supabase.from("rezervace").select("odjezd, vyplata, poplatek_z_pobytu, nemovitost_id").neq("stav", "zrusena"),
    supabase.from("v_dluznici").select("dluh, smlouva_id"),
    supabase.from("najemni_smlouva").select("id, nemovitost_id"),
    nemId ? supabase.from("nemovitost").select("id").eq("nadrazena_id", nemId) : Promise.resolve({ data: [] as { id: string }[] }),
    moznostiNemovitosti(supabase, { vcetneArchivu: true }),
    supabase.from("pohledavka").select("uhrazeno, smlouva_id, najemni_smlouva(kauce_vracena_dne)").eq("druh", "kauce"),
  ]);

  // výběr nemovitosti: budova včetně svých jednotek
  const ids = nemId ? new Set([nemId, ...(podrizene.data ?? []).map((x) => x.id)]) : null;
  const nemSmlouvy = new Map((smlouvy.data ?? []).map((s) => [s.id, s.nemovitost_id as string]));
  const patri = (nemovitost: string | null | undefined) => !ids || (!!nemovitost && ids.has(nemovitost));

  // období: rok nebo celkem od prvního záznamu
  const vsechnaData = [
    ...(pohl.data ?? []).map((p) => p.obdobi), ...(nakl.data ?? []).map((n) => n.datum),
    ...(ost.data ?? []).map((o) => o.datum), ...(rez.data ?? []).map((x) => x.odjezd),
  ].filter(Boolean).sort();
  const prvniRok = vsechnaData.length ? Math.min(Number(vsechnaData[0].slice(0, 4)), ted) : ted;
  const posledniRok = vsechnaData.length ? Math.max(Number(vsechnaData[vsechnaData.length - 1].slice(0, 4)), ted) : ted;
  const odRok = celkem ? prvniRok : r, doRok = celkem ? posledniRok : r;
  const od = `${odRok}-01-01`, doo = `${doRok}-12-31`;

  const klic = (d: string) => {
    const y = d.slice(0, 4), m = Number(d.slice(5, 7));
    return cleneni === "rok" ? y : cleneni === "ctvrtleti" ? `${y}-Q${Math.ceil(m / 3)}` : d.slice(0, 7);
  };
  const sloupce: Sloupec[] = [];
  for (let y = odRok; y <= doRok; y++) {
    const jedenRok = odRok === doRok;
    if (cleneni === "rok") sloupce.push({ klic: `${y}`, popis: `${y}`, predepsano: 0, vybrano: 0, ostatni: 0, naklady: 0 });
    else if (cleneni === "ctvrtleti") for (let q = 1; q <= 4; q++) sloupce.push({ klic: `${y}-Q${q}`, popis: jedenRok ? `${q}. Q` : `${q}Q ${String(y).slice(2)}`, predepsano: 0, vybrano: 0, ostatni: 0, naklady: 0 });
    else for (let m = 1; m <= 12; m++) sloupce.push({ klic: `${y}-${String(m).padStart(2, "0")}`, popis: jedenRok ? MESICE[m - 1] : `${MESICE[m - 1]} ${String(y).slice(2)}`, predepsano: 0, vybrano: 0, ostatni: 0, naklady: 0 });
  }
  const podle = new Map(sloupce.map((s) => [s.klic, s]));
  const v = (d: string | null) => (d && d >= od && d <= doo ? podle.get(klic(d)) : undefined);

  for (const p of pohl.data ?? []) {
    if (!patri(nemSmlouvy.get(p.smlouva_id))) continue;
    const s = v(p.obdobi); if (!s) continue;
    s.predepsano += Number(p.castka); s.vybrano += Number(p.uhrazeno);
  }
  const struktura = new Map<string, number>();
  let pocetNakladu = 0;
  for (const n of nakl.data ?? []) {
    if (!patri(n.nemovitost_id)) continue;
    const s = v(n.datum); if (!s) continue;
    s.naklady += Number(n.castka_celkem); pocetNakladu++;
    struktura.set(n.kategorie, (struktura.get(n.kategorie) ?? 0) + Number(n.castka_celkem));
  }
  for (const o of ost.data ?? []) { if (patri(o.nemovitost_id)) { const s = v(o.datum); if (s) s.ostatni += Number(o.castka); } }
  for (const x of rez.data ?? []) { if (patri(x.nemovitost_id)) { const s = v(x.odjezd); if (s) s.ostatni += Number(x.vyplata ?? 0) - Number(x.poplatek_z_pobytu ?? 0); } }

  const soucet = (k: keyof Omit<Sloupec, "klic" | "popis">) => sloupce.reduce((a, s) => a + s[k], 0);
  const predepsano = soucet("predepsano"), vybrano = soucet("vybrano"), ostatni = soucet("ostatni"), naklady = soucet("naklady");
  const prijmy = vybrano + ostatni;
  const kauceCelkem = (kauce.data ?? []).filter((k) => patri(nemSmlouvy.get(k.smlouva_id)) && !(k.najemni_smlouva as unknown as { kauce_vracena_dne: string | null } | null)?.kauce_vracena_dne)
    .reduce((a, k) => a + Number(k.uhrazeno), 0);
  const dluhCelkem = (dluh.data ?? []).filter((d) => patri(nemSmlouvy.get(d.smlouva_id))).reduce((a, d) => a + Number(d.dluh), 0);
  const maxSloupec = Math.max(1, ...sloupce.map((x) => Math.max(x.vybrano + x.ostatni, x.naklady, x.predepsano)));
  const strukturaRazena = [...struktura.entries()].sort((a, b) => b[1] - a[1]);
  const nazevNem = nemId ? moznosti.find((m) => m.id === nemId)?.nazev : null;
  const obdobiText = celkem ? `celkem ${odRok === doRok ? odRok : `${odRok}–${doRok}`}` : `rok ${r}`;

  const dlazdice = [
    { text: "Čistý výsledek", hodnota: korun(prijmy - naklady), pozn: "příjmy minus náklady",
      tridy: prijmy - naklady >= 0 ? "dlazdice-zelena" : "dlazdice-cervena", cislo: prijmy - naklady >= 0 ? "plus" : "minus" },
    { text: "Příjmy", hodnota: korun(prijmy), pozn: predepsano ? `nájem ${Math.round((vybrano / predepsano) * 100)} % z předepsaných ${korun(predepsano)}${ostatni ? ` + ostatní ${korun(ostatni)}` : ""}` : ostatni ? `ostatní příjmy a krátkodobé pronájmy` : "zatím nic předepsáno",
      tridy: "dlazdice-zelena", cislo: "plus" },
    { text: "Náklady", hodnota: korun(-naklady), pozn: `${pocetNakladu} položek`, href: "/finance/naklady", tridy: "dlazdice-cervena", cislo: naklady ? "minus" : "" },
    { text: "Dluží celkem", hodnota: korun(dluhCelkem), pozn: "po splatnosti, všechna léta", href: "/finance/dluznici",
      tridy: dluhCelkem > 0 ? "dlazdice-oranzova" : "dlazdice-zelena", cislo: dluhCelkem > 0 ? "text-amber-700" : "plus" },
    { text: "Složené kauce", hodnota: korun(kauceCelkem), pozn: "drží se u nás, k vrácení", href: "/finance/kauce", tridy: "dlazdice-zelena", cislo: "" },
  ];
  const BARVY = ["bg-blue-500", "bg-violet-500", "bg-amber-500", "bg-rose-500", "bg-emerald-500", "bg-cyan-500", "bg-fuchsia-500", "bg-lime-500"];
  const roky = Array.from({ length: Math.max(posledniRok, ted) - prvniRok + 1 }, (_, i) => Math.max(posledniRok, ted) - i);
  const zbytekParam = (bez: string) => {
    const p = new URLSearchParams();
    if (sp.rok && bez !== "rok") p.set("rok", String(sp.rok));
    if (sp.cleneni && bez !== "cleneni") p.set("cleneni", String(sp.cleneni));
    if (nemId && bez !== "nemovitost") p.set("nemovitost", nemId);
    return p.toString();
  };
  let kumul = 0;

  return (
    <>
      <Nadpis titulek={nazevNem ? `Finance – ${nazevNem}` : "Finance"}
        podtitulek={`Cashflow za ${obdobiText}${nazevNem ? " (včetně jednotek)" : ", všechny nemovitosti"}. Nájemné a zálohy podle měsíce, ke kterému patří.`} />

      <div className="karta mb-6 grid gap-3 text-sm sm:grid-cols-[1fr_auto_auto]">
        <label className="block"><span className="stitek">Nemovitost</span>
          <HledatNemovitost moznosti={moznosti} name="nemovitost" vychozi={nemId} prazdna="Všechny nemovitosti"
            navigace={`/finance?${zbytekParam("nemovitost")}${zbytekParam("nemovitost") ? "&" : ""}nemovitost=`} /></label>
        <form className="flex items-end gap-2">
          {nemId && <input type="hidden" name="nemovitost" value={nemId} />}
          {sp.cleneni && <input type="hidden" name="cleneni" value={String(sp.cleneni)} />}
          <label className="block"><span className="stitek">Období</span>
            <select name="rok" defaultValue={celkem ? "celkem" : String(r)} className="pole w-auto">
              <option value="celkem">Celkem – všechna léta</option>
              {roky.map((y) => <option key={y} value={y}>{y}</option>)}
            </select></label>
          <button className="tlacitko-svetle">Zobrazit</button>
        </form>
        <div><span className="stitek">Členění</span>
          <div className="flex gap-1">
            {(Object.keys(CLENENI) as Cleneni[]).map((c) => (
              <Link key={c} href={`/finance?${zbytekParam("cleneni")}${zbytekParam("cleneni") ? "&" : ""}cleneni=${c}`}
                className={`rounded-lg px-3 py-2 ${cleneni === c ? "bg-blue-600 text-white" : "border border-slate-300 bg-white hover:bg-slate-50"}`}>{CLENENI[c]}</Link>
            ))}
          </div>
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {dlazdice.map((d) => {
          const obsah = (<>
            <div className="stitek">{d.text}</div>
            <div className={`text-2xl font-semibold ${d.cislo}`}>{d.hodnota}</div>
            <div className="text-xs text-slate-500">{d.pozn}</div>
          </>);
          return d.href ? <Link key={d.text} href={d.href} className={`${d.tridy} hover:brightness-[0.98]`}>{obsah}</Link> : <div key={d.text} className={d.tridy}>{obsah}</div>;
        })}
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="karta lg:col-span-2">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h2 className="font-semibold">Cashflow – {CLENENI[cleneni].toLowerCase()}</h2>
            <div className="flex flex-wrap gap-4 text-xs text-slate-600">
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-500" />Příjmy</span>
              <span className="flex items-center gap-1"><i className="inline-block h-2.5 w-2.5 rounded-sm bg-rose-400" />Náklady</span>
              <span className="flex items-center gap-1"><i className="inline-block h-0.5 w-3 bg-blue-500" />Předepsáno</span>
            </div>
          </div>
          <div className="overflow-x-auto">
            <div className="flex h-60 items-end gap-2" style={{ minWidth: sloupce.length > 16 ? sloupce.length * 44 : undefined }}>
              {sloupce.map((x) => {
                const pr = x.vybrano + x.ostatni, vys = pr - x.naklady;
                return (
                  <div key={x.klic} className="flex flex-1 flex-col items-center gap-1" title={`${x.popis}: příjmy ${korun(pr)}, náklady ${korun(x.naklady)}, předepsáno ${korun(x.predepsano)}`}>
                    <div className="relative flex h-48 w-full items-end justify-center gap-0.5">
                      <div className="w-1/3 rounded-t bg-emerald-500" style={{ height: `${(pr / maxSloupec) * 100}%` }} />
                      <div className="w-1/3 rounded-t bg-rose-400" style={{ height: `${(x.naklady / maxSloupec) * 100}%` }} />
                      {x.predepsano > 0 && <div className="absolute inset-x-0 h-0.5 bg-blue-500" style={{ bottom: `${(x.predepsano / maxSloupec) * 100}%` }} />}
                    </div>
                    <div className="whitespace-nowrap text-xs text-slate-500">{x.popis}</div>
                    {(pr || x.naklady) ? <div className={`text-[10px] font-medium ${vys >= 0 ? "plus" : "minus"}`}>
                      {vys >= 0 ? "+" : "−"}{Math.round(Math.abs(vys) / 1000)}k</div> : <div className="text-[10px]">&nbsp;</div>}
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <section className="karta">
          <h2 className="mb-4 font-semibold">Struktura nákladů</h2>
          {strukturaRazena.length === 0 ? <p className="text-sm text-slate-500">Žádné náklady v tomto období. <Link href="/finance/naklady" className="odkaz">Zadat náklad</Link></p> : (
            <ul className="space-y-3 text-sm">
              {strukturaRazena.map(([k, val], i) => (
                <li key={k}>
                  <div className="mb-1 flex justify-between"><span>{KATEGORIE_NAKLADU[k] ?? k}</span><span className="font-medium minus"><Castka v={-val} /></span></div>
                  <div className="h-1.5 rounded-full bg-slate-100"><div className={`h-1.5 rounded-full ${BARVY[i % BARVY.length]}`} style={{ width: `${(val / naklady) * 100}%` }} /></div>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section className="karta overflow-x-auto lg:col-span-3">
          <h2 className="mb-3 font-semibold">Přehled {CLENENI[cleneni].toLowerCase()} a celkem</h2>
          <table className="tabulka text-sm">
            <thead><tr><th>Období</th><th className="text-right">Předepsáno</th><th className="text-right">Vybráno</th><th className="text-right">Ostatní příjmy</th>
              <th className="text-right">Náklady</th><th className="text-right">Výsledek</th><th className="text-right">Kumulativně</th></tr></thead>
            <tbody>
              {sloupce.map((x) => {
                const vys = x.vybrano + x.ostatni - x.naklady; kumul += vys;
                const prazdny = !x.predepsano && !x.vybrano && !x.ostatni && !x.naklady;
                return (
                  <tr key={x.klic} className={prazdny ? "text-slate-400" : ""}>
                    <td>{cleneni === "rok" ? x.popis : x.klic.includes("Q") ? `${x.klic.slice(6)}. čtvrtletí ${x.klic.slice(0, 4)}` : `${MESICE[Number(x.klic.slice(5)) - 1]} ${x.klic.slice(0, 4)}`}</td>
                    <td className="text-right">{x.predepsano ? korun(x.predepsano) : "–"}</td>
                    <td className="text-right plus">{x.vybrano ? korun(x.vybrano) : "–"}</td>
                    <td className="text-right">{x.ostatni ? korun(x.ostatni) : "–"}</td>
                    <td className="text-right minus">{x.naklady ? korun(-x.naklady) : "–"}</td>
                    <td className={`text-right font-medium ${vys >= 0 ? "plus" : "minus"}`}>{prazdny ? "–" : korun(vys)}</td>
                    <td className={`text-right ${kumul >= 0 ? "plus" : "minus"}`}><Castka v={kumul} /></td>
                  </tr>
                );
              })}
              <tr className="border-t-2 border-slate-300 font-semibold">
                <td>Celkem {obdobiText.replace("celkem ", "")}</td>
                <td className="text-right"><Castka v={predepsano} /></td>
                <td className="text-right plus"><Castka v={vybrano} /></td>
                <td className="text-right"><Castka v={ostatni} /></td>
                <td className="text-right minus"><Castka v={-naklady} /></td>
                <td className={`text-right ${prijmy - naklady >= 0 ? "plus" : "minus"}`}><Castka v={prijmy - naklady} /></td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </section>
      </div>
    </>
  );
}
