import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import { FOOTER_LINKS, UNDERWRITING_URL } from "@/data/landing";

export const Footer = () => (
  <footer id="footer" className="border-t border-line bg-ink px-5 pb-10 pt-16 sm:px-8 lg:px-12">
    <div className="mx-auto w-full max-w-[1240px]">
      <div className="grid grid-cols-1 gap-10 sm:grid-cols-2 lg:grid-cols-[1.4fr_repeat(3,0.7fr)]">
        <div>
          <div className="flex items-baseline gap-2.5">
            <span className="h-4 w-[3px] bg-gold" aria-hidden="true" />
            <span className="font-serif text-[22px] leading-none text-white">Obelix</span>
          </div>
          <p className="mt-3 label-xs">Property Management</p>
          <p className="mt-5 max-w-xs text-[12px] leading-relaxed text-neutral-500">
            An operating system for NYC multifamily portfolios—compliance, maintenance, leasing,
            financials and owner reporting in one record.
          </p>
          <a
            href={UNDERWRITING_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="footer-underwriting"
            className="mt-5 inline-flex items-center gap-1.5 border border-line px-3 py-2 text-[12px] text-neutral-300 transition-colors hover:border-gold/50 hover:text-gold"
          >
            Obelix Underwriting — deal analysis
            <ArrowUpRight size={12} strokeWidth={1.75} />
          </a>
        </div>

        {FOOTER_LINKS.map((group) => (
          <nav key={group.heading} aria-label={group.heading}>
            <h3 className="label-xs">{group.heading}</h3>
            <ul className="mt-4 space-y-2.5">
              {group.items.map((item) => {
                const testId = `footer-link-${item.label.toLowerCase().replace(/\s+/g, "-")}`;
                return (
                  <li key={item.label}>
                    {item.external ? (
                      <a
                        href={item.external}
                        target="_blank"
                        rel="noopener noreferrer"
                        data-testid={testId}
                        className="inline-flex items-center gap-1 text-[13px] text-neutral-400 transition-colors hover:text-white"
                      >
                        {item.label}
                        <ArrowUpRight size={11} strokeWidth={1.75} />
                      </a>
                    ) : (
                      <Link
                        to={item.to}
                        data-testid={testId}
                        className="text-[13px] text-neutral-400 transition-colors hover:text-white"
                      >
                        {item.label}
                      </Link>
                    )}
                  </li>
                );
              })}
            </ul>
          </nav>
        ))}
      </div>

      <div className="mt-14 border-t border-line pt-6">
        <p className="max-w-3xl text-[11px] leading-relaxed text-neutral-500">
          Obelix Property Management provides operational software and does not provide legal,
          accounting, engineering, or regulatory advice.
        </p>
        <p className="mt-4 text-[11px] text-neutral-600">
          © 2025 Obelix Property Management. New York, NY.
        </p>
      </div>
    </div>
  </footer>
);
