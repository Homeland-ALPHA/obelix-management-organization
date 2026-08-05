import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Pencil, Plus } from "lucide-react";
import { toast } from "sonner";
import { api, apiError } from "@/lib/api";
import { fmtDate, fmtInt, fmtMoney } from "@/lib/fmt";
import { useBuilding } from "@/context/BuildingContext";
import { useList, useSave, useRemove } from "@/lib/hooks";
import { RequireBuildingSelected } from "@/components/app/guards";
import { AutoForm, DataTable, Expandable, GhostButton, Modal, SourceTag } from "@/components/app/kit";
import { Panel } from "@/components/app/ui";
import { cn } from "@/lib/utils";

const Ledger = ({ rows }) => (
  <ul className="grid grid-cols-1 divide-y divide-line/70 md:grid-cols-2 md:divide-y-0">
    {rows.map(([label, value, note], i) => (
      <li key={label} className={cn("flex items-center justify-between gap-4 px-4 py-2.5", i % 2 === 0 ? "md:border-r md:border-line/70" : "", "md:border-b md:border-line/70")}>
        <span className="text-[12px] text-dim">{label}</span>
        <span className="text-right text-[13px] text-body">
          {value ?? <span className="italic text-faint">{note || "Not entered"}</span>}
        </span>
      </li>
    ))}
  </ul>
);

const OWNERSHIP_FIELDS = [
  { name: "legal_owner", label: "Legal owner", half: true },
  { name: "entity", label: "Ownership entity", half: true },
  { name: "managing_agent", label: "Managing agent", half: true },
  { name: "management_company", label: "Management company", half: true },
  { name: "property_manager", label: "Property manager", half: true },
  { name: "superintendent", label: "Superintendent", half: true },
  { name: "emergency_contact", label: "Emergency contact", half: true },
  { name: "ownership_pct", label: "Ownership %", type: "number", half: true },
  { name: "acquisition_date", label: "Acquisition date", type: "date", half: true },
  { name: "acquisition_price", label: "Acquisition price", type: "money", half: true },
];

const UTILITY_FIELDS = [
  { name: "heating", label: "Heating system", half: true },
  { name: "boiler", label: "Boiler", half: true },
  { name: "fuel", label: "Fuel type", half: true },
  { name: "elevator", label: "Elevator", half: true },
  { name: "fire_alarm", label: "Fire alarm", half: true },
  { name: "sprinkler", label: "Sprinkler", half: true },
  { name: "intercom", label: "Intercom", half: true },
  { name: "cameras", label: "Security cameras", half: true },
  { name: "water_meters", label: "Water meters", half: true },
  { name: "gas_meters", label: "Gas meters", half: true },
  { name: "electric_meters", label: "Electric meters", half: true },
  { name: "internet", label: "Internet provider", half: true },
  { name: "waste", label: "Waste collection", half: true },
];

const LOAN_FIELDS = [
  { name: "lender", label: "Lender", required: true, half: true },
  { name: "loan_type", label: "Loan type", half: true },
  { name: "original_principal", label: "Original principal", type: "money", half: true },
  { name: "balance", label: "Outstanding balance", type: "money", half: true },
  { name: "rate", label: "Interest rate %", type: "number", half: true },
  { name: "fixed", label: "Fixed rate", type: "toggle", half: true },
  { name: "monthly_payment", label: "Monthly payment", type: "money", half: true },
  { name: "escrow", label: "Escrow payment", type: "money", half: true },
  { name: "amortization_years", label: "Amortization (years)", type: "number", half: true },
  { name: "maturity_date", label: "Maturity date", type: "date", half: true },
  { name: "next_payment_date", label: "Next payment date", type: "date", half: true },
  { name: "notes", label: "Notes", type: "textarea" },
];

const PAYMENT_FIELDS = [
  { name: "date", label: "Date", type: "date", required: true, half: true },
  { name: "amount", label: "Total amount", type: "money", required: true, half: true },
  { name: "principal", label: "Principal", type: "money", half: true },
  { name: "interest", label: "Interest", type: "money", half: true },
  { name: "escrow", label: "Escrow", type: "money", half: true },
  { name: "method", label: "Method", half: true },
];

const SectionEdit = ({ title, open, onClose, fields, initial, onSubmit, busy }) => (
  <Modal open={open} onClose={onClose} title={title} wide>
    <AutoForm fields={fields} initial={initial} onSubmit={onSubmit} busy={busy} />
  </Modal>
);

