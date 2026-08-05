import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AlertTriangle, Check, Circle } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { fmtDate } from "@/lib/fmt";
import { useList } from "@/lib/hooks";
import { cn } from "@/lib/utils";
import { Field, GhostButton, GoldButton, inputCls } from "./ui";
import { StatusBadge } from "@/components/landing/primitives";

/* Remediation tracker for a single city violation: where it stands, what is
   still required before it can be certified, and who changed what. */

export const STAGES = [
  { key: "detected", label: "Detected", note: "Agency issued violation" },
  { key: "explained", label: "Explained", note: "Plain-language summary" },
  { key: "assigned", label: "Assigned", note: "Vendor + deadline" },
  { key: "corrected", label: "Corrected", note: "Work performed" },
  { key: "documented", label: "Documented", note: "Photos + report" },
  { key: "certified", label: "Certified", note: "Filed with agency" },
  { key: "cleared", label: "Cleared", note: "Violation closed" },
];

export const stageIndex = (key) => Math.max(STAGES.findIndex((s) => s.key === key), 0);

/* An agency-closed violation is cleared regardless of our own bookkeeping. */
export const effectiveStage = (item, tracking) =>
  item?.extra?.open === false ? "cleared" : tracking?.stage || "detected";

export const stageLabel = (key) => STAGES[stageIndex(key)].label;

/* The eight things that must be true before certification. The first three come
   from the agency record; the rest are the team's own work. */
export const requirementsFor = ({ item, tracking = {}, buildingLabel, vendorName }) => {
  const apt = tracking.unit || item?.extra?.apartment || "";
  const due = tracking.target_date || item?.extra?.correct_by || "";
  const overdue = !!due && due < new Date().toISOString().slice(0, 10) && item?.extra?.open !== false;
  return [
    { key: "property", label: "Property", value: buildingLabel || "—", done: !!buildingLabel },
    { key: "unit", label: "Unit", value: apt || "Not set", done: !!apt, editable: "unit" },
    {
      key: "target_date",
      label: "Correction deadline",
      value: due ? fmtDate(due) : "Not set",
      done: !!due,
      tone: overdue ? "alert" : null,
      editable: "target_date",
    },
    {
      key: "vendor_id",
      label: "Assigned vendor",
      value: vendorName || tracking.assignee || "Unassigned",
      done: !!(tracking.vendor_id || tracking.assignee),
      editable: "vendor_id",
    },
    { key: "access_confirmed", label: "Access confirmed", value: tracking.access_confirmed ? "Yes" : "Not confirmed", done: !!tracking.access_confirmed, toggle: true },
    { key: "before_photos", label: "Before photos", value: tracking.before_photos ? "Uploaded" : "Pending", done: !!tracking.before_photos, toggle: true },
    { key: "treatment_report", label: "Treatment report", value: tracking.treatment_report ? "Filed" : "Pending", done: !!tracking.treatment_report, toggle: true },
    { key: "certification", label: "Certification", value: tracking.certification ? "Filed with agency" : "Not ready", done: !!tracking.certification, toggle: true },
  ];
};

export const readiness = (reqs) => {
  const met = reqs.filter((r) => r.done).length;
  return { met, total: reqs.length, pct: Math.round((met / reqs.length) * 100) };
};

const Stepper = ({ current, onPick, disabled }) => (
  <div className="relative border border-line bg-surface px-4 py-5">
    <div className="absolute left-[3.2rem] right-[3.2rem] top-[2.6rem] hidden h-px bg-line md:block" aria-hidden="true" />
    <ol className="relative grid grid-cols-2 gap-4 sm:grid-cols-4 md:grid-cols-7 md:gap-1">
      {STAGES.map((s, i) => {
        const done = i < current;
        const active = i === current;
        return (
          <li key={s.key} className="flex items-start gap-2.5 md:flex-col md:items-center md:gap-0 md:text-center">
            <button
              type="button"
              disabled={disabled}
              onClick={() => onPick(s.key)}
              title={disabled ? "Cleared by the agency" : `Mark as ${s.label}`}
              aria-current={active ? "step" : undefined}
              className={cn(
                "tnum relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[10px] transition-colors",
                done && "border-ok/50 bg-ok/10 text-ok",
                active && "border-gold bg-gold/15 text-gold",
                !done && !active && "border-line bg-panel text-faint",
                !disabled && "hover:border-gold/70",
              )}
            >
              {done ? <Check size={12} strokeWidth={2} /> : i + 1}
            </button>
            <div className="md:mt-2.5">
              <div className={cn("text-[12px] font-medium", active ? "text-gold" : done ? "text-body" : "text-dim")}>{s.label}</div>
              <div className="mt-0.5 text-[10.5px] text-dim">{s.note}</div>
            </div>
          </li>
        );
      })}
    </ol>
  </div>
);

