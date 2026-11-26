import { supabaseServer } from "@/lib/supabase/server";
import { cestaOdKorene, idSlozky, stahnout } from "@/lib/googleDisk";

/** Otevře / stáhne soubor z Google Disku přes servisní účet – jen přihlášeným a jen ze složky dané nemovitosti. */
export async function GET(request: Request, ctx: RouteContext<"/disk/[soubor]">) {
  const { soubor: id } = await ctx.params;
  const nemovitost = new URL(request.url).searchParams.get("nemovitost") ?? "";
  const supabase = await supabaseServer();
  const { data: claims } = await supabase.auth.getClaims();
  if (!claims?.claims) return new Response("Nepřihlášen", { status: 401 });

  // RLS: nemovitost uvidí jen člen organizace
  const { data: n } = await supabase.from("nemovitost").select("drive_folder_url, nadrazena:nadrazena_id(drive_folder_url)").eq("id", nemovitost).maybeSingle();
  const koren = idSlozky(n?.drive_folder_url ?? (n?.nadrazena as unknown as { drive_folder_url: string | null } | null)?.drive_folder_url);
  if (!koren) return new Response("Nemovitost nemá složku na Disku", { status: 404 });

  try {
    const cesta = await cestaOdKorene(koren, id);
    if (!cesta) return new Response("Soubor nepatří do složky nemovitosti", { status: 403 });
    const s = cesta[cesta.length - 1];
    const r = await stahnout(s);
    if (!r.ok || !r.body) return new Response(`Google Disk vrátil chybu ${r.status}`, { status: 502 });
    const pdf = s.mimeType.startsWith("application/vnd.google-apps.");
    const nazev = pdf ? `${s.name}.pdf` : s.name;
    return new Response(r.body, {
      headers: {
        "content-type": pdf ? "application/pdf" : s.mimeType || "application/octet-stream",
        "content-disposition": `inline; filename*=UTF-8''${encodeURIComponent(nazev)}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
      },
    });
  } catch (e) {
    return new Response(e instanceof Error ? e.message : "Chyba Google Disku", { status: 502 });
  }
}
