import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { FormularOsoby } from "@/components/FormularOsoby";
import { DRUHY_VLASTNIKA } from "@/lib/format";
import { pridatOsobu } from "./actions";

type Radek = { id: string; odkaz: string; jmeno: string; stitky: string[]; telefon: string | null; email: string | null; ico: string | null; kontaktu: number; firma: string | null };
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

export default async function Adresar({ searchParams }: PageProps<"/osoby">) {
  const sp = await searchParams;
  const filtr = String(sp.k ?? "");
  const q = String(sp.q ?? "").trim();
  const supabase = await supabaseServer();
  const [osoby, vlastnici, najemci] = await Promise.all([
    supabase.from("osoba").select("id, jmeno, prijmeni, nazev_firmy, ico, telefon, email, kategorie, firma_id, funkce, firma:firma_id(nazev_firmy)").order("nazev_firmy").order("prijmeni"),
    supabase.from("vlastnik").select("id, nazev, druh, ico, telefon, email").order("nazev"),
    supabase.from("najemni_smlouva_osoba").select("osoba_id, role"),
  ]);
  const role = new Map<string, Set<string>>();
  for (const r of najemci.data ?? []) { const s = role.get(r.osoba_id) ?? new Set(); s.add(r.role); role.set(r.osoba_id, s); }
  const pocetKontaktu = new Map<string, number>();
  for (const o of osoby.data ?? []) if (o.firma_id) pocetKontaktu.set(o.firma_id, (pocetKontaktu.get(o.firma_id) ?? 0) + 1);

  const radky: Radek[] = [
    ...(osoby.data ?? []).map((o) => {
      const r = role.get(o.id);
      const firma = (o.firma as unknown as { nazev_firmy: string | null } | null)?.nazev_firmy ?? null;
      return {
        id: o.id, odkaz: `/osoby/${o.firma_id ?? o.id}`, ico: o.ico, telefon: o.telefon, email: o.email, kontaktu: pocetKontaktu.get(o.id) ?? 0,
        jmeno: o.nazev_firmy ?? `${o.prijmeni ?? ""} ${o.jmeno ?? ""}`.trim(), firma: o.firma_id ? [o.funkce, firma].filter(Boolean).join(", ") : null,
        stitky: [
          ...(r?.has("najemce") || r?.has("spolunajemce") ? ["najemnik"] : []),
          ...(o.firma_id || r?.has("kontakt") ? ["kontakt"] : []),
          ...((o.kategorie as string[]) ?? []),
        ],
      };
    }),
    ...(vlastnici.data ?? []).map((v) => ({
      id: v.id, odkaz: `/vlastnici/${v.id}`, jmeno: v.nazev, ico: v.ico, telefon: v.telefon, email: v.email, kontaktu: 0, firma: DRUHY_VLASTNIKA[v.druh] ?? null,
      stitky: ["vlastnik"],
    })),
  ];
  const SYSTEM: Record<string, string> = { najemnik: "Nájemník", vlastnik: "Vlastník", kontakt: "Kontaktní osoba" };
  const nazev = (k: string) => SYSTEM[k] ?? k;
  const vlastniStitky = Array.from(new Set((osoby.data ?? []).flatMap((o) => (o.kategorie as string[]) ?? []))).sort((a, b) => a.localeCompare(b, "cs"));
  const poradi = [...Object.keys(SYSTEM), ...vlastniStitky];
  const pocty = new Map<string, number>();
  for (const r of radky) for (const s of new Set(r.stitky)) pocty.set(s, (pocty.get(s) ?? 0) + 1);
  const slova = norm(q).split(/\s+/).filter(Boolean);
  const vybrane = radky
    .filter((r) => !filtr || r.stitky.includes(filtr))
    .filter((r) => slova.every((w) => norm(`${r.jmeno} ${r.firma ?? ""} ${r.ico ?? ""} ${r.telefon ?? ""} ${r.email ?? ""}`).includes(w)))
    .sort((a, b) => a.jmeno.localeCompare(b.jmeno, "cs"));
  const odkaz = (k: string) => `/osoby?${new URLSearchParams({ ...(k ? { k } : {}), ...(q ? { q } : {}) })}`;
  const BARVY: Record<string, string> = { najemnik: "bg-violet-50 text-violet-700", vlastnik: "bg-blue-50 text-blue-700", kontakt: "bg-slate-100 text-slate-600" };

  return (
    <>
      <Nadpis titulek="Adresář" podtitulek="Nájemníci, vlastníci, řemeslníci, dodavatelé, právníci a další kontakty" />
      <Chyba text={sp.chyba} />
      <div className="mb-4 flex flex-wrap gap-1.5 text-sm">
        <Link href={odkaz("")} className={`rounded-full px-3 py-1 ${!filtr ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>Vše ({radky.length})</Link>
        {poradi.filter((k) => pocty.get(k)).map((k) => [k, nazev(k)] as const).map(([k, x]) => (
          <Link key={k} href={odkaz(k)} className={`rounded-full px-3 py-1 ${filtr === k ? "bg-blue-600 text-white" : "bg-slate-100 text-slate-700 hover:bg-slate-200"}`}>{x} ({pocty.get(k)})</Link>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-3 lg:col-span-2">
          <form className="flex gap-2" action="/osoby">
            {filtr && <input type="hidden" name="k" value={filtr} />}
            <input type="search" name="q" defaultValue={q} placeholder="Hledat jméno, firmu, IČO, telefon, e-mail…" className="pole" />
            <button className="tlacitko-svetle">Hledat</button>
          </form>
          <div className="karta overflow-x-auto">
            {vybrane.length === 0 ? <p className="text-sm text-slate-500">Nic nenalezeno.</p> : (
              <table className="tabulka">
                <thead><tr><th>Jméno / firma</th><th>Štítky</th><th>Telefon</th><th>E-mail</th></tr></thead>
                <tbody>{vybrane.map((r) => (
                  <tr key={r.stitky.includes("vlastnik") ? "v" + r.id : r.id}>
                    <td><Link href={r.odkaz} className="font-medium hover:underline">{r.jmeno}</Link>
                      {(r.firma || r.kontaktu > 0 || r.ico) && <div className="text-xs text-slate-500">{[r.firma, r.ico && `IČO ${r.ico}`, r.kontaktu > 0 && `${r.kontaktu} kontaktních osob`].filter(Boolean).join(" · ")}</div>}</td>
                    <td><div className="flex flex-wrap gap-1">{[...new Set(r.stitky)].map((s) => <span key={s} className={`rounded px-1.5 py-0.5 text-xs ${BARVY[s] ?? "bg-amber-50 text-amber-800"}`}>{nazev(s)}</span>)}</div></td>
                    <td className="whitespace-nowrap">{r.telefon ? <a href={`tel:${r.telefon.replace(/\s/g, "")}`} className="odkaz">{r.telefon}</a> : "–"}</td>
                    <td>{r.email ? <a href={`mailto:${r.email}`} className="odkaz">{r.email}</a> : "–"}</td>
                  </tr>))}
                </tbody>
              </table>)}
          </div>
        </div>
        <div>
          <h2 className="mb-2 font-semibold">Nový kontakt</h2>
          <FormularOsoby akce={pridatOsobu} tlacitko="Přidat do adresáře" stitky={vlastniStitky} />
        </div>
      </div>
    </>
  );
}
