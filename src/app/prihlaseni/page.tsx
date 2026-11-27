import { Odeslat } from "@/components/Odeslat";
import { prihlasit, zapomenuteHeslo, prihlasitGoogle } from "./actions";
import { PresmerovatOdkaz } from "./PresmerovatOdkaz";

/** Je v Supabase zapnuté přihlášení přes Google? (veřejné nastavení Auth) */
async function googleZapnuty() {
  try {
    const r = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/settings`, {
      headers: { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY! }, next: { revalidate: 300 },
    });
    return !!(await r.json())?.external?.google;
  } catch { return false; }
}

const CHYBY: Record<string, string> = {
  "1": "Nesprávný e-mail nebo heslo.",
  google: "Přihlášení přes Google se nepodařilo.",
  neclen: "Tento účet Google nemá do aplikace přístup. Požádejte administrátora o pozvánku na stejný e-mail.",
};

export default async function Prihlaseni({ searchParams }: PageProps<"/prihlaseni">) {
  const { chyba, odeslano, zapomenute } = await searchParams;
  const google = await googleZapnuty();
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <PresmerovatOdkaz />
      <div className="karta w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Správa nemovitostí</h1>
          <p className="text-sm text-slate-500">Přihlaste se svým účtem</p>
        </div>
        {typeof chyba === "string" && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{CHYBY[chyba] ?? CHYBY["1"]}</p>}
        {odeslano && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Pokud účet existuje, poslali jsme na e-mail odkaz pro nastavení nového hesla.</p>}
        {zapomenute ? (
          <form action={zapomenuteHeslo} className="space-y-3">
            <label className="block"><span className="stitek">E-mail</span><input name="email" type="email" required autoComplete="email" className="pole" /></label>
            <Odeslat className="w-full justify-center">Poslat odkaz na nové heslo</Odeslat>
            <a href="/prihlaseni" className="block text-center text-sm odkaz">Zpět na přihlášení</a>
          </form>
        ) : (<>
          <form action={prihlasit} className="space-y-4">
            <label className="block"><span className="stitek">E-mail</span><input name="email" type="email" required autoComplete="email" className="pole" /></label>
            <label className="block"><span className="stitek">Heslo</span><input name="heslo" type="password" required autoComplete="current-password" className="pole" /></label>
            <Odeslat className="w-full justify-center">Přihlásit se</Odeslat>
          </form>
          {google && (
            <form action={prihlasitGoogle}>
              <button className="tlacitko-svetle w-full justify-center">Přihlásit přes Google</button>
            </form>
          )}
          <a href="/prihlaseni?zapomenute=1" className="block text-center text-sm odkaz">Zapomenuté heslo</a>
        </>)}
      </div>
    </main>
  );
}
