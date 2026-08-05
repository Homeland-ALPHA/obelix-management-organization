import { useState } from "react";
import { Plus } from "lucide-react";
import { fmtDate, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { useList, useSave, useRemove } from "@/lib/hooks";
import { AutoForm, DataTable, GoldButton, Modal, ToneBadge } from "@/components/app/kit";
import { Panel, PanelHead } from "@/components/app/ui";

const FIELDS = [
  { name: "name", label: "Company name", required: true, half: true },
  { name: "category", label: "Service category", type: "select", options: ["plumbing", "electrical", "HVAC", "pest control", "cleaning", "roofing", "general contractor", "elevator", "security", "landscaping", "legal", "other"], half: true },
  { name: "contact", label: "Contact person", half: true },
  { name: "phone", label: "Phone", half: true },
  { name: "email", label: "Email", half: true },
  { name: "address", label: "Address", half: true },
  { name: "insurance_exp", label: "Insurance expires", type: "date", half: true },
  { name: "license_exp", label: "License expires", type: "date", half: true },
  { name: "contract_terms", label: "Contract terms" },
  { name: "rating", label: "Internal rating (1–5)", type: "number", half: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

const ExpBadge = ({ date }) => {
  if (!date) return "—";
  const today = new Date().toISOString().slice(0, 10);
  const soon = new Date(Date.now() + 30 * 864e5).toISOString().slice(0, 10);
  const tone = date < today ? "urgent" : date <= soon ? "warn" : "ok";
  return <ToneBadge tone={tone}>{fmtDate(date, "MMM D, YY")}</ToneBadge>;
};

const VendorsPage = () => {
  const { buildings } = useBuilding();
  const [modal, setModal] = useState(null);
  const [view, setView] = useState(null);
  const { data: vendors = [] } = useList("vendors", null);
  const { data: wos = [] } = useList("work_orders", "portfolio");
  const { data: expenses = [] } = useList("expenses", "portfolio");
  const save = useSave("vendors", { onDone: () => setModal(null) });
  const remove = useRemove("vendors", { onDone: () => setModal(null) });

  const statsFor = (v) => {
    const vwos = wos.filter((w) => w.vendor_id === v.id);
    const vexp = expenses.filter((e) => e.vendor_id === v.id);
    const done = vwos.filter((w) => ["Completed", "Inspected", "Closed"].includes(w.status));
    const avg = done.length && done.every((w) => w.completed?.date)
      ? Math.round(done.reduce((a, w) => a + (new Date(w.completed.date) - new Date(w.created_at)) / 864e5, 0) / done.length)
      : null;
    return {
      open: vwos.length - done.length,
      total_paid: vexp.filter((e) => e.status === "paid").reduce((a, e) => a + (e.amount || 0), 0),
      open_invoices: vexp.filter((e) => e.status !== "paid").length,
      avg_days: avg,
      buildings: [...new Set(vwos.map((w) => buildings.find((b) => b.id === w.building_id)?.label).filter(Boolean))],
      history: vwos,
    };
  };

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs text-gold/90">Vendors</p>
          <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">Directory, insurance and performance.</h1>
        </div>
        <GoldButton className="px-4 py-2 text-[12.5px]" onClick={() => setModal({})}><Plus size={13} /> Add vendor</GoldButton>
      </div>

      <Panel className="mt-6">
        <PanelHead title="Vendor directory" meta={`${vendors.length} vendors · portfolio-wide`} />
        <DataTable
          minWidth={860}
          columns={[
            { key: "name", label: "Vendor" },
            { key: "category", label: "Category" },
            { key: "phone", label: "Phone" },
            { key: "insurance_exp", label: "Insurance", render: (r) => <ExpBadge date={r.insurance_exp} /> },
            { key: "license_exp", label: "License", render: (r) => <ExpBadge date={r.license_exp} /> },
            { key: "open", label: "Open WOs", align: "right", render: (r) => statsFor(r).open || "—" },
            { key: "paid", label: "Total paid", align: "right", render: (r) => fmtMoney(statsFor(r).total_paid) },
            { key: "rating", label: "Rating", align: "right", render: (r) => (r.rating ? `${r.rating}/5` : "—") },
          ]}
          rows={vendors}
          onRow={(r) => setView(r)}
          empty="No vendors yet — add contractors, their insurance and licenses."
        />
      </Panel>

      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.row ? "Edit vendor" : "Add vendor"} wide>
        {modal && (
          <AutoForm
            fields={FIELDS}
            initial={modal.row || {}}
            busy={save.isPending}
            onSubmit={(v) => save.mutate({ ...v, id: modal.row?.id })}
            onDelete={modal.row ? () => remove.mutate(modal.row.id) : undefined}
          />
        )}
      </Modal>

      {view && (
        <Modal open onClose={() => setView(null)} title={view.name} wide>
          {(() => {
            const s = statsFor(view);
            return (
              <div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                  {[
                    ["Category", view.category || "—"],
                    ["Contact", view.contact || view.phone || "—"],
                    ["Open work orders", s.open],
                    ["Open invoices", s.open_invoices],
                    ["Total paid", fmtMoney(s.total_paid)],
                    ["Avg completion", s.avg_days != null ? `${s.avg_days} days` : "—"],
                    ["Buildings served", s.buildings.length || "—"],
                    ["Rating", view.rating ? `${view.rating}/5` : "—"],
                  ].map(([k, v]) => (
                    <div key={k} className="border border-line/70 px-3 py-2">
                      <p className="label-xs">{k}</p>
                      <p className="mt-0.5 truncate text-[13px] text-body">{v}</p>
                    </div>
                  ))}
                </div>
                <p className="label-xs mb-2 mt-4">Work history</p>
                <DataTable
                  minWidth={420}
                  columns={[
                    { key: "created_at", label: "Created", render: (r) => fmtDate(r.created_at) },
                    { key: "title", label: "Title" },
                    { key: "status", label: "Status" },
                    { key: "final_cost", label: "Cost", align: "right", render: (r) => fmtMoney(r.final_cost || r.est_cost) },
                  ]}
                  rows={s.history.slice(0, 10)}
                  empty="No work orders assigned to this vendor yet."
                />
                <div className="mt-4 flex justify-end">
                  <GoldButton className="px-4 py-2 text-[12px]" onClick={() => { setModal({ row: view }); setView(null); }}>Edit vendor</GoldButton>
                </div>
              </div>
            );
          })()}
        </Modal>
      )}
    </div>
  );
};

export default VendorsPage;
