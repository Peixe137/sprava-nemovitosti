// Pozvání nového uživatele z aplikace (Systém → Uživatelé). Smí jen administrátor organizace.
// Vytvoří účet a pošle e-mail s odkazem na nastavení hesla; přidá člověka do organizace s rolí.
import { createClient } from "npm:@supabase/supabase-js@2";

const ROLE = ["majitel", "spravce", "ucetni", "host", "udrzbar"];
const odpoved = (status: number, telo: Record<string, unknown>) =>
  new Response(JSON.stringify(telo), { status, headers: { "content-type": "application/json" } });

Deno.serve(async (req) => {
  if (req.method !== "POST") return odpoved(405, { chyba: "Jen POST." });
  const url = Deno.env.get("SUPABASE_URL")!;
  const anon = Deno.env.get("SUPABASE_ANON_KEY")!;
  const service = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const auth = req.headers.get("Authorization") ?? "";

  // volající = přihlášený uživatel aplikace; ověří se jeho role
  const ja = createClient(url, anon, { global: { headers: { Authorization: auth } }, auth: { persistSession: false } });
  const { data: role } = await ja.rpc("moje_aktualni_role");
  if (role !== "majitel") return odpoved(403, { chyba: "Uživatele zve jen administrátor." });

  let b: { email?: string; jmeno?: string; telefon?: string; role?: string; presmerovat?: string };
  try { b = await req.json(); } catch { return odpoved(400, { chyba: "Neplatný požadavek." }); }
  const email = (b.email ?? "").trim().toLowerCase();
  const r = b.role ?? "host";
  if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return odpoved(400, { chyba: "Neplatný e-mail." });
  if (!ROLE.includes(r)) return odpoved(400, { chyba: "Neznámá role." });

  const admin = createClient(url, service, { auth: { persistSession: false } });
  const { error: chybaPozvanky } = await admin.auth.admin.inviteUserByEmail(email, {
    redirectTo: b.presmerovat, data: { jmeno: b.jmeno ?? null },
  });
  const uzExistuje = !!chybaPozvanky && /already|registered|exists/i.test(chybaPozvanky.message);
  if (chybaPozvanky && !uzExistuje) return odpoved(400, { chyba: `Pozvánku se nepodařilo poslat: ${chybaPozvanky.message}` });

  // zařazení do organizace volajícího (pod jeho oprávněním – funkce si roli ověří znovu)
  const { data: vysledek, error: chybaClena } = await ja.rpc("pridat_clena", { p_email: email, p_role: r });
  if (chybaClena || vysledek !== "ok") return odpoved(400, { chyba: chybaClena?.message ?? "Uživatele se nepodařilo přidat." });

  const { data: clen } = await ja.rpc("clenove_organizace");
  const uid = (clen as { user_id: string; email: string }[] | null)?.find((c) => c.email?.toLowerCase() === email)?.user_id;
  if (uid && (b.jmeno || b.telefon)) await ja.rpc("upravit_clena", { p_user: uid, p_jmeno: b.jmeno ?? "", p_telefon: b.telefon ?? "" });

  return odpoved(200, { ok: true, pozvan: !uzExistuje });
});
