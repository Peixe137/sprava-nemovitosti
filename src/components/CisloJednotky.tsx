"use client";
import { useRef, useState } from "react";

/** Patro + pořadí na patře → číslo jednotky (2. patro, j. 01 → 201) a označení s č.p. budovy (147-201).
 *  Číslo jde přepsat ručně; z označení se dá složit název jednotky. */
export function CisloJednotky({ patro: p0, kod: k0, cp, ku }: { patro?: number | null; kod?: string | null; cp?: string | null; ku?: string | null }) {
  const ref = useRef<HTMLDivElement>(null);
  const [patro, setPatro] = useState(p0 != null ? String(p0) : "");
  const [poradi, setPoradi] = useState(k0 && k0.length === 3 ? k0.slice(1) : "");
  const [kod, setKod] = useState(k0 ?? "");
  const [rucne, setRucne] = useState(false);
  const spocitat = (p: string, j: string) => {
    if (rucne) return;
    const pn = Number(p);
    if (p !== "" && j !== "" && pn >= 0 && pn <= 9) setKod(`${pn}${j.padStart(2, "0").slice(-2)}`);
  };
  const oznaceni = kod ? (cp ? `${cp}-${kod.padStart(3, "0")}` : kod.padStart(3, "0")) : "";
  const doNazvu = () => {
    const pole = ref.current?.closest("form")?.querySelector<HTMLInputElement>('input[name="nazev"]');
    if (!pole) return;
    const popis = pole.value.match(/\(.*\)\s*$/)?.[0];   // ponechá „(Pošta)“
    // název: katastrální území + označení, popis v závorce – např. „Bechyně 147-101 (Pošta)“
    const zaklad = [ku, oznaceni].filter(Boolean).join(" ");
    pole.value = popis ? `${zaklad} ${popis}` : `${zaklad} ()`;
    pole.focus();
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
      <div ref={ref} className="text-sm text-slate-600 sm:col-span-3">
        {oznaceni ? <>Označení jednotky: <b>{[ku, oznaceni].filter(Boolean).join(" ")}</b>
          <button type="button" onClick={doNazvu} className="ml-3 text-blue-700 hover:underline">použít do názvu</button></>
          : <span className="text-slate-400">Označení = k.ú., č.p. budovy (nebo parcela)-patro a jednotka, např. Bechyně 147-101</span>}
      </div>
    </>
  );
}
