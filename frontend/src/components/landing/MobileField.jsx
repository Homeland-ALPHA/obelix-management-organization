import { Phone, Camera, Package, FileUp, CheckCircle2, BadgeCheck, DoorOpen, Signal, Wifi, BatteryFull } from "lucide-react";
import { Section, Eyebrow, H2, Lede, Reveal, StatusBadge } from "./primitives";

const FIELD_ACTIONS = [
  { icon: DoorOpen, label: "Confirm access", meta: "Tenant confirmed 2:30 PM", done: true },
  { icon: Camera, label: "Before photos", meta: "3 images uploaded", done: true },
  { icon: Package, label: "Materials used", meta: "P-trap, 1½ in. slip joint", done: true },
  { icon: Camera, label: "After photos", meta: "Pending", done: false },
  { icon: FileUp, label: "Vendor documentation", meta: "Invoice pending", done: false },
  { icon: BadgeCheck, label: "Manager verification", meta: "Not requested", done: false },
];

const CAPABILITIES = [
  "View assigned work for the day, by building and line",
  "Contact the tenant without exposing personal numbers",
  "Confirm an access window before travelling to the unit",
  "Capture before-and-after photos directly in the work order",
  "Record materials used and labour time on site",
  "Upload vendor invoices, permits and certificates of insurance",
  "Mark the repair complete and request manager verification",
];

const Phone_ = () => (
  <div className="mx-auto w-full max-w-[320px]">
    <div className="relative rounded-[2rem] border border-line bg-[#0D0D0D] p-2.5 shadow-[0_30px_80px_-30px_rgba(0,0,0,1)]">
      <div className="overflow-hidden rounded-[1.5rem] border border-line bg-surface">
        <div className="flex items-center justify-between px-4 py-2 text-neutral-500">
          <span className="tnum text-[10px]">2:14</span>
          <div className="flex items-center gap-1.5">
            <Signal size={10} strokeWidth={1.5} />
            <Wifi size={10} strokeWidth={1.5} />
            <BatteryFull size={12} strokeWidth={1.5} />
          </div>
        </div>

        <div className="border-y border-line bg-[#101010] px-4 py-3">
          <div className="flex items-center justify-between">
            <span className="label-xs text-gold/90">Work order #WO-2291</span>
            <StatusBadge status="In Progress" />
          </div>
          <h3 className="mt-2 text-[13px] font-medium leading-snug text-white">
            Water leak beneath bathroom sink — Unit 3A
          </h3>
          <p className="mt-1 text-[11px] text-neutral-500">2116 Colonial Avenue · Bronx, NY</p>
        </div>

        <div className="flex items-center justify-between border-b border-line bg-emerald-500/[0.07] px-4 py-2.5">
          <span className="text-[11px] text-emerald-400">Access confirmed for 2:30 PM</span>
          <CheckCircle2 size={13} strokeWidth={1.5} className="text-emerald-400" />
        </div>

        <div className="flex gap-2 border-b border-line px-4 py-3">
          <button
            type="button"
            data-testid="mobile-call-tenant"
            className="flex flex-1 items-center justify-center gap-1.5 border border-line bg-[#101010] py-2 text-[11px] text-neutral-200 transition-colors hover:border-gold/50 hover:text-gold"
          >
            <Phone size={11} strokeWidth={1.5} /> Call tenant
          </button>
          <button
            type="button"
            data-testid="mobile-capture-photo"
            className="flex flex-1 items-center justify-center gap-1.5 border border-line bg-[#101010] py-2 text-[11px] text-neutral-200 transition-colors hover:border-gold/50 hover:text-gold"
          >
            <Camera size={11} strokeWidth={1.5} /> Capture
          </button>
        </div>

        <ul className="divide-y divide-line/70 px-4">
          {FIELD_ACTIONS.map((a) => (
            <li key={a.label} className="flex items-center gap-3 py-2.5">
              <a.icon
                size={13}
                strokeWidth={1.5}
                className={a.done ? "text-emerald-400" : "text-neutral-600"}
              />
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] text-neutral-200">{a.label}</p>
                <p className="truncate text-[10px] text-neutral-500">{a.meta}</p>
              </div>
              <span
                className={`h-1.5 w-1.5 rounded-full ${a.done ? "bg-emerald-400" : "bg-neutral-700"}`}
                aria-hidden="true"
              />
            </li>
          ))}
        </ul>

        <div className="p-4">
          <button
            type="button"
            data-testid="mobile-complete-repair"
            className="w-full bg-gold py-2.5 text-[12px] font-medium text-ink transition-colors hover:bg-gold-hover"
          >
            Mark repair complete
          </button>
          <p className="mt-2 text-center text-[10px] text-neutral-500">
            Manager verification requested automatically
          </p>
        </div>
      </div>
    </div>
  </div>
);

export const MobileField = () => (
  <Section id="field" label="Field operations" className="border-t border-line">
    <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1fr_0.85fr] lg:gap-20">
      <Reveal>
        <Eyebrow>Field operations</Eyebrow>
        <H2 className="mt-5">The superintendent’s half of the job, done on a phone.</H2>
        <Lede className="mt-6">
          Field staff and vendors work the same record the office sees. Proof is captured where the
          work happens—not typed up hours later.
        </Lede>
        <ul className="mt-8 space-y-3">
          {CAPABILITIES.map((c) => (
            <li key={c} className="flex gap-3 text-[13px] leading-relaxed text-neutral-300">
              <CheckCircle2 size={14} strokeWidth={1.5} className="mt-0.5 shrink-0 text-gold" />
              {c}
            </li>
          ))}
        </ul>
      </Reveal>

      <Reveal delay={0.1}>
        <Phone_ />
      </Reveal>
    </div>
  </Section>
);
