import { Link } from "react-router-dom";
import { Check, ArrowRight } from "lucide-react";
import { PRICING_TIERS } from "@/data/landing";
import { Section, Eyebrow, H2, Lede, Reveal } from "./primitives";
import { cn } from "@/lib/utils";

export const Pricing = () => (
  <Section id="pricing" label="Pricing" className="border-t border-line">
    <Reveal>
      <Eyebrow>Pricing</Eyebrow>
      <div className="mt-5 flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
        <H2 className="max-w-2xl">Priced by portfolio size, quoted per engagement.</H2>
        <Lede className="max-w-md">
          Obelix is sold by unit band rather than per seat, so superintendents, vendors and owners can
          all be in the system without a licence penalty.
        </Lede>
      </div>
    </Reveal>

    <div className="mt-10 grid grid-cols-1 gap-px bg-line lg:grid-cols-3">
      {PRICING_TIERS.map((t, i) => (
        <Reveal key={t.name} delay={i * 0.06}>
          <div
            data-testid={`pricing-tier-${t.name.toLowerCase()}`}
            className={cn(
              "flex h-full flex-col border bg-surface p-6 sm:p-7 transition-colors",
              t.featured ? "border-gold/45 bg-elevated/50" : "border-line hover:border-neutral-700",
            )}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-serif text-2xl text-white">{t.name}</h3>
              {t.featured && (
                <span className="border border-gold/40 bg-gold/10 px-2 py-[3px] text-[10px] uppercase tracking-[0.12em] text-gold">
                  Most common
                </span>
              )}
            </div>
            <p className="mt-1.5 label-xs">{t.band}</p>
            <p className="mt-4 text-[13px] leading-relaxed text-neutral-400">{t.summary}</p>

            <div className="mt-6 border-t border-line pt-5">
              <div className="tnum text-2xl font-semibold text-white">Custom quote</div>
              <p className="mt-1 text-[11px] text-neutral-500">
                Annual agreement · billed by units under management
              </p>
            </div>

            <ul className="mt-6 space-y-2.5">
              {t.features.map((f) => (
                <li key={f} className="flex gap-2.5 text-[12.5px] leading-relaxed text-neutral-300">
                  <Check size={13} strokeWidth={2} className="mt-0.5 shrink-0 text-gold" />
                  {f}
                </li>
              ))}
            </ul>

            <a
              href="#cta"
              data-testid={`pricing-cta-${t.name.toLowerCase()}`}
              onClick={(e) => {
                e.preventDefault();
                document.getElementById("cta-form")?.scrollIntoView({ behavior: "smooth", block: "center" });
              }}
              className={cn(
                "group mt-8 inline-flex items-center justify-center gap-2 px-5 py-2.5 text-[13px] font-medium transition-colors",
                t.featured
                  ? "bg-gold text-ink hover:bg-gold-hover"
                  : "border border-line text-neutral-200 hover:border-neutral-600 hover:bg-white/[0.03] hover:text-white",
              )}
            >
              Request a quote
              <ArrowRight
                size={13}
                strokeWidth={1.75}
                className="transition-transform group-hover:translate-x-0.5"
              />
            </a>
          </div>
        </Reveal>
      ))}
    </div>

    <Reveal delay={0.1}>
      <div className="mt-8 grid grid-cols-1 gap-px bg-line sm:grid-cols-3">
        {[
          ["Implementation", "Building, unit, lease and vendor data migrated with a named lead."],
          ["Unlimited roles", "Owners, managers, staff, vendors and tenants at no extra seat cost."],
          ["No lock-in exports", "Your violation, financial and inspection history exports on request."],
        ].map(([k, v]) => (
          <div key={k} className="border border-line bg-surface p-5">
            <h3 className="text-sm font-medium text-white">{k}</h3>
            <p className="mt-2 text-[12.5px] leading-relaxed text-neutral-400">{v}</p>
          </div>
        ))}
      </div>
      <p className="mt-6 text-[11px] leading-relaxed text-neutral-500">
        Pricing is quoted per portfolio after a scoping call. Figures shown elsewhere on this site are
        illustrative product data, not a commercial offer.{" "}
        <Link to="/security" className="text-neutral-300 underline-offset-2 hover:underline">
          Review access and records controls
        </Link>
        .
      </p>
    </Reveal>
  </Section>
);
