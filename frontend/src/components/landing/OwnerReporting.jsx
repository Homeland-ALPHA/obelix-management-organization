import { useState } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { OWNER_KPIS, OWNER_CHART, APPROVALS } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal, StatusBadge } from "./primitives";
import { cn } from "@/lib/utils";

const ChartTip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="border border-line bg-ink px-3 py-2 text-[11px] shadow-lg">
      <div className="label-xs">{label} 2025</div>
      <div className="mt-1.5 tnum text-neutral-200">NOI ${payload[0].value},300</div>
      <div className="tnum text-neutral-400">Collections ${payload[1]?.value},600</div>
    </div>
  );
};

const KpiGrid = ({ items }) => (
  <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4" data-testid="owner-kpi-grid">
    {items.map((k) => (
      <div key={k.label} className="bg-surface px-4 py-3.5">
        <div className="label-xs">{k.label}</div>
        <div
          className={cn(
            "mt-1.5 tnum text-lg sm:text-xl font-semibold tracking-tight",
            k.tone === "alert" ? "text-red-400" : k.tone === "ok" ? "text-emerald-400" : "text-white",
          )}
        >
          {k.value}
        </div>
      </div>
    ))}
  </div>
);

const PerformanceChart = () => (
  <div className="h-[220px] w-full" data-testid="owner-chart">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={OWNER_CHART} margin={{ top: 6, right: 4, left: -22, bottom: 0 }}>
        <defs>
          <linearGradient id="noiFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#C7A36B" stopOpacity={0.35} />
            <stop offset="100%" stopColor="#C7A36B" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke="#2A2A2A" vertical={false} />
        <XAxis
          dataKey="month"
          stroke="#525252"
          tick={{ fontSize: 10 }}
          tickLine={false}
          axisLine={{ stroke: "#2A2A2A" }}
        />
        <YAxis stroke="#525252" tick={{ fontSize: 10 }} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTip />} cursor={{ stroke: "#C7A36B", strokeOpacity: 0.3 }} />
        <Area type="monotone" dataKey="noi" stroke="#C7A36B" strokeWidth={1.5} fill="url(#noiFill)" />
        <Area
          type="monotone"
          dataKey="collections"
          stroke="#525252"
          strokeWidth={1}
          strokeDasharray="3 3"
          fill="none"
        />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

