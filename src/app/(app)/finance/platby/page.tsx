import Link from "next/link";
import { supabaseServer } from "@/lib/supabase/server";
import { korun, datum } from "@/lib/format";
import { Nadpis } from "@/components/Chyba";

const STAV: Record<string, [string, string]> = {
  sparovano: ["Spárováno", "bg-green-50 text-green-800"],
  castecne: ["Přeplatek", "bg-amber-50 text-amber-800"],
  nesparovano: ["Nespárováno", "bg-red-50 text-red-700"],
  ignorovat: ["Ignorováno", "bg-slate-100 text-slate-600"],
  naklad: ["Náklad", "bg-slate-100 text-slate-600"],
};

export default async function Platby({ searchParams }: PageProps<"/finance/platby">) {
  const { filtr } = await searchParams;
  const supabase = await supabaseServer();
  let dotaz = supabase.from("bankovni_pohyb")
    .select("id, datum, castka, vs, protiucet, protiucet_banka, protiucet_nazev, zprava, stav_parovani, ucet:ucet_id(nazev, cislo_uctu)")
    .order("datum", { ascending: false }).limit(300);
  if (filtr === "prichozi") dotaz = dotaz.gt("castka", 0);
  if (filtr === "nesparovane") dotaz = dotaz.gt("castka", 0).neq("stav_parovani", "sparovano");
  const [{ data }, ucty] = await Promise.all([
    dotaz,
    supabase.from("bankovni_ucet").select("nazev, cislo_uctu, kod_banky, posledni_sync").eq("aktivni", true),
  ]);
  const radky = (data ?? []) as unknown as {
    id: string; datum: string; castka: number; vs: string | null; protiucet: string | null; protiucet_banka: string | null;
    protiucet_nazev: string | null; zprava: string | null; stav_parovani: string; ucet: { nazev: string } | null;
  }[];

  const Filtr = ({ k, text }: { k?: string; text: string }) => (
    <Link href={k ? `/finance/platby?filtr=${k}` : "/finance/platby"}
      className={`rounded-lg px-3 py-1.5 text-sm ${filtr === k || (!k && !filtr) ? "bg-blue-600 text-white" : "border border-slate-300 bg-white"}`}>{text}</Link>
  );

  return (
    <>
      <Nadpis titulek="Platby" podtitulek="Pohyby na bankovních účtech a jejich spárování s nájemníky" />
      {(ucty.data ?? []).length === 0 ? (
        <div className="karta mb-6 text-sm">
          <p className="font-medium">Zatím není připojený žádný bankovní účet.</p>
          <p className="mt-1 text-slate-600">Po připojení účtu u Fio banky se sem budou pohyby stahovat každou hodinu a příchozí platby se samy spárují podle variabilního symbolu.
            Do té doby zapisujte úhrady ručně tlačítkem „Zaplaceno“ v detailu <Link href="/smlouvy" className="odkaz">nájemní smlouvy</Link>.</p>
        </div>
      ) : (
        <div className="mb-4 flex flex-wrap gap-3 text-xs text-slate-500">
          {(ucty.data ?? []).map((u) => <span key={u.cislo_uctu}>{u.nazev} ({u.cislo_uctu}/{u.kod_banky}) · poslední stažení {u.posledni_sync ? new Date(u.posledni_sync).toLocaleString("cs-CZ") : "zatím ne"}</span>)}
        </div>
      )}
      <div className="mb-4 flex gap-2"><Filtr text="Vše" /><Filtr k="prichozi" text="Příchozí" /><Filtr k="nesparovane" text="Nespárované" /></div>
      <div className="karta overflow-x-auto">
        {radky.length === 0 ? <p className="text-sm text-slate-500">Žádné pohyby.</p> : (
          <table className="tabulka">
            <thead><tr><th>Datum</th><th>Účet</th><th>Protistrana</th><th>VS</th><th>Zpráva</th><th className="text-right">Částka</th><th>Stav</th></tr></thead>
            <tbody>{radky.map((r) => {
              const [text, barva] = STAV[r.stav_parovani] ?? [r.stav_parovani, ""];
              return (
                <tr key={r.id}>
                  <td className="whitespace-nowrap">{datum(r.datum)}</td>
                  <td>{r.ucet?.nazev ?? "–"}</td>
                  <td>{r.protiucet_nazev ?? "–"}<div className="text-xs text-slate-500">{r.protiucet ? `${r.protiucet}/${r.protiucet_banka}` : ""}</div></td>
                  <td>{r.vs ?? "–"}</td>
                  <td className="max-w-xs truncate">{r.zprava ?? ""}</td>
                  <td className={`text-right font-medium ${Number(r.castka) < 0 ? "minus" : "plus"}`}>{korun(r.castka)}</td>
                  <td>{Number(r.castka) > 0 && <span className={`rounded-full px-2 py-0.5 text-xs ${barva}`}>{text}</span>}</td>
                </tr>);
            })}</tbody>
          </table>
        )}
      </div>
    </>
  );
}
