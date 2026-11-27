import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { korun, datum, dnesIso, zaDni, PRIORITY } from "@/lib/format";
import { Castka } from "@/components/Castka";

type Upozorneni = { text: string; href: string; ton: "cervena" | "oranzova" | "modra" };
const TON = {
  cervena: "border-red-200 bg-red-50 text-red-800",
  oranzova: "border-amber-200 bg-amber-50 text-amber-900",
  modra: "border-blue-200 bg-blue-50 text-blue-900",
};

export default async function Prehled() {
  const supabase = await supabaseServer();
  const dnes = dnesIso();
  const [dluhy, nemovitosti, smlouvy, terminyV, org, zadosti, otevreneUkoly] = await Promise.all([
    supabase.from("v_dluznici").select("smlouva_id, najemnik, nemovitost, dluh, dni_po_splatnosti"),
    supabase.from("nemovitost").select("id, nadrazena_id, typ_kod, nazev, stav, vyuziti").is("archivovano_dne", null),
    supabase.from("najemni_smlouva").select("id, nemovitost_id, datum_od, datum_do, variabilni_symbol, stav").eq("stav", "aktivni"),
    supabase.from("v_terminy").select("*").order("datum").limit(10),
    supabase.from("organizace").select("nazev").limit(1).maybeSingle(),
    supabase.from("zadost_smazani").select("id", { count: "exact", head: true }).eq("stav", "navrh"),
    supabase.from("termin").select("id, nazev, datum, priorita, druh, nemovitost_id").eq("splneno", false),
  ]);
  // termíny: z přehledu blížících se + všechny urgentní úkoly; barva podle důležitosti
  const priority = new Map((otevreneUkoly.data ?? []).map((t) => [t.id, t.priorita as string]));
  const terminyVse = [...(terminyV.data ?? []), ...(otevreneUkoly.data ?? []).filter((t) => t.priorita === "urgentni" && !(terminyV.data ?? []).some((v) => v.id === t.id)).map((t) => ({ ...t, zdroj: "termin" }))]
    .sort((a, b) => String(a.datum).localeCompare(String(b.datum)));
  const terminy = { data: terminyVse.slice(0, 10) };

  // dlužníci po smlouvách
  const poSmlouve = new Map<string, { smlouva_id: string; najemnik: string | null; nemovitost: string; dluh: number; dni: number }>();
  for (const d of dluhy.data ?? []) {
    const x = poSmlouve.get(d.smlouva_id) ?? { smlouva_id: d.smlouva_id, najemnik: d.najemnik, nemovitost: d.nemovitost, dluh: 0, dni: 0 };
    x.dluh += Number(d.dluh); x.dni = Math.max(x.dni, d.dni_po_splatnosti);
    poSmlouve.set(d.smlouva_id, x);
  }
  const dluznici = [...poSmlouve.values()].sort((a, b) => b.dluh - a.dluh);
  const dluhCelkem = dluznici.reduce((s, d) => s + d.dluh, 0);
  const kriticti = dluznici.filter((d) => d.dni > 90).length;

  // obsazenost: pronajímatelné jsou nemovitosti bez podřízených jednotek (byt, garáž, samostatný dům…)
  const vse = nemovitosti.data ?? [];
  const sPodrizenymi = new Set(vse.map((x) => x.nadrazena_id).filter(Boolean));
  const pronajimatelne = vse.filter((x) => !sPodrizenymi.has(x.id) && !["P", "D"].includes(x.typ_kod) && x.stav !== "v_nakupu" && x.vyuziti === "pronajem");
  const obsazene = new Set((smlouvy.data ?? []).filter((s) => s.datum_od <= dnes && (!s.datum_do || s.datum_do >= dnes)).map((s) => s.nemovitost_id));
  // podepsaná smlouva, která teprve začne → „v rezervaci“, není to volná jednotka
  const zacatekBudouci = new Map<string, string>();
  for (const s of smlouvy.data ?? []) if (s.datum_od > dnes && (!zacatekBudouci.has(s.nemovitost_id) || s.datum_od < zacatekBudouci.get(s.nemovitost_id)!)) zacatekBudouci.set(s.nemovitost_id, s.datum_od);
  const rezervovane = pronajimatelne.filter((x) => !obsazene.has(x.id) && zacatekBudouci.has(x.id));
  const volne = pronajimatelne.filter((x) => !obsazene.has(x.id) && !zacatekBudouci.has(x.id));
  const pocetObsazenych = pronajimatelne.length - volne.length - rezervovane.length;
  const procento = pronajimatelne.length ? Math.round((pocetObsazenych / pronajimatelne.length) * 100) : 0;

  const koncici = (smlouvy.data ?? []).filter((s) => s.datum_do && s.datum_do >= dnes && s.datum_do <= zaDni(90));
  const prosle = (terminy.data ?? []).filter((t) => t.datum < dnes);

  const upozorneni: Upozorneni[] = [];
  if (zadosti.count) upozorneni.push({ text: `${zadosti.count}× žádost o smazání ke schválení`, href: "/nastaveni/schvaleni", ton: "oranzova" });
  if (dluznici.length) upozorneni.push({ text: `${dluznici.length}× nezaplacené nájemné (${korun(dluhCelkem)})`, href: "/finance/dluznici", ton: "cervena" });
  if (prosle.length) upozorneni.push({ text: `${prosle.length}× prošlý termín nebo revize`, href: "#terminy", ton: "oranzova" });
  if (koncici.length) upozorneni.push({ text: `${koncici.length}× smlouva končí do 90 dní`, href: "/smlouvy", ton: "oranzova" });
  if (volne.length) upozorneni.push({ text: `${volne.length}× volná jednotka k pronájmu`, href: "#volne", ton: "modra" });

  const hodina = new Date().toLocaleString("cs-CZ", { hour: "numeric", timeZone: "Europe/Prague" });
  const h = Number(hodina);
  const pozdrav = h < 4 || h >= 22 ? "Dobrou noc" : h < 10 ? "Dobré ráno" : h < 18 ? "Dobrý den" : "Dobrý večer";

  return (
    <>
      <section className="karta mb-6">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
          <h1 className="text-2xl font-semibold">{pozdrav}</h1>
          <span className="text-sm text-slate-500">{new Date().toLocaleDateString("cs-CZ", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Prague" })} · {org.data?.nazev}</span>
        </div>
        {upozorneni.length === 0 ? (
          <p className="text-sm text-green-700">Dnes nic nevyžaduje vaši pozornost.</p>
        ) : (
          <>
            <p className="mb-3 text-sm text-slate-600">Dnes vyžaduje pozornost:</p>
            <div className="flex flex-wrap gap-2">
              {upozorneni.map((u) => (
                <Link key={u.text} href={u.href} className={`rounded-lg border px-3 py-2 text-sm font-medium hover:opacity-80 ${TON[u.ton]}`}>{u.text} →</Link>
              ))}
            </div>
          </>
        )}
      </section>

      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="dlazdice-modra">
          <div className="stitek">Obsazenost</div>
          <div className="text-2xl font-semibold">{procento} %</div>
          <div className="mt-2 h-1.5 rounded-full bg-white"><div className="h-1.5 rounded-full bg-blue-500" style={{ width: `${procento}%` }} /></div>
          <div className="mt-1 text-xs text-slate-500">{pocetObsazenych} pronajato{rezervovane.length ? ` · ${rezervovane.length} v rezervaci` : ""} · {volne.length} volných</div>
        </div>
        <Link href="/smlouvy" className="dlazdice-fialova hover:border-violet-300">
          <div className="stitek">Aktivní smlouvy</div>
          <div className="text-2xl font-semibold">{(smlouvy.data ?? []).length}</div>
          <div className="text-xs text-slate-500">{koncici.length} končí do 90 dní</div>
        </Link>
        <Link href="/finance/dluznici" className={`${dluhCelkem ? "dlazdice-cervena hover:border-rose-300" : "dlazdice-zelena hover:border-emerald-300"}`}>
          <div className="stitek">Dluží celkem</div>
          <div className={`text-2xl font-semibold ${dluhCelkem ? "minus" : "plus"}`}><Castka v={dluhCelkem} /></div>
          <div className="text-xs text-slate-500">{kriticti} déle než 90 dní</div>
        </Link>
        <div className="dlazdice-oranzova">
          <div className="stitek mb-2">Rychlé akce</div>
          <div className="flex flex-col gap-1 text-sm">
            <Link href="/smlouvy/nova" className="odkaz">+ Nová nájemní smlouva</Link>
            <Link href="/finance/naklady" className="odkaz">+ Zadat náklad</Link>
            <Link href="/nemovitosti/nova" className="odkaz">+ Nová nemovitost</Link>
          </div>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <section className="karta">
          <div className="mb-3 flex items-center justify-between"><h2 className="font-semibold">Největší dlužníci</h2><Link href="/finance/dluznici" className="text-sm odkaz">Vše</Link></div>
          {dluznici.length === 0 ? <p className="text-sm text-slate-500">Nikdo nic nedluží.</p> : (
            <ul className="space-y-3 text-sm">{dluznici.slice(0, 6).map((d) => (
              <li key={d.smlouva_id} className="flex items-start justify-between gap-2">
                <div><Link href={`/smlouvy/${d.smlouva_id}`} className="odkaz">{d.najemnik ?? "–"}</Link>
                  <div className="text-xs text-slate-500">{d.nemovitost} · {d.dni} dní po splatnosti</div></div>
                <span className="font-semibold whitespace-nowrap text-red-700"><Castka v={d.dluh} /></span>
              </li>))}</ul>
          )}
        </section>

        <section id="terminy" className="karta">
          <div className="mb-3 flex items-baseline justify-between"><h2 className="font-semibold">Úkoly a termíny</h2><Link href="/terminy" className="text-sm odkaz">Vše</Link></div>
          {(terminy.data ?? []).length === 0 ? <p className="text-sm text-slate-500">Žádné blížící se termíny.</p> : (
            <ul className="space-y-2 text-sm">{(terminy.data ?? []).map((t) => (
              <li key={t.zdroj + t.id} className="flex justify-between gap-2">
                <span className="flex items-center gap-2"><i className={`inline-block h-2 w-2 shrink-0 rounded-full ${PRIORITY[priority.get(t.id) ?? ""]?.tecka ?? "bg-blue-300"}`} />{t.nazev}</span>
                <span className={`whitespace-nowrap ${t.datum < dnes ? "font-semibold text-red-700" : "text-slate-600"}`}>{datum(t.datum)}</span>
              </li>))}</ul>
          )}
        </section>

        <section id="volne" className="karta">
          <h2 className="mb-3 font-semibold">Volné jednotky</h2>
          {rezervovane.length > 0 && (
            <ul className="mb-3 space-y-2 text-sm">{rezervovane.map((v) => (
              <li key={v.id} className="flex justify-between gap-2">
                <Link href={`/nemovitosti/${v.id}`} className="odkaz">{v.nazev}</Link>
                <span className="text-xs whitespace-nowrap text-blue-700">v rezervaci, nájem od {datum(zacatekBudouci.get(v.id))}</span>
              </li>))}</ul>
          )}
          {volne.length === 0 ? <p className="text-sm text-slate-500">{rezervovane.length ? "Jinak je vše pronajato." : "Vše je pronajato."}</p> : (
            <ul className="space-y-2 text-sm">{volne.slice(0, 8).map((v) => (
              <li key={v.id} className="flex justify-between gap-2">
                <Link href={`/nemovitosti/${v.id}`} className="odkaz">{v.nazev}</Link>
                <Link href={`/smlouvy/nova?nemovitost=${v.id}`} className="text-xs whitespace-nowrap text-slate-500 hover:underline">pronajmout</Link>
              </li>))}</ul>
          )}
        </section>
      </div>
    </>
  );
}
