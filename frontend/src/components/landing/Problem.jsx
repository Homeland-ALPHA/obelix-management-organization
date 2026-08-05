import { FileSpreadsheet, Mail, MessageSquare, Landmark, Receipt, PhoneCall, FileText, Stamp } from "lucide-react";
import { FRAGMENTS } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal } from "./primitives";

const ICONS = [Landmark, MessageSquare, FileText, PhoneCall, Stamp, Receipt, FileSpreadsheet, Mail];

const CHAOS = [
  "Spreadsheets",
  "Email threads",
  "Text messages",
  "City portals",
  "Contractor invoices",
  "Tenant calls",
  "Paper records",
];

export const Problem = () => (
  <Section id="problem" label="The problem" className="border-t border-line">
    <div className="grid grid-cols-1 gap-14 lg:grid-cols-[0.95fr_1.05fr] lg:gap-20">
      <Reveal>
        <Eyebrow>The problem</Eyebrow>
        <H2 className="mt-5">NYC property management is fragmented by default.</H2>
        <Lede className="mt-6">
          A single Class C violation touches a tenant, a superintendent, a contractor, an insurance
          certificate, a photo record, an HPD certification and an owner approval. Today that work
          lives in seven different places at once.
        </Lede>
        <Lede className="mt-4">
          Managers move between spreadsheets, email threads, text messages, city portals, contractor
          invoices, tenant phone calls and paper records—re-entering the same facts and hoping nothing
          expires in between.
        </Lede>

        <ul className="mt-8 flex flex-wrap gap-2">
          {CHAOS.map((c) => (
            <li
              key={c}
              className="border border-dashed border-neutral-800 px-2.5 py-1.5 text-[11px] text-neutral-500"
            >
              {c}
            </li>
          ))}
        </ul>

        <p className="mt-9 border-l-2 border-gold pl-5 font-serif text-xl sm:text-2xl leading-snug text-white">
          Obelix turns disconnected information into assigned, trackable work.
        </p>
      </Reveal>

      <Reveal delay={0.1}>
        <div className="relative overflow-hidden border border-line bg-surface p-5 sm:p-7 grain">
          <div className="label-xs">Consolidation map</div>
          <div className="mt-5 grid grid-cols-1 items-center gap-5 sm:grid-cols-[1fr_auto_1fr]">
            <ul className="space-y-1.5">
              {FRAGMENTS.slice(0, 4).map((f, i) => {
                const Icon = ICONS[i];
                return (
                  <li
                    key={f}
                    className="flex items-center gap-2.5 border border-line bg-[#101010] px-3 py-2.5 text-[12px] text-neutral-300 transition-colors hover:border-gold/40"
                  >
                    <Icon size={13} strokeWidth={1.5} className="shrink-0 text-neutral-500" />
                    <span className="truncate">{f}</span>
                  </li>
                );
              })}
            </ul>

            <div className="relative flex items-center justify-center py-2 sm:py-0">
              <svg
                width="70"
                height="150"
                viewBox="0 0 70 150"
                className="hidden sm:block"
                aria-hidden="true"
              >
                {[18, 52, 96, 132].map((y, i) => (
                  <path
                    key={`l-${y}`}
                    d={`M0 ${y} C 34 ${y}, 36 75, 68 75`}
                    fill="none"
                    stroke="#C7A36B"
                    strokeOpacity="0.4"
                    strokeWidth="1"
                    strokeDasharray="4 8"
                    className="animate-flow"
                    style={{ animationDelay: `${i * 0.2}s` }}
                  />
                ))}
              </svg>
              <div className="sm:hidden h-8 w-px bg-gradient-to-b from-transparent via-gold/50 to-transparent" />
            </div>

            <ul className="space-y-1.5">
              {FRAGMENTS.slice(4).map((f, i) => {
                const Icon = ICONS[i + 4];
                return (
                  <li
                    key={f}
                    className="flex items-center gap-2.5 border border-line bg-[#101010] px-3 py-2.5 text-[12px] text-neutral-300 transition-colors hover:border-gold/40"
                  >
                    <Icon size={13} strokeWidth={1.5} className="shrink-0 text-neutral-500" />
                    <span className="truncate">{f}</span>
                  </li>
                );
              })}
            </ul>
          </div>

          <div className="mt-6 border border-gold/30 bg-gold/[0.06] px-4 py-4 text-center">
            <div className="font-serif text-lg text-white">Obelix Operating System</div>
            <div className="mt-1.5 label-xs text-gold/80">One record · One owner · One next action</div>
            <div className="mt-4 grid grid-cols-3 gap-px border border-line bg-line text-center">
              {[
                ["Assigned", "38"],
                ["Due this week", "11"],
                ["Cleared in July", "14"],
              ].map(([k, v]) => (
                <div key={k} className="bg-[#101010] px-2 py-2.5">
                  <div className="tnum text-sm font-semibold text-white">{v}</div>
                  <div className="mt-0.5 text-[9px] uppercase tracking-[0.14em] text-neutral-500">{k}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </Reveal>
    </div>
  </Section>
);
