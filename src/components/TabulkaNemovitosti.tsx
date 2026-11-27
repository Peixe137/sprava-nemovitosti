"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Castka } from "@/components/Castka";

export type RadekNem = {
  id: string; nadrazena_id: string | null; typ_kod: string; nazev: string; adresa: string; mapa: string | null; lv: string | null;
  vlastnik: string; stav: string; volne: boolean; upozorneni: string | null; porizovaci: number | null; trzni: number | null; disk: string | null; jednotka: boolean;
};

/** Seznam nemovitostí se zaškrtáváním – součty pořizovací ceny a tržní hodnoty jen za zaškrtnuté. */
export function TabulkaNemovitosti({ radky, archiv }: { radky: RadekNem[]; archiv: boolean }) {
  const [vybrane, setVybrane] = useState<Set<string>>(() => new Set(radky.map((r) => r.id)));
  const koreny = radky.filter((r) => !r.nadrazena_id || !radky.some((y) => y.id === r.nadrazena_id));
  const deti = (id: string) => radky.filter((r) => r.nadrazena_id === id);
  const prepnout = (r: RadekNem) => setVybrane((v) => {
    const n = new Set(v); const ids = [r.id, ...deti(r.id).map((d) => d.id)];
    const zap = !v.has(r.id); ids.forEach((i) => (zap ? n.add(i) : n.delete(i))); return n;
  });
  const vse = vybrane.size === radky.length;
  const souhrn = useMemo(() => {
    const vyb = radky.filter((r) => vybrane.has(r.id));
    return {
      nemovitosti: vyb.filter((r) => !r.jednotka).length, jednotek: vyb.filter((r) => r.jednotka).length,
      porizovaci: vyb.reduce((a, r) => a + (r.porizovaci ?? 0), 0), trzni: vyb.reduce((a, r) => a + (r.trzni ?? 0), 0),
    };
  }, [radky, vybrane]);

  const radek = (x: RadekNem, odsazeni: boolean) => (
    <tr key={x.id} className={vybrane.has(x.id) ? "" : "opacity-50"}>
      <td className="w-6"><input type="checkbox" checked={vybrane.has(x.id)} onChange={() => prepnout(x)} aria-label="Započítat do součtu" /></td>
      <td className={odsazeni ? "pl-8" : ""}>
        <span className="mr-2 inline-block w-6 rounded bg-slate-100 text-center text-xs font-semibold">{x.typ_kod}</span>
        <Link href={`/nemovitosti/${x.id}`} className="odkaz">{x.nazev}</Link>
      </td>
      <td>{x.adresa ? <a href={x.mapa!} target="_blank" rel="noopener" className="hover:underline" title="Otevřít na Mapy.cz">{x.adresa} <span className="text-blue-700">↗</span></a> : "–"}</td>
      <td className="whitespace-nowrap">{x.lv ? "LV " + x.lv : "–"}</td>
      <td>{x.vlastnik || "–"}</td>
      <td><span className={x.volne ? "text-blue-700" : archiv ? "text-slate-500" : ""}>{x.stav}{x.upozorneni && <span title={x.upozorneni} className="ml-1 text-amber-600">⚠</span>}</span></td>
      <td className="text-right">{x.porizovaci != null ? <Castka v={x.porizovaci} /> : ""}</td>
      <td className="text-right">{x.trzni != null ? <Castka v={x.trzni} /> : ""}</td>
      <td className="text-right">{x.disk && <a href={x.disk} target="_blank" rel="noopener" className="tlacitko-svetle px-2 py-1 text-xs">Disk ↗</a>}</td>
    </tr>
  );

  return (
    <table className="tabulka">
      <thead><tr>
        <th className="w-6"><input type="checkbox" checked={vse} onChange={() => setVybrane(vse ? new Set() : new Set(radky.map((r) => r.id)))} aria-label="Vybrat vše" /></th>
        <th>Název <span className="font-normal normal-case text-slate-400">({souhrn.nemovitosti} nem., {souhrn.jednotek} jedn.)</span></th>
        <th>Adresa</th><th>LV</th><th>Vlastník</th><th>Stav</th>
        <th className="text-right">Pořizovací cena</th><th className="text-right">Tržní hodnota</th><th></th>
      </tr></thead>
      <tbody>{koreny.flatMap((k) => [radek(k, false), ...deti(k.id).map((d) => radek(d, true))])}</tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-300 font-semibold">
          <td></td>
          <td colSpan={5}>Celkem {vse ? "" : "za zaškrtnuté "}– {souhrn.nemovitosti} nemovitostí, {souhrn.jednotek} jednotek</td>
          <td className="text-right"><Castka v={souhrn.porizovaci} /></td>
          <td className="text-right"><Castka v={souhrn.trzni} /></td>
          <td className="text-right text-xs font-normal">{souhrn.trzni && souhrn.porizovaci ? <span className={souhrn.trzni >= souhrn.porizovaci ? "plus" : "minus"}>{souhrn.trzni >= souhrn.porizovaci ? "+" : ""}{Math.round(((souhrn.trzni - souhrn.porizovaci) / souhrn.porizovaci) * 100)} %</span> : ""}</td>
        </tr>
      </tfoot>
    </table>
  );
}
