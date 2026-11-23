"use client";
import { useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

export type Moznost = { id: string; nazev: string; popis?: string | null };
const norm = (s: string) => s.normalize("NFD").replace(/\p{Diacritic}/gu, "").toLowerCase();

/** Výběr nemovitosti s vyhledáváním (název, adresa, obec, LV – bez ohledu na diakritiku).
 *  navigace: po výběru přejde na tuto adresu + id (předvyplnění formuláře). prazdna: popisek volby „nic“. */
export function HledatNemovitost({ moznosti, name, vychozi = "", required, prazdna, navigace, placeholder = "Hledat podle názvu, adresy nebo LV…" }: {
  moznosti: Moznost[]; name: string; vychozi?: string; required?: boolean; prazdna?: string; navigace?: string; placeholder?: string;
}) {
  const router = useRouter();
  const [id, setId] = useState(vychozi);
  const [q, setQ] = useState("");
  const [otevreno, setOtevreno] = useState(false);
  const [aktivni, setAktivni] = useState(0);
  const obal = useRef<HTMLDivElement>(null);
  const vybrana = moznosti.find((m) => m.id === id);

  const nalezene = useMemo(() => {
    const slova = norm(q).split(/\s+/).filter(Boolean);
    return moznosti.filter((m) => slova.every((w) => norm(`${m.nazev} ${m.popis ?? ""}`).includes(w))).slice(0, 60);
  }, [q, moznosti]);
  const polozky: (Moznost | null)[] = prazdna ? [null, ...nalezene] : nalezene;

  const vyber = (m: Moznost | null) => {
    setId(m?.id ?? ""); setQ(""); setOtevreno(false);
    if (navigace) router.replace(navigace + (m?.id ?? ""), { scroll: false });
  };

  return (
    <div ref={obal} className="relative"
      onBlur={(e) => { if (!obal.current?.contains(e.relatedTarget as Node)) setOtevreno(false); }}>
      {/* skutečná hodnota formuláře; viditelné pole jen hledá */}
      <input name={name} value={id} required={required} onChange={() => {}} tabIndex={-1} aria-hidden
        className="pointer-events-none absolute inset-x-0 bottom-0 h-px opacity-0" />
      <input type="search" className="pole" autoComplete="off" role="combobox" aria-expanded={otevreno}
        placeholder={vybrana ? `${vybrana.nazev}` : (prazdna ?? placeholder)}
        value={otevreno ? q : (vybrana?.nazev ?? (id ? "" : prazdna ?? ""))}
        onFocus={() => { setOtevreno(true); setQ(""); setAktivni(0); }}
        onChange={(e) => { setQ(e.target.value); setOtevreno(true); setAktivni(0); }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") { e.preventDefault(); setAktivni((a) => Math.min(a + 1, polozky.length - 1)); }
          if (e.key === "ArrowUp") { e.preventDefault(); setAktivni((a) => Math.max(a - 1, 0)); }
          if (e.key === "Enter" && otevreno) { e.preventDefault(); if (polozky.length) vyber(polozky[aktivni] ?? null); }
          if (e.key === "Escape") setOtevreno(false);
        }} />
      {!otevreno && vybrana?.popis && <div className="mt-1 truncate text-xs text-slate-500">{vybrana.popis}</div>}
      {otevreno && (
        <ul role="listbox" className="absolute z-20 mt-1 max-h-72 w-full overflow-auto rounded-lg border border-slate-200 bg-white py-1 text-sm shadow-lg">
          {polozky.length === 0 && <li className="px-3 py-2 text-slate-500">Nic nenalezeno.</li>}
          {polozky.map((m, i) => (
            <li key={m?.id ?? "-"} role="option" aria-selected={i === aktivni} tabIndex={-1}
              onMouseDown={(e) => { e.preventDefault(); vyber(m); }} onMouseEnter={() => setAktivni(i)}
              className={`cursor-pointer px-3 py-2 ${i === aktivni ? "bg-blue-50" : ""} ${m?.id === id ? "font-medium" : ""}`}>
              {m ? <><div>{m.nazev}</div>{m.popis && <div className="text-xs text-slate-500">{m.popis}</div>}</> : <div className="text-slate-500">{prazdna}</div>}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
