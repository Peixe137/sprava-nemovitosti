import { notFound } from "next/navigation";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { FormularRezervace } from "@/components/FormularRezervace";
import { Odeslat } from "@/components/Odeslat";
import { ulozitRezervaci, smazatRezervaci } from "../actions";

export default async function UpravitRezervaci({ params, searchParams }: PageProps<"/kratkodobe/[id]">) {
  const { id } = await params;
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const [{ data: r }, { data: nem }] = await Promise.all([
    supabase.from("rezervace").select("*").eq("id", id).maybeSingle(),
    supabase.from("nemovitost").select("id, nazev").order("nazev"),
  ]);
  if (!r) notFound();
  return (
    <>
      <Nadpis titulek={`Rezervace ${r.host ?? ""}`} podtitulek={`${r.noci} nocí`} />
      <Chyba text={chyba} />
      <FormularRezervace akce={ulozitRezervaci.bind(null, id)} nemovitosti={nem ?? []} v={r} />
      <form action={smazatRezervaci.bind(null, id)} className="mt-6 max-w-3xl rounded-xl border border-red-200 bg-red-50 p-5 text-sm">
        <p className="mb-3 text-red-800">Smazat rezervaci natrvalo (zrušenou rezervaci raději jen přepněte na stav Zrušená).</p>
        <div className="flex items-center gap-4"><label className="flex items-center gap-2"><input type="checkbox" name="potvrzeni" required /> Ano, smazat</label><Odeslat svetle>Smazat</Odeslat></div>
      </form>
    </>
  );
}
