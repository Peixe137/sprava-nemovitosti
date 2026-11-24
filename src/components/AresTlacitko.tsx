"use client";
import { useRef, useState, useTransition } from "react";
import { aresPodleIco } from "@/app/actions/ares";

// Tlačítko vedle pole IČO: načte údaje z ARES a vyplní pole stejného formuláře.
// mapovani: { klíč z ARES: name pole ve formuláři }
export function AresTlacitko({ icoPole = "ico", mapovani }: { icoPole?: string; mapovani: Record<string, string> }) {
  const ref = useRef<HTMLButtonElement>(null);
  const [zprava, setZprava] = useState<{ text: string; chyba?: boolean } | null>(null);
  const [nacita, start] = useTransition();

  const nacist = () => {
    const form = ref.current?.form;
    if (!form) return;
    const ico = (form.elements.namedItem(icoPole) as HTMLInputElement | null)?.value ?? "";
    if (!ico.trim()) { setZprava({ text: "Nejdřív vyplňte IČO.", chyba: true }); return; }
    start(async () => {
      const r = await aresPodleIco(ico);
      if (!r.ok) { setZprava({ text: r.chyba, chyba: true }); return; }
      for (const [klic, pole] of Object.entries(mapovani)) {
        const el = form.elements.namedItem(pole) as HTMLInputElement | HTMLSelectElement | null;
        const hodnota = (r.data as Record<string, unknown>)[klic];
        if (!el || hodnota == null) continue;
        if (el instanceof HTMLInputElement && el.type === "checkbox") el.checked = Boolean(hodnota);
        else el.value = String(hodnota);
        el.dispatchEvent(new Event("input", { bubbles: true })); // ať navázaná pole (např. návrh zkratky) zareagují
      }
      setZprava(r.data.zanikl
        ? { text: `Pozor: ${r.data.nazev} je v ARES vedený jako zaniklý.`, chyba: true }
        : { text: `Načteno: ${r.data.nazev}${r.data.platce_dph ? " · plátce DPH" : ""}` });
    });
  };

  return (
    <div className="space-y-1">
      <button ref={ref} type="button" onClick={nacist} disabled={nacita} className="tlacitko-svetle w-full justify-center">
        {nacita ? "Načítám…" : "Načíst z ARES"}
      </button>
      {zprava && <p className={`text-xs ${zprava.chyba ? "text-red-700" : "text-green-700"}`}>{zprava.text}</p>}
    </div>
  );
}
