"use client";

import { useState } from "react";

/** Výběr štítků: kliknutím zapnout/vypnout, nový štítek dopsat a přidat (Enter nebo +). Odesílá se jako víc polí `name`. */
export function StitkyVyber({ name, moznosti, vychozi = [] }: { name: string; moznosti: string[]; vychozi?: string[] }) {
  const [vsechny, setVsechny] = useState(() => Array.from(new Set([...moznosti, ...vychozi])).sort((a, b) => a.localeCompare(b, "cs")));
  const [vybrane, setVybrane] = useState<string[]>(vychozi);
  const [novy, setNovy] = useState("");

  const prepnout = (s: string) => setVybrane((v) => (v.includes(s) ? v.filter((x) => x !== s) : [...v, s]));
  const pridat = () => {
    const s = novy.trim().replace(/\s+/g, " ");
    if (!s) return;
    const existujici = vsechny.find((x) => x.toLocaleLowerCase("cs") === s.toLocaleLowerCase("cs"));
    const stitek = existujici ?? s;
    if (!existujici) setVsechny((v) => [...v, stitek].sort((a, b) => a.localeCompare(b, "cs")));
    setVybrane((v) => (v.includes(stitek) ? v : [...v, stitek]));
    setNovy("");
  };

  return (
    <div>
      {vybrane.map((s) => <input key={s} type="hidden" name={name} value={s} />)}
      <div className="mt-1 flex flex-wrap gap-1.5">
        {vsechny.map((s) => {
          const zap = vybrane.includes(s);
          return (
            <button key={s} type="button" onClick={() => prepnout(s)} aria-pressed={zap}
              className={`rounded-full border px-2.5 py-0.5 text-xs transition ${zap ? "border-blue-600 bg-blue-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"}`}>
              {zap ? "✓ " : ""}{s}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-1.5">
        <input value={novy} onChange={(e) => setNovy(e.target.value)} placeholder="Nový štítek…" className="pole"
          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); pridat(); } }} />
        <button type="button" onClick={pridat} className="tlacitko-svetle shrink-0">+ Přidat</button>
      </div>
    </div>
  );
}
