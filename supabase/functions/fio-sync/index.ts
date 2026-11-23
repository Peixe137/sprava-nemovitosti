// Stáhne nové pohyby ze všech aktivních účtů Fio a spáruje příchozí platby s dluhy nájemníků.
// Spouští plánovač (pg_cron) každou hodinu. Tokeny Fio jsou v tajemstvích Edge Functions
// pod názvem FIO_TOKEN_<cislo_uctu> (číslo účtu bez předčíslí a kódu banky, jen číslice).
import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "jsr:@supabase/supabase-js@2";

type Sloupec = { value: string | number | null } | null;
type Pohyb = Record<string, Sloupec>;

const hodnota = (p: Pohyb, c: string) => (p[c]?.value ?? null);
const datum = (v: unknown) => {
  if (typeof v === "number") return new Date(v).toISOString().slice(0, 10);
  return String(v).slice(0, 10); // "2026-11-01+0100"
};

Deno.serve(async (req) => {
  const tajne = Deno.env.get("FIO_SYNC_SECRET");
  if (!tajne || req.headers.get("authorization") !== `Bearer ${tajne}`) {
    return new Response("Neoprávněno", { status: 401 });
  }

  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
  const { data: ucty, error } = await db.from("bankovni_ucet")
    .select("id, organizace_id, cislo_uctu").eq("banka", "FIO").eq("aktivni", true);
  if (error) return Response.json({ chyba: error.message }, { status: 500 });

  const vysledek: Record<string, unknown> = {};
  for (const u of ucty ?? []) {
    const cislo = String(u.cislo_uctu).replace(/\D/g, "");
    const token = Deno.env.get(`FIO_TOKEN_${cislo}`);
    if (!token) { vysledek[cislo] = "chybí token"; continue; }

    const res = await fetch(`https://fioapi.fio.cz/v1/rest/last/${token}/transactions.json`);
    if (!res.ok) { vysledek[cislo] = `Fio chyba ${res.status}`; continue; }
    const json = await res.json();
    const pohyby: Pohyb[] = json?.accountStatement?.transactionList?.transaction ?? [];

    const radky = pohyby.map((p) => ({
      organizace_id: u.organizace_id,
      ucet_id: u.id,
      banka_pohyb_id: String(hodnota(p, "column22")),
      datum: datum(hodnota(p, "column0")),
      castka: Number(hodnota(p, "column1")),
      mena: (hodnota(p, "column14") as string) ?? "CZK",
      protiucet: hodnota(p, "column2") as string | null,
      protiucet_banka: hodnota(p, "column3") as string | null,
      protiucet_nazev: hodnota(p, "column10") as string | null,
      ks: hodnota(p, "column4") as string | null,
      vs: hodnota(p, "column5") as string | null,
      ss: hodnota(p, "column6") as string | null,
      zprava: (hodnota(p, "column16") ?? hodnota(p, "column7")) as string | null,
      typ: hodnota(p, "column8") as string | null,
      surova_data: p,
    }));

    let nove = 0, sparovano = 0;
    if (radky.length) {
      const { data: vlozene, error: e } = await db.from("bankovni_pohyb")
        .upsert(radky, { onConflict: "ucet_id,banka_pohyb_id", ignoreDuplicates: true })
        .select("id, castka");
      if (e) { vysledek[cislo] = `chyba zápisu: ${e.message}`; continue; }
      nove = vlozene?.length ?? 0;
      for (const v of vlozene ?? []) {
        if (Number(v.castka) <= 0) continue;
        const { data: r } = await db.rpc("sparovat_pohyb", { p_pohyb: v.id });
        if (typeof r === "string" && r.startsWith("sparovano")) sparovano++;
      }
    }
    await db.from("bankovni_ucet").update({ posledni_sync: new Date().toISOString() }).eq("id", u.id);
    vysledek[cislo] = { stazeno: pohyby.length, nove, sparovano };
  }
  return Response.json(vysledek);
});
