import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { FormularVlastnika } from "@/components/FormularVlastnika";
import { upravitVlastnika, smazatVlastnika } from "../actions";

export default async function UpravitVlastnika({ params, searchParams }: PageProps<"/vlastnici/[id]">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: v }, { data: vl }] = await Promise.all([
    supabase.from("vlastnik").select("*").eq("id", id).maybeSingle(),
    supabase.from("vlastnictvi").select("podil_citatel, podil_jmenovatel, nemovitost(id, nazev, archivovano_dne)").eq("vlastnik_id", id),
  ]);
  if (!v) notFound();
  const nemovitosti = (vl ?? []) as unknown as { podil_citatel: number; podil_jmenovatel: number; nemovitost: { id: string; nazev: string; archivovano_dne: string | null } | null }[];

  return (
    <>
      <Nadpis titulek={v.nazev} podtitulek="Úprava vlastníka" akce={<Link href="/vlastnici" className="tlacitko-svetle">← Vlastníci</Link>} />
      <Chyba text={chyba} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2"><FormularVlastnika akce={upravitVlastnika.bind(null, id)} v={v} /></div>
        <div className="space-y-6">
          <section className="karta text-sm">
            <h2 className="mb-2 font-semibold">Nemovitosti ({nemovitosti.length})</h2>
            {nemovitosti.length === 0 ? <p className="text-slate-500">Žádné.</p> : (
              <ul className="space-y-1">{nemovitosti.map((x) => x.nemovitost && (
                <li key={x.nemovitost.id} className="flex justify-between gap-2">
                  <Link href={`/nemovitosti/${x.nemovitost.id}`} className={`odkaz ${x.nemovitost.archivovano_dne ? "opacity-50" : ""}`}>{x.nemovitost.nazev}</Link>
                  {x.podil_jmenovatel > 1 && <span className="text-slate-500">{x.podil_citatel}/{x.podil_jmenovatel}</span>}
                </li>))}
              </ul>)}
            <p className="mt-3 text-xs text-slate-500">Když se změní vlastník nemovitosti (prodej, převod), upravte ho u nemovitosti: Upravit → Vlastník.</p>
          </section>
          <form action={smazatVlastnika.bind(null, id)} className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm">
            <p className="mb-3 text-red-800">Smazat vlastníka – jen omyl nebo duplicita. Nejde, pokud má nemovitosti nebo smlouvy.</p>
            <div className="flex items-center gap-3"><label className="flex items-center gap-2"><input type="checkbox" name="potvrzeni" required /> Ano, smazat</label><Odeslat svetle>Smazat</Odeslat></div>
          </form>
        </div>
      </div>
    </>
  );
}
