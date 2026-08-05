import { useState } from "react";
import * as Icons from "lucide-react";
import { Plus, Minus } from "lucide-react";
import { FEATURES } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal } from "./primitives";
import { cn } from "@/lib/utils";

const FeatureCard = ({ feature, index }) => {
  const [open, setOpen] = useState(false);
  const Icon = Icons[feature.icon] || Icons.Square;

  return (
    <Reveal delay={index * 0.05}>
      <article
        data-testid={`feature-card-${index}`}
        className={cn(
          "group flex h-full flex-col border border-line bg-surface p-6 transition-colors duration-200 hover:border-neutral-700 hover:bg-elevated/60",
          open && "border-gold/40",
        )}
      >
        <div className="flex items-start justify-between">
          <span className="flex h-9 w-9 items-center justify-center border border-line bg-[#101010] text-gold transition-colors group-hover:border-gold/40">
            <Icon size={16} strokeWidth={1.5} />
          </span>
          <span className="tnum label-xs">0{index + 1}</span>
        </div>

        <h3 className="mt-5 text-base font-medium tracking-tight text-white">{feature.title}</h3>
        <p className="mt-2.5 text-[13px] leading-relaxed text-neutral-400">{feature.body}</p>

        {open && (
          <ul className="mt-4 space-y-2 border-t border-line pt-4" data-testid={`feature-detail-${index}`}>
            {feature.detail.map((d) => (
              <li key={d} className="flex gap-2.5 text-[12px] leading-relaxed text-neutral-400">
                <span className="mt-1.5 h-1 w-1 shrink-0 bg-gold" aria-hidden="true" />
                {d}
              </li>
            ))}
          </ul>
        )}

        <button
          type="button"
          data-testid={`feature-learn-more-${index}`}
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="mt-6 inline-flex items-center gap-2 self-start text-[12px] font-medium text-gold transition-colors hover:text-gold-hover"
        >
          {open ? <Minus size={13} strokeWidth={1.75} /> : <Plus size={13} strokeWidth={1.75} />}
          {open ? "Show less" : "Learn more"}
        </button>
      </article>
    </Reveal>
  );
};

export const Platform = () => (
  <Section id="platform" label="Core platform" className="border-t border-line">
    <Reveal>
      <Eyebrow>Core platform</Eyebrow>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <H2 className="max-w-2xl">Everything required to operate an NYC building.</H2>
        <Lede className="max-w-md">
          Six connected modules, one record per building. Compliance, maintenance, leasing,
          inspections, financials and vendors share the same source of truth.
        </Lede>
      </div>
    </Reveal>

    <div className="mt-12 grid grid-cols-1 gap-px bg-line sm:grid-cols-2 lg:grid-cols-3">
      {FEATURES.map((f, i) => (
        <FeatureCard key={f.title} feature={f} index={i} />
      ))}
    </div>
  </Section>
);
