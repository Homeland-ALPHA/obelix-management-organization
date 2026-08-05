import { Check, Circle, AlertTriangle } from "lucide-react";
import { WORKFLOW_STEPS, VIOLATION_CHECKS } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal, StatusBadge } from "./primitives";
import { cn } from "@/lib/utils";

const ACTIVE_INDEX = 4; // Documented in progress

const Step = ({ step, i }) => {
  const done = i < ACTIVE_INDEX;
  const current = i === ACTIVE_INDEX;
  return (
    <li
      data-testid={`workflow-step-${i}`}
      className="relative flex items-start gap-3 md:flex-col md:items-center md:gap-0 md:text-center"
    >
      <span
        className={cn(
          "relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] tnum transition-colors",
          done && "border-emerald-500/50 bg-emerald-500/10 text-emerald-400",
          current && "border-gold bg-gold/15 text-gold",
          !done && !current && "border-line bg-surface text-neutral-600",
        )}
      >
        {done ? <Check size={12} strokeWidth={2} /> : i + 1}
      </span>
      <div className="md:mt-3">
        <div
          className={cn(
            "text-[13px] font-medium",
            current ? "text-gold" : done ? "text-neutral-200" : "text-neutral-500",
          )}
        >
          {step.label}
        </div>
        <div className="mt-0.5 text-[11px] text-neutral-500">{step.note}</div>
      </div>
    </li>
  );
};

export const Workflow = () => {
  const completed = VIOLATION_CHECKS.filter((c) => c.done).length;
  const pct = Math.round((completed / VIOLATION_CHECKS.length) * 100);

  return (
    <Section id="violations" label="Violation workflow" className="border-t border-line">
      <Reveal>
        <Eyebrow>Violation workflow</Eyebrow>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <H2 className="max-w-2xl">From violation issued to violation cleared.</H2>
          <Lede className="max-w-md">
            Seven stages, each with a named owner and a required artifact. Nothing advances on
            assumption.
          </Lede>
        </div>
      </Reveal>

      <Reveal delay={0.06}>
        <div className="relative mt-12 border border-line bg-surface px-5 py-7 sm:px-8">
          <div
            className="absolute left-[2.4rem] top-12 bottom-12 w-px bg-line md:hidden"
            aria-hidden="true"
          />
          <div
            className="absolute left-[3.5rem] right-[3.5rem] top-[3.6rem] hidden h-px bg-line md:block"
            aria-hidden="true"
          />
          <ol className="relative grid grid-cols-1 gap-6 md:grid-cols-7 md:gap-2">
            {WORKFLOW_STEPS.map((s, i) => (
              <Step key={s.label} step={s} i={i} />
            ))}
          </ol>
        </div>
      </Reveal>

      <div className="mt-8 grid grid-cols-1 gap-px bg-line lg:grid-cols-[1.15fr_1fr]">
        <Reveal>
          <div className="h-full border border-line bg-surface p-6" data-testid="violation-detail-panel">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-2.5">
                <AlertTriangle size={15} strokeWidth={1.5} className="text-red-400" />
                <h3 className="font-serif text-xl text-white">Class C: Evidence of rats</h3>
              </div>
              <StatusBadge status="Urgent" />
            </div>
            <p className="mt-2 text-[11px] tnum text-neutral-500">
              HPD violation #40291 · Issued July 24, 2025
            </p>

            <dl className="mt-6 divide-y divide-line/70">
              {VIOLATION_CHECKS.map((c) => (
                <div key={c.label} className="flex items-center justify-between gap-4 py-2.5">
                  <dt className="text-[12px] text-neutral-500">{c.label}</dt>
                  <dd className="flex items-center gap-2 text-right">
                    <span
                      className={cn(
                        "text-[13px]",
                        c.tone === "alert" ? "text-red-400" : c.done ? "text-neutral-100" : "text-neutral-500",
                      )}
                    >
                      {c.value}
                    </span>
                    {c.done ? (
                      <Check size={13} strokeWidth={2} className="text-emerald-400" />
                    ) : (
                      <Circle size={11} strokeWidth={1.5} className="text-neutral-600" />
                    )}
                  </dd>
                </div>
              ))}
            </dl>
          </div>
        </Reveal>

        <Reveal delay={0.08}>
          <div className="flex h-full flex-col border border-line bg-surface p-6">
            <div className="label-xs">Required before certification</div>
            <div className="mt-4 flex items-end justify-between">
              <span className="tnum font-serif text-4xl text-white">{pct}%</span>
              <span className="text-[11px] text-neutral-500">
                {completed} of {VIOLATION_CHECKS.length} requirements met
              </span>
            </div>
            <div
              className="mt-3 h-1.5 w-full overflow-hidden bg-[#101010]"
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label="Violation certification readiness"
              data-testid="violation-progress"
            >
              <div className="h-full bg-gold transition-all duration-700" style={{ width: `${pct}%` }} />
            </div>

            <ul className="mt-6 space-y-2.5">
              {VIOLATION_CHECKS.filter((c) => !c.done).map((c) => (
                <li
                  key={c.label}
                  className="flex items-center justify-between border border-line bg-[#101010] px-3 py-2.5"
                >
                  <span className="text-[12px] text-neutral-300">{c.label}</span>
                  <StatusBadge status="Awaiting Approval" />
                </li>
              ))}
            </ul>

            <p className="mt-auto pt-8 border-l-2 border-gold pl-5 font-serif text-lg leading-snug text-white">
              Obelix does not simply show that a violation exists. It tells your team what must
              happen next.
            </p>
          </div>
        </Reveal>
      </div>
    </Section>
  );
};
