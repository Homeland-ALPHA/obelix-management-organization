import { useEffect, useState } from "react";
import { ChevronDown, RefreshCw, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDateTime } from "@/lib/fmt";
import { Field, GhostButton, GoldButton, Spinner, ToneBadge, inputCls } from "./ui";

/* Higher-level UI kit for the operating app: modals, auto-forms, tables,
   summary cards, source transparency tags, empty states. */

// ------------------------------------------------------------- modal
export const Modal = ({ open, onClose, title, children, wide }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-[80] flex items-start justify-center overflow-y-auto bg-black/70 p-4 sm:p-8" onMouseDown={onClose}>
      <div
        className={cn("mt-6 w-full border border-line bg-panel shadow-modal", wide ? "max-w-3xl" : "max-w-xl")}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between border-b border-line bg-surface/70 px-5 py-3">
          <h3 className="text-[14px] font-medium text-strong">{title}</h3>
          <button type="button" onClick={onClose} className="text-dim transition-colors hover:text-strong" aria-label="Close">
            <X size={16} strokeWidth={1.5} />
          </button>
        </div>
        <div className="p-5">{children}</div>
      </div>
    </div>
  );
};

// ------------------------------------------------------------- auto form
const coerce = (type, v) => {
  if (v === "" || v === null || v === undefined) return null;
  if (type === "money" || type === "number") {
    const n = parseFloat(String(v).replace(/[$,]/g, ""));
    return Number.isNaN(n) ? null : n;
  }
  return v;
};

export const AutoForm = ({ fields, initial = {}, onSubmit, submitLabel = "Save", busy, onDelete, deleteLabel }) => {
  const [values, setValues] = useState(() => {
    const v = {};
    fields.forEach((f) => {
      v[f.name] = initial[f.name] ?? f.default ?? (f.type === "toggle" ? false : "");
    });
    return v;
  });
  const set = (name, val) => setValues((s) => ({ ...s, [name]: val }));

  const submit = (e) => {
    e.preventDefault();
    const out = {};
    fields.forEach((f) => {
      out[f.name] = f.type === "toggle" ? !!values[f.name] : coerce(f.type, values[f.name]);
    });
    onSubmit(out);
  };

  return (
    <form onSubmit={submit} className="grid grid-cols-2 gap-4">
      {fields.map((f) => (
        <div key={f.name} className={f.half ? "col-span-1" : "col-span-2"}>
          <Field label={f.label}>
            {f.type === "select" ? (
              <select value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} required={f.required} className={cn(inputCls, "appearance-none")}>
                <option value="">{f.placeholder || "Select…"}</option>
                {(f.options || []).map((o) => (
                  <option key={o.value ?? o} value={o.value ?? o}>
                    {o.label ?? o}
                  </option>
                ))}
              </select>
            ) : f.type === "textarea" ? (
              <textarea value={values[f.name] ?? ""} onChange={(e) => set(f.name, e.target.value)} rows={3} placeholder={f.placeholder} className={inputCls} />
            ) : f.type === "toggle" ? (
              <button
                type="button"
                onClick={() => set(f.name, !values[f.name])}
                className={cn(
                  "flex h-[38px] w-full items-center justify-between border px-3.5 text-[13px] transition-colors",
                  values[f.name] ? "border-gold/60 bg-gold/10 text-gold" : "border-line bg-panel text-mid",
                )}
              >
                {f.label}
                <span className="label-xs">{values[f.name] ? "Yes" : "No"}</span>
              </button>
            ) : (
              <input
                type={f.type === "date" ? "date" : f.type === "money" || f.type === "number" ? "text" : "text"}
                inputMode={f.type === "money" || f.type === "number" ? "decimal" : undefined}
                value={values[f.name] ?? ""}
                onChange={(e) => set(f.name, e.target.value)}
                placeholder={f.placeholder}
                required={f.required}
                className={inputCls}
              />
            )}
          </Field>
        </div>
      ))}
      <div className="col-span-2 mt-1 flex items-center justify-between gap-3">
        {onDelete ? (
          <button type="button" onClick={onDelete} className="border border-alert/40 px-3 py-2 text-[12px] font-medium text-alert transition-colors hover:bg-alert/10">
            {deleteLabel || "Delete"}
          </button>
        ) : (
          <span />
        )}
        <GoldButton type="submit" disabled={busy} className="px-6">
          {busy ? <Spinner className="border-ink/40 border-t-ink" /> : submitLabel}
        </GoldButton>
      </div>
    </form>
  );
};

