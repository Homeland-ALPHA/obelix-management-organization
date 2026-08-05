import { Link } from "react-router-dom";
import { ChevronRight } from "lucide-react";
import { Eyebrow, Lede } from "./primitives";

export const PageHeader = ({ eyebrow, title, lede, meta }) => (
  <section className="relative overflow-hidden border-b border-line px-5 pt-28 pb-14 sm:px-8 sm:pt-32 sm:pb-16 lg:px-12">
    <div className="pointer-events-none absolute inset-0 grid-lines opacity-60" aria-hidden="true" />
    <div
      className="pointer-events-none absolute -top-48 left-1/4 h-[420px] w-[720px] rounded-full bg-[radial-gradient(ellipse_at_center,rgba(199,163,107,0.11),transparent_65%)]"
      aria-hidden="true"
    />
    <div className="relative mx-auto w-full max-w-[1240px]">
      <nav aria-label="Breadcrumb" className="mb-7">
        <ol className="flex items-center gap-1.5 text-[11px] text-neutral-500">
          <li>
            <Link to="/" data-testid="breadcrumb-home" className="transition-colors hover:text-gold">
              Obelix
            </Link>
          </li>
          <ChevronRight size={11} strokeWidth={1.5} aria-hidden="true" />
          <li className="text-neutral-300">{eyebrow}</li>
        </ol>
      </nav>

      <Eyebrow>{eyebrow}</Eyebrow>
      <h1
        data-testid="page-title"
        className="mt-5 max-w-3xl font-serif text-4xl sm:text-5xl lg:text-[3.4rem] font-light leading-[1.04] tracking-tight text-white"
      >
        {title}
      </h1>
      <Lede className="mt-6 max-w-2xl">{lede}</Lede>

      {meta && (
        <dl className="mt-10 grid grid-cols-2 gap-px border border-line bg-line sm:grid-cols-4">
          {meta.map(([k, v]) => (
            <div key={k} className="bg-surface px-4 py-3.5">
              <dd className="tnum text-lg font-semibold tracking-tight text-white">{v}</dd>
              <dt className="mt-1 label-xs">{k}</dt>
            </div>
          ))}
        </dl>
      )}
    </div>
  </section>
);
