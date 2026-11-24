"use client";
import { useEffect, useRef, useState } from "react";
import { navrhZkratky } from "@/lib/zkratka";

/** Pole firemní zkratky: samo navrhne @ + 3 písmena z názvu, dokud ji uživatel nepřepíše ručně. */
export function PoleZkratky({ vychozi }: { vychozi?: string }) {
  const ref = useRef<HTMLInputElement>(null);
  const [hodnota, setHodnota] = useState(vychozi ?? "");
  const rucne = useRef(Boolean(vychozi)); // u existujícího vlastníka zkratku nepřepisujeme

  useEffect(() => {
    const form = ref.current?.form;
    if (!form) return;
    const nazev = () => (form.elements.namedItem("nazev") as HTMLInputElement | null)?.value ?? "";
    const prepocitat = (e: Event) => {
      if ((e.target as HTMLInputElement)?.name !== "nazev" || rucne.current) return;
      setHodnota(navrhZkratky(nazev()));
    };
    form.addEventListener("input", prepocitat);
    return () => form.removeEventListener("input", prepocitat);
  }, []);

  return (
    <label className="block"><span className="stitek">Zkratka (tag)</span>
      <div className="flex items-center rounded-lg border border-slate-300 bg-white focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
        <span className="pl-3 text-slate-400">@</span>
        <input ref={ref} name="zkratka" value={hodnota} maxLength={6} placeholder="CTX"
          onChange={(e) => { rucne.current = e.target.value !== ""; setHodnota(e.target.value.replace(/^@/, "").toUpperCase()); }}
          className="w-full rounded-lg bg-transparent px-1 py-2 text-sm uppercase focus:outline-none" />
      </div>
      {!rucne.current && hodnota && <span className="text-xs text-slate-500">návrh z názvu – lze přepsat</span>}
    </label>
  );
}
