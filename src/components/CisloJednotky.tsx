"use client";
import { useState } from "react";

/** Patro + pořadí na patře → trojmístné číslo jednotky pro VS (2. patro, j. 01 → 201). Číslo jde přepsat ručně. */
export function CisloJednotky({ patro: p0, kod: k0 }: { patro?: number | null; kod?: string | null }) {
  const [patro, setPatro] = useState(p0 != null ? String(p0) : "");
  const [poradi, setPoradi] = useState(k0 && k0.length === 3 ? k0.slice(1) : "");
  const [kod, setKod] = useState(k0 ?? "");
  const [rucne, setRucne] = useState(false);
  const spocitat = (p: string, j: string) => {
    if (rucne) return;
    const pn = Number(p);
    if (p !== "" && j !== "" && pn >= 0 && pn <= 9) setKod(`${pn}${j.padStart(2, "0").slice(-2)}`);
  };
  return (
    <>
      <label className="block"><span className="stitek">Patro</span>
        <input name="patro" type="number" min={-5} max={99} value={patro} placeholder="0 = přízemí"
          onChange={(e) => { setPatro(e.target.value); spocitat(e.target.value, poradi); }} className="pole" /></label>
      <label className="block"><span className="stitek">Jednotka na patře</span>
        <input inputMode="numeric" maxLength={2} value={poradi} placeholder="01"
          onChange={(e) => { const v = e.target.value.replace(/\D/g, ""); setPoradi(v); spocitat(patro, v); }} className="pole" /></label>
      <label className="block"><span className="stitek">Číslo jednotky (VS)</span>
        <input name="kod_jednotky" inputMode="numeric" maxLength={3} pattern="[0-9]{1,3}" value={kod} placeholder="201"
          onChange={(e) => { setRucne(true); setKod(e.target.value.replace(/\D/g, "")); }} className="pole" /></label>
    </>
  );
}
