import { useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { Menu, X, ArrowUpRight } from "lucide-react";
import { NAV_LINKS, UNDERWRITING_URL } from "@/data/landing";
import { cn } from "@/lib/utils";

const Wordmark = ({ onClick }) => (
  <Link
    to="/"
    onClick={onClick}
    data-testid="nav-wordmark"
    className="group flex items-baseline gap-2.5"
    aria-label="Obelix Property Management — home"
  >
    <span className="flex items-center gap-2">
      <span className="relative h-4 w-[3px] bg-gold" aria-hidden="true" />
      <span className="font-serif text-[22px] leading-none tracking-[0.02em] text-white">
        Obelix
      </span>
    </span>
    <span className="hidden sm:block label-xs text-neutral-500 transition-colors group-hover:text-neutral-400">
      Property Management
    </span>
  </Link>
);

export const Nav = () => {
  const [open, setOpen] = useState(false);
  const [solid, setSolid] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    const onScroll = () => setSolid(window.scrollY > 24);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => setOpen(false), [pathname]);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <header
      data-testid="site-nav"
      className={cn(
        "fixed top-0 left-0 right-0 z-50 transition-colors duration-300",
        solid || open
          ? "bg-ink/90 backdrop-blur-md border-b border-line"
          : "bg-transparent border-b border-transparent",
      )}
    >
      <nav
        aria-label="Primary"
        className="mx-auto flex h-16 w-full max-w-[1240px] items-center justify-between gap-6 px-5 sm:px-8 lg:px-12"
      >
        <Wordmark />

        <ul className="hidden lg:flex items-center gap-7">
          {NAV_LINKS.map((l) => {
            const active = pathname === l.to;
            return (
              <li key={l.to}>
                <Link
                  to={l.to}
                  data-testid={`nav-link-${l.label.toLowerCase()}`}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "relative text-[13px] font-medium transition-colors after:absolute after:-bottom-1.5 after:left-0 after:h-px after:bg-gold after:transition-all",
                    active
                      ? "text-white after:w-full"
                      : "text-neutral-400 hover:text-white after:w-0 hover:after:w-full",
                  )}
                >
                  {l.label}
                </Link>
              </li>
            );
          })}
        </ul>

        <div className="hidden lg:flex items-center gap-5">
          <a
            href={UNDERWRITING_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="nav-underwriting"
            className="group hidden xl:inline-flex items-center gap-1 text-[13px] font-medium text-neutral-400 transition-colors hover:text-gold"
          >
            Underwriting
            <ArrowUpRight
              size={12}
              strokeWidth={1.75}
              className="transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5"
            />
          </a>
          <Link
            to="/signin"
            data-testid="nav-signin"
            className="text-[13px] font-medium text-neutral-300 transition-colors hover:text-white"
          >
            Sign In
          </Link>
          <a
            href="#cta"
            data-testid="nav-book-demo"
            className="border border-gold/60 bg-gold/[0.08] px-4 py-2 text-[13px] font-medium text-gold transition-all duration-200 hover:bg-gold hover:text-ink"
          >
            Book a Demo
          </a>
        </div>

        <button
          type="button"
          data-testid="mobile-menu-toggle"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? "Close menu" : "Open menu"}
          onClick={() => setOpen((v) => !v)}
          className="lg:hidden flex h-9 w-9 items-center justify-center border border-line text-neutral-300 transition-colors hover:border-neutral-600 hover:text-white"
        >
          {open ? <X size={17} strokeWidth={1.5} /> : <Menu size={17} strokeWidth={1.5} />}
        </button>
      </nav>

      {open && (
        <div
          id="mobile-menu"
          data-testid="mobile-menu"
          className="lg:hidden max-h-[calc(100vh-4rem)] overflow-y-auto border-t border-line bg-ink px-5 pb-8 pt-4 sm:px-8"
        >
          <ul className="flex flex-col">
            {NAV_LINKS.map((l) => (
              <li key={l.to} className="border-b border-line/70">
                <Link
                  to={l.to}
                  data-testid={`mobile-nav-link-${l.label.toLowerCase()}`}
                  onClick={() => setOpen(false)}
                  className="block py-3.5 text-sm text-neutral-300 transition-colors hover:text-gold"
                >
                  {l.label}
                </Link>
              </li>
            ))}
            <li className="border-b border-line/70">
              <a
                href={UNDERWRITING_URL}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="mobile-nav-underwriting"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 py-3.5 text-sm text-neutral-300 transition-colors hover:text-gold"
              >
                Obelix Underwriting <ArrowUpRight size={12} strokeWidth={1.75} />
              </a>
            </li>
          </ul>
          <div className="mt-6 flex flex-col gap-3">
            <Link
              to="/signin"
              onClick={() => setOpen(false)}
              data-testid="mobile-nav-signin"
              className="border border-line px-4 py-2.5 text-center text-sm text-neutral-200"
            >
              Sign In
            </Link>
            <a
              href="#cta"
              onClick={() => setOpen(false)}
              data-testid="mobile-nav-book-demo"
              className="bg-gold px-4 py-2.5 text-center text-sm font-medium text-ink"
            >
              Book a Demo
            </a>
          </div>
        </div>
      )}
    </header>
  );
};
