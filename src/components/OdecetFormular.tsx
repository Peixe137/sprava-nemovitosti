"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { zapsatOdecet } from "@/app/(app)/meridla/actions";
import { nahratSoubor } from "@/components/NahratPrilohy";
import { DRUHY_ODECTU } from "@/lib/format";

/** Zápis odečtu s fotkou stavu (mobil: rovnou fotoaparát). */
export function OdecetFormular({ meridloId, org, jednotka }: { meridloId: string; org: string; jednotka: string | null }) {
  const router = useRouter();
  const foto = useRef<HTMLInputElement>(null);
  const [stav, setStav] = useState("");
  const [potvrdit, setPotvrdit] = useState(false);
  const odeslat = async (fd: FormData) => {
    setStav("Ukládám…");
    if (potvrdit) fd.set("potvrdit", "1");
    const r = await zapsatOdecet(meridloId, fd);
    if (r.chyba) { setStav(r.chyba); setPotvrdit(r.chyba.startsWith("Stav je nižší")); return; }
    for (const f of [...(foto.current?.files ?? [])]) {
      const e = await nahratSoubor(org, "odecet", r.id!, f);
      if (e) { setStav(`Odečet uložen, fotka ne: ${e}`); router.refresh(); return; }
    }
    setStav("Uloženo."); setPotvrdit(false);
    router.refresh();
  };
  return (
    <form action={odeslat} className="flex flex-wrap items-end gap-2 text-xs">
      <label className="block"><span className="stitek">Datum</span><input type="date" name="datum" defaultValue={new Date().toISOString().slice(0, 10)} className="pole w-36 py-1" /></label>
      <label className="block"><span className="stitek">Stav{jednotka ? ` (${jednotka})` : ""}</span><input name="stav" inputMode="decimal" required className="pole w-28 py-1" /></label>
      <label className="block"><span className="stitek">Druh</span>
        <select name="druh" defaultValue="pravidelny" className="pole w-auto py-1">{Object.entries(DRUHY_ODECTU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
      <label className="block"><span className="stitek">Fotka</span><input ref={foto} type="file" accept="image/*" capture="environment" className="w-44 text-xs" /></label>
      <button className="tlacitko-svetle px-2 py-1 text-xs">{potvrdit ? "Přesto uložit" : "Zapsat"}</button>
      {stav && <span className={stav === "Uloženo." ? "plus" : stav === "Ukládám…" ? "text-slate-500" : "text-amber-700"}>{stav}</span>}
    </form>
  );
}
