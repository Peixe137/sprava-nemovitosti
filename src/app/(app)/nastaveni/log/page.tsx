import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Nadpis } from "@/components/Chyba";
import { mojeRole } from "@/lib/role";

const TABULKY: Record<string, string> = {
  nemovitost: "Nemovitost", vlastnik: "Vlastník", osoba: "Kontakt", vlastnictvi: "Vlastnictví", najemni_smlouva: "Nájemní smlouva",
  najemni_smlouva_osoba: "Nájemník ve smlouvě", predpis_polozka: "Předpis plateb", naklad: "Náklad", prijem_ostatni: "Ostatní příjem",
  rezervace: "Rezervace", bankovni_ucet: "Bankovní účet", parovani: "Spárování platby", dokument: "Dokument", termin: "Úkol / termín",
  katastralni_polozka: "Katastr", omezeni: "Omezení LV", clenstvi: "Uživatel", zadost_smazani: "Žádost o smazání",
  odberne_misto: "Odběrné místo", meridlo: "Měřidlo", odecet: "Odečet", vyuctovani: "Vyúčtování",
};
const AKCE: Record<string, [string, string]> = { pridano: ["přidal", "text-green-700"], upraveno: ["upravil", "text-blue-700"], smazano: ["smazal", "text-red-700"] };
const ODKAZ: Record<string, string> = { nemovitost: "/nemovitosti/", najemni_smlouva: "/smlouvy/", osoba: "/osoby/", vlastnik: "/vlastnici/" };
const SKRYT = new Set(["id", "organizace_id", "vytvoreno", "surova_data"]);

const hodnota = (v: unknown) => v == null || v === "" ? "–" : typeof v === "object" ? JSON.stringify(v) : String(v);
const zkrat = (s: string) => s.length > 60 ? s.slice(0, 57) + "…" : s;
const nazev = (z: Record<string, unknown> | null) => {
  if (!z) return "";
  const v = (k: string) => { const x = z[k]; return Array.isArray(x) ? x[1] ?? x[0] : x; };
  return [v("nazev"), v("nazev_firmy"), [v("prijmeni"), v("jmeno")].filter(Boolean).join(" "), v("variabilni_symbol") && `VS ${v("variabilni_symbol")}`, v("popis")]
    .find((x) => x && String(x).trim()) as string | undefined ?? "";
};

/** Log změn: kdo kdy co přidal, upravil nebo smazal. Vidí jen administrátor. */
export default async function Log({ searchParams }: PageProps<"/nastaveni/log">) {
  const sp = await searchParams;
  const supabase = await supabaseServer();
  if (await mojeRole(supabase) !== "majitel") return (<><Nadpis titulek="Log změn" /><p className="text-sm text-slate-500">Log změn vidí jen administrátor.</p></>);
  const tab = typeof sp.tabulka === "string" ? sp.tabulka : "";
  const kdo = typeof sp.kdo === "string" ? sp.kdo : "";
  const strana = Math.max(0, Number(sp.strana) || 0);
  let q = supabase.from("log_zmen").select("id, kdy, user_id, tabulka, zaznam_id, akce, zmeny").order("kdy", { ascending: false }).range(strana * 100, strana * 100 + 99);
  if (tab) q = q.eq("tabulka", tab);
  if (kdo) q = q.eq("user_id", kdo);
  const [{ data }, { data: clenove }] = await Promise.all([q, supabase.rpc("clenove_organizace")]);
  const lide = new Map(((clenove ?? []) as { user_id: string; email: string; jmeno: string | null }[]).map((c) => [c.user_id, c.jmeno || c.email]));
  const zaznamy = (data ?? []) as { id: number; kdy: string; user_id: string | null; tabulka: string; zaznam_id: string | null; akce: string; zmeny: Record<string, unknown> | null }[];
  const url = (zmena: Record<string, string | number>) => {
    const p = new URLSearchParams(Object.entries({ tabulka: tab, kdo, strana: String(strana), ...zmena }).filter(([, v]) => v !== "" && v !== "0").map(([k, v]) => [k, String(v)]));
    return `/nastaveni/log?${p}`;
  };

  return (
    <>
      <Nadpis titulek="Log změn" podtitulek="Kdo kdy co přidal, upravil nebo smazal" />
      <form className="mb-4 flex flex-wrap items-end gap-2 text-sm">
        <label className="block"><span className="stitek">Co</span>
          <select name="tabulka" defaultValue={tab} className="pole w-auto"><option value="">Vše</option>{Object.entries(TABULKY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
        <label className="block"><span className="stitek">Kdo</span>
          <select name="kdo" defaultValue={kdo} className="pole w-auto"><option value="">Všichni</option>{[...lide].map(([id, n]) => <option key={id} value={id}>{n}</option>)}</select></label>
        <button className="tlacitko-svetle">Filtrovat</button>
      </form>
      <section className="karta overflow-x-auto">
        {zaznamy.length === 0 ? <p className="text-sm text-slate-500">Zatím žádné změny. Zapisuje se od 27. 11. 2026.</p> : (
          <table className="tabulka text-sm">
            <thead><tr><th>Kdy</th><th>Kdo</th><th>Co</th><th>Změny</th></tr></thead>
            <tbody>{zaznamy.map((z) => {
              const [slovo, barva] = AKCE[z.akce] ?? [z.akce, ""];
              const pole = Object.entries(z.zmeny ?? {}).filter(([k, v]) => !SKRYT.has(k) && !(z.akce !== "upraveno" && (v == null || v === "")));
              const odkaz = ODKAZ[z.tabulka] && z.zaznam_id && z.akce !== "smazano" ? ODKAZ[z.tabulka] + z.zaznam_id : null;
              const jmeno = nazev(z.zmeny);
              return (
                <tr key={z.id} className="align-top">
                  <td className="whitespace-nowrap text-xs text-slate-500">{new Date(z.kdy).toLocaleString("cs-CZ", { timeZone: "Europe/Prague", day: "numeric", month: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</td>
                  <td className="whitespace-nowrap">{z.user_id ? lide.get(z.user_id) ?? "jiný uživatel" : <span className="text-slate-500">systém</span>}</td>
                  <td><span className={barva}>{slovo}</span> {TABULKY[z.tabulka] ?? z.tabulka}
                    {jmeno && <> · {odkaz ? <Link href={odkaz} className="odkaz">{zkrat(jmeno)}</Link> : zkrat(jmeno)}</>}
                    {!jmeno && odkaz && <> · <Link href={odkaz} className="odkaz">otevřít</Link></>}</td>
                  <td className="text-xs text-slate-600">
                    {z.akce === "upraveno"
                      ? pole.map(([k, v]) => { const [a, b] = v as [unknown, unknown]; return <div key={k}><b>{k}</b>: <span className="text-slate-400 line-through">{zkrat(hodnota(a))}</span> → {zkrat(hodnota(b))}</div>; })
                      : <details><summary className="cursor-pointer text-slate-500">{pole.length} údajů</summary>{pole.map(([k, v]) => <div key={k}><b>{k}</b>: {zkrat(hodnota(v))}</div>)}</details>}
                  </td>
                </tr>);
            })}</tbody>
          </table>
        )}
        <div className="mt-3 flex justify-between text-sm">
          {strana > 0 ? <Link href={url({ strana: strana - 1 })} className="odkaz">← novější</Link> : <span />}
          {zaznamy.length === 100 && <Link href={url({ strana: strana + 1 })} className="odkaz">starší →</Link>}
        </div>
      </section>
    </>
  );
}
