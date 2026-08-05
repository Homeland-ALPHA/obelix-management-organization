import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Landmark, Plus, ReceiptText } from "lucide-react";
import { api } from "@/lib/api";
import { fmtDate, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { useList, useSave, useRemove } from "@/lib/hooks";
import { RequireBuildingSelected } from "@/components/app/guards";
import { FinanceChart } from "@/components/app/FinanceChart";
import { AutoForm, DataTable, EmptyState, GhostButton, GoldButton, Modal, SubTabs, SummaryCard, ToneBadge } from "@/components/app/kit";
import { Panel, PanelHead } from "@/components/app/ui";
import { cn } from "@/lib/utils";

const TABS = ["Dashboard", "Revenue", "Expenses", "Budget", "Mortgage", "Accounts Payable", "Banking", "Statements"];

export const REVENUE_CATEGORIES = ["rent", "subsidy", "commercial_rent", "laundry", "parking", "late_fees", "application_fees", "storage", "other"];
export const EXPENSE_CATEGORIES = [
  "repairs", "utilities", "payroll", "insurance", "property_taxes", "legal", "accounting", "management_fees",
  "pest_control", "cleaning", "security", "elevator", "mortgage_interest", "capital_improvements", "other",
];
const cat = (c) => (c || "—").replace(/_/g, " ");

const useAux = (buildingId) => {
  const { data: units = [] } = useList("units", buildingId);
  const { data: tenants = [] } = useList("tenants", buildingId);
  const { data: vendors = [] } = useList("vendors", null);
  return {
    units,
    tenants,
    vendors,
    unitOpts: units.map((u) => ({ value: u.id, label: `Unit ${u.number}` })),
    tenantOpts: tenants.map((t) => ({ value: t.id, label: t.name })),
    vendorOpts: vendors.map((v) => ({ value: v.id, label: v.name })),
    unitName: (id) => units.find((u) => u.id === id)?.number || "—",
    tenantName: (id) => tenants.find((t) => t.id === id)?.name || "—",
    vendorName: (id) => vendors.find((v) => v.id === id)?.name || "—",
  };
};

/* ------------------------------------------------ dashboard */

/* Headline strip — the four numbers that answer "how is the portfolio doing". */
const HeadlineStat = ({ label, value, tone, unavailable, note }) => (
  <div className="border-r border-line px-5 py-4 last:border-r-0">
    <div className="label-xs">{label}</div>
    <div className={cn("tnum mt-1.5 text-2xl font-semibold tracking-tight", unavailable ? "text-faint" : tone === "alert" ? "text-alert" : "text-strong")}>
      {unavailable ? "—" : value}
    </div>
    {unavailable && note ? <div className="mt-0.5 text-[10.5px] italic text-faint">{note}</div> : null}
  </div>
);

const ArrearsAging = ({ aging }) => {
  const buckets = aging?.buckets || [];
  const hasData = (aging?.total || 0) > 0;
  return (
    <Panel className="h-full">
      <PanelHead title="Arrears aging" meta={hasData ? `${fmtMoney(aging.total)} billed` : undefined} />
      {!hasData ? (
        <p className="px-4 py-8 text-center text-[12px] text-dim">
          No billed revenue yet — record revenue to see how receivables are aging.
        </p>
      ) : (
        <ul className="divide-y divide-line/70">
          {buckets.map((b) => (
            <li key={b.key} className="flex items-center justify-between gap-4 px-4 py-2.5">
              <span className={cn("text-[12.5px]", b.key === "d90_plus" && b.amount > 0 ? "text-alert" : "text-mid")}>{b.label}</span>
              <span className="flex items-baseline gap-3">
                <span className={cn("tnum text-[13px] font-medium", b.amount > 0 && b.key !== "current" ? "text-body" : "text-mid")}>{fmtMoney(b.amount)}</span>
                <span className="tnum w-12 text-right text-[11px] text-dim">{b.pct}%</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  );
};

const Dashboard = ({ buildingId }) => {
  const { data: f = {} } = useQuery({
    queryKey: ["financials", "summary", buildingId],
    queryFn: () => api.get("/financials/summary", { params: { building_id: buildingId } }).then((r) => r.data),
  });
  const na = !f.has_data;
  const cards = [
    ["Gross potential rent", f.gpr != null ? fmtMoney(f.gpr) : null, "Enter the rent roll"],
    ["Expected revenue · month", f.expected_month != null ? fmtMoney(f.expected_month) : null, "Enter the rent roll"],
    ["Actual revenue · month", !na ? fmtMoney(f.collected_month) : null, "Record revenue"],
    ["Collection rate", f.collection_rate != null ? `${f.collection_rate}%` : null, "Needs expected + actual"],
    ["Outstanding arrears", !na ? fmtMoney(f.arrears) : null, "Record revenue"],
    ["Operating expenses · month", !na ? fmtMoney(f.opex_month) : null, "Record expenses"],
    ["Mortgage · month", f.debt_monthly != null ? fmtMoney(f.debt_monthly) : null, "Add a loan"],
    ["Capital expenditures · YTD", !na ? fmtMoney(f.capex_ytd) : null, "Record expenses"],
    ["NOI · month", f.noi_month != null ? fmtMoney(f.noi_month) : null, "Needs revenue + expenses"],
    ["Cash flow after debt", f.cash_flow_month != null ? fmtMoney(f.cash_flow_month) : null, "Needs NOI + loan"],
    ["DSCR", f.dscr != null ? f.dscr : null, "Needs NOI + loan"],
    ["Cash balance", null, "Connection required"],
  ];
  return (
    <div>
      {/* headline strip */}
      <div className="grid grid-cols-2 border border-line bg-panel lg:grid-cols-4">
        <HeadlineStat label="Occupancy" value={f.occupancy != null ? `${f.occupancy}%` : null} unavailable={f.occupancy == null} note="Add units & tenants" />
        <HeadlineStat label="Collections" value={fmtMoney(f.collected_month)} unavailable={na} note="Record revenue" />
        <HeadlineStat label="Outstanding arrears" value={fmtMoney(f.arrears)} tone={f.arrears ? "alert" : null} unavailable={na} note="Record revenue" />
        <HeadlineStat label="Monthly NOI" value={f.noi_month != null ? fmtMoney(f.noi_month) : null} unavailable={f.noi_month == null} note="Needs revenue + expenses" />
      </div>

      {/* performance + receivables */}
      <div className="mt-4 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <FinanceChart buildingId={buildingId} />
        <div className="flex flex-col gap-4">
          <ArrearsAging aging={f.aging} />
          {f.noi_leader && (
            <div className="border border-line bg-panel px-4 py-3.5">
              <div className="label-xs">Building-level NOI leader</div>
              <p className="mt-1.5 text-[13px] text-body">
                {f.noi_leader.label} · <span className="tnum font-medium text-gold">{fmtMoney(f.noi_leader.noi)}</span> monthly NOI
              </p>
            </div>
          )}
        </div>
      </div>

      {/* full metric set */}
      <div className="mt-6 grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
        {cards.map(([label, value, note]) => (
          <SummaryCard key={label} label={label} value={value ?? "—"} unavailable={value == null} sub={value == null ? note : null} />
        ))}
      </div>
    </div>
  );
};

/* ------------------------------------------------ revenue */
const Revenue = ({ buildingId }) => {
  const { data: rows = [] } = useList("revenue", buildingId);
  const aux = useAux(buildingId);
  const [modal, setModal] = useState(null);
  const save = useSave("revenue", { onDone: () => setModal(null) });
  const remove = useRemove("revenue", { onDone: () => setModal(null) });

  const fields = [
    { name: "date", label: "Date", type: "date", required: true, half: true },
    { name: "category", label: "Category", type: "select", options: REVENUE_CATEGORIES.map((c) => ({ value: c, label: cat(c) })), required: true, half: true },
    { name: "unit_id", label: "Unit", type: "select", options: aux.unitOpts, half: true },
    { name: "tenant_id", label: "Tenant", type: "select", options: aux.tenantOpts, half: true },
    { name: "expected", label: "Expected amount", type: "money", half: true },
    { name: "received", label: "Amount received", type: "money", half: true },
    { name: "method", label: "Payment method", type: "select", options: ["ACH", "Check", "Cash", "Card", "Money order", "Other"], half: true },
    { name: "status", label: "Status", type: "select", options: ["paid", "partial", "due"], half: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <Panel>
      <PanelHead title="Revenue" meta={`${rows.length} entries`} right={<GoldButton className="px-3 py-1.5 text-[12px]" onClick={() => setModal({})}><Plus size={12} /> Record revenue</GoldButton>} />
      <DataTable
        columns={[
          { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
          { key: "category", label: "Category", render: (r) => cat(r.category) },
          { key: "unit", label: "Unit", render: (r) => aux.unitName(r.unit_id) },
          { key: "tenant", label: "Tenant", render: (r) => aux.tenantName(r.tenant_id) },
          { key: "expected", label: "Expected", align: "right", render: (r) => fmtMoney(r.expected) },
          { key: "received", label: "Received", align: "right", render: (r) => fmtMoney(r.received) },
          { key: "bal", label: "Balance", align: "right", render: (r) => { const b = (r.expected || 0) - (r.received || 0); return b > 0 ? <span className="text-alert">{fmtMoney(b)}</span> : "—"; } },
          { key: "status", label: "Status", render: (r) => <ToneBadge tone={r.status === "paid" ? "ok" : r.status === "due" ? "urgent" : "warn"}>{r.status || "—"}</ToneBadge> },
        ]}
        rows={rows}
        onRow={(r) => setModal({ row: r })}
        empty="No revenue recorded — record rent payments, subsidies and other income here."
      />
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.row ? "Edit revenue entry" : "Record revenue"} wide>
        {modal && (
          <AutoForm
            fields={fields}
            initial={modal.row || { date: new Date().toISOString().slice(0, 10), status: "paid" }}
            busy={save.isPending}
            onSubmit={(v) => save.mutate({ ...v, id: modal.row?.id, building_id: buildingId })}
            onDelete={modal.row ? () => remove.mutate(modal.row.id) : undefined}
          />
        )}
      </Modal>
    </Panel>
  );
};

/* ------------------------------------------------ expenses */
const Expenses = ({ buildingId, apOnly = false }) => {
  const { data: all = [] } = useList("expenses", buildingId);
  const aux = useAux(buildingId);
  const [modal, setModal] = useState(null);
  const save = useSave("expenses", { onDone: () => setModal(null) });
  const remove = useRemove("expenses", { onDone: () => setModal(null) });
  const quick = useSave("expenses");

  const rows = apOnly ? all.filter((e) => e.status !== "paid") : all;

  const fields = [
    { name: "category", label: "Category", type: "select", options: EXPENSE_CATEGORIES.map((c) => ({ value: c, label: cat(c) })), required: true, half: true },
    { name: "vendor_id", label: "Vendor", type: "select", options: aux.vendorOpts, half: true },
    { name: "unit_id", label: "Unit (optional)", type: "select", options: aux.unitOpts, half: true },
    { name: "invoice_date", label: "Invoice date", type: "date", required: true, half: true },
    { name: "due_date", label: "Due date", type: "date", half: true },
    { name: "amount", label: "Amount", type: "money", required: true, half: true },
    { name: "status", label: "Payment status", type: "select", options: ["unpaid", "paid"], half: true },
    { name: "paid_date", label: "Paid date", type: "date", half: true },
    { name: "method", label: "Payment method", type: "select", options: ["ACH", "Check", "Cash", "Card", "Other"], half: true },
    { name: "approval_status", label: "Approval", type: "select", options: ["none", "pending", "approved", "declined"], half: true },
    { name: "notes", label: "Notes", type: "textarea" },
  ];

  return (
    <Panel>
      <PanelHead
        title={apOnly ? "Accounts payable" : "Expenses"}
        meta={apOnly ? `${rows.length} open · ${fmtMoney(rows.reduce((a, e) => a + (e.amount || 0), 0))}` : `${rows.length} entries`}
        right={<GoldButton className="px-3 py-1.5 text-[12px]" onClick={() => setModal({})}><Plus size={12} /> Record expense</GoldButton>}
      />
      <DataTable
        columns={[
          { key: "invoice_date", label: "Invoice", render: (r) => fmtDate(r.invoice_date) },
          { key: "category", label: "Category", render: (r) => cat(r.category) },
          { key: "vendor", label: "Vendor", render: (r) => aux.vendorName(r.vendor_id) },
          { key: "amount", label: "Amount", align: "right", render: (r) => fmtMoney(r.amount) },
          { key: "due_date", label: "Due", render: (r) => fmtDate(r.due_date) },
          { key: "status", label: "Status", render: (r) => <ToneBadge tone={r.status === "paid" ? "ok" : "warn"}>{r.status || "—"}</ToneBadge> },
          {
            key: "approval", label: "Approval",
            render: (r) =>
              r.approval_status === "pending" ? (
                <span className="flex gap-1.5" onClick={(e) => e.stopPropagation()}>
                  <button type="button" className="border border-ok/40 px-2 py-0.5 text-[10px] text-ok hover:bg-ok/10" onClick={() => quick.mutate({ id: r.id, approval_status: "approved" })}>Approve</button>
                  <button type="button" className="border border-line px-2 py-0.5 text-[10px] text-mid hover:text-strong" onClick={() => quick.mutate({ id: r.id, approval_status: "declined" })}>Decline</button>
                </span>
              ) : r.approval_status && r.approval_status !== "none" ? (
                <ToneBadge tone={r.approval_status === "approved" ? "ok" : "neutral"}>{r.approval_status}</ToneBadge>
              ) : ("—"),
          },
          ...(apOnly
            ? [{
                key: "pay", label: "", align: "right",
                render: (r) => (
                  <button type="button" onClick={(e) => { e.stopPropagation(); quick.mutate({ id: r.id, status: "paid", paid_date: new Date().toISOString().slice(0, 10) }); }} className="border border-gold/50 px-2 py-0.5 text-[10px] text-gold hover:bg-gold/10">
                    Mark paid
                  </button>
                ),
              }]
            : []),
        ]}
        rows={rows}
        onRow={(r) => setModal({ row: r })}
        empty={apOnly ? "No open invoices." : "No expenses recorded yet."}
      />
      <Modal open={!!modal} onClose={() => setModal(null)} title={modal?.row ? "Edit expense" : "Record expense"} wide>
        {modal && (
          <AutoForm
            fields={fields}
            initial={modal.row || { invoice_date: new Date().toISOString().slice(0, 10), status: "unpaid", approval_status: "none" }}
            busy={save.isPending}
            onSubmit={(v) => save.mutate({ ...v, id: modal.row?.id, building_id: buildingId })}
            onDelete={modal.row ? () => remove.mutate(modal.row.id) : undefined}
          />
        )}
      </Modal>
    </Panel>
  );
};

/* ------------------------------------------------ budget */
const Budget = ({ buildingId }) => {
  const year = String(new Date().getFullYear());
  const { data: budgets = [] } = useList("budgets", buildingId);
  const { data: expenses = [] } = useList("expenses", buildingId);
  const { data: revenue = [] } = useList("revenue", buildingId);
  const [period, setPeriod] = useState("Year to date");
  const [editOpen, setEditOpen] = useState(false);
  const save = useSave("budgets", { onDone: () => setEditOpen(false) });

  const budget = budgets.find((b) => String(b.year) === year);
  const lines = budget?.lines || [];

  const inPeriod = (d) => {
    if (!d || !d.startsWith(year)) return false;
    const m = new Date().toISOString().slice(5, 7);
    if (period === "Current month") return d.slice(5, 7) === m;
    if (period === "Year to date") return d.slice(5, 7) <= m;
    return true;
  };
  const frac = period === "Current month" ? 1 / 12 : period === "Year to date" ? new Date().getMonth() + 1 : 12;
  const fracOf = (annual) => ((annual || 0) * frac) / 12;

  const actualFor = (line) =>
    line.kind === "expense"
      ? expenses.filter((e) => e.category === line.category && inPeriod(e.invoice_date)).reduce((a, e) => a + (e.amount || 0), 0)
      : revenue.filter((r) => r.category === line.category && inPeriod(r.date)).reduce((a, r) => a + (r.received || 0), 0);

  const [draft, setDraft] = useState(null);

  return (
    <Panel>
      <PanelHead
        title={`Operating budget · ${year}`}
        meta={budget ? `${lines.length} lines` : "not created"}
        right={
          <div className="flex items-center gap-2">
            <select value={period} onChange={(e) => setPeriod(e.target.value)} className="border border-line bg-panel px-2 py-1 text-[11px] text-mid outline-none">
              {["Current month", "Year to date", "Full year"].map((p) => <option key={p}>{p}</option>)}
            </select>
            <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => { setDraft(lines.length ? [...lines] : [{ category: "rent", kind: "revenue", annual: "" }]); setEditOpen(true); }}>
              {budget ? "Edit budget" : "Create budget"}
            </GhostButton>
          </div>
        }
      />
      {!budget ? (
        <p className="px-4 py-8 text-center text-[12px] text-dim">No budget for {year} yet — create one to compare budget versus actual.</p>
      ) : (
        <DataTable
          columns={[
            { key: "category", label: "Category", render: (r) => `${cat(r.category)} ${r.kind === "revenue" ? "· rev" : ""}` },
            { key: "budget", label: `Budget (${period.toLowerCase()})`, align: "right", render: (r) => fmtMoney(fracOf(r.annual)) },
            { key: "actual", label: "Actual", align: "right", render: (r) => fmtMoney(actualFor(r)) },
            {
              key: "var", label: "Variance", align: "right",
              render: (r) => {
                const b = fracOf(r.annual);
                const a = actualFor(r);
                const v = r.kind === "expense" ? b - a : a - b;
                return <span className={v < 0 ? "text-alert" : "text-body"}>{fmtMoney(v)}</span>;
              },
            },
            {
              key: "varp", label: "Var %", align: "right",
              render: (r) => {
                const b = fracOf(r.annual);
                if (!b) return "—";
                const a = actualFor(r);
                const v = ((r.kind === "expense" ? b - a : a - b) / b) * 100;
                return `${v.toFixed(0)}%`;
              },
            },
          ]}
          rows={lines.map((l, i) => ({ ...l, id: i }))}
        />
      )}
      <Modal open={editOpen} onClose={() => setEditOpen(false)} title={`Budget lines · ${year}`} wide>
        {draft && (
          <div>
            <div className="max-h-[380px] space-y-2 overflow-y-auto pr-1">
              {draft.map((l, i) => (
                <div key={i} className="grid grid-cols-[1fr_110px_120px_32px] items-center gap-2">
                  <select value={l.category} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, category: e.target.value } : x)))} className="border border-line bg-panel px-2.5 py-2 text-[12px] text-strong outline-none">
                    {(l.kind === "revenue" ? REVENUE_CATEGORIES : EXPENSE_CATEGORIES).map((c) => <option key={c} value={c}>{cat(c)}</option>)}
                  </select>
                  <select value={l.kind} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, kind: e.target.value, category: e.target.value === "revenue" ? "rent" : "repairs" } : x)))} className="border border-line bg-panel px-2.5 py-2 text-[12px] text-strong outline-none">
                    <option value="revenue">Revenue</option>
                    <option value="expense">Expense</option>
                  </select>
                  <input value={l.annual ?? ""} onChange={(e) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, annual: e.target.value } : x)))} placeholder="Annual $" inputMode="decimal" className="border border-line bg-panel px-2.5 py-2 text-[12px] text-strong outline-none" />
                  <button type="button" onClick={() => setDraft((d) => d.filter((_, j) => j !== i))} className="text-dim hover:text-alert">×</button>
                </div>
              ))}
            </div>
            <div className="mt-4 flex items-center justify-between">
              <GhostButton className="px-3 py-1.5 text-[12px]" onClick={() => setDraft((d) => [...d, { category: "repairs", kind: "expense", annual: "" }])}>
                <Plus size={12} /> Add line
              </GhostButton>
              <GoldButton
                className="px-5 py-2 text-[12px]"
                disabled={save.isPending}
                onClick={() =>
                  save.mutate({
                    id: budget?.id,
                    building_id: buildingId,
                    year,
                    lines: draft.map((l) => ({ ...l, annual: parseFloat(String(l.annual).replace(/[$,]/g, "")) || 0 })),
                  })
                }
              >
                Save budget
              </GoldButton>
            </div>
          </div>
        )}
      </Modal>
    </Panel>
  );
};

