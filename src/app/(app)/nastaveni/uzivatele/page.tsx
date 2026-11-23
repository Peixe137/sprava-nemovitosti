import { supabaseServer } from "@/lib/supabase/server";
import { Chyba, Nadpis } from "@/components/Chyba";
import { Odeslat } from "@/components/Odeslat";
import { ROLE, POPIS_ROLE, mojeRole } from "@/lib/role";
import { datum } from "@/lib/format";
import { pridatUzivatele, zmenitRoli, odebratUzivatele } from "../actions";

export default async function Uzivatele({ searchParams }: PageProps<"/nastaveni/uzivatele">) {
  const { chyba } = await searchParams;
  const supabase = await supabaseServer();
  const role = await mojeRole(supabase);
  if (role !== "majitel") return (<><Nadpis titulek="Uživatelé" /><p className="text-sm text-slate-500">Uživatele spravuje administrátor. Vaše role: {ROLE[role ?? ""] ?? "–"}.</p></>);
  const [{ data: clenove }, { data: ja }] = await Promise.all([supabase.rpc("clenove_organizace"), supabase.auth.getClaims()]);
  const lide = (clenove ?? []) as { user_id: string; email: string; role: string; posledni_prihlaseni: string | null }[];
  const vyber = ["majitel", "spravce", "ucetni", "host"];

  return (
    <>
      <Nadpis titulek="Uživatelé" podtitulek="Kdo má přístup a co smí" />
      <Chyba text={chyba} />
      <div className="mb-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {vyber.map((r) => (
          <div key={r} className="rounded-xl border border-slate-200 p-4 text-sm"><div className="font-semibold">{ROLE[r]}</div><div className="text-slate-500">{POPIS_ROLE[r]}</div></div>
        ))}
      </div>
      <section className="karta mb-6 overflow-x-auto">
        <table className="tabulka">
          <thead><tr><th>E-mail</th><th>Role</th><th>Naposledy přihlášen</th><th></th></tr></thead>
          <tbody>{lide.map((c) => {
            const jaSam = c.user_id === ja?.claims?.sub;
            return (
              <tr key={c.user_id}>
                <td>{c.email}{jaSam && <span className="ml-2 text-xs text-slate-500">(vy)</span>}</td>
                <td>{jaSam ? ROLE[c.role] : (
                  <form action={zmenitRoli.bind(null, c.user_id)} className="flex items-center gap-2">
                    <select name="role" defaultValue={c.role} className="pole w-auto py-1">{vyber.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
                    <Odeslat svetle className="px-3 py-1">Uložit</Odeslat>
                  </form>)}</td>
                <td>{c.posledni_prihlaseni ? datum(c.posledni_prihlaseni.slice(0, 10)) : "–"}</td>
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
        <h2 className="font-semibold">Přidat uživatele</h2>
        <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
          <input name="email" type="email" required placeholder="e-mail" className="pole" />
          <select name="role" defaultValue="spravce" className="pole">{vyber.map((r) => <option key={r} value={r}>{ROLE[r]}</option>)}</select>
        </div>
        <p className="text-xs text-slate-500">Člověk musí mít účet. Nový účet vytvoříte pozvánkou v Supabase (Authentication → Users → Invite user); po přijetí ho sem přidejte.</p>
        <Odeslat>Přidat</Odeslat>
      </form>
    </>
  );
}
