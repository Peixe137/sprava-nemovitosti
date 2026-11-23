import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Nadpis } from "@/components/Chyba";
import { PLATFORMY, korun, datum } from "@/lib/format";

type Rez = {
  id: string; nemovitost_id: string; platforma: string; host: string | null; prijezd: string; odjezd: string; noci: number;
  cena_ubytovani: number | null; uklid: number | null; poplatek_platformy: number | null; poplatek_z_pobytu: number | null;
  vyplata: number | null; datum_vyplaty: string | null; stav: string; pocet_hostu: number | null; kod_rezervace: string | null;
};
const iso = (d: Date) => d.toISOString().slice(0, 10);
const den = (s: string) => new Date(s + "T00:00:00Z");
const MESICE = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

export default async function Kratkodobe({ searchParams }: PageProps<"/kratkodobe">) {
  const sp = await searchParams;
  const m = /^\d{4}-\d{2}$/.test(String(sp.m)) ? String(sp.m) : new Date().toISOString().slice(0, 7);
  const [rok, mes] = m.split("-").map(Number);
  const zacatek = new Date(Date.UTC(rok, mes - 1, 1)), konec = new Date(Date.UTC(rok, mes, 1)); // konec = 1. den dalšího měsíce
  const dnu = (konec.getTime() - zacatek.getTime()) / 86400000;
  const posun = (k: number) => { const d = new Date(Date.UTC(rok, mes - 1 + k, 1)); return d.toISOString().slice(0, 7); };
  const ctvrtleti = Math.floor((mes - 1) / 3);
  const qOd = iso(new Date(Date.UTC(rok, ctvrtleti * 3, 1))), qDo = iso(new Date(Date.UTC(rok, ctvrtleti * 3 + 3, 1)));

  const supabase = await supabaseServer();
  const [nem, rez, q] = await Promise.all([
    supabase.from("nemovitost").select("id, nazev, vyuziti, obec").is("archivovano_dne", null).order("nazev"),
    supabase.from("rezervace").select("*").lt("prijezd", iso(konec)).gt("odjezd", iso(zacatek)).order("prijezd"),
    supabase.from("rezervace").select("poplatek_z_pobytu, noci, pocet_hostu, nemovitost:nemovitost_id(obec)")
      .neq("stav", "zrusena").gte("prijezd", qOd).lt("prijezd", qDo),
  ]);
  const vse = (rez.data ?? []) as Rez[];
  const platne = vse.filter((r) => r.stav !== "zrusena");
  const sRezervaci = new Set(vse.map((r) => r.nemovitost_id));
  const radky = (nem.data ?? []).filter((n) => n.vyuziti === "kratkodoby" || sRezervaci.has(n.id));

  // ukazatele měsíce: noci počítané jen v rámci měsíce
  const nociVMesici = (r: Rez) => Math.max(0, (Math.min(den(r.odjezd).getTime(), konec.getTime()) - Math.max(den(r.prijezd).getTime(), zacatek.getTime())) / 86400000);
  const obsazeno = platne.reduce((s, r) => s + nociVMesici(r), 0);
  const kapacita = radky.length * dnu;
  const trzbaNoci = platne.reduce((s, r) => s + (r.noci ? (Number(r.cena_ubytovani ?? 0) / r.noci) * nociVMesici(r) : 0), 0);
  const adr = obsazeno ? trzbaNoci / obsazeno : 0;
  const vyplaty = platne.filter((r) => (r.datum_vyplaty ?? r.prijezd) >= iso(zacatek) && (r.datum_vyplaty ?? r.prijezd) < iso(konec))
    .reduce((s, r) => s + Number(r.vyplata ?? 0), 0);
  const poplatekQ = new Map<string, { castka: number; noci: number }>();
  for (const r of (q.data ?? []) as unknown as { poplatek_z_pobytu: number | null; noci: number; nemovitost: { obec: string | null } | null }[]) {
    const k = r.nemovitost?.obec ?? "bez obce";
    const x = poplatekQ.get(k) ?? { castka: 0, noci: 0 };
    x.castka += Number(r.poplatek_z_pobytu ?? 0); x.noci += r.noci; poplatekQ.set(k, x);
  }

  const dny = Array.from({ length: dnu }, (_, i) => iso(new Date(zacatek.getTime() + i * 86400000)));
  const dnes = new Date().toISOString().slice(0, 10);
  const dlazdice = [
    { t: "Obsazenost", h: kapacita ? `${Math.round((obsazeno / kapacita) * 100)} %` : "–", p: `${obsazeno} z ${kapacita} nocí`, c: "dlazdice-modra" },
    { t: "Průměrná cena za noc", h: adr ? korun(adr) : "–", p: `výnos na dostupnou noc ${kapacita ? korun(trzbaNoci / kapacita) : "–"}`, c: "dlazdice-fialova" },
    { t: "Výplaty v měsíci", h: korun(vyplaty), p: `${platne.length} rezervací`, c: "dlazdice-zelena", cislo: "plus" },
    { t: `Poplatek z pobytu Q${ctvrtleti + 1}`, h: korun([...poplatekQ.values()].reduce((s, x) => s + x.castka, 0)), p: "k odvodu obcím", c: "dlazdice-oranzova" },
  ];

  return (
    <>
      <Nadpis titulek="Krátkodobé pronájmy" podtitulek="Airbnb, Booking a přímé rezervace"
        akce={<Link href="/kratkodobe/nova" className="tlacitko">+ Rezervace</Link>} />

      <div className="mb-4 flex items-center gap-2">
        <Link href={`/kratkodobe?m=${posun(-1)}`} className="tlacitko-svetle px-3">←</Link>
        <div className="min-w-36 text-center font-semibold capitalize">{MESICE[mes - 1]} {rok}</div>
        <Link href={`/kratkodobe?m=${posun(1)}`} className="tlacitko-svetle px-3">→</Link>
        <Link href="/kratkodobe" className="ml-2 text-sm odkaz">dnes</Link>
        <div className="ml-auto flex gap-3 text-xs">
          {Object.values(PLATFORMY).map((p) => <span key={p.text} className="flex items-center gap-1"><i className={`inline-block h-2.5 w-2.5 rounded-sm ${p.barva}`} />{p.text}</span>)}
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {dlazdice.map((d) => (
          <div key={d.t} className={d.c}><div className="stitek">{d.t}</div>
            <div className={`text-2xl font-semibold ${d.cislo ?? ""}`}>{d.h}</div><div className="text-xs text-slate-500">{d.p}</div></div>
        ))}
      </div>

      <section className="karta mb-6 overflow-x-auto">
        <h2 className="mb-3 font-semibold">Kalendář obsazenosti</h2>
        {radky.length === 0 ? (
          <p className="text-sm text-slate-500">Zatím žádná nemovitost pro krátkodobý pronájem. U nemovitosti nastavte Upravit → Využití → „Krátkodobý pronájem“, nebo rovnou přidejte rezervaci.</p>
        ) : (
          <div className="min-w-[720px]">
            <div className="grid items-end gap-px text-center text-[10px] text-slate-400" style={{ gridTemplateColumns: `180px repeat(${dnu}, minmax(0, 1fr))` }}>
              <div />
              {dny.map((d) => {
                const dt = den(d); const vikend = [0, 6].includes(dt.getUTCDay());
                return <div key={d} className={`${vikend ? "font-semibold text-slate-600" : ""} ${d === dnes ? "rounded bg-blue-600 text-white" : ""}`}>{dt.getUTCDate()}</div>;
              })}
            </div>
            {radky.map((n) => (
              <div key={n.id} className="mt-1 grid gap-px" style={{ gridTemplateColumns: `180px repeat(${dnu}, minmax(0, 1fr))` }}>
                <Link href={`/nemovitosti/${n.id}`} className="truncate pr-2 text-sm odkaz" title={n.nazev}>{n.nazev}</Link>
                {dny.map((d) => {
                  const r = platne.find((x) => x.nemovitost_id === n.id && x.prijezd <= d && d < x.odjezd);
                  if (!r) return <Link key={d} href={`/kratkodobe/nova?nemovitost=${n.id}&prijezd=${d}`} title={`${datum(d)} – volno, přidat rezervaci`}
                    className={`h-7 ${[0, 6].includes(den(d).getUTCDay()) ? "bg-slate-100" : "bg-slate-50"} hover:bg-blue-100`} />;
                  const prvni = d === r.prijezd || d === iso(zacatek);
                  return (
                    <Link key={d} href={`/kratkodobe/${r.id}`} title={`${r.host ?? "host"} · ${datum(r.prijezd)}–${datum(r.odjezd)} · ${PLATFORMY[r.platforma]?.text}`}
                      className={`h-7 overflow-hidden px-0.5 text-[10px] leading-7 whitespace-nowrap text-white ${PLATFORMY[r.platforma]?.barva ?? "bg-slate-500"} ${d === r.prijezd ? "rounded-l-md" : ""}`}>
                      {prvni ? (r.host ?? "").split(" ")[0] : ""}
                    </Link>);
                })}
              </div>
            ))}
            <p className="mt-2 text-xs text-slate-500">Klikněte na volný den pro novou rezervaci, na barevný pruh pro úpravu.</p>
          </div>
        )}
      </section>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="karta overflow-x-auto lg:col-span-2">
          <h2 className="mb-3 font-semibold">Rezervace v měsíci</h2>
          {vse.length === 0 ? <p className="text-sm text-slate-500">Žádné rezervace.</p> : (
            <table className="tabulka">
              <thead><tr><th>Termín</th><th>Host</th><th>Nemovitost</th><th className="text-right">Ubytování</th><th className="text-right">Výplata</th></tr></thead>
              <tbody>{vse.map((r) => (
                <tr key={r.id} className={r.stav === "zrusena" ? "text-slate-400 line-through" : ""}>
                  <td className="whitespace-nowrap"><Link href={`/kratkodobe/${r.id}`} className="odkaz">{datum(r.prijezd)} – {datum(r.odjezd)}</Link>
                    <div className="text-xs text-slate-500">{r.noci} nocí{r.pocet_hostu ? ` · ${r.pocet_hostu} os.` : ""}</div></td>
                  <td>{r.host ?? "–"}<div><span className={`rounded px-1.5 text-[10px] ${PLATFORMY[r.platforma]?.svetla}`}>{PLATFORMY[r.platforma]?.text}</span></div></td>
                  <td className="text-sm">{(nem.data ?? []).find((n) => n.id === r.nemovitost_id)?.nazev ?? "–"}</td>
                  <td className="text-right">{korun(r.cena_ubytovani)}{r.noci && r.cena_ubytovani ? <div className="text-xs text-slate-500">{korun(Number(r.cena_ubytovani) / r.noci)}/noc</div> : null}</td>
                  <td className="text-right font-medium plus">{korun(r.vyplata)}<div className="text-xs font-normal text-slate-500">{r.datum_vyplaty ? datum(r.datum_vyplaty) : "nevyplaceno"}</div></td>
                </tr>))}
              </tbody>
            </table>
          )}
        </section>
        <section className="karta">
          <h2 className="mb-1 font-semibold">Poplatek z pobytu – Q{ctvrtleti + 1} {rok}</h2>
          <p className="mb-3 text-xs text-slate-500">Podle data příjezdu, po obcích – podklad pro čtvrtletní hlášení a odvod.</p>
          {poplatekQ.size === 0 ? <p className="text-sm text-slate-500">V tomto čtvrtletí nic.</p> : (
            <ul className="space-y-2 text-sm">{[...poplatekQ.entries()].map(([obec, x]) => (
              <li key={obec} className="flex justify-between"><span>{obec}<span className="ml-1 text-xs text-slate-500">{x.noci} nocí</span></span><span className="font-medium">{korun(x.castka)}</span></li>
            ))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