export const ViolationTracker = ({ item, buildingId, buildingLabel, onCreateWorkOrder }) => {
  const qc = useQueryClient();
  const { data: vendors = [] } = useList("vendors", null);
  const [entry, setEntry] = useState("");

  const { data: tracking } = useQuery({
    queryKey: ["violation-tracking", item.id],
    queryFn: () => api.get(`/violations/${item.id}/tracking`).then((r) => r.data),
  });
  const t = tracking || {};

  const save = useMutation({
    mutationFn: (patch) => api.put(`/violations/${item.id}/tracking`, { building_id: buildingId, ...patch }).then((r) => r.data),
    onSuccess: (data) => {
      qc.setQueryData(["violation-tracking", item.id], data);
      qc.invalidateQueries({ queryKey: ["violation-tracking-map"] });
      qc.invalidateQueries({ queryKey: ["e", "activity"] });
      setEntry("");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const closedByAgency = item.extra?.open === false;
  const current = stageIndex(effectiveStage(item, t));
  const vendorName = vendors.find((v) => v.id === t.vendor_id)?.name;
  const reqs = requirementsFor({ item, tracking: t, buildingLabel, vendorName });
  const { met, total, pct } = readiness(reqs);
  const outstanding = reqs.filter((r) => !r.done);

  const patch = (p, msg) => save.mutate(p, { onSuccess: () => msg && toast.success(msg) });

  return (
    <div className="space-y-5">
      <Stepper current={current} disabled={closedByAgency} onPick={(k) => patch({ stage: k }, `Moved to ${stageLabel(k)}`)} />

      <div className="grid gap-5 lg:grid-cols-[1.15fr_1fr]">
        {/* --------------------------------------------------- record */}
        <div className="border border-line bg-panel p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="flex min-w-0 items-start gap-2.5">
              <AlertTriangle size={15} strokeWidth={1.5} className={cn("mt-0.5 shrink-0", item.tone === "urgent" ? "text-alert" : "text-gold")} />
              <h3 className="font-serif text-lg leading-snug text-strong">{item.title}</h3>
            </div>
            <StatusBadge status={closedByAgency ? "Cleared" : item.tone === "urgent" ? "Urgent" : "In Progress"} />
          </div>
          <p className="tnum mt-2 text-[11px] text-dim">
            #{item.id}
            {item.extra?.class ? ` · Class ${item.extra.class}` : ""} · Issued {fmtDate(item.date)}
          </p>

          <dl className="mt-5 divide-y divide-line/70">
            {reqs.map((r) => (
              <div key={r.key} className="flex items-center justify-between gap-4 py-2.5">
                <dt className="text-[12px] text-dim">{r.label}</dt>
                <dd className="flex items-center gap-2 text-right">
                  <span className={cn("text-[13px]", r.tone === "alert" ? "text-alert" : r.done ? "text-body" : "text-dim")}>{r.value}</span>
                  {r.toggle ? (
                    <button
                      type="button"
                      disabled={save.isPending}
                      onClick={() => patch({ [r.key]: !r.done }, `${r.done ? "Cleared" : "Marked"}: ${r.label}`)}
                      aria-label={`${r.done ? "Unmark" : "Mark"} ${r.label}`}
                      className={cn("transition-colors", r.done ? "text-ok hover:text-mid" : "text-faint hover:text-gold")}
                    >
                      {r.done ? <Check size={13} strokeWidth={2} /> : <Circle size={11} strokeWidth={1.5} />}
                    </button>
                  ) : r.done ? (
                    <Check size={13} strokeWidth={2} className="text-ok" />
                  ) : (
                    <Circle size={11} strokeWidth={1.5} className="text-faint" />
                  )}
                </dd>
              </div>
            ))}
          </dl>

          {/* assignment */}
          <div className="mt-5 grid grid-cols-2 gap-3 border-t border-line pt-4">
            <Field label="Unit / apartment">
              <input
                defaultValue={t.unit || item.extra?.apartment || ""}
                onBlur={(e) => e.target.value !== (t.unit || "") && patch({ unit: e.target.value })}
                placeholder="e.g. 3B"
                className={inputCls}
              />
            </Field>
            <Field label="Correction deadline">
              <input
                type="date"
                defaultValue={t.target_date || item.extra?.correct_by || ""}
                onBlur={(e) => e.target.value !== (t.target_date || "") && patch({ target_date: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Assigned vendor">
              <select value={t.vendor_id || ""} onChange={(e) => patch({ vendor_id: e.target.value })} className={cn(inputCls, "appearance-none")}>
                <option value="">Select vendor…</option>
                {vendors.map((v) => (
                  <option key={v.id} value={v.id}>{v.name}</option>
                ))}
              </select>
            </Field>
            <Field label="Responsible person">
              <input
                defaultValue={t.assignee || ""}
                onBlur={(e) => e.target.value !== (t.assignee || "") && patch({ assignee: e.target.value })}
                placeholder="e.g. J. Ortiz"
                className={inputCls}
              />
            </Field>
          </div>
        </div>

        {/* --------------------------------------------------- readiness */}
        <div className="flex flex-col border border-line bg-panel p-5">
          <div className="label-xs">Required before certification</div>
          <div className="mt-3 flex items-end justify-between">
            <span className="tnum font-serif text-4xl text-strong">{pct}%</span>
            <span className="text-[11px] text-dim">{met} of {total} requirements met</span>
          </div>
          <div
            className="mt-3 h-1.5 w-full overflow-hidden bg-surface"
            role="progressbar"
            aria-valuenow={pct}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Certification readiness"
          >
            <div className="h-full bg-gold transition-all duration-500" style={{ width: `${pct}%` }} />
          </div>

          <ul className="mt-5 space-y-2">
            {outstanding.map((r) => (
              <li key={r.key} className="flex items-center justify-between gap-2 border border-line bg-surface px-3 py-2.5">
                <span className="text-[12px] text-mid">{r.label}</span>
                {r.toggle ? (
                  <button
                    type="button"
                    onClick={() => patch({ [r.key]: true }, `Marked: ${r.label}`)}
                    className="border border-line px-2 py-0.5 text-[10px] font-medium uppercase tracking-[0.08em] text-mid transition-colors hover:border-gold/50 hover:text-gold"
                  >
                    Mark done
                  </button>
                ) : (
                  <StatusBadge status="Not Started" />
                )}
              </li>
            ))}
            {outstanding.length === 0 && (
              <li className="border border-ok/30 bg-ok/[0.06] px-3 py-2.5 text-[12px] text-ok">
                All requirements met — ready to certify with the agency.
              </li>
            )}
          </ul>

          {onCreateWorkOrder && (
            <GhostButton onClick={() => onCreateWorkOrder(item)} className="mt-4 w-full py-1.5 text-[12px]">
              Create work order from this violation
            </GhostButton>
          )}

          {/* --------------------------------------------- history */}
          <div className="mt-5 border-t border-line pt-4">
            <div className="label-xs">Record of activity</div>
            <ul className="mt-2.5 max-h-[190px] space-y-2 overflow-y-auto pr-1">
              {[...(t.history || [])].reverse().map((h, i) => (
                <li key={`${h.at}-${i}`} className="border-l-2 border-line pl-3">
                  <p className="text-[11.5px] text-body">{h.note}</p>
                  <p className="tnum mt-0.5 text-[10px] text-dim">
                    {stageLabel(h.stage)} · {h.by} · {fmtDate(h.at)}
                  </p>
                </li>
              ))}
              {!(t.history || []).length && <li className="text-[11.5px] text-dim">Nothing recorded yet.</li>}
            </ul>
            <div className="mt-3 flex gap-2">
              <input
                value={entry}
                onChange={(e) => setEntry(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && entry.trim() && patch({ entry: entry.trim() })}
                placeholder="Add a note to the record…"
                className={cn(inputCls, "py-1.5 text-[12px]")}
              />
              <GoldButton disabled={!entry.trim() || save.isPending} onClick={() => patch({ entry: entry.trim() })} className="shrink-0 px-3 py-1.5 text-[12px]">
                Log
              </GoldButton>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
