import { ArrowRight, Building2, Search, Bell, ArrowUpRight } from "lucide-react";
import { motion } from "framer-motion";
import { Link } from "react-router-dom";
import { HERO_STATS, HERO_PRIORITIES, UNDERWRITING_URL } from "@/data/landing";
import { StatusBadge } from "./primitives";

const DashboardPreview = () => (
  <div
    data-testid="hero-dashboard"
    className="relative w-full border border-line bg-[#101010] shadow-[0_24px_80px_-20px_rgba(0,0,0,0.9)]"
  >
    <div className="flex items-center justify-between border-b border-line bg-surface/70 px-3.5 py-2.5">
      <div className="flex items-center gap-2">
        <span className="h-1.5 w-1.5 rounded-full bg-gold animate-pulse-dot" aria-hidden="true" />
        <span className="label-xs text-neutral-400">Obelix · Portfolio Overview</span>
      </div>
      <div className="flex items-center gap-3 text-neutral-600">
        <Search size={13} strokeWidth={1.5} />
        <Bell size={13} strokeWidth={1.5} />
        <span className="hidden sm:block text-[10px] tnum text-neutral-500">Aug 1 · 9:42 AM</span>
      </div>
    </div>

    <div className="grid grid-cols-2 gap-px bg-line sm:grid-cols-4">
      {HERO_STATS.map((s) => (
        <div key={s.label} className="bg-[#101010] px-3.5 py-3">
          <div className="label-xs">{s.label}</div>
          <div
            className={`mt-1 tnum text-lg sm:text-xl font-semibold tracking-tight ${
              s.tone === "alert" ? "text-red-400" : s.tone === "ok" ? "text-emerald-400" : "text-white"
            }`}
          >
            {s.value}
          </div>
        </div>
      ))}
    </div>

    <div className="border-t border-line px-3.5 py-3">
      <div className="flex items-center justify-between">
        <h3 className="text-[13px] font-medium tracking-tight text-white">Today’s Priorities</h3>
        <span className="label-xs">4 of 7 urgent</span>
      </div>
      <ul className="mt-3 divide-y divide-line/70">
        {HERO_PRIORITIES.map((p, i) => (
          <motion.li
            key={p.title}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.5 + i * 0.09, duration: 0.4 }}
            className="flex items-start justify-between gap-3 py-2.5"
          >
            <div className="flex min-w-0 items-start gap-2.5">
              <span className="mt-1 tnum text-[10px] text-neutral-600">{i + 1}</span>
              <div className="min-w-0">
                <p className="truncate text-[13px] text-neutral-100">{p.title}</p>
                <p className="mt-0.5 truncate text-[11px] text-neutral-500">
                  {p.property} · <span className="tnum">{p.when}</span>
                </p>
              </div>
            </div>
            <StatusBadge status={p.status} />
          </motion.li>
        ))}
      </ul>
    </div>

    <div className="flex items-center justify-between border-t border-line bg-surface/60 px-3.5 py-2">
      <span className="label-xs">12 buildings synced · HPD / DOB</span>
      <span className="flex items-center gap-1.5 text-[10px] text-emerald-400">
        <span className="h-1 w-1 rounded-full bg-emerald-400" aria-hidden="true" /> Live
      </span>
    </div>
  </div>
);

export const Hero = () => (
  <section id="top" className="relative overflow-hidden pt-28 pb-16 sm:pt-32 sm:pb-24">
    <div className="pointer-events-none absolute inset-0 grid-lines opacity-70" aria-hidden="true" />
    <div
      className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-[radial-gradient(ellipse_at_center,rgba(199,163,107,0.13),transparent_65%)]"
      aria-hidden="true"
    />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-ink to-transparent" aria-hidden="true" />

    <div className="relative mx-auto grid w-full max-w-[1240px] grid-cols-1 items-center gap-14 px-5 sm:px-8 lg:grid-cols-[1fr_1.05fr] lg:gap-16 lg:px-12">
      <div>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="inline-flex items-center gap-2 border border-line bg-surface/80 px-3 py-1.5"
        >
          <Building2 size={12} strokeWidth={1.5} className="text-gold" />
          <span className="label-xs text-neutral-400">NYC multifamily operating system</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.08 }}
          data-testid="page-title"
          className="mt-6 font-serif text-4xl sm:text-5xl lg:text-6xl font-light leading-[1.02] tracking-tight text-white"
        >
          Your entire NYC portfolio.
          <span className="block text-gold">Under control.</span>
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.16 }}
          className="mt-6 max-w-xl text-sm sm:text-base leading-relaxed text-neutral-400"
        >
          Track violations, repairs, leases, inspections, rent, vendors, and compliance deadlines
          across every building—from one operating system.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.55, delay: 0.24 }}
          className="mt-9 flex flex-col gap-3 sm:flex-row"
        >
          <a
            href="#cta"
            data-testid="hero-book-demo"
            className="group inline-flex items-center justify-center gap-2 bg-gold px-6 py-3 text-sm font-medium text-ink transition-colors duration-200 hover:bg-gold-hover"
          >
            Book a Demo
            <ArrowRight size={15} strokeWidth={1.75} className="transition-transform group-hover:translate-x-0.5" />
          </a>
          <Link
            to="/platform"
            data-testid="hero-explore-platform"
            className="inline-flex items-center justify-center border border-line bg-transparent px-6 py-3 text-sm font-medium text-neutral-200 transition-colors duration-200 hover:border-neutral-600 hover:bg-white/[0.03] hover:text-white"
          >
            Explore the Platform
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.6, delay: 0.34 }}
          className="mt-6 flex flex-col gap-2"
        >
          <p className="text-xs text-neutral-500">
            Built for NYC multifamily owners and property managers.
          </p>
          <a
            href={UNDERWRITING_URL}
            target="_blank"
            rel="noopener noreferrer"
            data-testid="hero-underwriting-link"
            className="inline-flex w-fit items-center gap-1.5 text-xs text-neutral-400 transition-colors hover:text-gold"
          >
            Underwriting a new NYC deal? Visit Obelix Underwriting
            <ArrowUpRight size={11} strokeWidth={1.75} />
          </a>
        </motion.div>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.7, delay: 0.2 }}
        className="relative"
      >
        <div
          className="absolute -inset-x-6 -inset-y-8 bg-[radial-gradient(ellipse_at_center,rgba(199,163,107,0.10),transparent_70%)]"
          aria-hidden="true"
        />
        <DashboardPreview />
      </motion.div>
    </div>
  </section>
);
