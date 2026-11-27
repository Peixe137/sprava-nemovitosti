const kc = new Intl.NumberFormat("cs-CZ", { style: "currency", currency: "CZK", maximumFractionDigits: 0 });
export const korun = (v: number | string | null | undefined) => (v == null || v === "" ? "–" : kc.format(Number(v)));
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
