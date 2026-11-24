import { supabaseServer } from "@/lib/supabase/server";
import { DRUHY_VLASTNIKA } from "@/lib/format";
import { Chyba, Nadpis } from "@/components/Chyba";
import { pridatVlastnika } from "./actions";
import { FormularVlastnika } from "@/components/FormularVlastnika";
import Link from "next/link";

export default async function Vlastnici({ searchParams }: PageProps<"/vlastnici">) {
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const { data } = await supabase.from("vlastnik").select("*").order("nazev");

  return (
    <>
      <Nadpis titulek="Vlastníci" podtitulek="Vaše firmy, vy osobně a klienti, jejichž nemovitosti spravujete" />
      <Chyba text={chyba} />
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="karta overflow-x-auto lg:col-span-2">
          {(data ?? []).length === 0 ? <p className="text-sm text-slate-500">Zatím žádní vlastníci.</p> : (
            <table className="tabulka">
              <thead><tr><th>Název</th><th>Tag</th><th>Druh</th><th>IČO</th><th>DPH</th><th></th></tr></thead>
              <tbody>
                {(data ?? []).map((v) => (
                  <tr key={v.id}>
                    <td className="font-medium"><Link href={`/vlastnici/${v.id}`} className="hover:underline">{v.nazev}</Link></td>
                    <td>{v.zkratka ? "@" + v.zkratka : "–"}</td>
                    <td>{DRUHY_VLASTNIKA[v.druh]}</td>
                    <td>{v.ico ?? "–"}</td>
                    <td>{v.platce_dph ? "plátce" : "–"}</td>
                    <td className="text-right"><Link href={`/vlastnici/${v.id}`} className="text-xs odkaz">upravit</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div>
          <h2 className="mb-2 font-semibold">Přidat vlastníka</h2>
          <FormularVlastnika akce={pridatVlastnika} />
        </div>
      </div>
    </>
  );
}