const ProfileInner = () => {
  const { selected: b, selectedId } = useBuilding();
  const qc = useQueryClient();
  const [editing, setEditing] = useState(null); // 'details' | 'ownership' | 'utilities' | 'valuation'
  const [loanModal, setLoanModal] = useState(null); // {loan?} | null
  const [payModal, setPayModal] = useState(null); // loan doc

  const p = b.profile || {};
  const own = b.ownership || {};
  const util = b.utilities || {};
  const valUser = b.valuation_user || {};
  const s = b.summary || {};

  const { data: loans = [] } = useList("loans", selectedId);
  const { data: rentroll } = useQuery({
    queryKey: ["rentroll", selectedId],
    queryFn: () => api.get("/rentroll", { params: { building_id: selectedId } }).then((r) => r.data),
  });
  const { data: expenses = [] } = useList("expenses", selectedId);

  const patch = useMutation({
    mutationFn: (payload) => api.patch(`/buildings/${b.id}`, payload).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries();
      setEditing(null);
      toast.success("Building profile updated");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  const saveLoan = useSave("loans", { onDone: () => setLoanModal(null) });
  const removeLoan = useRemove("loans", { onDone: () => setLoanModal(null) });
  const addPayment = useMutation({
    mutationFn: ({ loanId, ...values }) => api.post(`/e/loans/${loanId}/payments`, values).then((r) => r.data),
    onSuccess: () => {
      qc.invalidateQueries();
      setPayModal(null);
      toast.success("Payment recorded");
    },
    onError: (e) => toast.error(apiError(e)),
  });

  // stabilized value
  const gpr = useMemo(() => (rentroll?.rows || []).reduce((a, r) => a + (parseFloat(r.current_rent) || 0), 0), [rentroll]);
  const opexT12 = useMemo(() => {
    const floor = new Date(Date.now() - 365 * 864e5).toISOString().slice(0, 7);
    return expenses
      .filter((e) => (e.invoice_date || "").slice(0, 7) >= floor && !["mortgage_interest", "capital_improvements"].includes(e.category))
      .reduce((a, e) => a + (parseFloat(e.amount) || 0), 0);
  }, [expenses]);
  const capRate = parseFloat(valUser.cap_rate) || null;
  const vacancy = parseFloat(valUser.vacancy_pct) || 0;
  const stabilized = gpr && opexT12 && capRate ? ((gpr * 12 * (1 - vacancy / 100) - opexT12) / (capRate / 100)) : null;
  const missing = [!gpr && "rent roll", !opexT12 && "operating expenses", !capRate && "cap rate"].filter(Boolean);

  const bblParts = b.bbl ? { block: String(parseInt(b.bbl.slice(1, 6), 10)), lot: String(parseInt(b.bbl.slice(6, 10), 10)) } : {};
  const totalPaid = (l) => (l.payments || []).reduce((a, x) => ({ p: a.p + (parseFloat(x.principal) || 0), i: a.i + (parseFloat(x.interest) || 0) }), { p: 0, i: 0 });

  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="label-xs text-gold/90">Building profile</p>
          <h1 className="mt-1.5 font-serif text-3xl font-light tracking-tight text-strong">{b.label}</h1>
        </div>
        <SourceTag source="PLUTO · HPD · DOF" syncedAt={b.last_synced} />
      </div>

      <div className="mt-6 space-y-4">
        {/* -------- property details */}
        <Expandable
          title="Property details"
          meta="city record"
          defaultOpen
          right={
            <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => setEditing("details")}>
              <Pencil size={11} strokeWidth={1.5} /> Edit
            </GhostButton>
          }
        >
          <Ledger
            rows={[
              ["Building name", b.label],
              ["Address", `${b.housenumber || ""} ${b.street || ""}`.trim() || null],
              ["Borough", b.borough],
              ["Block / lot", b.bbl ? `${bblParts.block} / ${bblParts.lot}` : null],
              ["BIN", b.bin || null],
              ["BBL", b.bbl],
              ["Property type", b.property_type, "Not entered"],
              ["Year built", p.year_built],
              ["Residential units", fmtInt(p.units_res)],
              ["Total units", fmtInt(p.units_total)],
              ["Commercial units", b.commercial_units ?? (p.units_total && p.units_res ? p.units_total - p.units_res : null)],
              ["Stories", p.floors],
              ["Gross sq ft", p.bldg_area ? `${fmtInt(p.bldg_area)} sq ft` : null],
              ["Lot sq ft", p.lot_area ? `${fmtInt(p.lot_area)} sq ft` : null],
              ["Building class", p.building_class],
              ["HPD registration", b.registration_id && b.registration_id !== "0" ? b.registration_id : null, s.registration_current ? "Current" : "Not registered"],
              ["Rent stabilization", (rentroll?.rows || []).some((r) => r.stabilized) ? "Stabilized units on roll" : null, "Unknown — set per tenant"],
            ]}
          />
        </Expandable>

        {/* -------- ownership */}
        <Expandable
          title="Ownership & management"
          meta={own.legal_owner || p.owner ? undefined : "not entered"}
          right={
            <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => setEditing("ownership")}>
              <Pencil size={11} strokeWidth={1.5} /> Edit
            </GhostButton>
          }
        >
          <Ledger
            rows={[
              ["Owner of record (DOF)", p.owner],
              ["Legal owner", own.legal_owner],
              ["Ownership entity", own.entity],
              ["Managing agent", own.managing_agent],
              ["Management company", own.management_company],
              ["Property manager", own.property_manager],
              ["Superintendent", own.superintendent],
              ["Emergency contact", own.emergency_contact],
              ["Ownership %", own.ownership_pct ? `${own.ownership_pct}%` : null],
              ["Acquisition date", own.acquisition_date ? fmtDate(own.acquisition_date) : null],
              ["Acquisition price", own.acquisition_price ? fmtMoney(own.acquisition_price) : null],
            ]}
          />
        </Expandable>

        {/* -------- financing */}
        <Expandable
          title="Financing"
          meta={loans.length ? `${loans.length} loan${loans.length === 1 ? "" : "s"}` : "no loans added"}
          defaultOpen={loans.length > 0}
          right={
            <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => setLoanModal({})}>
              <Plus size={11} strokeWidth={1.5} /> Add loan
            </GhostButton>
          }
        >
          {loans.length === 0 ? (
            <p className="px-4 py-6 text-center text-[12px] text-dim">No financing recorded — add the mortgage to track balance, payments and DSCR.</p>
          ) : (
            <div className="divide-y divide-line/70">
              {loans.map((l) => {
                const tp = totalPaid(l);
                return (
                  <div key={l.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[13px] font-medium text-strong">{l.lender} <span className="label-xs ml-2">{l.loan_type || "mortgage"}{l.fixed ? " · fixed" : ""}</span></p>
                      <div className="flex gap-2">
                        <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => setPayModal(l)}>Record payment</GhostButton>
                        <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => setLoanModal({ loan: l })}><Pencil size={11} strokeWidth={1.5} /> Edit</GhostButton>
                      </div>
                    </div>
                    <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4">
                      {[
                        ["Outstanding balance", fmtMoney(l.balance)],
                        ["Monthly payment", fmtMoney(l.monthly_payment)],
                        ["Rate", l.rate ? `${l.rate}%` : "—"],
                        ["Maturity", l.maturity_date ? fmtDate(l.maturity_date) : "—"],
                        ["Principal paid", fmtMoney(tp.p)],
                        ["Interest paid", fmtMoney(tp.i)],
                        ["Next payment", l.next_payment_date ? fmtDate(l.next_payment_date) : "—"],
                        ["Payments recorded", (l.payments || []).length],
                      ].map(([k, v]) => (
                        <div key={k} className="border border-line/70 px-3 py-2">
                          <p className="label-xs">{k}</p>
                          <p className="tnum mt-0.5 text-[13px] text-body">{v}</p>
                        </div>
                      ))}
                    </div>
                    {(l.payments || []).length > 0 && (
                      <div className="mt-3">
                        <DataTable
                          minWidth={480}
                          columns={[
                            { key: "date", label: "Date" },
                            { key: "amount", label: "Amount", align: "right", render: (r) => fmtMoney(r.amount) },
                            { key: "principal", label: "Principal", align: "right", render: (r) => fmtMoney(r.principal) },
                            { key: "interest", label: "Interest", align: "right", render: (r) => fmtMoney(r.interest) },
                            { key: "escrow", label: "Escrow", align: "right", render: (r) => fmtMoney(r.escrow) },
                          ]}
                          rows={[...(l.payments || [])].sort((a, c) => (c.date || "").localeCompare(a.date || ""))}
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </Expandable>

        {/* -------- valuation */}
        <Expandable
          title="Valuation"
          meta="DOF + user entered"
          defaultOpen
          right={
            <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => setEditing("valuation")}>
              <Pencil size={11} strokeWidth={1.5} /> Edit assumptions
            </GhostButton>
          }
        >
          <div className="px-4 pt-3">
            <SourceTag source="NYC DOF assessment roll" syncedAt={b.last_synced} />
          </div>
          <Ledger
            rows={[
              ["DOF market value", s.market_value ? fmtMoney(s.market_value) : null, "Source did not return a value"],
              ["Assessed value", s.assessed_value ? fmtMoney(s.assessed_value) : null, "Source did not return a value"],
              ["Acquisition value", own.acquisition_price ? fmtMoney(own.acquisition_price) : null],
              ["Your market value", valUser.market_value ? fmtMoney(valUser.market_value) : null],
              ["Assumed cap rate", capRate ? `${capRate}%` : null],
              ["Assumed vacancy", valUser.vacancy_pct ? `${valUser.vacancy_pct}%` : null],
              ["Value per unit", s.market_value && p.units_res ? fmtMoney(s.market_value / p.units_res) : null],
              ["Value per sq ft", s.market_value && p.bldg_area ? `$${Math.round(s.market_value / p.bldg_area)}` : null],
            ]}
          />
          <div className="border-t border-line px-4 py-3">
            <p className="label-xs">Stabilized value</p>
            {stabilized ? (
              <p className="tnum mt-1 text-lg font-semibold text-gold">{fmtMoney(stabilized)}</p>
            ) : (
              <p className="mt-1 text-[12px] italic text-dim">Requires {missing.join(", ")} before it can be calculated.</p>
            )}
            <p className="mt-1.5 text-[11px] text-dim">
              Stabilized Value = Stabilized NOI ÷ Assumed Capitalization Rate — NOI from annualized rent roll
              (less {vacancy || 0}% vacancy) minus trailing-12-month operating expenses.
            </p>
          </div>
        </Expandable>

        {/* -------- utilities */}
        <Expandable
          title="Utilities & building systems"
          meta={Object.values(util).some(Boolean) ? undefined : "not entered"}
          right={
            <GhostButton className="px-2.5 py-1 text-[11px]" onClick={() => setEditing("utilities")}>
              <Pencil size={11} strokeWidth={1.5} /> Edit
            </GhostButton>
          }
        >
          <Ledger rows={UTILITY_FIELDS.map((f) => [f.label, util[f.name]])} />
        </Expandable>
      </div>

      {/* modals */}
      <SectionEdit
        title="Edit property details"
        open={editing === "details"}
        onClose={() => setEditing(null)}
        fields={[
          { name: "label", label: "Building name", required: true },
          { name: "property_type", label: "Property type", type: "select", options: ["Multifamily", "Mixed use", "Commercial", "Condo / co-op", "Other"], half: true },
          { name: "commercial_units", label: "Commercial units", type: "number", half: true },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        initial={b}
        onSubmit={(v) => patch.mutate(v)}
        busy={patch.isPending}
      />
      <SectionEdit title="Edit ownership & management" open={editing === "ownership"} onClose={() => setEditing(null)} fields={OWNERSHIP_FIELDS} initial={own} onSubmit={(v) => patch.mutate({ ownership: v })} busy={patch.isPending} />
      <SectionEdit title="Edit utilities & systems" open={editing === "utilities"} onClose={() => setEditing(null)} fields={UTILITY_FIELDS} initial={util} onSubmit={(v) => patch.mutate({ utilities: v })} busy={patch.isPending} />
      <SectionEdit
        title="Valuation assumptions"
        open={editing === "valuation"}
        onClose={() => setEditing(null)}
        fields={[
          { name: "market_value", label: "Your market value", type: "money", half: true },
          { name: "cap_rate", label: "Assumed cap rate %", type: "number", half: true },
          { name: "vacancy_pct", label: "Assumed vacancy %", type: "number", half: true },
        ]}
        initial={valUser}
        onSubmit={(v) => patch.mutate({ valuation_user: v })}
        busy={patch.isPending}
      />

      <Modal open={!!loanModal} onClose={() => setLoanModal(null)} title={loanModal?.loan ? "Edit loan" : "Add loan"} wide>
        {loanModal && (
          <AutoForm
            fields={LOAN_FIELDS}
            initial={loanModal.loan || {}}
            busy={saveLoan.isPending}
            onSubmit={(v) => saveLoan.mutate({ ...v, id: loanModal.loan?.id, building_id: b.id })}
            onDelete={loanModal.loan ? () => removeLoan.mutate(loanModal.loan.id) : undefined}
            deleteLabel="Delete loan"
          />
        )}
      </Modal>

      <Modal open={!!payModal} onClose={() => setPayModal(null)} title={`Record payment · ${payModal?.lender || ""}`}>
        {payModal && (
          <AutoForm
            fields={PAYMENT_FIELDS}
            initial={{ amount: payModal.monthly_payment }}
            busy={addPayment.isPending}
            onSubmit={(v) => addPayment.mutate({ loanId: payModal.id, ...v })}
            submitLabel="Record payment"
          />
        )}
      </Modal>
    </div>
  );
};

const ProfilePage = () => (
  <RequireBuildingSelected pageName="Building Profile">
    <ProfileInner />
  </RequireBuildingSelected>
);

export default ProfilePage;
