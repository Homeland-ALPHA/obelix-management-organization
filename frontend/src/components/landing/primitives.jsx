import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export const Reveal = ({ children, delay = 0, className }) => (
  <motion.div
    className={className}
    initial={{ opacity: 0, y: 18 }}
    whileInView={{ opacity: 1, y: 0 }}
    viewport={{ once: true, margin: "-60px" }}
    transition={{ duration: 0.45, delay, ease: [0.22, 0.61, 0.36, 1] }}
  >
    {children}
  </motion.div>
);

export const Section = ({ id, children, className, label }) => (
  <section
    id={id}
    aria-label={label}
    className={cn("relative w-full px-5 sm:px-8 lg:px-12 py-20 sm:py-28", className)}
  >
    <div className="mx-auto w-full max-w-[1240px]">{children}</div>
  </section>
);

export const Eyebrow = ({ children, className }) => (
  <div className={cn("flex items-center gap-3", className)}>
    <span className="h-px w-8 bg-gold/60" aria-hidden="true" />
    <span className="label-xs text-gold/90">{children}</span>
  </div>
);

export const H2 = ({ children, className }) => (
  <h2
    className={cn(
      "font-serif text-3xl sm:text-4xl lg:text-[2.9rem] leading-[1.08] tracking-tight text-white",
      className,
    )}
  >
    {children}
  </h2>
);

export const Lede = ({ children, className }) => (
  <p className={cn("text-sm sm:text-base leading-relaxed text-neutral-400", className)}>
    {children}
  </p>
);

const STATUS = {
  Urgent: "text-alert bg-alert/10 border-alert/25",
  Emergency: "text-alert bg-alert/10 border-alert/25",
  Overdue: "text-alert bg-alert/10 border-alert/25",
  Completed: "text-ok bg-ok/10 border-ok/25",
  Cleared: "text-ok bg-ok/10 border-ok/25",
  Approved: "text-ok bg-ok/10 border-ok/25",
  Scheduled: "text-gold bg-gold/10 border-gold/25",
  "In Progress": "text-gold bg-gold/10 border-gold/25",
  "Awaiting Approval": "text-mid bg-tint/[0.06] border-tint/15",
  "Awaiting Review": "text-mid bg-tint/[0.06] border-tint/15",
  "Not Started": "text-mid bg-tint/[0.04] border-tint/10",
  Declined: "text-mid bg-tint/[0.04] border-tint/10",
  "Quote Requested": "text-gold bg-gold/10 border-gold/25",
};

export const StatusBadge = ({ status, className, ...rest }) => (
  <span
    className={cn(
      "inline-flex items-center gap-1.5 border px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.1em] whitespace-nowrap",
      STATUS[status] || "text-mid bg-tint/[0.04] border-tint/10",
      className,
    )}
    {...rest}
  >
    {status}
  </span>
);

export const Stat = ({ value, label, tone = "default", testId }) => (
  <div
    data-testid={testId}
    className="group relative border border-line bg-surface px-4 py-3.5 transition-colors duration-200 hover:border-neutral-700"
  >
    <div className="label-xs">{label}</div>
    <div
      className={cn(
        "mt-1.5 tnum text-xl sm:text-2xl font-semibold tracking-tight",
        tone === "alert" ? "text-red-400" : tone === "ok" ? "text-emerald-400" : "text-white",
      )}
    >
      {value}
    </div>
  </div>
);
