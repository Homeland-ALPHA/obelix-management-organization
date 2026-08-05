import { useMemo, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { fmtDate, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { useList, useSave, useRemove, useSettings } from "@/lib/hooks";
import { AutoForm, DataTable, GoldButton, Modal, PriorityChip, SubTabs, SummaryCard, ToneBadge } from "@/components/app/kit";
import { Panel, PanelHead } from "@/components/app/ui";
import { StatusBadge } from "@/components/landing/primitives";
import { cn } from "@/lib/utils";

const STATUSES = [
  "Submitted", "Under Review", "Approval Required", "Approved", "Assigned", "Scheduled",
  "In Progress", "Waiting for Parts", "Waiting for Access", "Completed", "Inspected", "Closed",
];
const DONE = ["Completed", "Inspected", "Closed"];
/* dropStatus is what a card becomes when dragged into the column; dragging
   within a column is a no-op so sub-states like "Waiting for Parts" survive. */
const BOARD_COLUMNS = [
  { label: "Intake", statuses: ["Submitted", "Under Review"], dropStatus: "Submitted" },
  { label: "Approval", statuses: ["Approval Required", "Approved"], dropStatus: "Approval Required" },
  { label: "Scheduled", statuses: ["Assigned", "Scheduled"], dropStatus: "Scheduled" },
  { label: "In progress", statuses: ["In Progress", "Waiting for Parts", "Waiting for Access"], dropStatus: "In Progress" },
  { label: "Done", statuses: DONE, dropStatus: "Completed" },
];
const CATEGORIES = ["plumbing", "electrical", "heating", "appliance", "pest", "doors_locks", "leak", "structural", "cleaning", "other"];

const WorkOrdersPage = () => {
  const { selectedId, isPortfolio, buildings } = useBuilding();
  const [view, setView] = useState("Board");
  const [modal, setModal] = useState(null);
  // dragRef drives drop acceptance (must be readable in the same tick as the
  // dragover that precedes the first re-render); dragId only drives visuals.
  const dragRef = useRef(null);
  const [dragId, setDragId] = useState(null);
  const [dragOver, setDragOver] = useState(null);
  const { data: settings } = useSettings();

  const { data: wos = [] } = useList("work_orders", selectedId);
  const { data: units = [] } = useList("units", selectedId);
  const { data: vendors = [] } = useList("vendors", null);

  const save = useSave("work_orders", { onDone: () => setModal(null) });
  const remove = useRemove("work_orders", { onDone: () => setModal(null) });
  const quick = useSave("work_orders");

  const bname = (id) => buildings.find((b) => b.id === id)?.label || "";
  const unitName = (id) => (units.find((u) => u.id === id) ? `Unit ${units.find((u) => u.id === id).number}` : null);
  const vendorName = (id) => vendors.find((v) => v.id === id)?.name || null;

  const threshold = settings?.approval_threshold ?? 1000;

  const fields = [
    ...(isPortfolio
      ? [{ name: "building_id", label: "Building", type: "select", options: buildings.map((b) => ({ value: b.id, label: b.label })), required: true }]
      : []),
    { name: "title", label: "Issue title", required: true },
    { name: "category", label: "Category", type: "select", options: CATEGORIES.map((c) => ({ value: c, label: c.replace(/_/g, " ") })), half: true },
    { name: "priority", label: "Priority", type: "select", options: ["low", "medium", "high", "emergency"], half: true },
    { name: "unit_id", label: "Unit", type: "select", options: units.map((u) => ({ value: u.id, label: `Unit ${u.number}` })), half: true },
    { name: "area", label: "Common area (if not a unit)", half: true },
    { name: "description", label: "Description", type: "textarea" },
    { name: "reported_by", label: "Reported by", half: true },
    { name: "tenant_contact", label: "Tenant contact", half: true },
    { name: "entry_permission", label: "Permission to enter", type: "toggle", half: true },
    { name: "access_time", label: "Preferred access time", half: true },
    { name: "assignee", label: "Assigned employee", half: true },
    { name: "vendor_id", label: "Assigned vendor", type: "select", options: vendors.map((v) => ({ value: v.id, label: v.name })), half: true },
    { name: "est_cost", label: "Estimated cost", type: "money", half: true },
    { name: "target_date", label: "Target completion", type: "date", half: true },
    { name: "status", label: "Status", type: "select", options: STATUSES, half: true },
    { name: "related_violation", label: "Related violation #", half: true },
    { name: "notes", label: "Internal notes", type: "textarea" },
  ];

  const submitWo = (v, existing) => {
    let status = v.status || "Submitted";
    // approval threshold rule
    if (!existing && (v.est_cost || 0) >= threshold && status === "Submitted") {
      status = "Approval Required";
      toast.info(`Estimated cost ≥ ${fmtMoney(threshold)} — routed for approval`);
    }
    // completion requirements
    if (DONE.includes(status) && !DONE.includes(existing?.status)) {
      if (!v.final_cost && !existing?.final_cost) {
        toast.error("Enter the final cost before closing a work order");
        return;
      }
    }
    save.mutate({ ...v, status, id: existing?.id, building_id: existing?.building_id || v.building_id || selectedId });
  };

  /* Board drag-and-drop. Closing still requires a final cost, so a drag into
     Done without one sends the card to its form instead of silently failing. */
  const dropOn = (w, col) => {
    if (!w || col.statuses.includes(w.status)) return;
    const status = col.dropStatus;
    if (DONE.includes(status) && !w.final_cost) {
      toast.error("Enter the final cost before closing this work order");
      setModal({ row: w });
      return;
    }
    const payload = { id: w.id, status };
    if (DONE.includes(status)) {
      payload.completed = {
        ...(w.completed || {}),
        date: w.completed?.date || new Date().toISOString().slice(0, 10),
        by: w.assignee || vendorName(w.vendor_id) || "—",
      };
    }
    quick.mutate(payload, { onSuccess: () => toast.success(`Moved to ${status}`) });
  };

  const open = wos.filter((w) => !DONE.includes(w.status));
  const analytics = useMemo(() => {
    const byStatus = {};
    STATUSES.forEach((s) => (byStatus[s] = wos.filter((w) => w.status === s).length));
    const done = wos.filter((w) => DONE.includes(w.status) && w.completed?.date && w.created_at);
    const avgDays = done.length
      ? Math.round(done.reduce((a, w) => a + (new Date(w.completed.date) - new Date(w.created_at)) / 864e5, 0) / done.length)
      : null;
    return { byStatus, avgDays, emergencies: wos.filter((w) => w.priority === "emergency" && !DONE.includes(w.status)).length, totalCost: wos.reduce((a, w) => a + (w.final_cost || 0), 0) };
  }, [wos]);

  const Card = ({ w }) => (
    <button
      type="button"
      onClick={() => setModal({ row: w })}
      draggable
      onDragStart={(e) => {
        e.dataTransfer.effectAllowed = "move";
        e.dataTransfer.setData("text/plain", w.id);
        dragRef.current = w.id;
        setDragId(w.id);
      }}
      onDragEnd={() => {
        dragRef.current = null;
        setDragId(null);
        setDragOver(null);
      }}
      className={cn(
        "w-full cursor-grab border border-line bg-panel px-3 py-2.5 text-left transition-colors hover:border-line-strong active:cursor-grabbing",
        dragId === w.id && "opacity-40",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 truncate text-[12.5px] text-body">{w.title}</p>
        <PriorityChip p={w.priority} />
      </div>
      <p className="mt-1 truncate text-[10.5px] text-dim">
        {isPortfolio ? `${bname(w.building_id)} · ` : ""}
        {unitName(w.unit_id) || w.area || "Common area"} · {w.assignee || vendorName(w.vendor_id) || "unassigned"}
      </p>
      <div className="mt-1.5 flex items-center justify-between">
        <StatusBadge status={w.status === "Approval Required" ? "Awaiting Approval" : w.status} />
        <span className="tnum text-[10px] text-dim">{w.est_cost ? fmtMoney(w.est_cost) : ""}</span>
      </div>
    </button>
  );

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs text-gold/90">Work orders</p>
          <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">Submission to completion.</h1>
        </div>
        <GoldButton onClick={() => setModal({})} disabled={isPortfolio && !wos.length && false} className="px-4 py-2 text-[12.5px]">
          <Plus size={13} /> New work order
        </GoldButton>
      </div>

      <div className="mt-5">
        <SubTabs tabs={["Board", "List", "Analytics"]} active={view} onChange={setView} />
      </div>

      {view === "Board" && (
        <div className="mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-5">
          {BOARD_COLUMNS.map((col) => {
            const items = wos.filter((w) => col.statuses.includes(w.status));
            const dragged = dragId ? wos.find((w) => w.id === dragId) : null;
            const isTarget = dragOver === col.label && dragged && !col.statuses.includes(dragged.status);
            return (
              <div
                key={col.label}
                onDragOver={(e) => {
                  if (!dragRef.current) return;
                  e.preventDefault();
                  e.dataTransfer.dropEffect = "move";
                  setDragOver(col.label);
                }}
                onDragLeave={(e) => {
                  if (!e.currentTarget.contains(e.relatedTarget)) setDragOver(null);
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  const id = e.dataTransfer.getData("text/plain") || dragRef.current;
                  dragRef.current = null;
                  setDragOver(null);
                  setDragId(null);
                  dropOn(wos.find((w) => w.id === id), col);
                }}
                className={cn(
                  "border p-2 transition-colors",
                  isTarget ? "border-gold/60 bg-gold/[0.05]" : "border-line/60 bg-sidebar",
                )}
              >
                <p className="label-xs flex items-center justify-between px-1 pb-2">
                  {col.label} <span className="tnum">{items.length}</span>
                </p>
                <div className="space-y-2">
                  {items.map((w) => <Card key={w.id} w={w} />)}
                  {items.length === 0 && (
                    <p className="px-1 py-4 text-center text-[11px] text-faint">
                      {isTarget ? `Drop to mark ${col.dropStatus}` : "—"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {view === "List" && (
        <Panel className="mt-5">
          <PanelHead title="All work orders" meta={`${open.length} open · ${wos.length} total`} />
          <DataTable
            minWidth={860}
            columns={[
              { key: "created_at", label: "Created", render: (r) => fmtDate(r.created_at) },
              ...(isPortfolio ? [{ key: "b", label: "Building", render: (r) => bname(r.building_id) }] : []),
              { key: "title", label: "Title" },
              { key: "unit", label: "Location", render: (r) => unitName(r.unit_id) || r.area || "—" },
              { key: "priority", label: "Priority", render: (r) => <PriorityChip p={r.priority} /> },
              { key: "status", label: "Status", render: (r) => <ToneBadge tone={DONE.includes(r.status) ? "ok" : r.status === "Approval Required" ? "warn" : "neutral"}>{r.status}</ToneBadge> },
              { key: "assignee", label: "Assigned", render: (r) => r.assignee || vendorName(r.vendor_id) || "—" },
              { key: "target_date", label: "Target", render: (r) => fmtDate(r.target_date) },
              { key: "est_cost", label: "Est.", align: "right", render: (r) => fmtMoney(r.est_cost) },
              { key: "final_cost", label: "Final", align: "right", render: (r) => fmtMoney(r.final_cost) },
            ]}
            rows={wos}
            onRow={(r) => setModal({ row: r })}
            empty="No work orders yet — create one, or generate one from a violation on the Compliance tab."
          />
        </Panel>
      )}

      {view === "Analytics" && (
        <div className="mt-5">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <SummaryCard label="Open" value={open.length} />
            <SummaryCard label="Open emergencies" value={analytics.emergencies} tone={analytics.emergencies ? "alert" : "ok"} />
            <SummaryCard label="Avg. days to complete" value={analytics.avgDays ?? "—"} unavailable={analytics.avgDays == null} sub={analytics.avgDays == null ? "No completed orders yet" : null} />
            <SummaryCard label="Total final cost" value={fmtMoney(analytics.totalCost)} />
          </div>
          <Panel className="mt-4">
            <PanelHead title="By status" />
            <ul className="grid grid-cols-2 divide-y divide-line/60 sm:grid-cols-3">
              {STATUSES.map((s) => (
                <li key={s} className="flex items-center justify-between px-4 py-2">
                  <span className="text-[12px] text-mid">{s}</span>
                  <span className="tnum text-[13px] text-body">{analytics.byStatus[s]}</span>
                </li>
              ))}
            </ul>
          </Panel>
        </div>
      )}

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.row ? modal.row.title : "New work order"} wide>
        {modal && (
          <>
            {modal.row?.status === "Approval Required" && (
              <div className="mb-4 flex items-center justify-between border border-gold/30 bg-gold/[0.06] px-3.5 py-2.5">
                <p className="text-[12px] text-gold">
                  Approval requested — estimated {fmtMoney(modal.row.est_cost)}
                </p>
                <div className="flex gap-2">
                  <button type="button" className="border border-ok/40 px-2.5 py-1 text-[11px] text-ok hover:bg-ok/10"
                    onClick={() => { quick.mutate({ id: modal.row.id, status: "Approved", approval: { ...(modal.row.approval || {}), decision: "approved", decided_at: new Date().toISOString() } }); setModal(null); }}>
                    Approve
                  </button>
                  <button type="button" className="border border-line px-2.5 py-1 text-[11px] text-mid hover:text-strong"
                    onClick={() => { quick.mutate({ id: modal.row.id, status: "Under Review", approval: { ...(modal.row.approval || {}), decision: "declined", decided_at: new Date().toISOString() } }); setModal(null); }}>
                    Decline
                  </button>
                </div>
              </div>
            )}
            <AutoForm
              fields={[
                ...fields,
                { name: "final_cost", label: "Final cost (required to close)", type: "money", half: true },
                { name: "completion_notes", label: "Completion notes", type: "textarea" },
              ]}
              initial={modal.row ? { ...modal.row, completion_notes: modal.row.completed?.notes } : { priority: "medium", status: "Submitted", entry_permission: false }}
              busy={save.isPending}
              onSubmit={(v) => {
                const { completion_notes, ...rest } = v;
                const payload = { ...rest };
                if (DONE.includes(v.status)) {
                  payload.completed = { notes: completion_notes, date: modal.row?.completed?.date || new Date().toISOString().slice(0, 10), by: v.assignee || "—" };
                }
                submitWo(payload, modal.row);
              }}
              onDelete={modal.row ? () => remove.mutate(modal.row.id) : undefined}
            />
          </>
        )}
      </Modal>
    </div>
  );
};

export default WorkOrdersPage;
