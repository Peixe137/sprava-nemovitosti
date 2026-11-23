"use client";
import { useEffect, useRef } from "react";
import { useSearchParams } from "next/navigation";

/** Pole rychlého hledání v postranním panelu. ⌘K / Ctrl+K nebo „/“ do něj skočí. */
export function Hledani() {
  const pole = useRef<HTMLInputElement>(null);
  const q = useSearchParams().get("q") ?? "";
  useEffect(() => {
    const klavesa = (e: KeyboardEvent) => {
      const vPoli = (e.target as HTMLElement)?.closest("input, textarea, select");
      if (((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") || (e.key === "/" && !vPoli)) {
        e.preventDefault(); pole.current?.focus(); pole.current?.select();
      }
    };
    window.addEventListener("keydown", klavesa);
    return () => window.removeEventListener("keydown", klavesa);
  }, []);
  return (
    <form action="/hledat" className="relative px-3 pb-3">
      <input ref={pole} name="q" type="search" defaultValue={q} key={q} placeholder="Hledat…" aria-label="Hledat v celé databázi"
        className="w-full rounded-lg border border-slate-200 bg-slate-50 py-2 pr-10 pl-3 text-sm placeholder:text-slate-400 focus:border-slate-400 focus:bg-white focus:outline-none" />
      <kbd className="pointer-events-none absolute top-2 right-5 rounded border border-slate-200 px-1 text-[10px] text-slate-400">⌘K</kbd>
    </form>
  );
}
