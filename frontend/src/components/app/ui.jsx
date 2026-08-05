import { useState } from "react";
import { AlertTriangle, Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";
import { fmtDate } from "@/lib/fmt";

/* Shared UI for the operating app — same visual language as the landing template. */

export const Panel = ({ children, className }) => (
  <div className={cn("border border-line bg-panel", className)}>{children}</div>
);

export const PanelHead = ({ title, meta, right, className, open, onToggle }) => (
  <div className={cn("flex flex-wrap items-center justify-between gap-2 border-b border-line bg-surface/70 px-4 py-2.5", className)}>
    <div className="flex items-baseline gap-3">
      {onToggle ? (
        <button type="button" onClick={onToggle} aria-expanded={open} className="flex items-center gap-2 text-left">
          <ChevronDown
            size={13}
            strokeWidth={1.5}
            className={cn("shrink-0 text-dim transition-transform", open ? "rotate-0" : "-rotate-90")}
            aria-hidden="true"
          />
          <h3 className="text-[13px] font-medium tracking-tight text-strong">{title}</h3>
        </button>
      ) : (
        <h3 className="text-[13px] font-medium tracking-tight text-strong">{title}</h3>
      )}
      {meta ? <span className="label-xs">{meta}</span> : null}
    </div>
    {right}
  </div>
);

const TONE = {
  urgent: "text-alert bg-alert/10 border-alert/25",
  warn: "text-gold bg-gold/10 border-gold/25",
  ok: "text-ok bg-ok/10 border-ok/25",
  neutral: "text-mid bg-tint/[0.04] border-tint/10",
};

export const ToneBadge = ({ tone = "neutral", children, className }) => (
  <span
    className={cn(
      "inline-flex items-center border px-2 py-[3px] text-[10px] font-medium uppercase tracking-[0.1em] whitespace-nowrap",
      TONE[tone] || TONE.neutral,
      className,
    )}
  >
    {children}
  </span>
);

export const ClassChip = ({ k }) => (
  <span
    className={cn(
      "inline-flex h-5 w-5 shrink-0 items-center justify-center border text-[10px] font-semibold",
      k === "C" || k === "I"
        ? "border-alert/40 text-alert"
        : k === "B"
          ? "border-gold/40 text-gold"
          : "border-line text-mid",
    )}
  >
    {k}
  </span>
);

export const DataRow = ({ item, lead, onClick }) => (
  <li
    onClick={onClick}
    className={cn("flex items-start justify-between gap-3 px-4 py-2.5", onClick && "cursor-pointer transition-colors hover:bg-tint/[0.02]")}
  >
    <div className="flex min-w-0 items-start gap-2.5">
      {lead}
      <div className="min-w-0">
        <p className="text-[13px] leading-snug text-body">{item.title}</p>
        {item.sub ? <p className="mt-0.5 truncate text-[11px] text-dim">{item.sub}</p> : null}
      </div>
    </div>
    <div className="flex shrink-0 flex-col items-end gap-1">
      <ToneBadge tone={item.tone}>{item.badge || "—"}</ToneBadge>
      <span className="tnum text-[10px] text-dim">{fmtDate(item.date)}</span>
    </div>
  </li>
);

const RowCheckbox = ({ checked, onToggle }) => (
  <button
    type="button"
    role="checkbox"
    aria-checked={checked}
    aria-label={checked ? "Deselect record" : "Select record"}
    onClick={onToggle}
    className={cn(
      "mt-[3px] flex h-3.5 w-3.5 shrink-0 items-center justify-center border transition-colors",
      checked ? "border-gold bg-gold text-ink" : "border-line-strong hover:border-gold/70",
    )}
  >
    {checked ? <Check size={10} strokeWidth={3} /> : null}
  </button>
);

export const DatasetPanel = ({
  ds,
  leadFor,
  initial = 8,
  className,
  filters,
  selectable,
  canSelect = (it) => !!it?.extra?.open,
  bulkLabel = "Create work order",
  onBulk,
  bulkBusy,
  columns,
  onRowClick,
}) => {
  const [all, setAll] = useState(false);
  const [expanded, setExpanded] = useState(true);
  const [filterKey, setFilterKey] = useState(filters?.[0]?.key);
  const [sel, setSel] = useState(() => new Set());
  if (!ds) return null;

  const activeFilter = filters?.find((f) => f.key === filterKey) || null;
  const rows = activeFilter ? ds.items.filter(activeFilter.test) : ds.items;
  const items = all ? rows : rows.slice(0, initial);
  const selectableRows = selectable ? rows.filter((it) => canSelect(it)) : [];
  const selected = selectableRows.filter((it) => sel.has(it.id));

  const setFilter = (key) => {
    setFilterKey(key);
    setSel(new Set());
    setAll(false);
  };
  const toggleExpanded = () => {
    if (expanded) setSel(new Set());
    setExpanded(!expanded);
  };
  const toggleSel = (id) =>
    setSel((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const runBulk = () =>
    Promise.resolve(onBulk?.(selected))
      .then(() => setSel(new Set()))
      .catch(() => {});

  return (
    <Panel className={className}>
      <PanelHead
        title={ds.label}
        meta={`${activeFilter ? `${rows.length} of ${ds.count}` : ds.count} record${ds.count === 1 ? "" : "s"} · ${ds.source}`}
        right={<span className="label-xs text-faint">NYC Open Data</span>}
        open={expanded}
        onToggle={toggleExpanded}
        className={expanded ? undefined : "border-b-0"}
      />
      {expanded && filters?.length ? (
        <div className="flex flex-wrap items-center gap-1 border-b border-line/60 px-2 py-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              type="button"
              onClick={() => setFilter(f.key)}
              className={cn(
                "px-2 py-1 text-[10.5px] font-medium uppercase tracking-[0.08em] transition-colors",
                filterKey === f.key ? "bg-gold/10 text-gold" : "text-dim hover:text-strong",
              )}
            >
              {f.label} <span className="tnum ml-0.5 opacity-70">{ds.items.filter(f.test).length}</span>
            </button>
          ))}
        </div>
      ) : null}
      {expanded && selectable && selected.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gold/25 bg-gold/[0.05] px-4 py-2">
          <span className="text-[12px] font-medium text-body">
            {selected.length} selected
            {selected.length < selectableRows.length && (
              <button
                type="button"
                onClick={() => setSel(new Set(selectableRows.map((it) => it.id)))}
                className="ml-3 text-[11px] font-medium text-gold transition-colors hover:text-gold-hover"
              >
                Select all {selectableRows.length}
              </button>
            )}
          </span>
          <span className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setSel(new Set())}
              className="border border-line px-2.5 py-1 text-[11px] font-medium text-mid transition-colors hover:border-line-strong hover:text-strong"
            >
              Clear
            </button>
            <button
              type="button"
              disabled={bulkBusy}
              onClick={runBulk}
              className="bg-gold px-3 py-1 text-[11px] font-medium text-ink transition-colors hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-50"
            >
              {bulkBusy ? "Creating…" : `${bulkLabel}${selected.length > 1 ? ` (${selected.length})` : ""}`}
            </button>
          </span>
        </div>
      )}
      {!expanded ? null : ds.error ? (
        <div className="flex items-center gap-2 px-4 py-3 text-[12px] text-alert">
          <AlertTriangle size={13} strokeWidth={1.5} /> Source unavailable: {ds.error}
        </div>
      ) : ds.count === 0 ? (
        <p className="px-4 py-4 text-[12px] text-dim">No records on file for this building.</p>
      ) : rows.length === 0 ? (
        <p className="px-4 py-4 text-[12px] text-dim">
          No {activeFilter ? `${activeFilter.label.toLowerCase()} ` : ""}records for this building.
        </p>
      ) : (
        <>
          {columns ? (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] border-collapse text-left">
                <thead>
                  <tr className="border-b border-line">
                    {selectable ? <th className="w-9 px-4 py-2.5" aria-label="Select" /> : null}
                    {columns.map((c) => (
                      <th key={c.key} scope="col" className={cn("label-xs px-4 py-2.5 font-normal", c.align === "right" && "text-right")}>
                        {c.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {items.map((it) => (
                    <tr
                      key={it.id + (it.date || "")}
                      onClick={onRowClick ? () => onRowClick(it) : undefined}
                      className={cn("border-b border-line/60 last:border-0", onRowClick && "cursor-pointer transition-colors hover:bg-tint/[0.02]")}
                    >
                      {selectable ? (
                        <td className="px-4 py-3 align-top" onClick={(e) => e.stopPropagation()}>
                          {canSelect(it) ? <RowCheckbox checked={sel.has(it.id)} onToggle={() => toggleSel(it.id)} /> : null}
                        </td>
                      ) : null}
                      {columns.map((c) => (
                        <td key={c.key} className={cn("px-4 py-3 align-top text-[12.5px] text-mid", c.align === "right" && "tnum text-right")}>
                          {c.render(it)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <ul className="divide-y divide-line/70">
              {items.map((it) => (
                <DataRow
                  key={it.id + (it.date || "")}
                  item={it}
                  onClick={onRowClick ? () => onRowClick(it) : undefined}
                  lead={
                    selectable || leadFor ? (
                      <span className="flex items-start gap-2" onClick={(e) => e.stopPropagation()}>
                        {selectable ? (
                          canSelect(it) ? (
                            <RowCheckbox checked={sel.has(it.id)} onToggle={() => toggleSel(it.id)} />
                          ) : (
                            <span className="mt-[3px] h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                          )
                        ) : null}
                        {leadFor ? leadFor(it) : null}
                      </span>
                    ) : null
                  }
                />
              ))}
            </ul>
          )}
          {rows.length > initial && (
            <button
              type="button"
              onClick={() => setAll((v) => !v)}
              className="flex w-full items-center justify-center gap-1.5 border-t border-line px-4 py-2 text-[11px] font-medium text-mid transition-colors hover:text-gold"
            >
              {all ? "Show fewer" : `Show all ${rows.length}`}
              <ChevronDown size={12} className={cn("transition-transform", all && "rotate-180")} />
            </button>
          )}
        </>
      )}
    </Panel>
  );
};

export const LiveDot = ({ label = "Live" }) => (
  <span className="flex items-center gap-1.5 text-[10px] text-ok">
    <span className="h-1 w-1 rounded-full bg-ok animate-pulse-dot" aria-hidden="true" />
    {label}
  </span>
);

export const GoldButton = ({ children, className, ...rest }) => (
  <button
    type="button"
    className={cn(
      "inline-flex items-center justify-center gap-2 bg-gold px-4 py-2 text-[13px] font-medium text-ink transition-colors duration-200 hover:bg-gold-hover disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);

export const GhostButton = ({ children, className, ...rest }) => (
  <button
    type="button"
    className={cn(
      "inline-flex items-center justify-center gap-2 border border-line px-4 py-2 text-[13px] font-medium text-body transition-colors hover:border-line-strong hover:bg-tint/[0.03] hover:text-strong disabled:cursor-not-allowed disabled:opacity-50",
      className,
    )}
    {...rest}
  >
    {children}
  </button>
);

export const Spinner = ({ className }) => (
  <span
    className={cn("inline-block h-3.5 w-3.5 animate-spin rounded-full border border-line-strong border-t-gold", className)}
    aria-label="Loading"
  />
);

export const PageLoading = ({ label = "Loading portfolio…" }) => (
  <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3">
    <Spinner className="h-5 w-5" />
    <p className="label-xs">{label}</p>
  </div>
);

export const Field = ({ label, children }) => (
  <label className="block">
    <span className="label-xs">{label}</span>
    <div className="mt-1.5">{children}</div>
  </label>
);

export const inputCls =
  "w-full border border-line bg-panel px-3.5 py-2.5 text-sm text-strong placeholder:text-faint outline-none transition-colors focus:border-gold/70";
