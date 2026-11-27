import { supabaseServer } from "@/lib/supabase/server";
import { NahratPrilohy } from "@/components/NahratPrilohy";
import { smazatPrilohu } from "@/app/actions/prilohy";

type P = { id: string; cesta: string; nazev: string; typ: string | null; zaznam_id: string };

/** Načte přílohy k více záznamům najednou, s dočasnými odkazy (1 h). */
export async function nactiPrilohy(tabulka: string, ids: string[]) {
  const supabase = await supabaseServer();
  if (!ids.length) return new Map<string, (P & { url: string })[]>();
  const { data } = await supabase.from("priloha").select("id, cesta, nazev, typ, zaznam_id").eq("tabulka", tabulka).in("zaznam_id", ids).order("vytvoreno");
  const radky = (data ?? []) as P[];
  const { data: odkazy } = radky.length ? await supabase.storage.from("prilohy").createSignedUrls(radky.map((r) => r.cesta), 3600) : { data: [] };
  const url = new Map((odkazy ?? []).map((o) => [o.path, o.signedUrl]));
  const m = new Map<string, (P & { url: string })[]>();
  for (const r of radky) m.set(r.zaznam_id, [...(m.get(r.zaznam_id) ?? []), { ...r, url: url.get(r.cesta) ?? "" }]);
  return m;
}

export async function organizace() {
  const supabase = await supabaseServer();
  const { data } = await supabase.rpc("aktualni_organizace");
  return String(data ?? "");
}

/** Galerie příloh + nahrávání. `cesta` = stránka k obnovení po smazání. */
export function Prilohy({ seznam, org, tabulka, zaznamId, cesta, nahravat = true }: {
  seznam: (P & { url: string })[]; org: string; tabulka: string; zaznamId: string; cesta: string; nahravat?: boolean;
}) {
  return (
    <div className="space-y-2">
      {seznam.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {seznam.map((p) => (
            <div key={p.id} className="group relative rounded-lg border border-slate-200 bg-white p-1">
              <a href={p.url} target="_blank" rel="noopener">
                {p.typ?.startsWith("image/")
                  // eslint-disable-next-line @next/next/no-img-element
                  ? <img src={p.url} alt={p.nazev} className="block max-h-28 max-w-48 rounded" />
                  : <span className="block px-2 py-3 text-xs">📄 {p.nazev}</span>}
              </a>
              <form action={smazatPrilohu.bind(null, p.id, cesta)} className="absolute -top-2 -right-2 hidden group-hover:block">
                <button title="Odebrat" className="h-5 w-5 rounded-full border border-slate-300 bg-white text-[10px] text-slate-500 hover:text-red-700">✕</button>
              </form>
            </div>))}
        </div>
      )}
      {nahravat && <NahratPrilohy org={org} tabulka={tabulka} zaznamId={zaznamId} maly />}
    </div>
  );
}
