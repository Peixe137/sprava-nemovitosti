"use client";
import { useRouter } from "next/navigation";

/** Výběr nadřazené budovy. U nové nemovitosti přepne na formulář jednotky, kde se údaje převezmou z budovy. */
export function PatriPod({ budovy, vychozi, prepnout }: { budovy: { id: string; nazev: string }[]; vychozi: string; prepnout: boolean }) {
  const router = useRouter();
  return (
    <select name="nadrazena_id" defaultValue={vychozi} className="pole"
      onChange={(e) => { if (prepnout && e.target.value) router.push(`/nemovitosti/nova?nadrazena=${e.target.value}`); }}>
      <option value="">— samostatná (nepatří pod budovu ani areál) —</option>
      {budovy.map((x) => <option key={x.id} value={x.id}>{x.nazev}</option>)}
    </select>
  );
}
