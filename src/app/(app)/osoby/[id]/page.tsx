import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { FormularOsoby } from "@/components/FormularOsoby";
import { korun, datum } from "@/lib/format";
import { upravitOsobu, pridatKontaktFirmy, smazatOsobu } from "../actions";

export default async function Osoba({ params, searchParams }: PageProps<"/osoby/[id]">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: o }, { data: kontakty }, { data: smlouvy }, { data: naklady }, { data: vsechny }] = await Promise.all([
    supabase.from("osoba").select("*").eq("id", id).maybeSingle(),
    supabase.from("osoba").select("id, jmeno, prijmeni, funkce, telefon, email, poznamka").eq("firma_id", id).order("prijmeni"),
    supabase.from("najemni_smlouva_osoba").select("role, funkce, smlouva:smlouva_id(id, variabilni_symbol, stav, datum_od, datum_do, nemovitost(id, nazev))").eq("osoba_id", id),
    supabase.from("naklad").select("id, datum, castka_celkem, kategorie, nemovitost(nazev)").eq("dodavatel_id", id).order("datum", { ascending: false }).limit(10),
    supabase.from("osoba").select("kategorie").neq("kategorie", "{}"),
  ]);
  const stitky = Array.from(new Set((vsechny ?? []).flatMap((x) => (x.kategorie as string[]) ?? [])));
  if (!o) notFound();
  const nazev = o.nazev_firmy ?? `${o.jmeno ?? ""} ${o.prijmeni ?? ""}`.trim();
  type S = { role: string; funkce: string | null; smlouva: { id: string; variabilni_symbol: string; stav: string; datum_od: string; datum_do: string | null; nemovitost: { id: string; nazev: string } | null } | null };
  const sml = (smlouvy ?? []) as unknown as S[];
  const nakl = (naklady ?? []) as unknown as { id: string; datum: string; castka_celkem: number; kategorie: string; nemovitost: { nazev: string } | null }[];

  return (
    <>
      <Nadpis titulek={nazev} podtitulek={o.firma_id ? "Kontaktní osoba" : "Kontakt v adresáři"}
        akce={<Link href="/osoby" className="tlacitko-svetle">← Adresář</Link>} />
      <Chyba text={chyba} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1"><FormularOsoby akce={upravitOsobu.bind(null, id)} v={o} stitky={stitky} /></div>
        <div className="space-y-6 lg:col-span-2">
          {!o.firma_id && (
            <section id="kontakty" className="karta text-sm">
              <h2 className="mb-3 font-semibold">Kontaktní osoby ({(kontakty ?? []).length})</h2>
              {(kontakty ?? []).length > 0 && (
                <table className="tabulka mb-4">
                  <thead><tr><th>Jméno</th><th>Funkce</th><th>Telefon</th><th>E-mail</th><th></th></tr></thead>
                  <tbody>{(kontakty ?? []).map((k) => (
                    <tr key={k.id}>
                      <td><Link href={`/osoby/${k.id}`} className="font-medium hover:underline">{`${k.jmeno ?? ""} ${k.prijmeni ?? ""}`.trim()}</Link>{k.poznamka && <div className="text-xs text-slate-500">{k.poznamka}</div>}</td>
                      <td>{k.funkce ?? "–"}</td>
                      <td className="whitespace-nowrap">{k.telefon ? <a href={`tel:${k.telefon.replace(/\s/g, "")}`} className="odkaz">{k.telefon}</a> : "–"}</td>
                      <td>{k.email ? <a href={`mailto:${k.email}`} className="odkaz">{k.email}</a> : "–"}</td>
                      <td className="text-right"><form action={smazatOsobu.bind(null, k.id, `/osoby/${id}`)}><button className="text-xs text-slate-400 hover:text-red-700">odebrat</button></form></td>
                    </tr>))}
                  </tbody>
                </table>)}
              <form action={pridatKontaktFirmy.bind(null, id)} className="grid gap-2 sm:grid-cols-3">
                <input name="jmeno" placeholder="Jméno" className="pole" />
                <input name="prijmeni" placeholder="Příjmení" className="pole" />
                <input name="funkce" placeholder="Funkce (vedoucí, účetní, technik…)" className="pole" />
                <input name="telefon" placeholder="Telefon" className="pole" />
                <input name="email" type="email" placeholder="E-mail" className="pole" />
                <input name="poznamka" placeholder="Co má na starosti" className="pole" />
                <div className="sm:col-span-3"><Odeslat>+ Přidat kontaktní osobu</Odeslat></div>
              </form>
            </section>)}
          {o.firma_id && <p className="text-sm">Patří k firmě: <Link href={`/osoby/${o.firma_id}`} className="odkaz">otevřít firmu</Link></p>}
          <section className="karta text-sm">
            <h2 className="mb-3 font-semibold">Nájemní smlouvy ({sml.length})</h2>
            {sml.length === 0 ? <p className="text-slate-500">Žádné.</p> : (
              <ul className="space-y-1">{sml.map((s) => s.smlouva && (
                <li key={s.smlouva.id} className="flex flex-wrap justify-between gap-2">
                  <span><Link href={`/smlouvy/${s.smlouva.id}`} className="odkaz">VS {s.smlouva.variabilni_symbol}</Link> · {s.smlouva.nemovitost?.nazev}</span>
                  <span className="text-slate-500">{s.funkce ?? s.role} · {datum(s.smlouva.datum_od)}–{s.smlouva.datum_do ? datum(s.smlouva.datum_do) : "neurčito"}</span>
                </li>))}
              </ul>)}
          </section>
          {nakl.length > 0 && (
            <section className="karta text-sm">
              <h2 className="mb-3 font-semibold">Poslední náklady u tohoto dodavatele</h2>
              <ul className="space-y-1">{nakl.map((x) => (
                <li key={x.id} className="flex justify-between gap-2"><span>{datum(x.datum)} · {x.nemovitost?.nazev}</span><span className="minus">{korun(-x.castka_celkem)}</span></li>))}
              </ul>
            </section>)}
          <form action={smazatOsobu.bind(null, id, "/osoby")} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            <span className="mr-3 text-red-800">Smazat kontakt (jen omyl nebo duplicita).</span>
            <label className="mr-3 inline-flex items-center gap-1"><input type="checkbox" required /> potvrdit</label><Odeslat svetle>Smazat</Odeslat>
          </form>
        </div>
      </div>
    </>
  );
}