/* ------------------------------------------------ mortgage */
const Mortgage = ({ buildingId }) => {
  const { data: loans = [] } = useList("loans", buildingId);
  const { selected } = useBuilding();
  const { data: f = {} } = useQuery({
    queryKey: ["financials", "summary", buildingId],
    queryFn: () => api.get("/financials/summary", { params: { building_id: buildingId } }).then((r) => r.data),
  });
  const value = (selected?.summary || {}).market_value;
  const ltv = value && f.debt_balance ? `${Math.round((f.debt_balance / value) * 100)}%` : null;

  if (loans.length === 0) {
    return (
      <EmptyState icon={Landmark} title="No financing recorded." body="Add the mortgage under Building Profile → Financing to see balance, payments, DSCR and LTV here.">
        <Link to="/app/profile"><GhostButton>Open Building Profile</GhostButton></Link>
      </EmptyState>
    );
  }
  const payments = loans.flatMap((l) => (l.payments || []).map((p) => ({ ...p, lender: l.lender }))).sort((a, b) => (b.date || "").localeCompare(a.date || ""));
  const paid = payments.reduce((a, p) => ({ p: a.p + (p.principal || 0), i: a.i + (p.interest || 0) }), { p: 0, i: 0 });

  return (
    <div>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <SummaryCard label="Outstanding balance" value={fmtMoney(f.debt_balance)} />
        <SummaryCard label="Monthly payment" value={fmtMoney(f.debt_monthly)} />
        <SummaryCard label="Next payment" value={f.next_payment ? fmtDate(f.next_payment) : "—"} unavailable={!f.next_payment} />
        <SummaryCard label="Principal paid" value={fmtMoney(paid.p)} />
        <SummaryCard label="Interest paid" value={fmtMoney(paid.i)} />
        <SummaryCard label="DSCR" value={f.dscr ?? "—"} unavailable={f.dscr == null} sub={f.dscr == null ? "Needs revenue & expenses" : null} />
        <SummaryCard label="Loan-to-value" value={ltv ?? "—"} unavailable={!ltv} sub={!ltv ? "Needs DOF value" : "vs DOF market value"} />
        <SummaryCard label="Loans" value={loans.length} />
      </div>
      <Panel className="mt-5">
        <PanelHead title="Payment history" meta={`${payments.length} payments`} right={<Link to="/app/profile" className="label-xs text-dim hover:text-gold">Manage loans</Link>} />
        <DataTable
          columns={[
            { key: "date", label: "Date", render: (r) => fmtDate(r.date) },
            { key: "lender", label: "Lender" },
            { key: "amount", label: "Amount", align: "right", render: (r) => fmtMoney(r.amount) },
            { key: "principal", label: "Principal", align: "right", render: (r) => fmtMoney(r.principal) },
            { key: "interest", label: "Interest", align: "right", render: (r) => fmtMoney(r.interest) },
            { key: "escrow", label: "Escrow", align: "right", render: (r) => fmtMoney(r.escrow) },
          ]}
          rows={payments}
          empty="No payments recorded — record them from Building Profile → Financing."
        />
      </Panel>
    </div>
  );
};

