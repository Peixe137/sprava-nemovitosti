const kc = new Intl.NumberFormat("cs-CZ", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
/** Účetní formát: 1 000 000,15 Kč, záporné s minusem (-1 000,00 Kč). Mezery jsou nezlomitelné. */
export const korun = (v: number | string | null | undefined) => {
  if (v == null || v === "") return "–";
  const n = Math.round(Number(v) * 100) / 100;
  if (!Number.isFinite(n)) return "–";
  return `${n < 0 ? "-" : ""}${kc.format(Math.abs(n)).replace(/\s/g, "\u00a0")}\u00a0Kč`;
};
export const datum = (v: string | null | undefined) =>
  v ? new Date(v + (v.length === 10 ? "T00:00:00" : "")).toLocaleDateString("cs-CZ") : "–";
export const mesic = (v: string | null | undefined) =>
  v ? new Date(v + "T00:00:00").toLocaleDateString("cs-CZ", { month: "long", year: "numeric" }) : "–";

/** Fáze nemovitosti v portfoliu. Prodej / konec správy = archivace. Vlastní × ve správě plyne z vlastníka. */
export const STAVY_NEMOVITOSTI: Record<string, string> = {
  v_nakupu: "Nákup (v přípravě)", drzeni: "Držení", flip: "Flip (koupeno k prodeji)", v_prodeji: "V prodeji",
};
/** Jak se nemovitost využívá. Pronajato / volné se počítá ze smluv, nevyplňuje se. */
export const VYUZITI: Record<string, string> = {
  pronajem: "K pronájmu", kratkodoby: "Krátkodobý pronájem (Airbnb…)", vlastni: "Vlastní užívání", rekonstrukce: "Rekonstrukce", bez_vyuziti: "Bez využití",
};
export const PERIODY: Record<string, string> = {
  mesicne: "měsíčně", ctvrtletne: "čtvrtletně", pololetne: "pololetně", rocne: "ročně",
};
export const DRUHY_VLASTNIKA: Record<string, string> = {
  vlastni_firma: "Moje firma", vlastni_osoba: "Já osobně", klient_sprava: "Klient ve správě",
};
export const DRUHY_PREDPISU: Record<string, string> = {
  najem: "Nájem", zaloha_voda: "Záloha voda", zaloha_teplo: "Záloha teplo", zaloha_tuv: "Záloha TUV",
  zaloha_elektrina: "Záloha elektřina", zaloha_plyn: "Záloha plyn", zaloha_sluzby: "Záloha služby",
  parkovani: "Parkování", fond_oprav_prefakturace: "Fond oprav", jine: "Jiné",
};
export const STAVY_POHLEDAVKY: Record<string, string> = {
  otevrena: "Nezaplaceno", castecne: "Částečně", uhrazena: "Zaplaceno", prominuta: "Prominuto", preplatek: "Přeplatek",
};

export const KATEGORIE_NAKLADU: Record<string, string> = {
  oprava: "Opravy", udrzba: "Údržba", pojisteni: "Pojištění", dan_z_nemovitosti: "Daň z nemovitosti",
  fond_oprav: "Fond oprav", sprava_svj: "Správa SVJ", energie: "Energie", voda: "Voda", odpad: "Odpad",
  uver_uroky: "Úroky z úvěru", odmena_sprava: "Odměna za správu", pravni_ucetni: "Právní a účetní služby",
  revize: "Revize", technicke_zhodnoceni: "Technické zhodnocení (investice)", porizeni: "Pořízení", ostatni: "Ostatní",
};
export const MESICE = ["Led", "Úno", "Bře", "Dub", "Kvě", "Čvn", "Čvc", "Srp", "Zář", "Říj", "Lis", "Pro"];
export const dnesIso = () => new Date().toISOString().slice(0, 10);
export const zaDni = (n: number) => new Date(Date.now() + n * 86400000).toISOString().slice(0, 10);

export const DUVODY_ARCHIVACE: Record<string, string> = {
  prodano: "Prodáno", konec_spravy: "Ukončena správa (odešel klient)", zbourano: "Zbouráno / zaniklo", jine: "Jiný důvod",
};

export const PLATFORMY: Record<string, { text: string; barva: string; svetla: string }> = {
  airbnb: { text: "Airbnb", barva: "bg-rose-500", svetla: "bg-rose-50 text-rose-700" },
  booking: { text: "Booking", barva: "bg-blue-600", svetla: "bg-blue-50 text-blue-700" },
  primo: { text: "Přímo", barva: "bg-emerald-500", svetla: "bg-emerald-50 text-emerald-700" },
  jine: { text: "Jiné", barva: "bg-violet-500", svetla: "bg-violet-50 text-violet-700" },
};

/** Výchozí nabídka štítků v adresáři; další si uživatel dopisuje (nájemníci a vlastníci se poznají z vazeb). */
export const STITKY_OSOB = ["Řemeslník", "Dodavatel energií", "Dodavatel služeb", "Právník / advokát", "Účetní", "Úřad", "Banka", "Pojišťovna", "Realitní", "Ostatní"];
/** Štítky, podle kterých je kontakt dodavatelem (nabízí se u nákladů). */
export const STITKY_DODAVATELE = ["Řemeslník", "Dodavatel energií", "Dodavatel služeb"];

/** Omezení vlastnického práva zapsaná na listu vlastnictví. */
export const OMEZENI: Record<string, string> = {
  zastava: "Zástavní právo", exekuce: "Exekuce", vecne_bremeno: "Věcné břemeno",
  predkupni_pravo: "Předkupní právo", zakaz_zcizeni: "Zákaz zcizení / zatížení", jine: "Jiné omezení",
};

/** Úkoly a termíny */
export const DRUHY_TERMINU: Record<string, string> = {
  ukol: "Úkol", revize: "Revize", pojisteni: "Pojištění", dan_z_nemovitosti: "Daň z nemovitosti", valorizace: "Valorizace nájmu",
  vyuctovani: "Vyúčtování", cejch_meridla: "Cejch měřidla", konec_smlouvy: "Konec smlouvy", jiny: "Jiný termín",
};
export const PRIORITY: Record<string, { text: string; tecka: string; radek: string; stitek: string }> = {
  urgentni: { text: "Urgentní", tecka: "bg-red-500", radek: "border-l-4 border-l-red-500", stitek: "bg-red-100 text-red-800" },
  dulezite: { text: "Důležité", tecka: "bg-emerald-500", radek: "border-l-4 border-l-emerald-500", stitek: "bg-emerald-100 text-emerald-800" },
  nedulezite: { text: "Nedůležité", tecka: "bg-slate-300", radek: "border-l-4 border-l-slate-300", stitek: "bg-slate-100 text-slate-600" },
};
export const OPAKOVANI: Record<string, string> = { zadne: "Neopakuje se", mesicne: "Každý měsíc", rocne: "Každý rok", dvouletne: "Každé 2 roky", petilete: "Každých 5 let" };

/** Služby k přeúčtování (u nákladu) a jejich řádky ve vyúčtování. */
export const SLUZBY: Record<string, string> = {
  voda: "Voda (vodné a stočné)", tuv: "Teplá voda", teplo: "Teplo (vytápění)", elektrina: "Elektřina (podružné elektroměry)", plyn: "Plyn",
  elektrina_spol: "Elektřina společných prostor", vytah: "Výtah", uklid: "Úklid", osvetleni: "Osvětlení", odpad: "Odpad", ostatni: "Ostatní služby",
};

/** Energie a měřidla */
export const KOMODITY: Record<string, string> = { elektrina: "Elektřina", plyn: "Plyn", voda: "Voda", teplo: "Teplo" };
export const DRUHY_MERIDEL: Record<string, string> = {
  voda_studena: "Vodoměr – studená", voda_tepla: "Vodoměr – teplá", elektrina: "Elektroměr", plyn: "Plynoměr", teplo: "Měřič tepla", rtn: "Rozúčtovač topení",
};
export const JEDNOTKY_MERIDEL: Record<string, string> = { voda_studena: "m³", voda_tepla: "m³", elektrina: "kWh", plyn: "m³", teplo: "GJ", rtn: "dílky" };
export const UCEL_MERIDLA: Record<string, string> = { jednotka: "Jednotka", hlavni: "Hlavní (patní) měřidlo budovy", spolecne: "Společné prostory" };
export const DRUHY_ODECTU: Record<string, string> = { pocatecni: "Počáteční (převzetí)", pravidelny: "Pravidelný", konecny: "Konečný (předání)", vymena: "Výměna měřidla" };
/** Která měřidla patří ke službě ve vyúčtování (rozúčtování podle spotřeby). */
export const MERIDLA_SLUZBY: Record<string, string[]> = {
  voda: ["voda_studena", "voda_tepla"], tuv: ["voda_tepla"], teplo: ["teplo", "rtn"], elektrina: ["elektrina"], plyn: ["plyn"],
};
export const cislo = (v: number | string | null | undefined, des = 3) =>
  v == null || v === "" ? "–" : Number(v).toLocaleString("cs-CZ", { maximumFractionDigits: des });
