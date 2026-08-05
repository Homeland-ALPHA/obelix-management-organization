import { Link } from "react-router-dom";
import * as Icons from "lucide-react";
import { ArrowRight } from "lucide-react";
import { MODULES } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal } from "./primitives";

export const ModuleIndex = ({ exclude }) => {
  const items = MODULES.filter((m) => m.to !== exclude);
  return (
    <Section id="modules" label="Explore Obelix" className="border-t border-line">
      <Reveal>
        <Eyebrow>Explore Obelix</Eyebrow>
        <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
          <H2 className="max-w-2xl">One system, examined module by module.</H2>
          <Lede className="max-w-md">
            Each area of the platform has its own page, with the interfaces your team would actually
            use day to day.
          </Lede>
        </div>
      </Reveal>

      <div className="mt-10 grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
        {items.map((m, i) => {
          const Icon = Icons[m.icon] || Icons.Square;
          return (
            <Reveal key={m.to} delay={i * 0.04}>
              <Link
                to={m.to}
                data-testid={`module-link-${m.label.toLowerCase()}`}
                className="group flex h-full flex-col border border-line bg-surface p-6 transition-colors duration-200 hover:border-gold/40 hover:bg-elevated/60"
              >
                <div className="flex items-center justify-between">
                  <span className="flex h-9 w-9 items-center justify-center border border-line bg-[#101010] text-gold transition-colors group-hover:border-gold/40">
                    <Icon size={16} strokeWidth={1.5} />
                  </span>
                  <span className="label-xs">{m.label}</span>
                </div>
                <h3 className="mt-5 text-base font-medium leading-snug tracking-tight text-white">
                  {m.title}
                </h3>
                <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-400">{m.body}</p>
                <span className="mt-6 inline-flex items-center gap-1.5 text-[12px] font-medium text-gold">
                  View {m.label}
                  <ArrowRight
                    size={13}
                    strokeWidth={1.75}
                    className="transition-transform group-hover:translate-x-0.5"
                  />
                </span>
              </Link>
            </Reveal>
          );
        })}
      </div>
    </Section>
  );
};
