"use client";
import { useState } from "react";
import { DRUHY_PREDPISU, PERIODY } from "@/lib/format";

export type Polozka = { druh: string; popis?: string | null; castka: string | number; perioda: string };

/** Nájem a zálohy jako samostatné řádky – lze přidávat, odebírat a nastavit periodu. */
export function PolozkyPredpisu({ vychozi }: { vychozi: Polozka[] }) {
  const [radky, setRadky] = useState<(Polozka & { k: number })[]>(
    (vychozi.length ? vychozi : [{ druh: "najem", castka: "", perioda: "mesicne" }]).map((p, k) => ({ ...p, k })));
  const pridat = () => setRadky((r) => [...r, { k: Date.now(), druh: "zaloha_sluzby", castka: "", perioda: "mesicne" }]);
  const odebrat = (k: number) => setRadky((r) => r.filter((x) => x.k !== k));
  return (
    <div className="space-y-2">
      {radky.map((r) => (
        <div key={r.k} className="grid grid-cols-[1.2fr_1.4fr_1fr_1fr_auto] items-center gap-2">
          <select name="p_druh" defaultValue={r.druh} className="pole">
            {Object.entries(DRUHY_PREDPISU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <input name="p_popis" defaultValue={r.popis ?? ""} placeholder="upřesnění (nepovinné)" className="pole" />
          <input name="p_castka" defaultValue={String(r.castka ?? "")} placeholder="Kč" inputMode="decimal" className="pole" />
          <select name="p_perioda" defaultValue={r.perioda} className="pole">
            {Object.entries(PERIODY).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
          <button type="button" onClick={() => odebrat(r.k)} aria-label="Odebrat řádek" className="px-2 text-slate-400 hover:text-red-700">✕</button>
        </div>
      ))}
      <button type="button" onClick={pridat} className="text-sm text-blue-700 hover:underline">+ Přidat položku (záloha, parkování…)</button>
    </div>
  );
}
