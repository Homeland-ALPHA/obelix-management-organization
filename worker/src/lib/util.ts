export const nowISO = () => new Date().toISOString();

export const todayISO = () => new Date().toISOString().slice(0, 10);

/** ISO date `days` from today (UTC). */
export function addDaysISO(days: number, from?: string): string {
  const d = from ? new Date(`${from}T00:00:00Z`) : new Date();
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Last `n` month keys (YYYY-MM), oldest first, ending with the current month. */
export function lastMonths(n: number): string[] {
  const out: string[] = [];
  const d = new Date();
  let y = d.getUTCFullYear();
  let m = d.getUTCMonth();
  for (let i = 0; i < n; i++) {
    out.push(`${y}-${String(m + 1).padStart(2, "0")}`);
    m -= 1;
    if (m < 0) {
      m = 11;
      y -= 1;
    }
  }
  return out.reverse();
}

/** Mirror of Python float() coercion used across the financial code. */
export function f(v: unknown): number {
  const n = typeof v === "string" && v.trim() === "" ? NaN : Number(v);
  return Number.isFinite(n) ? n : 0;
}

export const round2 = (n: number) => Math.round(n * 100) / 100;

/** Thousands-separated, no decimals — Python's f"{x:,.0f}". */
export const money0 = (n: number) =>
  n.toLocaleString("en-US", { maximumFractionDigits: 0 });

function csvCell(v: unknown): string {
  const s = v === null || v === undefined ? "" : String(v);
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function csvResponse(headers: string[], rows: unknown[][], filename: string): Response {
  const lines = [headers, ...rows].map((r) => r.map(csvCell).join(","));
  return new Response(lines.join("\r\n") + "\r\n", {
    headers: {
      "Content-Type": "text/csv",
      "Content-Disposition": `attachment; filename="${filename}"`,
    },
  });
}
