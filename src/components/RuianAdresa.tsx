"use client";
import { useEffect, useRef, useState, useTransition } from "react";
import { ruianHledat, ruianDetail } from "@/app/actions/ruian";
import type { NalezenaAdresa, DetailMista } from "@/lib/ruian";

// Našeptávač adresy z RÚIAN: po výběru vyplní pole stejného formuláře
// (ulice, cislo_popisne, obec, psc, katastralni_uzemi, parcelni_cislo) a skrytá pole se souřadnicemi a parcelou.
export function RuianAdresa() {
  const box = useRef<HTMLDivElement>(null);
  const [text, setText] = useState("");
  const [vysledky, setVysledky] = useState<NalezenaAdresa[]>([]);
  const [vybrano, setVybrano] = useState<DetailMista | null>(null);
  const [chyba, setChyba] = useState<string | null>(null);
  const [nacita, start] = useTransition();

  useEffect(() => {
    if (text.trim().length < 3 || vybrano?.adresa === text) { setVysledky([]); return; }
    const t = setTimeout(() => start(async () => setVysledky(await ruianHledat(text))), 350);
    return () => clearTimeout(t);
  }, [text, vybrano]);

  const vyber = (a: NalezenaAdresa) => {
    setVysledky([]); setText(a.adresa); setChyba(null);
    start(async () => {
      const r = await ruianDetail(a.x, a.y);
      if (!r.ok) { setChyba(r.chyba); return; }
      setVybrano(r.data);
      const form = box.current?.closest("form");
      if (!form) return;
      const nastav = (jmeno: string, hodnota: unknown) => {
        const el = form.elements.namedItem(jmeno) as HTMLInputElement | null;
        if (el && hodnota != null && hodnota !== "") el.value = String(hodnota);
      };
      const d = r.data;
      nastav("ulice", d.ulice);
      nastav("cislo_popisne", d.cislo_popisne);
      nastav("obec", d.obec);
      nastav("psc", d.psc);
      nastav("katastralni_uzemi", d.katastralni_uzemi);
      nastav("parcelni_cislo", d.parcela?.cislo);
      nastav("zem_sirka", d.zem_sirka); nastav("zem_delka", d.zem_delka);
      nastav("ruian_adresni_misto", d.ruian_adresni_misto); nastav("ku_kod", d.ku_kod);
      nastav("parcela_vymera", d.parcela?.vymera); nastav("parcela_druh", d.parcela?.druh); nastav("parcela_ruian", d.parcela?.ruian_kod);
    });
  };

  return (
    <div ref={box} className="relative">
      <span className="stitek">Vyhledat adresu v RÚIAN</span>
      <input value={text} onChange={(e) => { setText(e.target.value); setVybrano(null); }}
        placeholder="Začněte psát, např. Kubelíkova 733 Praha" className="pole" autoComplete="off" />
      {nacita && <span className="absolute top-8 right-3 text-xs text-slate-400">hledám…</span>}
      {vysledky.length > 0 && (
        <ul className="absolute z-10 mt-1 w-full overflow-hidden rounded-lg border border-slate-200 bg-white shadow-lg">
          {vysledky.map((a) => (
            <li key={`${a.x},${a.y}`}>
              <button type="button" onClick={() => vyber(a)} className="w-full px-3 py-2 text-left text-sm hover:bg-slate-50">{a.adresa}</button>
            </li>
          ))}
        </ul>
      )}
      {chyba && <p className="mt-1 text-xs text-red-700">{chyba}</p>}
      {vybrano && (
        <p className="mt-1 text-xs text-green-700">
          Doplněno z RÚIAN: k.ú. {vybrano.katastralni_uzemi ?? "?"}{vybrano.parcela ? `, parcela ${vybrano.parcela.cislo} (${vybrano.parcela.vymera ?? "?"} m², ${vybrano.parcela.druh ?? "druh neuveden"})` : ""}.
          Parcela a stavba se po uložení zapíšou do katastrální skladby nemovitosti.
        </p>
      )}
      {["zem_sirka", "zem_delka", "ruian_adresni_misto", "ku_kod", "parcela_vymera", "parcela_druh", "parcela_ruian"].map((n) => <input key={n} type="hidden" name={n} />)}
    </div>
  );
}
