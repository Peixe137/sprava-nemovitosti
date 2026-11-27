import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Tisk } from "@/components/Tisk";
import { Castka } from "@/components/Castka";
import { datum } from "@/lib/format";
import { RADKY } from "@/lib/vyuctovani-radky";
import { oznacitVyuctovani, smazatVyuctovani } from "../../../vyuctovani-actions";

const KLIC: Record<string, string> = { spotreba: "podle spotřeby", plocha: "podle plochy", pevny: "přímo jednotky", osoby: "podle osob", jednotky: "podle jednotek" };
type Os = { role: string; osoba: { jmeno: string | null; prijmeni: string | null; nazev_firmy: string | null; adresa: string | null } };

/** Vyúčtování služeb k tisku / PDF. */
export default async function Vyuctovani({ params }: PageProps<"/smlouvy/[id]/vyuctovani/[vid]">) {
  const { id, vid } = await params;
  const supabase = await supabaseServer();
  const [{ data: v }, { data: pol }, { data: s }] = await Promise.all([
    supabase.from("vyuctovani").select("*").eq("id", vid).maybeSingle(),
    supabase.from("vyuctovani_polozka").select("*").eq("vyuctovani_id", vid),
    supabase.from("najemni_smlouva").select("variabilni_symbol, cislo_smlouvy, nemovitost(nazev, ulice, cislo_popisne, obec), pronajimatel:pronajimatel_id(nazev, ico, adresa), bankovni_ucet:bankovni_ucet_id(cislo_uctu, kod_banky), najemni_smlouva_osoba(role, osoba(jmeno, prijmeni, nazev_firmy, adresa))").eq("id", id).maybeSingle(),
  ]);
  if (!v || !s) notFound();
  const n = s.nemovitost as unknown as { nazev: string; ulice: string | null; cislo_popisne: string | null; obec: string | null };
  const pr = s.pronajimatel as unknown as { nazev: string; ico: string | null; adresa: string | null } | null;
  const ucet = s.bankovni_ucet as unknown as { cislo_uctu: string; kod_banky: string } | null;
  const najemce = (s.najemni_smlouva_osoba as unknown as Os[]).find((o) => o.role === "najemce")?.osoba;
  const poradi = Object.keys(RADKY);
  const polozky = (pol ?? []).sort((a, b) => poradi.indexOf(a.sluzba) - poradi.indexOf(b.sluzba));
  const vys = Number(v.vysledek);
  const STAV: Record<string, string> = { rozpracovano: "rozpracováno", odeslano: `odesláno ${v.odeslano_dne ? datum(v.odeslano_dne) : ""}`, vyrovnano: "vyrovnáno" };

  return (
    <div className="mx-auto max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2 print:hidden">
        <Link href={`/smlouvy/${id}`} className="odkaz text-sm">← Zpět na smlouvu</Link>
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="text-slate-500">Stav: {STAV[v.stav]} · doručit do {datum(v.lhuta_dorucit)}</span>
          {v.stav === "rozpracovano" && <form action={oznacitVyuctovani.bind(null, id, vid, "odeslano")}><button className="tlacitko-svetle">Označit jako odeslané</button></form>}
          {v.stav === "odeslano" && <form action={oznacitVyuctovani.bind(null, id, vid, "vyrovnano")}><button className="tlacitko-svetle">Vyrovnáno</button></form>}
          <Tisk />
        </div>
      </div>
      <article className="karta text-sm leading-relaxed print:border-0 print:shadow-none">
        <h1 className="mb-1 text-xl font-semibold">Vyúčtování služeb spojených s užíváním</h1>
        <p className="mb-5 text-slate-500">za období {datum(v.obdobi_od)} – {datum(v.obdobi_do)} · smlouva {s.cislo_smlouvy ? `č. ${s.cislo_smlouvy}, ` : ""}VS {s.variabilni_symbol}</p>
        <div className="mb-5 grid gap-4 sm:grid-cols-2">
          <div><div className="stitek">Pronajímatel</div><b>{pr?.nazev}</b>{pr?.ico && <div>IČO {pr.ico}</div>}{pr?.adresa && <div>{pr.adresa}</div>}</div>
          <div><div className="stitek">Nájemce</div><b>{najemce?.nazev_firmy ?? [najemce?.jmeno, najemce?.prijmeni].filter(Boolean).join(" ")}</b>{najemce?.adresa && <div>{najemce.adresa}</div>}</div>
        </div>
        <div className="mb-5"><div className="stitek">Předmět nájmu</div>{n.nazev}{n.ulice && `, ${n.ulice} ${n.cislo_popisne ?? ""}`}{n.obec && `, ${n.obec}`}</div>
        <table className="tabulka mb-4">
          <thead><tr><th>Služba</th><th>Způsob rozúčtování</th><th className="text-right">Náklad</th><th className="text-right">Zálohy</th><th className="text-right">Rozdíl</th></tr></thead>
          <tbody>{polozky.map((p) => (
            <tr key={p.id} className="align-top">
              <td>{RADKY[p.sluzba] ?? p.sluzba}{p.poznamka && <div className="mt-1 text-xs text-slate-500">{p.poznamka}</div>}</td>
              <td className="whitespace-nowrap">{KLIC[p.klic] ?? p.klic}{p.podil != null && ` (${(Number(p.podil) * 100).toLocaleString("cs-CZ", { maximumFractionDigits: 2 })} %)`}</td>
              <td className="text-right"><Castka v={p.naklad} /></td><td className="text-right"><Castka v={p.zalohy} /></td><td className="text-right"><Castka v={p.rozdil} /></td>
            </tr>))}
            <tr className="border-t-2 border-slate-300 font-semibold"><td colSpan={2}>Celkem</td><td className="text-right"><Castka v={v.naklady_celkem} /></td><td className="text-right"><Castka v={v.zalohy_celkem} /></td><td className="text-right"><Castka v={vys} /></td></tr>
          </tbody>
        </table>
        <p className="mb-2 text-base font-semibold">{vys > 0 ? <>Nedoplatek k úhradě: <Castka v={vys} /></> : vys < 0 ? <>Přeplatek k vrácení: <Castka v={-vys} /></> : "Bez nedoplatku a přeplatku."}</p>
        {vys > 0 && <p className="mb-4">Nedoplatek uhraďte do 30 dnů{ucet ? ` na účet ${ucet.cislo_uctu}/${ucet.kod_banky}` : ""}, variabilní symbol {s.variabilni_symbol}.</p>}
        {vys < 0 && <p className="mb-4">Přeplatek vám vrátíme do 30 dnů na účet, ze kterého platíte nájemné, nebo ho po dohodě započteme proti nájemnému.</p>}
        {v.poznamka && <p className="mb-4 whitespace-pre-line">{v.poznamka}</p>}
        <p className="mb-10 text-xs text-slate-500">Podklady k vyúčtování (faktury dodavatelů, odečty měřidel) jsou k nahlédnutí u pronajímatele.</p>
        <div className="w-64 border-t border-slate-400 pt-1 text-center text-xs">Pronajímatel{pr?.nazev ? ` – ${pr.nazev}` : ""}</div>
      </article>
      <form action={smazatVyuctovani.bind(null, id, vid)} className="mt-4 text-right print:hidden"><button className="text-xs text-slate-400 hover:text-red-700">smazat vyúčtování</button></form>
    </div>
  );
}
