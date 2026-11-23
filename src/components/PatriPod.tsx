"use client";
import { HledatNemovitost, type Moznost } from "@/components/HledatNemovitost";

/** Výběr nadřazené budovy s vyhledáváním. U nové nemovitosti přepne na formulář jednotky, kde se údaje převezmou z budovy. */
export function PatriPod({ budovy, vychozi, prepnout }: { budovy: Moznost[]; vychozi: string; prepnout: boolean }) {
  return <HledatNemovitost name="nadrazena_id" moznosti={budovy} vychozi={vychozi}
    prazdna="— samostatná (nepatří pod budovu ani areál) —" navigace={prepnout ? "/nemovitosti/nova?nadrazena=" : undefined} />;
}
