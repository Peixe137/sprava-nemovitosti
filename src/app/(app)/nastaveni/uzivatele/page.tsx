import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { ROLE, POPIS_ROLE, mojeRole } from "@/lib/role";
import { datum } from "@/lib/format";
import { pridatUzivatele, zmenitRoli, odebratUzivatele, upravitUzivatele } from "../actions";
import { Zprava } from "@/components/Zprava";

export default async function Uzivatele({ searchParams }: PageProps<"/nastaveni/uzivatele">) {
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const role = await mojeRole(supabase);
  if (role !== "majitel") return (<><Nadpis titulek="Uživatelé" /><p className="text-sm text-slate-500">Uživatele spravuje administrátor. Vaše role: {ROLE[role ?? ""] ?? "–"}.</p></>);
  const [{ data: clenove }, { data: ja }] = await Promise.all([supabase.rpc("clenove_organizace"), supabase.auth.getClaims()]);
  const lide = (clenove ?? []) as { user_id: string; email: string; role: string; posledni_prihlaseni: string | null; jmeno: string | null; telefon: string | null; pozvan: string | null }[];
  const vyber = ["majitel", "spravce", "ucetni", "udrzbar", "host"];

  return (
    <>
      <Nadpis titulek="Uživatelé" podtitulek="Kdo má přístup a co smí" />
      <Chyba text={chyba} />
      <Zprava />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {vyber.map((r) => (
          <div key={r} className="rounded-xl border border-slate-200 p-4 text-sm"><div className="font-semibold">{ROLE[r]}</div><div className="text-slate-500">{POPIS_ROLE[r]}</div></div>
        ))}
      </div>
      <section className="karta mb-6 overflow-x-auto">
        <table className="tabulka">
          <thead><tr><th>Jméno a kontakt</th><th>Role</th><th>Naposledy přihlášen</th><th></th></tr></thead>
          <tbody>{lide.map((c) => {
            const jaSam = c.user_id === ja?.claims?.sub;
            return (
              <tr key={c.user_id}>
                <td>
                  <form action={upravitUzivatele.bind(null, c.user_id)} className="flex flex-wrap items-center gap-1">
                    <input name="jmeno" defaultValue={c.jmeno ?? ""} placeholder="Jméno" className="pole w-40 py-1" />
                    <input name="telefon" defaultValue={c.telefon ?? ""} placeholder="Telefon" className="pole w-32 py-1" />
                    <button className="text-xs text-blue-700 hover:underline">uložit</button>
                  </form>
                  <div className="mt-1 text-xs text-slate-500">{c.email}{jaSam && " (vy)"}</div></td>
                <td>{jaSam ? ROLE[c.role] : (
                  <form action={zmenitRoli.bind(null, c.user_id)} className="flex items-center gap-2">
                    <select name="role" defaultValue={c.role} className="pole w-auto py-1">{vyber.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
                    <Odeslat svetle className="px-3 py-1">Uložit</Odeslat>
                  </form>)}</td>
                <td>{c.posledni_prihlaseni ? datum(c.posledni_prihlaseni.slice(0, 10)) : c.pozvan ? <span className="text-xs text-amber-700">pozván {datum(c.pozvan.slice(0, 10))}, zatím nepřihlášen</span> : "–"}</td>
                <td className="text-right">{!jaSam && (
                  <form action={odebratUzivatele.bind(null, c.user_id)} className="flex items-center justify-end gap-2 text-xs">
                    <label className="flex items-center gap-1"><input type="checkbox" name="potvrzeni" required /> potvrdit</label>
                    <button className="text-slate-500 hover:text-red-700">odebrat</button>
                  </form>)}</td>
              </tr>);
          })}</tbody>
        </table>
      </section>
      <form action={pridatUzivatele} className="karta max-w-xl space-y-3">
        <h2 className="font-semibold">Pozvat nového uživatele</h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <input name="jmeno" placeholder="Jméno a příjmení" className="pole" />
          <input name="telefon" placeholder="Telefon" className="pole" />
          <input name="email" type="email" required placeholder="E-mail (přihlašovací)" className="pole" />
          <select name="role" defaultValue="spravce" className="pole">{vyber.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
        </div>
        <p className="text-xs text-slate-500">Na e-mail přijde pozvánka s odkazem, přes který si člověk nastaví heslo. Pak se přihlašuje e-mailem a heslem (nebo přes Google, je-li zapnuté). Kdo už účet má, bude jen přidán s rolí.</p>
        <Odeslat>Poslat pozvánku</Odeslat>
      </form>
    </>
  );
}
