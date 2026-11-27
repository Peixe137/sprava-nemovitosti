"use client";
import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";

/** Nahrání souboru do Storage + záznam v tabulce priloha. Vrací chybu jako text. */
export async function nahratSoubor(org: string, tabulka: string, zaznamId: string, f: File): Promise<string | null> {
  const supabase = supabaseBrowser();
  const bezpecne = (f.name || "snimek.png").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^\w.-]+/g, "_").slice(-80);
  const cesta = `${org}/${tabulka}/${zaznamId}/${Date.now()}-${bezpecne}`;
  const { error } = await supabase.storage.from("prilohy").upload(cesta, f, { contentType: f.type || undefined });
  if (error) return error.message;
  const { error: e2 } = await supabase.from("priloha").insert({ tabulka, zaznam_id: zaznamId, cesta, nazev: f.name || "snímek obrazovky.png", typ: f.type, velikost: f.size });
  return e2?.message ?? null;
}

/** Vložit snímek obrazovky (⌘V), přetáhnout soubor, vybrat ho nebo vyfotit mobilem. */
export function NahratPrilohy({ org, tabulka, zaznamId, maly }: { org: string; tabulka: string; zaznamId: string; maly?: boolean }) {
  const router = useRouter();
  const vyber = useRef<HTMLInputElement>(null);
  const [stav, setStav] = useState("");
  const nahrat = async (soubory: File[]) => {
    if (!soubory.length) return;
    setStav("Nahrávám…");
    for (const f of soubory) {
      if (f.size > 25 * 1024 * 1024) { setStav(`${f.name}: větší než 25 MB`); return; }
      const chyba = await nahratSoubor(org, tabulka, zaznamId, f);
      if (chyba) { setStav(`Nenahráno: ${chyba}`); return; }
    }
    setStav(`Nahráno: ${soubory.length}`);
    router.refresh();
  };
  return (
    <div className={`flex flex-wrap items-center gap-2 ${maly ? "text-xs" : "text-sm"}`}>
      <div tabIndex={0} onPaste={(e) => { const s = [...e.clipboardData.files]; if (s.length) { e.preventDefault(); nahrat(s); } }}
        onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); nahrat([...e.dataTransfer.files]); }}
        className="min-w-48 flex-1 cursor-text rounded-lg border border-dashed border-slate-300 px-3 py-2 text-slate-500 focus:border-blue-500 focus:outline-none">
        Klikněte sem a vložte snímek obrazovky (⌘V / Ctrl+V), nebo sem přetáhněte soubor
      </div>
      <button type="button" onClick={() => vyber.current?.click()} className="tlacitko-svetle px-2 py-1 text-xs">Vybrat / vyfotit</button>
      <input ref={vyber} type="file" multiple accept="image/*,application/pdf,.doc,.docx,.xls,.xlsx" className="hidden"
        onChange={(e) => { nahrat([...(e.target.files ?? [])]); e.target.value = ""; }} />
      {stav && <span className="text-xs text-slate-500">{stav}</span>}
    </div>
  );
}
