import { korun } from "@/lib/format";

/** Částka v účetním formátu; záporná červeně s minusem. */
export function Castka({ v }: { v: number | string | null | undefined }) {
  const n = v == null || v === "" ? null : Number(v);
  return <span className={n != null && n < 0 ? "minus whitespace-nowrap" : "whitespace-nowrap"}>{korun(v)}</span>;
}
