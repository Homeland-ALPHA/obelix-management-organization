import dayjs from "dayjs";

export const fmtDate = (iso, f = "MMM D, YYYY") => (iso ? dayjs(iso).format(f) : "—");

export const fmtDateTime = (iso) => (iso ? dayjs(iso).format("MMM D · h:mm A") : "—");

export const fmtInt = (n) => (n === null || n === undefined ? "—" : Number(n).toLocaleString("en-US"));

export const fmtMoney = (n) => {
  if (!n && n !== 0) return "—";
  const v = Number(n);
  if (Math.abs(v) >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
  if (Math.abs(v) >= 10_000) return `$${Math.round(v / 1_000)}K`;
  return `$${Math.round(v).toLocaleString("en-US")}`;
};
