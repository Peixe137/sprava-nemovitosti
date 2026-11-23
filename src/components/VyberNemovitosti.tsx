"use client";
import { useRouter } from "next/navigation";

/** Výběr nemovitosti, který po změně znovu načte formulář s předvyplněnými údaji. */
export function VyberNemovitosti({ moznosti, vybrana }: { moznosti: { id: string; nazev: string }[]; vybrana: string }) {
  const router = useRouter();
  return (
    <select name="nemovitost_id" required value={vybrana} className="pole"
      onChange={(e) => router.replace(`/smlouvy/nova?nemovitost=${e.target.value}`, { scroll: false })}>
      <option value="" disabled>— vyberte —</option>
      {moznosti.map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
    </select>
  );
}