const ApprovalCard = ({ item }) => {
  const [status, setStatus] = useState("Awaiting Approval");

  const actions = [
    { id: "approve", label: "Approve", next: "Approved" },
    { id: "quote", label: "Request Another Quote", next: "Quote Requested" },
    { id: "decline", label: "Decline", next: "Declined" },
  ];

  return (
    <li
      data-testid={`approval-${item.id}`}
      className="border border-line bg-[#101010] p-4 transition-colors hover:border-neutral-700"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[13px] text-neutral-100">{item.title}</p>
          <p className="mt-1 text-[11px] text-neutral-500">
            {item.property} · {item.vendor}
          </p>
        </div>
        <span className="tnum shrink-0 text-[13px] font-semibold text-gold">{item.amount}</span>
      </div>

      <div className="mt-3.5 flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={status} data-testid={`approval-status-${item.id}`} />
        <div className="flex flex-wrap justify-end gap-1.5">
          {actions.map((a) => (
            <button
              key={a.id}
              type="button"
              data-testid={`approval-${a.id}-${item.id}`}
              onClick={() => setStatus(a.next)}
              disabled={status === a.next}
              aria-label={`${a.label} — ${item.title}`}
              className={cn(
                "border px-2.5 py-1.5 text-[11px] font-medium transition-colors duration-200 disabled:cursor-default disabled:opacity-45",
                a.id === "approve"
                  ? "border-emerald-500/40 text-emerald-400 hover:enabled:bg-emerald-500/10"
                  : a.id === "decline"
                    ? "border-line text-neutral-400 hover:enabled:border-neutral-600 hover:enabled:text-neutral-200"
                    : "border-gold/40 text-gold hover:enabled:bg-gold/10",
              )}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>
    </li>
  );
};

export const Financials = () => (
  <Section id="financials" label="Financial performance" className="border-t border-line">
    <Reveal>
      <Eyebrow>Financial performance</Eyebrow>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <H2 className="max-w-2xl">Collections, arrears and NOI—per building.</H2>
        <Lede className="max-w-md">
          Rent roll, vendor spend and operating expenses reconcile to the same building record your
          compliance and maintenance work lives on.
        </Lede>
      </div>
    </Reveal>

    <Reveal delay={0.06}>
      <div className="mt-10 border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <span className="label-xs text-neutral-400">Portfolio financials · July 2025 · 12 buildings</span>
          <span className="label-xs">Bronx / Manhattan / Queens</span>
        </div>
        <KpiGrid items={OWNER_KPIS.slice(0, 4)} />
        <div className="grid grid-cols-1 gap-px border-t border-line bg-line lg:grid-cols-[1.2fr_1fr]">
          <div className="bg-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-white">Portfolio performance</h3>
              <span className="label-xs">NOI · thousands</span>
            </div>
            <div className="mt-4">
              <PerformanceChart />
            </div>
          </div>
          <div className="bg-surface p-5">
            <div className="label-xs">Arrears aging</div>
            <ul className="mt-4 divide-y divide-line/70">
              {[
                ["Current", "$266,180", "93.5%"],
                ["1 – 30 days", "$9,240", "3.2%"],
                ["31 – 60 days", "$5,110", "1.8%"],
                ["61 – 90 days", "$2,420", "0.9%"],
                ["90+ days — housing court", "$1,650", "0.6%"],
              ].map(([bucket, amount, share]) => (
                <li key={bucket} className="flex items-center justify-between py-2.5">
                  <span className="text-[12px] text-neutral-300">{bucket}</span>
                  <span className="flex items-baseline gap-3">
                    <span className="tnum text-[13px] text-neutral-100">{amount}</span>
                    <span className="tnum w-11 text-right text-[11px] text-neutral-500">{share}</span>
                  </span>
                </li>
              ))}
            </ul>
            <div className="mt-5 border border-line bg-[#101010] px-3.5 py-3">
              <div className="label-xs">Building-level NOI leader</div>
              <p className="mt-1.5 text-[13px] text-neutral-100">
                1284 Grand Concourse · <span className="tnum text-gold">$41,900</span> monthly NOI
              </p>
            </div>
          </div>
        </div>
      </div>
    </Reveal>
  </Section>
);

export const OwnerReporting = () => (
  <Section id="owners" label="Owner reporting" className="border-t border-line">
    <Reveal>
      <Eyebrow>Owner reporting</Eyebrow>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <H2 className="max-w-2xl">Give owners answers—not operational noise.</H2>
        <Lede className="max-w-md">
          One monthly view of occupancy, collections, arrears and NOI, with the approvals that are
          waiting on a decision.
        </Lede>
      </div>
    </Reveal>

    <Reveal delay={0.06}>
      <div className="mt-10 border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3 sm:px-5">
          <span className="label-xs text-neutral-400">Owner dashboard · July 2025 · 12 buildings</span>
          <span className="label-xs">Bronx / Manhattan / Queens</span>
        </div>

        <KpiGrid items={OWNER_KPIS} />

        <div className="grid grid-cols-1 gap-px border-t border-line bg-line lg:grid-cols-[1.1fr_1fr]">
          <div className="bg-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-white">Portfolio performance</h3>
              <span className="label-xs">NOI · thousands</span>
            </div>
            <div className="mt-4">
              <PerformanceChart />
            </div>
          </div>

          <div className="bg-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-white">Approval requests</h3>
              <span className="label-xs">3 waiting</span>
            </div>
            <ul className="mt-4 space-y-2.5">
              {APPROVALS.map((a) => (
                <ApprovalCard key={a.id} item={a} />
              ))}
            </ul>
          </div>
        </div>
      </div>
    </Reveal>
  </Section>
);
