/**
 * Čtení bankovních výpisů ze souboru – bez napojení na banku.
 *  - GPC / ABO („kompatibilní média“): český standard, umí ho ČSOB, KB, ČS, RB, Fio, UniCredit, Moneta…
 *  - SEPA XML camt.053: XML výpis podle ISO 20022 (ČSOB „SEPA XML“, ČS, RB, Fio…)
 * Výsledek je jednotný seznam pohybů; párování podle VS dělá databáze (sparovat_pohyb).
 */

export type Pohyb = {
  id: string;              // stabilní id pohybu – při opakovaném nahrání stejného výpisu se nic nezdvojí
  datum: string;           // YYYY-MM-DD
  castka: number;          // + příjem, − výdaj
  mena: string;
  vs: string | null; ks: string | null; ss: string | null;
  protiucet: string | null; protiucet_banka: string | null; protiucet_nazev: string | null;
  zprava: string | null;
  typ: string;
};
export type Vypis = { format: "GPC" | "camt.053"; ucet: string | null; kodBanky: string | null; od: string | null; do: string | null; pohyby: Pohyb[] };

/** Text souboru: UTF-8, jinak Windows-1250 (běžné u GPC z českých bank). */
export function dekodovat(buf: ArrayBuffer): string {
  try { return new TextDecoder("utf-8", { fatal: true }).decode(buf); }
  catch { return new TextDecoder("windows-1250").decode(buf); }
}

const bezNul = (s: string) => s.replace(/^0+/, "");
const prazdne = (s: string | null | undefined) => { const v = (s ?? "").trim(); return v === "" ? null : v; };
const symbol = (s: string) => prazdne(bezNul(s.trim()));
const ddmmrr = (s: string) => /^\d{6}$/.test(s) && s !== "000000" ? `20${s.slice(4, 6)}-${s.slice(2, 4)}-${s.slice(0, 2)}` : null;
/** číslo účtu 16 znaků → „předčíslí-číslo“ bez úvodních nul */
const ucetZ16 = (s: string) => {
  const d = s.replace(/\D/g, "").padStart(16, "0");
  const pred = bezNul(d.slice(0, 6)), cislo = bezNul(d.slice(6));
  return cislo ? (pred ? `${pred}-${cislo}` : cislo) : null;
};

export function nactiVypis(text: string, nazevSouboru = ""): Vypis {
  const t = text.replace(/^﻿/, "");
  if (/<Document[\s>]/.test(t) && /camt\.05[23]/.test(t)) return nactiCamt(t);
  if (/^07[45]/m.test(t)) return nactiGpc(t);
  throw new Error(`Soubor ${nazevSouboru || ""} není výpis ve formátu GPC (ABO) ani SEPA XML (camt.053).`.replace("  ", " "));
}

/* ---------- GPC / ABO ---------- */
export function nactiGpc(text: string): Vypis {
  const radky = text.split(/\r?\n/).filter((r) => r.trim());
  let ucet: string | null = null, od: string | null = null, doo: string | null = null;
  const pohyby: Pohyb[] = [];
  const vyskyt = new Map<string, number>();
  for (const r0 of radky) {
    const r = r0.padEnd(128, " ");
    const typ = r.slice(0, 3);
    if (typ === "074") {
      ucet = ucet ?? ucetZ16(r.slice(3, 19));
      const d1 = ddmmrr(r.slice(39, 45)), d2 = ddmmrr(r.slice(108, 114));
      if (d1 && (!od || d1 < od)) od = d1;
      if (d2 && (!doo || d2 > doo)) doo = d2;
    } else if (typ === "075") {
      const kod = r.slice(60, 61);
      const halere = Number(r.slice(48, 60).replace(/\D/g, "") || 0);
      const znamenko = kod === "1" || kod === "5" ? -1 : 1; // 1 debet, 2 kredit, 4 storno debetu, 5 storno kreditu
      const ksPole = r.slice(71, 81).replace(/\D/g, "").padStart(10, "0"); // 00BBBBKSYM
      const datum = ddmmrr(r.slice(122, 128)) ?? ddmmrr(r.slice(91, 97)) ?? doo ?? new Date().toISOString().slice(0, 10);
      const zaklad = [r.slice(3, 19), r.slice(19, 35), r.slice(35, 48), r.slice(48, 61), r.slice(61, 71), datum].join("|");
      const n = (vyskyt.get(zaklad) ?? 0) + 1; vyskyt.set(zaklad, n);
      pohyby.push({
        id: `gpc:${zaklad}|${n}`,
        datum, castka: (znamenko * halere) / 100, mena: r.slice(118, 122) === "0203" || r.slice(118, 122).trim() === "" ? "CZK" : `kód ${r.slice(118, 122)}`,
        vs: symbol(r.slice(61, 71)), ks: symbol(ksPole.slice(6, 10)), ss: symbol(r.slice(81, 91)),
        protiucet: ucetZ16(r.slice(19, 35)), protiucet_banka: prazdne(bezNul(ksPole.slice(2, 6)) ? ksPole.slice(2, 6) : ""),
        protiucet_nazev: prazdne(r.slice(97, 117)), zprava: null,
        typ: kod === "4" || kod === "5" ? "storno" : znamenko > 0 ? "příjem" : "výdaj",
      });
    } else if ((typ === "078" || typ === "079") && pohyby.length) {
      // doplňující text k předchozí položce (zpráva pro příjemce, avízo)
      const p = pohyby[pohyby.length - 1];
      const txt = r.slice(3).trim();
      if (txt) p.zprava = p.zprava ? `${p.zprava} ${txt}` : txt;
    }
  }
  return { format: "GPC", ucet, kodBanky: null, od, do: doo, pohyby };
}

