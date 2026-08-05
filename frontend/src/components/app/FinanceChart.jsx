import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import dayjs from "dayjs";
import { useTheme } from "next-themes";
import { api } from "@/lib/api";
import { fmtMoney } from "@/lib/fmt";
import { cn } from "@/lib/utils";
import { Panel, PanelHead } from "./ui";

/* Palettes validated (dataviz six-checks) per theme surface — dark on #101010,
   light on #FFFFFF; each keeps CVD separation and ≥3:1 stroke contrast.
   "Expected" variants reuse the entity hue with a dashed stroke (secondary encoding). */
const PALETTES = {
  dark: {
    revenue: "#B58A38",
    expenses: "#C0565E",
    noi: "#4E8FC7",
    grid: "rgba(255,255,255,0.05)",
    tick: "#737373",
    cursor: "rgba(255,255,255,0.15)",
  },
  light: {
    revenue: "#8A671F",
    expenses: "#B23842",
    noi: "#2E6FA3",
    grid: "rgba(0,0,0,0.07)",
    tick: "#6E6A63",
    cursor: "rgba(0,0,0,0.25)",
  },
};

const SERIES = [
  { key: "actual_revenue", label: "Actual revenue", colorKey: "revenue" },
  { key: "expected_revenue", label: "Expected revenue", colorKey: "revenue", dashed: true },
  { key: "actual_expenses", label: "Actual expenses", colorKey: "expenses" },
  { key: "expected_expenses", label: "Expected expenses", colorKey: "expenses", dashed: true },
  { key: "noi", label: "NOI", colorKey: "noi" },
];

const RANGES = {
  Monthly: { granularity: "month", months: 12 },
  Annual: { granularity: "year" },
  "Five-year": { granularity: "month", months: 60 },
  "All-time": { granularity: "year" },
};

const fmtPeriod = (p, granularity) => (granularity === "year" ? p : dayjs(`${p}-01`).format("MMM YY"));

const ChartTooltip = ({ active, payload, label, granularity, palette }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line bg-surface px-3 py-2 shadow-pop">
      <p className="label-xs">{granularity === "year" ? label : dayjs(`${label}-01`).format("MMMM YYYY")}</p>
      <ul className="mt-1.5 space-y-1">
        {payload.map((p) => {
          const s = SERIES.find((x) => x.key === p.dataKey);
          return (
            <li key={p.dataKey} className="flex items-center gap-2 text-[11.5px] text-body">
              <span className="h-[3px] w-3" style={{ backgroundColor: s ? palette[s.colorKey] : undefined, opacity: s?.dashed ? 0.6 : 1 }} aria-hidden="true" />
              {s?.label}
              <span className="tnum ml-auto pl-4 font-medium text-strong">{fmtMoney(p.value)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export const FinanceChart = ({ buildingId }) => {
  const [range, setRange] = useState("Monthly");
  const [hidden, setHidden] = useState(new Set());
  const [table, setTable] = useState(false);
  const params = RANGES[range];
  const { resolvedTheme } = useTheme();
  const palette = PALETTES[resolvedTheme === "light" ? "light" : "dark"];

  const { data } = useQuery({
    queryKey: ["financials", "series", buildingId, range],
    queryFn: () => api.get("/financials/series", { params: { building_id: buildingId || "portfolio", ...params } }).then((r) => r.data),
  });

  const series = useMemo(() => data?.series || [], [data]);
  const active = SERIES.filter((s) => !hidden.has(s.key));
  const toggle = (key) =>
    setHidden((h) => {
      const n = new Set(h);
      if (n.has(key)) n.delete(key);
      else n.add(key);
      return n;
    });

  return (
    <Panel>
      <PanelHead
        title="Financial performance"
        meta={data?.has_data ? undefined : "no financial records yet"}
        right={
          <div className="flex items-center gap-1">
            {Object.keys(RANGES).map((r) => (
              <button
                key={r}
                type="button"
                onClick={() => setRange(r)}
                className={cn(
                  "px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors",
                  range === r ? "bg-gold/10 text-gold" : "text-dim hover:text-strong",
                )}
              >
                {r}
              </button>
            ))}
            <button type="button" onClick={() => setTable((v) => !v)} className="label-xs ml-2 text-dim transition-colors hover:text-gold">
              {table ? "Chart" : "Table"}
            </button>
          </div>
        }
      />
      <div className="flex flex-wrap items-center gap-3 border-b border-line/60 px-4 py-2">
        {SERIES.map((s) => (
          <button key={s.key} type="button" onClick={() => toggle(s.key)} className={cn("flex items-center gap-1.5", hidden.has(s.key) && "opacity-35")}>
            <span className="h-[3px] w-4" style={{ backgroundColor: palette[s.colorKey], opacity: s.dashed ? 0.55 : 1, backgroundImage: s.dashed ? `repeating-linear-gradient(90deg, ${palette[s.colorKey]} 0 4px, transparent 4px 7px)` : undefined }} aria-hidden="true" />
            <span className="label-xs text-mid">{s.label}</span>
          </button>
        ))}
      </div>

      {!data?.has_data ? (
        <p className="px-4 py-10 text-center text-[12px] text-dim">
          No revenue or expense records yet — add them under Financials, or enter the rent roll to set expected revenue.
        </p>
      ) : table ? (
        <div className="overflow-x-auto px-4 py-3">
          <table className="w-full min-w-[560px] text-left">
            <thead>
              <tr className="border-b border-line">
                <th className="label-xs py-1.5 font-normal">Period</th>
                {active.map((s) => (
                  <th key={s.key} className="label-xs py-1.5 text-right font-normal">{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {series.map((row) => (
                <tr key={row.period} className="border-b border-line/50 last:border-0">
                  <td className="py-1.5 text-[12px] text-mid">{fmtPeriod(row.period, params.granularity)}</td>
                  {active.map((s) => (
                    <td key={s.key} className="tnum py-1.5 text-right text-[12px] text-body">{fmtMoney(row[s.key])}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="px-2 pb-3 pt-4">
          <ResponsiveContainer width="100%" height={260}>
            <LineChart data={series} margin={{ top: 6, right: 16, bottom: 0, left: 4 }}>
              <CartesianGrid vertical={false} stroke={palette.grid} />
              <XAxis dataKey="period" tickFormatter={(p) => fmtPeriod(p, params.granularity)} tick={{ fill: palette.tick, fontSize: 10 }} axisLine={false} tickLine={false} interval="preserveStartEnd" />
              <YAxis tickFormatter={(v) => fmtMoney(v)} tick={{ fill: palette.tick, fontSize: 10 }} axisLine={false} tickLine={false} width={54} />
              <Tooltip content={<ChartTooltip granularity={params.granularity} palette={palette} />} cursor={{ stroke: palette.cursor }} />
              {active.map((s) => (
                <Line
                  key={s.key}
                  type="monotone"
                  dataKey={s.key}
                  stroke={palette[s.colorKey]}
                  strokeWidth={2}
                  strokeDasharray={s.dashed ? "5 4" : undefined}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </Panel>
  );
};
