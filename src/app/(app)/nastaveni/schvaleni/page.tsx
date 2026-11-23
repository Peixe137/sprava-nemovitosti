import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { mojeRole } from "@/lib/role";
import { schvalitSmazani, zamitnoutSmazani } from "../actions";

const STAV: Record<string, string> = { navrh: "Čeká", schvaleno: "Smazáno", zamitnuto: "Zamítnuto" };

export default async function Schvaleni({ searchParams }: PageProps<"/nastaveni/schvaleni">) {
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const role = await mojeRole(supabase);
  const [{ data }, { data: lide }] = await Promise.all([
    supabase.from("zadost_smazani").select("*").order("navrzeno", { ascending: false }).limit(100),
    role === "majitel" ? supabase.rpc("clenove_organizace") : Promise.resolve({ data: [] }),
  ]);
  const jmeno = (id: string | null) => ((lide ?? []) as { user_id: string; email: string }[]).find((l) => l.user_id === id)?.email ?? "";
  const zadosti = data ?? [];
  const cekajici = zadosti.filter((z) => z.stav === "navrh");

  return (
    <>
      <Nadpis titulek="Ke schválení" podtitulek="Správce mazání navrhuje, administrátor schvaluje" />
      <Chyba text={chyba} />
      <section className="karta mb-6">
        <h2 className="mb-3 font-semibold">Čeká na schválení ({cekajici.length})</h2>
        {cekajici.length === 0 ? <p className="text-sm text-slate-500">Nic nečeká.</p> : (
          <ul className="divide-y divide-slate-100">{cekajici.map((z) => (
            <li key={z.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
              <div>
                <div className="font-medium">{z.odkaz ? <Link href={z.odkaz} className="odkaz">{z.popis}</Link> : z.popis}</div>
                <div className="text-xs text-slate-500">navrhl {jmeno(z.navrhl) || "správce"} · {new Date(z.navrzeno).toLocaleString("cs-CZ")}{z.duvod ? ` · ${z.duvod}` : ""}</div>
              </div>
              {role === "majitel" && (
                <div className="flex gap-2">
                  <form action={schvalitSmazani.bind(null, z.id)}><Odeslat className="bg-rose-600 hover:bg-rose-700">Smazat</Odeslat></form>
                  <form action={zamitnoutSmazani.bind(null, z.id)}><Odeslat svetle>Zamítnout</Odeslat></form>
                </div>)}
            </li>))}
          </ul>)}
        {role !== "majitel" && <p className="mt-3 text-xs text-slate-500">Schvalovat může jen administrátor.</p>}
      </section>
      {zadosti.length > cekajici.length && (
        <section className="karta">
          <h2 className="mb-3 font-semibold">Vyřízené</h2>
          <ul className="space-y-1 text-sm">{zadosti.filter((z) => z.stav !== "navrh").map((z) => (
            <li key={z.id} className="flex justify-between gap-3"><span>{z.popis}</span><span className={z.stav === "schvaleno" ? "minus" : "text-slate-500"}>{STAV[z.stav]}</span></li>))}
          </ul>
        </section>)}
    </>
  );
}
