"use client";
import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

/** Nastavení hesla po pozvánce nebo při zapomenutém heslu. Odkaz z e-mailu nese přihlášení v adrese (#access_token… nebo ?code=…). */
export function NoveHeslo() {
  const [supabase] = useState(() => createBrowserClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!));
  const [stav, setStav] = useState<"nacitam" | "formular" | "chyba" | "hotovo">("nacitam");
  const [zprava, setZprava] = useState("");
  const [heslo, setHeslo] = useState("");
  const [heslo2, setHeslo2] = useState("");

  useEffect(() => {
    (async () => {
      const hash = new URLSearchParams(window.location.hash.slice(1));
      const code = new URLSearchParams(window.location.search).get("code");
      if (hash.get("error_description")) { setZprava(hash.get("error_description")!.replace(/\+/g, " ")); setStav("chyba"); return; }
      if (hash.get("access_token") && hash.get("refresh_token")) {
        const { error } = await supabase.auth.setSession({ access_token: hash.get("access_token")!, refresh_token: hash.get("refresh_token")! });
        history.replaceState(null, "", "/heslo");
        if (error) { setZprava(error.message); setStav("chyba"); return; }
      } else if (code) {
        const { error } = await supabase.auth.exchangeCodeForSession(code);
        history.replaceState(null, "", "/heslo");
        if (error) { setZprava(error.message); setStav("chyba"); return; }
      }
      const { data } = await supabase.auth.getUser();
      if (!data.user) { setZprava("Odkaz už vypršel nebo byl použit. Požádejte o nový (Zapomenuté heslo na přihlášení)."); setStav("chyba"); return; }
      setZprava(data.user.email ?? "");
      setStav("formular");
    })();
  }, [supabase]);

  const ulozit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (heslo.length < 8) { setZprava("Heslo musí mít aspoň 8 znaků."); return; }
    if (heslo !== heslo2) { setZprava("Hesla se neshodují."); return; }
    const { error } = await supabase.auth.updateUser({ password: heslo });
    if (error) { setZprava(error.message); return; }
    setStav("hotovo");
    setTimeout(() => { window.location.href = "/"; }, 1200);
  };

  return (
    <div className="karta w-full max-w-sm space-y-4">
      <h1 className="text-xl font-semibold">Nastavení hesla</h1>
      {stav === "nacitam" && <p className="text-sm text-slate-500">Ověřuji odkaz…</p>}
      {stav === "chyba" && <><p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{zprava}</p><a href="/prihlaseni" className="odkaz text-sm">Na přihlášení</a></>}
      {stav === "hotovo" && <p className="rounded-lg bg-green-50 px-3 py-2 text-sm text-green-800">Heslo uloženo. Přihlašuji…</p>}
      {stav === "formular" && (
        <form onSubmit={ulozit} className="space-y-3">
          <p className="text-sm text-slate-500">Účet: <b>{zprava.includes("@") ? zprava : ""}</b></p>
          {!zprava.includes("@") && zprava && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{zprava}</p>}
          <label className="block"><span className="stitek">Nové heslo (aspoň 8 znaků)</span>
            <input type="password" value={heslo} onChange={(e) => setHeslo(e.target.value)} required autoComplete="new-password" className="pole" /></label>
          <label className="block"><span className="stitek">Heslo znovu</span>
            <input type="password" value={heslo2} onChange={(e) => setHeslo2(e.target.value)} required autoComplete="new-password" className="pole" /></label>
          <button className="tlacitko w-full justify-center">Uložit heslo a přihlásit</button>
        </form>
      )}
    </div>
  );
}
