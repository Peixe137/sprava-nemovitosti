import "server-only";
import { createSign } from "node:crypto";

/**
 * Google Disk přes servisní účet (jen čtení). Klíč je v proměnné prostředí GOOGLE_SERVICE_ACCOUNT_JSON
 * (celý JSON stažený z Google Cloud). Servisní účet vidí jen složky, které s ním někdo sdílel.
 */
type Klic = { client_email: string; private_key: string };
export type Soubor = { id: string; name: string; mimeType: string; modifiedTime?: string; size?: string; webViewLink?: string; iconLink?: string; parents?: string[] };

const SLOZKA = "application/vnd.google-apps.folder";
export const jeSlozka = (s: Soubor) => s.mimeType === SLOZKA;

function klic(): Klic | null {
  const raw = process.env.GOOGLE_SERVICE_ACCOUNT_JSON;
  if (!raw) return null;
  try {
    const k = JSON.parse(raw) as Klic;
    return k.client_email && k.private_key ? { client_email: k.client_email, private_key: k.private_key.replace(/\\n/g, "\n") } : null;
  } catch { return null; }
}
export const diskNapojen = () => klic() !== null;

let token: { hodnota: string; platnost: number } | null = null;
async function pristup(): Promise<string> {
  if (token && token.platnost > Date.now() + 60_000) return token.hodnota;
  const k = klic();
  if (!k) throw new Error("Google Disk není napojený (chybí GOOGLE_SERVICE_ACCOUNT_JSON).");
  const b64 = (o: object | string) => Buffer.from(typeof o === "string" ? o : JSON.stringify(o)).toString("base64url");
  const ted = Math.floor(Date.now() / 1000);
  const telo = `${b64({ alg: "RS256", typ: "JWT" })}.${b64({
    iss: k.client_email, scope: "https://www.googleapis.com/auth/drive.readonly",
    aud: "https://oauth2.googleapis.com/token", iat: ted, exp: ted + 3600,
  })}`;
  const podpis = createSign("RSA-SHA256").update(telo).sign(k.private_key).toString("base64url");
  const r = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ grant_type: "urn:ietf:params:oauth:grant-type:jwt-bearer", assertion: `${telo}.${podpis}` }),
  });
  const j = await r.json() as { access_token?: string; expires_in?: number; error_description?: string };
  if (!r.ok || !j.access_token) throw new Error(`Google odmítl přihlášení servisního účtu: ${j.error_description ?? r.status}`);
  token = { hodnota: j.access_token, platnost: Date.now() + (j.expires_in ?? 3600) * 1000 };
  return token.hodnota;
}

async function api<T>(cesta: string, params: Record<string, string>): Promise<T> {
  const r = await fetch(`https://www.googleapis.com/drive/v3/${cesta}?${new URLSearchParams({ supportsAllDrives: "true", ...params })}`, {
    headers: { authorization: `Bearer ${await pristup()}` }, cache: "no-store",
  });
  if (r.status === 404) throw new Error("Složka nebo soubor nebyl nalezen – je sdílený se servisním účtem?");
  if (!r.ok) throw new Error(`Google Disk vrátil chybu ${r.status}.`);
  return r.json() as Promise<T>;
}

export const POLE = "id, name, mimeType, modifiedTime, size, webViewLink, iconLink, parents";

export async function soubor(id: string): Promise<Soubor> {
  return api<Soubor>(`files/${encodeURIComponent(id)}`, { fields: POLE });
}

export async function obsahSlozky(id: string): Promise<Soubor[]> {
  const vse: Soubor[] = [];
  let stranka: string | undefined;
  do {
    const r = await api<{ files: Soubor[]; nextPageToken?: string }>("files", {
      q: `'${id.replace(/'/g, "")}' in parents and trashed = false`, fields: `nextPageToken, files(${POLE})`,
      orderBy: "folder,name_natural", pageSize: "200", includeItemsFromAllDrives: "true", ...(stranka ? { pageToken: stranka } : {}),
    });
    vse.push(...r.files); stranka = r.nextPageToken;
  } while (stranka && vse.length < 1000);
  return vse;
}

/** Cesta od kořenové složky k danému souboru/složce (včetně), nebo null, když neleží uvnitř kořene. */
export async function cestaOdKorene(korenId: string, id: string): Promise<Soubor[] | null> {
  const cesta: Soubor[] = [];
  let akt = await soubor(id);
  for (let i = 0; i < 15; i++) {
    cesta.unshift(akt);
    if (akt.id === korenId) return cesta;
    const rodic = akt.parents?.[0];
    if (!rodic) return null;
    akt = await soubor(rodic);
  }
  return null;
}

/** Stažení obsahu souboru (Google dokumenty se exportují do PDF). */
export async function stahnout(s: Soubor): Promise<Response> {
  const google = s.mimeType.startsWith("application/vnd.google-apps.");
  const url = google
    ? `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(s.id)}/export?mimeType=application%2Fpdf`
    : `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(s.id)}?alt=media&supportsAllDrives=true`;
  return fetch(url, { headers: { authorization: `Bearer ${await pristup()}` }, cache: "no-store" });
}

/** ID složky z odkazu …/folders/<id> nebo ?id=<id>. */
export const idSlozky = (url: string | null | undefined) => url?.match(/\/folders\/([\w-]+)/)?.[1] ?? url?.match(/[?&]id=([\w-]+)/)?.[1] ?? null;
