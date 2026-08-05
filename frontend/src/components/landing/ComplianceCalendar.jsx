import { useState } from "react";
import { Info } from "lucide-react";
import { DEADLINES } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal } from "./primitives";
import { cn } from "@/lib/utils";

const NOTIFY = [
  { id: "d90", label: "90 days before", on: true },
  { id: "d30", label: "30 days before", on: true },
  { id: "d7", label: "7 days before", on: true },
  { id: "d0", label: "Due today", on: true },
];

const TONE = {
  alert: "bg-red-500",
  gold: "bg-gold",
  neutral: "bg-neutral-500",
};

const CalendarGrid = () => {
  const marked = new Map(DEADLINES.map((d) => [d.day, d]));
  const days = Array.from({ length: 31 }, (_, i) => i + 1);
  return (
    <div>
      <div className="grid grid-cols-7 gap-px border border-line bg-line">
        {["S", "M", "T", "W", "T", "F", "S"].map((d, i) => (
          <div key={`${d}-${i}`} className="bg-surface py-1.5 text-center label-xs">
            {d}
          </div>
        ))}
        {[null, null, null, null, null].slice(0, 5).map((_, i) => (
          <div key={`pad-${i}`} className="bg-[#0D0D0D] h-14" />
        ))}
        {days.map((d) => {
          const hit = marked.get(d);
          return (
            <div
              key={d}
              data-testid={hit ? `calendar-day-${d}` : undefined}
              className={cn(
                "relative h-14 bg-surface px-2 py-1.5 transition-colors",
                hit && "hover:bg-elevated",
              )}
            >
              <span className={cn("tnum text-[11px]", hit ? "text-white" : "text-neutral-600")}>
                {d}
              </span>
              {hit && (
                <span
                  className={cn("absolute bottom-2 left-2 h-1.5 w-1.5 rounded-full", TONE[hit.tone])}
                  aria-hidden="true"
                />
              )}
            </div>
          );
        })}
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={`tail-${i}`} className="h-14 bg-[#0D0D0D]" />
        ))}
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        {[
          ["Filing / registration", "alert"],
          ["Inspection", "gold"],
          ["Lease / vendor", "neutral"],
        ].map(([label, tone]) => (
          <span key={label} className="flex items-center gap-2 text-[11px] text-neutral-500">
            <span className={cn("h-1.5 w-1.5 rounded-full", TONE[tone])} aria-hidden="true" />
            {label}
          </span>
        ))}
      </div>
    </div>
  );
};

export const ComplianceCalendar = () => {
  const [notify, setNotify] = useState(NOTIFY);

  const toggle = (id) =>
    setNotify((prev) => prev.map((n) => (n.id === id ? { ...n, on: !n.on } : n)));

  return (
    <Section id="compliance" label="Compliance calendar" className="border-t border-line">
      <Reveal>
        <Eyebrow>Compliance calendar</Eyebrow>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <H2 className="max-w-2xl">Never discover a deadline after it passes.</H2>
          <Lede className="max-w-md">
            Registrations, filings, inspections, renewals and expirations for every building, on one
            timeline with escalating reminders.
          </Lede>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-[1fr_0.92fr]">
        <Reveal>
          <div className="border border-line bg-surface p-5">
            <div className="flex items-center justify-between">
              <h3 className="text-[13px] font-medium text-white">August 2025</h3>
              <span className="label-xs">9 deadlines</span>
            </div>
            <div className="mt-4">
              <CalendarGrid />
            </div>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="flex h-full flex-col gap-6">
            <div className="border border-line bg-surface p-5">
              <div className="label-xs">Upcoming deadlines</div>
              <ul className="mt-4 divide-y divide-line/70">
                {DEADLINES.map((d) => (
                  <li key={d.title} className="flex items-start gap-3 py-2.5">
                    <span className="tnum w-8 shrink-0 text-[11px] text-neutral-500">Aug {d.day}</span>
                    <span
                      className={cn("mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full", TONE[d.tone])}
                      aria-hidden="true"
                    />
                    <div className="min-w-0">
                      <p className="text-[13px] text-neutral-100">{d.title}</p>
                      <p className="mt-0.5 text-[11px] text-neutral-500">{d.detail}</p>
                    </div>
                  </li>
                ))}
              </ul>
            </div>

            <div className="border border-line bg-surface p-5">
              <div className="label-xs">Notification settings</div>
              <ul className="mt-4 space-y-2" data-testid="notification-settings">
                {notify.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      role="switch"
                      aria-checked={n.on}
                      data-testid={`notify-${n.id}`}
                      onClick={() => toggle(n.id)}
                      className="flex w-full items-center justify-between border border-line bg-[#101010] px-3 py-2.5 text-left transition-colors hover:border-neutral-600"
                    >
                      <span className="text-[12px] text-neutral-300">{n.label}</span>
                      <span
                        className={cn(
                          "relative h-4 w-8 border transition-colors",
                          n.on ? "border-gold/60 bg-gold/20" : "border-line bg-transparent",
                        )}
                        aria-hidden="true"
                      >
                        <span
                          className={cn(
                            "absolute top-[2px] h-[10px] w-[10px] transition-all duration-200",
                            n.on ? "left-[18px] bg-gold" : "left-[2px] bg-neutral-600",
                          )}
                        />
                      </span>
                    </button>
                  </li>
                ))}
              </ul>
              <p className="mt-4 flex gap-2 text-[11px] leading-relaxed text-neutral-500">
                <Info size={12} strokeWidth={1.5} className="mt-0.5 shrink-0" />
                Obelix does not provide legal advice. Users remain responsible for verifying their own
                regulatory obligations and filing requirements.
              </p>
            </div>
          </div>
        </Reveal>
      </div>
    </Section>
  );
};
