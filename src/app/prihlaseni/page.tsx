import { Odeslat } from "@/components/Odeslat";
import { prihlasit } from "./actions";

export default async function Prihlaseni({ searchParams }: PageProps<"/prihlaseni">) {
  const { chyba } = await searchParams;
  return (
    <main className="flex min-h-screen items-center justify-center p-6">
      <form action={prihlasit} className="karta w-full max-w-sm space-y-4">
        <div>
          <h1 className="text-xl font-semibold">Správa nemovitostí</h1>
          <p className="text-sm text-slate-500">Přihlaste se svým účtem</p>
        </div>
        {chyba && (
          <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">Nesprávný e-mail nebo heslo.</p>
        )}
        <label className="block">
          <span className="stitek">E-mail</span>
          <input name="email" type="email" required autoComplete="email" className="pole" />
        </label>
        <label className="block">
          <span className="stitek">Heslo</span>
          <input name="heslo" type="password" required autoComplete="current-password" className="pole" />
        </label>
        <Odeslat className="w-full justify-center">Přihlásit se</Odeslat>
      </form>
    </main>
  );
}