/* ---------- SEPA XML camt.053 ---------- */
const tag = (xml: string, cesta: string): string | null => {
  let x: string | null = xml;
  for (const t of cesta.split("/")) {
    if (x == null) return null;
    const m: RegExpMatchArray | null = x.match(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`));
    x = m ? m[1] : null;
  }
  return x == null ? null : x.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim()
    .replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&apos;/g, "'");
};
const bloky = (xml: string, t: string) => [...xml.matchAll(new RegExp(`<(?:\\w+:)?${t}(?:\\s[^>]*)?>([\\s\\S]*?)</(?:\\w+:)?${t}>`, "g"))].map((m) => m[1]);
const ibanNaUcet = (iban: string | null) => {
  const i = (iban ?? "").replace(/\s/g, "");
  if (!/^CZ\d{22}$/.test(i)) return { ucet: i || null, banka: null };
  return { ucet: ucetZ16(i.slice(8)), banka: i.slice(4, 8) };
};
const najdiSymbol = (text: string, zkratka: string) => {
  const m = text.match(new RegExp(`(?:^|[^A-Z])${zkratka}[:/ ]?\\s*(\\d{1,10})`, "i"));
  return m ? bezNul(m[1]) || null : null;
};

export function nactiCamt(xml: string): Vypis {
  const stmt = bloky(xml, "Stmt")[0] ?? xml;
  const vlastni = ibanNaUcet(tag(stmt, "Acct/Id/IBAN"));
  const pohyby: Pohyb[] = [];
  const vyskyt = new Map<string, number>();
  for (const e of bloky(stmt, "Ntry")) {
    const prijem = tag(e, "CdtDbtInd") === "CRDT";
    const castka = Number(tag(e, "Amt") ?? 0);
    const mena = e.match(/<(?:\w+:)?Amt[^>]*Ccy="([A-Z]{3})"/)?.[1] ?? "CZK";
    const datum = (tag(e, "BookgDt/Dt") ?? tag(e, "BookgDt/DtTm") ?? tag(e, "ValDt/Dt") ?? "").slice(0, 10);
    const tx = bloky(e, "TxDtls")[0] ?? e;
    const strana = prijem ? "Dbtr" : "Cdtr";
    const proti = ibanNaUcet(tag(tx, `RltdPties/${strana}Acct/Id/IBAN`));
    const jinyUcet = tag(tx, `RltdPties/${strana}Acct/Id/Othr/Id`);
    const ustrd = bloky(tx, "Ustrd").map((u) => u.trim()).join(" ") || null;
    const ref = tag(tx, "Refs/EndToEndId");
    const strd = tag(tx, "RmtInf/Strd/CdtrRefInf/Ref");
    const hledat = [strd, ref, ustrd].filter(Boolean).join(" ");
    const vs = najdiSymbol(hledat, "VS") ?? (strd && /^\d{1,10}$/.test(strd) ? bezNul(strd) : null)
      ?? (ref && /^\d{1,10}$/.test(ref) ? bezNul(ref) : null);
    const bankRef = tag(e, "AcctSvcrRef") ?? tag(tx, "Refs/AcctSvcrRef");
    const zaklad = bankRef ? `ref:${bankRef}` : [datum, castka, prijem, vs, proti.ucet].join("|");
    const n = (vyskyt.get(zaklad) ?? 0) + 1; vyskyt.set(zaklad, n);
    pohyby.push({
      id: `camt:${zaklad}${bankRef ? "" : `|${n}`}`,
      datum, castka: prijem ? castka : -castka, mena,
      vs, ks: najdiSymbol(hledat, "KS"), ss: najdiSymbol(hledat, "SS"),
      protiucet: proti.ucet ?? jinyUcet, protiucet_banka: proti.banka,
      protiucet_nazev: tag(tx, `RltdPties/${strana}/Nm`) ?? tag(tx, `RltdPties/${strana}/Pty/Nm`),
      zprava: ustrd, typ: tag(e, "RvslInd") === "true" ? "storno" : prijem ? "příjem" : "výdaj",
    });
  }
  const datumy = pohyby.map((p) => p.datum).filter(Boolean).sort();
  return {
    format: "camt.053", ucet: vlastni.ucet, kodBanky: vlastni.banka,
    od: (tag(stmt, "FrToDt/FrDtTm") ?? datumy[0] ?? "").slice(0, 10) || null,
    do: (tag(stmt, "FrToDt/ToDtTm") ?? datumy[datumy.length - 1] ?? "").slice(0, 10) || null,
    pohyby,
  };
}

/** Porovnání čísel účtů bez ohledu na pomlčku a úvodní nuly. */
export const stejnyUcet = (a: string | null | undefined, b: string | null | undefined) => {
  const k = (s: string) => { const [p, c] = s.includes("-") ? s.split("-") : ["", s]; return `${bezNul(p)}-${bezNul(c.replace(/\/.*/, ""))}`; };
  return !!a && !!b && k(a.replace(/\s/g, "")) === k(b.replace(/\s/g, ""));
};

export const BANKY: Record<string, string> = {
  "0300": "ČSOB", "5500": "Raiffeisenbank", "0800": "Česká spořitelna", "2010": "Fio banka", "0100": "Komerční banka",
  "2700": "UniCredit", "0600": "MONETA", "3030": "Air Bank", "6210": "mBank",
};