/* ------------------------------------------------ page */
const FinancialsInner = () => {
  const { selectedId } = useBuilding();
  const [tab, setTab] = useState("Dashboard");
  return (
    <div>
      <p className="label-xs text-gold/90">Financials</p>
      <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">Complete financial view.</h1>
      <div className="mt-5">
        <SubTabs tabs={TABS} active={tab} onChange={setTab} />
      </div>
      <div className="mt-5">
        {tab === "Dashboard" && <Dashboard buildingId={selectedId} />}
        {tab === "Revenue" && <Revenue buildingId={selectedId} />}
        {tab === "Expenses" && <Expenses buildingId={selectedId} />}
        {tab === "Budget" && <Budget buildingId={selectedId} />}
        {tab === "Mortgage" && <Mortgage buildingId={selectedId} />}
        {tab === "Accounts Payable" && <Expenses buildingId={selectedId} apOnly />}
        {tab === "Banking" && (
          <EmptyState icon={Landmark} title="Connection required." body="No bank account is connected. Banking balances and transactions will appear here once a connection is added — values are never shown as zero when the source is missing." />
        )}
        {tab === "Statements" && (
          <EmptyState icon={ReceiptText} title="Statements are generated in Reports." body="Monthly owner statements and income & expense exports are available on the Reports tab.">
            <Link to="/app/reports"><GhostButton>Open Reports</GhostButton></Link>
          </EmptyState>
        )}
      </div>
    </div>
  );
};

const FinancialsPage = () => (
  <RequireBuildingSelected pageName="Financials">
    <FinancialsInner />
  </RequireBuildingSelected>
);

export default FinancialsPage;
