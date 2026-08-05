import * as Icons from "lucide-react";
import { SECURITY_ITEMS } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal } from "./primitives";

export const Security = () => (
  <Section id="security" label="Access and records" className="border-t border-line">
    <Reveal>
      <Eyebrow>Access and records</Eyebrow>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <H2 className="max-w-2xl">Controlled access. Complete history.</H2>
        <Lede className="max-w-md">
          Portfolio data is scoped by role and by building, and every action is recorded so ownership
          of a decision is never in question.
        </Lede>
      </div>
    </Reveal>

    <div className="mt-12 grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
      {SECURITY_ITEMS.map((s, i) => {
        const Icon = Icons[s.icon] || Icons.Shield;
        return (
          <Reveal key={s.title} delay={i * 0.04}>
            <div className="flex h-full flex-col border border-line bg-surface p-6 transition-colors hover:border-neutral-700">
              <Icon size={16} strokeWidth={1.5} className="text-gold" />
              <h3 className="mt-4 text-sm font-medium text-white">{s.title}</h3>
              <p className="mt-2 text-[13px] leading-relaxed text-neutral-400">{s.body}</p>
            </div>
          </Reveal>
        );
      })}
    </div>

    <Reveal delay={0.1}>
      <p className="mt-8 border border-line bg-surface/60 px-5 py-4 text-[11px] leading-relaxed text-neutral-500">
        Obelix does not currently hold SOC 2, ISO 27001 or any other third-party security
        certification. Formal independent audit is a stated goal on our roadmap and will only be
        advertised once it has been completed and verified.
      </p>
    </Reveal>
  </Section>
);