// ------------------------------------------------------------- data table
export const DataTable = ({ columns, rows, onRow, empty = "No records yet.", minWidth = 640 }) => (
  <div className="overflow-x-auto">
    {rows.length === 0 ? (
      <p className="px-4 py-8 text-center text-[12px] text-dim">{empty}</p>
    ) : (
      <table className="w-full text-left" style={{ minWidth }}>
        <thead>
          <tr className="border-b border-line">
            {columns.map((c) => (
              <th key={c.key} className={cn("label-xs px-4 py-2 font-normal", c.align === "right" && "text-right")}>
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr
              key={r.id || i}
              onClick={onRow ? () => onRow(r) : undefined}
              className={cn("border-b border-line/60 last:border-0", onRow && "cursor-pointer transition-colors hover:bg-tint/[0.02]")}
            >
              {columns.map((c) => (
                <td key={c.key} className={cn("px-4 py-2.5 text-[12.5px] text-body", c.align === "right" && "tnum text-right")}>
                  {c.render ? c.render(r) : r[c.key] ?? "—"}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    )}
  </div>
);

// ------------------------------------------------------------- summary card
export const SummaryCard = ({ label, value, sub, tone = "default", onClick, unavailable }) => {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp
      type={onClick ? "button" : undefined}
      onClick={onClick}
      className={cn(
        "group border border-line bg-panel px-4 py-3 text-left transition-colors",
        onClick && "cursor-pointer hover:border-line-strong",
      )}
    >
      <div className="label-xs">{label}</div>
      <div
        className={cn(
          "mt-1 tnum text-lg font-semibold tracking-tight",
          unavailable ? "text-faint" : tone === "alert" ? "text-alert" : tone === "ok" ? "text-ok" : "text-strong",
        )}
      >
        {unavailable ? "—" : value}
      </div>
      {sub ? <div className={cn("mt-0.5 text-[10.5px]", unavailable ? "text-faint italic" : "text-dim")}>{sub}</div> : null}
    </Comp>
  );
};

// ------------------------------------------------------------- source transparency
export const SourceTag = ({ source, syncedAt, status = "ok", onRefresh, refreshing }) => (
  <span className="inline-flex items-center gap-2 text-[10px] text-dim">
    <span
      className={cn("h-1.5 w-1.5 rounded-full", status === "error" ? "bg-alert" : status === "pending" ? "bg-gold animate-pulse-dot" : "bg-ok")}
      aria-hidden="true"
    />
    <span className="uppercase tracking-[0.14em]">{source}</span>
    {syncedAt ? <span className="tnum normal-case tracking-normal">synced {fmtDateTime(syncedAt)}</span> : null}
    {onRefresh ? (
      <button type="button" onClick={onRefresh} disabled={refreshing} title="Refresh from source" className="text-dim transition-colors hover:text-gold disabled:opacity-50">
        <RefreshCw size={11} strokeWidth={1.5} className={refreshing ? "animate-spin" : ""} />
      </button>
    ) : null}
  </span>
);

// ------------------------------------------------------------- sub tabs
export const SubTabs = ({ tabs, active, onChange }) => (
  <div className="flex flex-wrap items-center gap-1 border-b border-line">
    {tabs.map((t) => (
      <button
        key={t}
        type="button"
        onClick={() => onChange(t)}
        className={cn(
          "-mb-px border-b-2 px-3.5 py-2 text-[12.5px] font-medium transition-colors",
          active === t ? "border-gold text-strong" : "border-transparent text-mid hover:text-strong",
        )}
      >
        {t}
      </button>
    ))}
  </div>
);

// ------------------------------------------------------------- misc
export const EmptyState = ({ icon: Icon, title, body, children }) => (
  <div className="flex flex-col items-center border border-line bg-panel px-6 py-14 text-center">
    {Icon ? <Icon size={20} strokeWidth={1.25} className="text-gold" /> : null}
    <h3 className="mt-3 font-serif text-2xl font-light text-strong">{title}</h3>
    {body ? <p className="mt-2 max-w-md text-[13px] leading-relaxed text-mid">{body}</p> : null}
    {children ? <div className="mt-5 flex flex-wrap justify-center gap-3">{children}</div> : null}
  </div>
);

export const Expandable = ({ title, meta, defaultOpen = false, right, children }) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="border border-line bg-panel">
      <div className="flex w-full items-center justify-between gap-3 border-b border-transparent bg-surface/70 px-4 py-2.5">
        <button type="button" onClick={() => setOpen((v) => !v)} className="flex flex-1 items-center gap-2.5 text-left">
          <ChevronDown size={14} strokeWidth={1.5} className={cn("text-dim transition-transform", open ? "rotate-0" : "-rotate-90")} />
          <span className="text-[13px] font-medium text-strong">{title}</span>
          {meta ? <span className="label-xs">{meta}</span> : null}
        </button>
        {right}
      </div>
      {open ? <div className="border-t border-line">{children}</div> : null}
    </div>
  );
};

const PRIORITY_MAP = {
  1: ["Emergency", "urgent"],
  2: ["Overdue", "urgent"],
  3: ["Waiting", "warn"],
  4: ["Upcoming", "neutral"],
  emergency: ["Emergency", "urgent"],
  high: ["High", "warn"],
  medium: ["Medium", "neutral"],
  low: ["Low", "neutral"],
};

export const priorityLabel = (p) => (PRIORITY_MAP[p] || [String(p || "—")])[0];

export const PriorityChip = ({ p }) => {
  const [label, tone] = PRIORITY_MAP[p] || [String(p || "—"), "neutral"];
  return <ToneBadge tone={tone}>{label}</ToneBadge>;
};

export { GhostButton, GoldButton, Spinner, ToneBadge };
